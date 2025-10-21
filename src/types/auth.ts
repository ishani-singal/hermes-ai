import type { User } from './user'
import type { Company } from './company'

/**
 * Sign up request body
 */
export interface SignUpRequest {
  email: string
  password: string
  fullName: string
  companyName: string
}

/**
 * Sign up response
 */
export interface SignUpResponse {
  user: User
  company: Company
}

/**
 * Sign in request body
 */
export interface SignInRequest {
  email: string
  password: string
}

/**
 * Sign in response
 */
export interface SignInResponse {
  user: User
  companies: Array<{
    id: string
    company_id: string
    role: 'admin' | 'editor' | 'viewer'
    company: Company
  }>
}
