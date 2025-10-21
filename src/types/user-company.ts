/**
 * User roles within a company
 */
export type UserRole = 'admin' | 'editor' | 'viewer'

/**
 * User-Company relationship (junction table)
 * Supports users belonging to multiple companies
 */
export interface UserCompany {
  id: string // UUID
  user_id: string // FK to users
  company_id: string // FK to companies
  role: UserRole
  is_active: boolean
  created_at: string
  updated_at: string
}
