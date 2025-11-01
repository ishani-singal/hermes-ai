/**
 * Company/Organization
 */
export interface Company {
  id: string // UUID
  name: string
  company_code: string // User-facing short code (e.g., "ACME")
  primary_contact_email: string // Fallback contact for support/billing
  created_at: string
  updated_at: string
}
