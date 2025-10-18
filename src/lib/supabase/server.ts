import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY!

if (!supabaseUrl || !supabaseSecretKey) {
  throw new Error('Missing Supabase secret key environment variables')
}

// Server-side Supabase client (uses secret key - elevated access)
// WARNING: This bypasses RLS policies. Use only in API routes/server components.
export const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})
