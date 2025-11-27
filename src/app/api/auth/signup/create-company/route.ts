import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import type { SignUpRequest, SignUpResponse } from '@/types'

/**
 * POST /api/auth/signup/create-company
 * 
 * Creates a new user account AND a new company
 * Flow:
 * 1. Validate company name doesn't exist
 * 2. Create auth.users via Supabase Auth
 * 3. Create company record
 * 4. Fetch auto-created public.users (from DB trigger)
 * 5. Create user_companies relationship (admin role)
 * 6. Return user + company data
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

    // Use admin client to bypass RLS for signup operations
    const supabase = createServiceRoleClient()

    // Check if company name already exists
    // Normalize: trim and collapse multiple spaces to single space
    const normalizedCompanyName = companyName.trim().replace(/\s+/g, ' ')

    // Fetch all companies and check for duplicates with normalized comparison
    const { data: companies, error: companiesError } = await supabase
      .from('companies')
      .select('id, name')

    if (companiesError) {
      console.error('Error fetching companies:', companiesError)
      return NextResponse.json(
        { error: 'Failed to verify company uniqueness' },
        { status: 500 }
      )
    }

    // Check if any existing company matches (case-insensitive, whitespace-normalized)
    const existingCompany = companies?.find(c =>
      c.name.trim().replace(/\s+/g, ' ').toLowerCase() === normalizedCompanyName.toLowerCase()
    )

    if (existingCompany) {
      return NextResponse.json(
        { error: 'A company with this name already exists. Please choose a different name or uncheck "Create new company" to join it.' },
        { status: 409 }
      )
    }

    // Step 1: Create auth user
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

    // Step 2: Generate company_code from company name
    const { data: companyCodeData, error: companyCodeError } = await supabase
      .rpc('generate_company_code', { p_company_name: normalizedCompanyName })

    if (companyCodeError) {
      console.error('Company code generation error:', companyCodeError)
      // Cleanup
      await supabase.auth.admin.deleteUser(userId)
      return NextResponse.json(
        { error: 'Failed to generate company code' },
        { status: 500 }
      )
    }

    const companyCode = companyCodeData as string

    // Step 3: Create company (user's email becomes primary contact)
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .insert({
        name: normalizedCompanyName,
        company_code: companyCode,
        primary_contact_email: email,
      })
      .select()
      .single()

    if (companyError || !company) {
      console.error('Company creation error:', companyError)

      // Cleanup: Delete auth user if company creation fails
      await supabase.auth.admin.deleteUser(userId)

      return NextResponse.json(
        { error: 'Failed to create company' },
        { status: 500 }
      )
    }

    // Step 4: Fetch auto-created public.users record (from DB trigger)
    // Note: There might be a slight delay, so we retry a few times
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
        // Wait 200ms before retrying
        await new Promise(resolve => setTimeout(resolve, 200))
      }

      attempts++
    }

    if (!user) {
      console.error('User record not found after signup')

      // Cleanup
      await supabase.auth.admin.deleteUser(userId)
      await supabase.from('companies').delete().eq('id', company.id)

      return NextResponse.json(
        { error: 'Failed to create user profile' },
        { status: 500 }
      )
    }

    // Step 5: Create user_companies relationship (admin role)
    const { error: userCompanyError } = await supabase
      .from('user_companies')
      .insert({
        user_id: userId,
        company_id: company.id,
        role: 'admin',
        is_active: true,
      })

    if (userCompanyError) {
      console.error('User-company relationship error:', userCompanyError)

      // Cleanup
      await supabase.auth.admin.deleteUser(userId)
      await supabase.from('companies').delete().eq('id', company.id)

      return NextResponse.json(
        { error: 'Failed to link user to company' },
        { status: 500 }
      )
    }

    // Step 6: Update user's default_company_id
    await supabase
      .from('users')
      .update({ default_company_id: company.id })
      .eq('id', userId)

    // Step 7: Return success response
    const response: SignUpResponse = {
      user: {
        ...user,
        default_company_id: company.id,
      },
      company,
    }

    return NextResponse.json(response, { status: 201 })

  } catch (error) {
    console.error('Create company signup error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
