'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User as SupabaseUser, Session } from '@supabase/supabase-js'
import { createBrowserClient } from '@/lib/supabase/client'
import type { User, Company, UserCompany, UserRole } from '@/types'

// ============================================
// TYPES
// ============================================

interface AuthContextType {
  // Auth state
  user: User | null
  supabaseUser: SupabaseUser | null
  session: Session | null
  isLoading: boolean
  
  // Company state
  activeCompanyId: string | null
  companies: (UserCompany & { company: Company })[]
  activeRole: UserRole | null
  
  // Auth methods
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  setActiveCompanyId: (companyId: string) => void
  
  // Refresh methods
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// ============================================
// PROVIDER
// ============================================

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [companies, setCompanies] = useState<(UserCompany & { company: Company })[]>([])
  const [activeCompanyId, setActiveCompanyIdState] = useState<string | null>(null)
  
  // Create Supabase client instance
  const supabase = createBrowserClient()

  // Derived state: Get active user's role at active company
  const activeRole: UserRole | null = companies.find(
    (uc) => uc.company_id === activeCompanyId
  )?.role || null

  // ============================================
  // FETCH USER DATA
  // ============================================

  const fetchUserData = async (userId: string) => {
    try {
      // Fetch user profile
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (userError) throw userError

      setUser(userData)

      // Fetch user's companies
      const { data: companiesData, error: companiesError } = await supabase
        .from('user_companies')
        .select(`
          *,
          company:companies(*)
        `)
        .eq('user_id', userId)
        .eq('is_active', true)

      if (companiesError) throw companiesError

      setCompanies(companiesData as (UserCompany & { company: Company })[])

      // Set active company (from user's default or first company)
      const storedCompanyId = localStorage.getItem('activeCompanyId')
      
      if (storedCompanyId && companiesData.some((uc: UserCompany) => uc.company_id === storedCompanyId)) {
        setActiveCompanyIdState(storedCompanyId)
      } else if (userData.default_company_id) {
        setActiveCompanyIdState(userData.default_company_id)
      } else if (companiesData.length > 0) {
        setActiveCompanyIdState(companiesData[0].company_id)
      }
    } catch (error) {
      console.error('Error fetching user data:', error)
      setUser(null)
      setCompanies([])
      setActiveCompanyIdState(null)
    }
  }

  // ============================================
  // AUTH STATE LISTENER
  // ============================================

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }: { data: { session: Session | null } }) => {
      setSession(session)
      setSupabaseUser(session?.user || null)
      
      if (session?.user) {
        fetchUserData(session.user.id)
      }
      
      setIsLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: string, session: Session | null) => {
      setSession(session)
      setSupabaseUser(session?.user || null)
      
      if (session?.user) {
        fetchUserData(session.user.id)
      } else {
        setUser(null)
        setCompanies([])
        setActiveCompanyIdState(null)
      }
      
      setIsLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  // ============================================
  // PERSIST ACTIVE COMPANY
  // ============================================

  useEffect(() => {
    if (activeCompanyId) {
      localStorage.setItem('activeCompanyId', activeCompanyId)
    } else {
      localStorage.removeItem('activeCompanyId')
    }
  }, [activeCompanyId])

  // ============================================
  // AUTH METHODS
  // ============================================

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) throw error

    // User data will be fetched automatically by the auth state listener
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error

    // Clear local state
    setUser(null)
    setCompanies([])
    setActiveCompanyIdState(null)
    localStorage.removeItem('activeCompanyId')
  }

  const setActiveCompanyId = (companyId: string) => {
    // Validate that user has access to this company
    if (!companies.some((uc) => uc.company_id === companyId)) {
      console.error('User does not have access to company:', companyId)
      return
    }

    setActiveCompanyIdState(companyId)
  }

  const refreshUser = async () => {
    if (supabaseUser) {
      await fetchUserData(supabaseUser.id)
    }
  }

  // ============================================
  // CONTEXT VALUE
  // ============================================

  const value: AuthContextType = {
    user,
    supabaseUser,
    session,
    isLoading,
    activeCompanyId,
    companies,
    activeRole,
    signIn,
    signOut,
    setActiveCompanyId,
    refreshUser,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// ============================================
// HOOK
// ============================================

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
