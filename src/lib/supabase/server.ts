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
 * IMPORTANT: Always add explicit .eq('company_id', companyId) filters
 * to ensure proper data isolation when working with company-scoped data.
 * 
 * @example
 * ```tsx
 * import { createServiceRoleClient } from '@/lib/supabase/server'
 * 
 * // Only after verifying user is admin
 * const supabase = createServiceRoleClient()
 * 
 * // Always filter by company_id for company-scoped data
 * const { data } = await supabase
 *   .from('work_orders')
 *   .select()
 *   .eq('company_id', user.companyId)
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
