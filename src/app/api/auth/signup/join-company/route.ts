import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import type { SignUpRequest, SignUpResponse } from '@/types'

/**
 * POST /api/auth/signup/join-company
 * 
 * Creates a new user account and adds them to an EXISTING company
 * Flow:
 * 1. Validate company exists
 * 2. Create auth.users via Supabase Auth
 * 3. Fetch auto-created public.users (from DB trigger)
 * 4. Create user_companies relationship (user role - auto-approved)
 * 5. Return user + company data
 */
export async function POST(request: NextRequest) {
  try {
    const body: SignUpRequest = await request.json()
    const { email, password, fullName, companyName } = body

    // Validate required fields
    if (!email || !password || !fullName || !companyName) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const supabase = createServiceRoleClient()

    // Step 1: Check if company exists
    // Normalize: trim and collapse multiple spaces to single space
    const normalizedCompanyName = companyName.trim().replace(/\s+/g, ' ')

    // Fetch all companies and do case-insensitive + whitespace-normalized matching
    const { data: companies, error: companiesError } = await supabase
      .from('companies')
      .select('*')

    if (companiesError) {
      console.error('Error fetching companies:', companiesError)
      return NextResponse.json(
        { error: 'Failed to verify company' },
        { status: 500 }
      )
    }

    // Find matching company with normalized comparison
    const company = companies?.find(c =>
      c.name.trim().replace(/\s+/g, ' ').toLowerCase() === normalizedCompanyName.toLowerCase()
    )

    if (!company) {
      return NextResponse.json(
        { error: 'Company not found. Please check the spelling or check "Create new company" to create it.' },
        { status: 404 }
      )
    }

    // Step 2: Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    })

    if (authError || !authData.user) {
      console.error('Auth signup error:', authError)
      return NextResponse.json(
        { error: authError?.message || 'Failed to create user' },
        { status: 400 }
      )
    }

    const userId = authData.user.id

    // Step 3: Fetch auto-created public.users record (from DB trigger)
    let user = null
    let attempts = 0
    const maxAttempts = 5

    while (!user && attempts < maxAttempts) {
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (userData) {
        user = userData
        break
      }

      if (attempts < maxAttempts - 1) {
        await new Promise(resolve => setTimeout(resolve, 200))
      }

      attempts++
    }

    if (!user) {
      console.error('User record not found after signup')

      // Cleanup
      await supabase.auth.admin.deleteUser(userId)

      return NextResponse.json(
        { error: 'Failed to create user profile' },
        { status: 500 }
      )
    }

    // Step 4: Add user to company as editor (auto-approved for MVP)
    const { error: userCompanyError } = await supabase
      .from('user_companies')
      .insert({
        user_id: userId,
        company_id: company.id,
        role: 'editor', // Start as editor for MVP, admin can upgrade later
        is_active: true,
      })

    if (userCompanyError) {
      console.error('User-company relationship error:', userCompanyError)

      // Cleanup
      await supabase.auth.admin.deleteUser(userId)

      return NextResponse.json(
        { error: 'Failed to add user to company' },
        { status: 500 }
      )
    }

    // Step 5: Update user's default company
    await supabase
      .from('users')
      .update({ default_company_id: company.id })
      .eq('id', userId)

    // Step 6: Return success response
    const response: SignUpResponse = {
      user: {
        ...user,
        default_company_id: company.id,
      },
      company,
    }

    return NextResponse.json(response, { status: 201 })

  } catch (error) {
    console.error('Join company signup error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
