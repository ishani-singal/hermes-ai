/**
 * POST /api/auth/signup/accept-invite
 * 
 * Accepts an invite and creates a new user account.
 * Flow:
 * 1. Validate invite token exists and is valid (not used, not expired)
 * 2. Create auth.users via Supabase Auth (sends confirmation email)
 * 3. Fetch auto-created public.users (from DB trigger)
 * 4. Create user_companies relationship with role from invite
 * 5. Mark invite as used
 * 6. Return user + company data (user must confirm email before signing in)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { AcceptInviteRequest, SignUpResponse } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body: AcceptInviteRequest = await request.json();
    const { token, fullName, password } = body;

    // Validate required fields
    if (!token) {
      return NextResponse.json(
        { error: 'Invite token is required' },
        { status: 400 }
      );
    }

    if (!fullName || fullName.trim().length === 0) {
      return NextResponse.json(
        { error: 'Full name is required' },
        { status: 400 }
      );
    }

    if (!password || password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();

    // Step 1: Fetch and validate invite
    const { data: invite, error: inviteError } = await supabase
      .from('invites')
      .select(`
        *,
        company:companies(id, name, company_code)
      `)
      .eq('token', token)
      .maybeSingle();

    if (inviteError) {
      console.error('Error fetching invite:', inviteError);
      return NextResponse.json(
        { error: 'Failed to validate invite' },
        { status: 500 }
      );
    }

    if (!invite) {
      return NextResponse.json(
        { error: 'Invalid invite link' },
        { status: 404 }
      );
    }

    // Check if already used
    if (invite.used_at) {
      return NextResponse.json(
        { error: 'This invite has already been used' },
        { status: 400 }
      );
    }

    // Check if expired
    if (new Date(invite.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'This invite has expired. Please request a new invite from your administrator.' },
        { status: 400 }
      );
    }

    // Check if email is already registered
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', invite.email)
      .maybeSingle();

    if (existingUser) {
      // Check if they're already in this company
      const { data: existingMembership } = await supabase
        .from('user_companies')
        .select('id')
        .eq('user_id', existingUser.id)
        .eq('company_id', invite.company_id)
        .maybeSingle();

      if (existingMembership) {
        return NextResponse.json(
          { error: 'You are already a member of this company. Please sign in instead.' },
          { status: 400 }
        );
      }

      // User exists but not in this company - they can be added
      // For now, we'll return an error and suggest they contact admin
      return NextResponse.json(
        { error: 'An account with this email already exists. Please contact your administrator.' },
        { status: 400 }
      );
    }

    // Step 2: Create auth user - Supabase will send confirmation email
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: invite.email,
      password: password,
      options: {
        data: {
          full_name: fullName.trim(),
        },
      },
    });

    if (authError || !authData.user) {
      console.error('Auth signup error:', authError);
      return NextResponse.json(
        { error: authError?.message || 'Failed to create user' },
        { status: 400 }
      );
    }

    const userId = authData.user.id;

    // Step 3: Fetch auto-created public.users record (from DB trigger)
    let user = null;
    let attempts = 0;
    const maxAttempts = 5;

    while (!user && attempts < maxAttempts) {
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (userData) {
        user = userData;
        break;
      }

      if (attempts < maxAttempts - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      attempts++;
    }

    if (!user) {
      console.error('User record not found after signup');
      await supabase.auth.admin.deleteUser(userId);
      return NextResponse.json(
        { error: 'Failed to create user profile' },
        { status: 500 }
      );
    }

    // Step 4: Create user_companies relationship with invite's role
    const { error: userCompanyError } = await supabase
      .from('user_companies')
      .insert({
        user_id: userId,
        company_id: invite.company_id,
        role: invite.role,
        is_active: true,
      });

    if (userCompanyError) {
      console.error('User-company relationship error:', userCompanyError);
      await supabase.auth.admin.deleteUser(userId);
      return NextResponse.json(
        { error: 'Failed to link user to company' },
        { status: 500 }
      );
    }

    // Step 5: Update user's default_company_id
    await supabase
      .from('users')
      .update({ default_company_id: invite.company_id })
      .eq('id', userId);

    // Step 6: Mark invite as used
    await supabase
      .from('invites')
      .update({ used_at: new Date().toISOString() })
      .eq('id', invite.id);

    // Step 7: Return success response
    const response: SignUpResponse = {
      user: {
        ...user,
        default_company_id: invite.company_id,
      },
      company: invite.company,
    };

    return NextResponse.json(response, { status: 201 });

  } catch (error) {
    console.error('Accept invite signup error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
