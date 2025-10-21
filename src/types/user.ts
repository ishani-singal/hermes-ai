/**
 * User profile (extends Supabase auth.users)
 */
export interface User {
  id: string // UUID, matches auth.users.id
  email: string
  full_name: string
  default_company_id: string | null // FK to companies
  created_at: string
  updated_at: string
}
