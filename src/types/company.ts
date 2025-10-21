/**
 * Company/Organization
 */
export interface Company {
  id: string // UUID
  name: string
  primary_contact_email: string // Fallback contact for support/billing
  created_at: string
  updated_at: string
}
