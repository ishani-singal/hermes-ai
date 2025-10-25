import { createServerClient as createSupabaseServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

/**
 * Create a server-side Supabase client (uses publishable key with cookies)
 * 
 * Use this in server components, API routes, and server actions for:
 * - User-scoped queries (respects RLS)
 * - Cookie-based authentication
 * - Server-side rendering with user context
 * 
 * @example
 * ```tsx
 * import { createServerClient } from '@/lib/supabase/server'
 * 
 * const supabase = await createServerClient()
 * const { data } = await supabase.from('table').select()
 * ```
 */
export async function createServerClient() {
  const cookieStore = await cookies()

  return createSupabaseServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}

/**
 * Create a Supabase client with service role key (ADMIN ACCESS)
 * 
 * ⚠️ BYPASSES ALL ROW LEVEL SECURITY (RLS) - Use with extreme caution
 * 
 * Use this ONLY for:
 * - Operations that require bypassing RLS (e.g., user signup)
 * - After proper authorization checks in your code
 * - Admin operations that need unrestricted access
 * 
 * Consider using createScopedServiceRoleClient() for safer admin operations.
 * 
 * @example
 * ```tsx
 * import { createServiceRoleClient } from '@/lib/supabase/server'
 * 
 * // Only after verifying user is admin
 * const supabase = createServiceRoleClient()
 * const { data } = await supabase.from('table').select()
 * ```
 */
export function createServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!supabaseServiceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is not set');
  }

  return createSupabaseClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Create a company-scoped service role client (SAFER ADMIN ACCESS)
 * 
 * Automatically injects company_id filter to all queries for data isolation.
 * This provides defense-in-depth security by preventing accidental cross-company data leaks.
 * 
 * ⚠️ Still bypasses RLS, but auto-scopes to a single company
 * 
 * Use this for:
 * - Admin operations within a specific company
 * - Bypassing RLS while maintaining company isolation
 * - Preventing accidental cross-company data access
 * 
 * @param companyId - The company ID to scope all queries to
 * @returns A Supabase client that automatically filters by company_id
 * 
 * @example
 * ```typescript
 * const supabase = createScopedServiceRoleClient(user.companyId);
 * 
 * // Automatically adds .eq('company_id', user.companyId)
 * const { data } = await supabase.from('work_orders').select('*');
 * ```
 */
export function createScopedServiceRoleClient(companyId: string) {
  const client = createServiceRoleClient();
  
  // Create a proxy that intercepts the 'from' method
  return new Proxy(client, {
    get(target, prop) {
      if (prop === 'from') {
        return (table: string) => {
          const query = target.from(table);
          
          // Intercept query builder methods to auto-inject company_id
          return new Proxy(query, {
            get(queryTarget, queryProp) {
              const original = queryTarget[queryProp as keyof typeof queryTarget];
              
              // Intercept methods that execute queries
              if (
                typeof original === 'function' &&
                ['select', 'insert', 'update', 'upsert', 'delete'].includes(queryProp as string)
              ) {
                return function(this: typeof queryTarget, ...args: unknown[]) {
                  // Call the original method
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const result = (original as (...args: unknown[]) => any).apply(this, args);
                  
                  // Auto-inject company_id filter for select/update/delete
                  // For insert/upsert, we'll handle it differently
                  if (queryProp === 'insert' || queryProp === 'upsert') {
                    // For insert/upsert, inject company_id into the data
                    const data = args[0];
                    if (Array.isArray(data)) {
                      args[0] = data.map(item => ({ ...item, company_id: companyId }));
                    } else if (typeof data === 'object' && data !== null) {
                      args[0] = { ...data, company_id: companyId };
                    }
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    return (original as (...args: unknown[]) => any).apply(queryTarget, args);
                  } else if (queryProp === 'select' || queryProp === 'update' || queryProp === 'delete') {
                    // For select/update/delete, add eq filter
                    return result.eq('company_id', companyId);
                  }
                  
                  return result;
                };
              }
              
              return original;
            }
          });
        };
      }
      
      return target[prop as keyof typeof target];
    }
  });
}