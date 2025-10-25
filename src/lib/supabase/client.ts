import { createBrowserClient as createSupabaseBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error('Missing Supabase environment variables')
}

/**
 * Create a browser-side Supabase client (uses publishable key - safe for browser)
 * 
 * Use this in client components ('use client') for:
 * - Client-side auth state management
 * - Real-time subscriptions
 * - Browser-initiated queries
 * 
 * @example
 * ```tsx
 * 'use client'
 * import { createBrowserClient } from '@/lib/supabase/client'
 * 
 * const supabase = createBrowserClient()
 * const { data } = await supabase.from('table').select()
 * ```
 */
export function createBrowserClient() {
  return createSupabaseBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
}