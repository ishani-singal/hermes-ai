import { UserRole } from './user-company'

/**
 * Invite status derived from used_at and expires_at
 */
export type InviteStatus = 'pending' | 'accepted' | 'expired'

/**
 * Database invite record
 */
export interface Invite {
  id: string // UUID
  company_id: string // FK to companies
  email: string
  role: UserRole
  token: string
  expires_at: string // ISO timestamp
  used_at: string | null // ISO timestamp, null if pending
  created_by: string | null // FK to users, null if creator deleted
  created_at: string
  updated_at: string
}

/**
 * Invite with computed status and optional relations
 */
export interface InviteWithDetails extends Invite {
  status: InviteStatus
  company?: {
    id: string
    name: string
    company_code: string
  }
  creator?: {
    id: string
    full_name: string | null
    email: string
  }
}

/**
 * Request to create a new invite
 */
export interface CreateInviteRequest {
  email: string
  role: UserRole
}

/**
 * Request to update an existing invite (regenerates token)
 */
export interface UpdateInviteRequest {
  email?: string
  role?: UserRole
}

/**
 * Response when creating/updating an invite
 */
export interface InviteResponse {
  invite: InviteWithDetails
  inviteLink: string
}

/**
 * Public invite validation response (for signup page)
 */
export interface InviteValidation {
  valid: boolean
  invite?: {
    email: string
    role: UserRole
    company: {
      id: string
      name: string
    }
  }
  error?: string
}

/**
 * Request to accept an invite and create account
 */
export interface AcceptInviteRequest {
  token: string
  fullName: string
  password: string
}

/**
 * Helper to compute invite status
 */
export function getInviteStatus(invite: Invite): InviteStatus {
  if (invite.used_at) {
    return 'accepted'
  }
  if (new Date(invite.expires_at) < new Date()) {
    return 'expired'
  }
  return 'pending'
}
