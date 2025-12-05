/**
 * GET /api/invites/[id] - Get a specific invite
 * PATCH /api/invites/[id] - Update invite (regenerates token, resets expiry)
 * DELETE /api/invites/[id] - Delete/revoke an invite
 * 
 * Authorization: Admin users only
 */

import { NextRequest } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { route, type RouteContext } from '@/lib/auth/route-builder';
import { success, badRequest, notFound } from '@/lib/auth/middleware';
import type { UpdateInviteRequest, InviteWithDetails, InviteResponse } from '@/types';
import { getInviteStatus } from '@/types';

// Invite expires in 7 days
const INVITE_EXPIRY_DAYS = 7;

// =============================================
// GET - Get Single Invite
// =============================================

export const GET = route()
  .auth()
  .requireAdmin()
  .handle(async (request: NextRequest, context: RouteContext) => {
    const { user, params } = context;
    const { id } = params;
    const supabase = createServiceRoleClient();

    const { data: invite, error } = await supabase
      .from('invites')
      .select(`
        *,
        company:companies(id, name, company_code),
        creator:users!created_by(id, full_name, email)
      `)
      .eq('id', id)
      .eq('company_id', user!.companyId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching invite:', error);
      return badRequest(error.message);
    }

    if (!invite) {
      return notFound('Invite not found');
    }

    const inviteWithDetails: InviteWithDetails = {
      ...invite,
      status: getInviteStatus(invite),
      company: invite.company,
      creator: invite.creator,
    };

    return success(inviteWithDetails);
  });

// =============================================
// PATCH - Update Invite (regenerates token)
// =============================================

export const PATCH = route()
  .auth()
  .requireAdmin()
  .handle(async (request: NextRequest, context: RouteContext) => {
    const { user, params } = context;
    const { id } = params;
    const supabase = createServiceRoleClient();

    // Get existing invite
    const { data: existingInvite, error: fetchError } = await supabase
      .from('invites')
      .select('*')
      .eq('id', id)
      .eq('company_id', user!.companyId)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching invite:', fetchError);
      return badRequest(fetchError.message);
    }

    if (!existingInvite) {
      return notFound('Invite not found');
    }

    // Cannot update a used invite
    if (existingInvite.used_at) {
      return badRequest('Cannot update an invite that has already been used');
    }

    // Parse request body
    const body: UpdateInviteRequest = await request.json();

    // Validate email if provided
    let normalizedEmail = existingInvite.email;
    if (body.email !== undefined) {
      if (!body.email || body.email.trim().length === 0) {
        return badRequest('Email cannot be empty');
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(body.email)) {
        return badRequest('Invalid email format');
      }
      normalizedEmail = body.email.trim().toLowerCase();
    }

    // Validate role if provided
    if (body.role !== undefined && !['admin', 'editor', 'viewer'].includes(body.role)) {
      return badRequest('Role must be admin, editor, or viewer');
    }

    // Generate new token (always regenerate on update)
    const { data: tokenData, error: tokenError } = await supabase
      .rpc('generate_invite_token');

    if (tokenError || !tokenData) {
      console.error('Error generating invite token:', tokenError);
      return badRequest('Failed to generate invite token');
    }

    // Calculate new expiry date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRY_DAYS);

    // Update invite
    const { data: invite, error: updateError } = await supabase
      .from('invites')
      .update({
        email: normalizedEmail,
        role: body.role || existingInvite.role,
        token: tokenData,
        expires_at: expiresAt.toISOString(),
      })
      .eq('id', id)
      .select(`
        *,
        company:companies(id, name, company_code),
        creator:users!created_by(id, full_name, email)
      `)
      .single();

    if (updateError || !invite) {
      console.error('Error updating invite:', updateError);
      return badRequest(updateError?.message || 'Failed to update invite');
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

    return success(response);
  });

// =============================================
// DELETE - Revoke/Delete Invite
// =============================================

export const DELETE = route()
  .auth()
  .requireAdmin()
  .handle(async (request: NextRequest, context: RouteContext) => {
    const { user, params } = context;
    const { id } = params;
    const supabase = createServiceRoleClient();

    // Check invite exists and belongs to user's company
    const { data: existingInvite, error: fetchError } = await supabase
      .from('invites')
      .select('id, used_at')
      .eq('id', id)
      .eq('company_id', user!.companyId)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching invite:', fetchError);
      return badRequest(fetchError.message);
    }

    if (!existingInvite) {
      return notFound('Invite not found');
    }

    // Allow deletion even if used (for cleanup)
    const { error: deleteError } = await supabase
      .from('invites')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting invite:', deleteError);
      return badRequest(deleteError.message);
    }

    return success({ message: 'Invite deleted successfully' });
  });
