/**
 * GET /api/invites/validate/[token] - Validate an invite token (public)
 * 
 * This endpoint is used by the invite signup page to display invite details.
 * It does NOT require authentication.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { InviteValidation } from '@/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
): Promise<Response> {
  const { token } = await params;

  if (!token) {
    const response: InviteValidation = {
      valid: false,
      error: 'Invite token is required',
    };
    return NextResponse.json(response, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  // Fetch invite with company info
  const { data: invite, error } = await supabase
    .from('invites')
    .select(`
      id,
      email,
      role,
      expires_at,
      used_at,
      company:companies!inner(id, name)
    `)
    .eq('token', token)
    .maybeSingle();

  if (error) {
    console.error('Error validating invite:', error);
    const response: InviteValidation = {
      valid: false,
      error: 'Failed to validate invite',
    };
    return NextResponse.json(response, { status: 500 });
  }

  if (!invite) {
    const response: InviteValidation = {
      valid: false,
      error: 'Invalid invite link',
    };
    return NextResponse.json(response, { status: 404 });
  }

  // Check if already used
  if (invite.used_at) {
    const response: InviteValidation = {
      valid: false,
      error: 'This invite has already been used',
    };
    return NextResponse.json(response, { status: 400 });
  }

  // Check if expired
  if (new Date(invite.expires_at) < new Date()) {
    const response: InviteValidation = {
      valid: false,
      error: 'This invite has expired. Please request a new invite from your administrator.',
    };
    return NextResponse.json(response, { status: 400 });
  }

  // Get company data (Supabase returns single object when using !inner)
  const company = invite.company as unknown as { id: string; name: string };

  // Valid invite
  const response: InviteValidation = {
    valid: true,
    invite: {
      email: invite.email,
      role: invite.role,
      company: {
        id: company.id,
        name: company.name,
      },
    },
  };

  return NextResponse.json(response);
}
