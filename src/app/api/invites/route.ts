/**
 * POST /api/invites - Create a new invite (admin only)
 * GET /api/invites - List invites for the company (admin only)
 * 
 * Authorization: Admin users only
 */

import { NextRequest } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { route, type RouteContext } from '@/lib/auth/route-builder';
import { success, badRequest } from '@/lib/auth/middleware';
import type { CreateInviteRequest, InviteWithDetails, InviteResponse } from '@/types';
import { getInviteStatus } from '@/types';

// Invite expires in 7 days
const INVITE_EXPIRY_DAYS = 7;

// =============================================
// GET - List Invites
// =============================================

export const GET = route()
  .auth()
  .requireAdmin()
  .handle(async (request: NextRequest, context: RouteContext) => {
    const { user } = context;
    const supabase = createServiceRoleClient();

    // Parse query parameters for filtering
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // 'pending', 'accepted', 'expired', or null for all

    // Fetch invites with company and creator info
    const query = supabase
      .from('invites')
      .select(`
        *,
        company:companies(id, name, company_code),
        creator:users!created_by(id, full_name, email)
      `)
      .eq('company_id', user!.companyId)
      .order('created_at', { ascending: false });

    const { data: invites, error } = await query;

    if (error) {
      console.error('Error listing invites:', error);
      return badRequest(error.message);
    }

    // Transform and filter by status
    const invitesWithDetails: InviteWithDetails[] = (invites || [])
      .map((invite) => ({
        ...invite,
        status: getInviteStatus(invite),
        company: invite.company,
        creator: invite.creator,
      }))
      .filter((invite) => {
        if (!status) return true;
        return invite.status === status;
      });

    return success(invitesWithDetails);
  });

// =============================================
// POST - Create Invite
// =============================================

export const POST = route()
  .auth()
  .requireAdmin()
  .handle(async (request: NextRequest, context: RouteContext) => {
    const { user } = context;
    const supabase = createServiceRoleClient();

    // Parse request body
    const body: CreateInviteRequest = await request.json();

    // Validate required fields
    if (!body.email || body.email.trim().length === 0) {
      return badRequest('Email is required');
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return badRequest('Invalid email format');
    }

    if (!body.role || !['admin', 'editor', 'viewer'].includes(body.role)) {
      return badRequest('Role must be admin, editor, or viewer');
    }

    const normalizedEmail = body.email.trim().toLowerCase();

    // Check if email is already a user in this company
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existingUser) {
      // Check if they're already in this company
      const { data: existingMembership } = await supabase
        .from('user_companies')
        .select('id')
        .eq('user_id', existingUser.id)
        .eq('company_id', user!.companyId)
        .maybeSingle();

      if (existingMembership) {
        return badRequest('This user is already a member of your company');
      }
    }

    // Check if there's already a pending invite for this email in this company
    const { data: existingInvite } = await supabase
      .from('invites')
      .select('id, used_at, expires_at')
      .eq('company_id', user!.companyId)
      .eq('email', normalizedEmail)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (existingInvite) {
      return badRequest('A pending invite already exists for this email. You can resend or edit the existing invite.');
    }

    // Generate secure token using database function
    const { data: tokenData, error: tokenError } = await supabase
      .rpc('generate_invite_token');

    if (tokenError || !tokenData) {
      console.error('Error generating invite token:', tokenError);
      return badRequest('Failed to generate invite token');
    }

    // Calculate expiry date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRY_DAYS);

    // Create invite
    const { data: invite, error: insertError } = await supabase
      .from('invites')
      .insert({
        company_id: user!.companyId,
        email: normalizedEmail,
        role: body.role,
        token: tokenData,
        expires_at: expiresAt.toISOString(),
        created_by: user!.id,
      })
      .select(`
        *,
        company:companies(id, name, company_code),
        creator:users!created_by(id, full_name, email)
      `)
      .single();

    if (insertError || !invite) {
      console.error('Error creating invite:', insertError);
      return badRequest(insertError?.message || 'Failed to create invite');
    }

    // Build invite link
    const baseUrl = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || '';
    const inviteLink = `${baseUrl}/signup/invite/${invite.token}`;

    const response: InviteResponse = {
      invite: {
        ...invite,
        status: getInviteStatus(invite),
        company: invite.company,
        creator: invite.creator,
      },
      inviteLink,
    };

    return success(response, 201);
  });
