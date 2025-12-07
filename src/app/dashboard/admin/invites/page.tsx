'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth/context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Dialog } from '@/components/ui/dialog'
import { 
  UserPlus, 
  Copy, 
  Check, 
  Trash2, 
  RefreshCw, 
  Edit2, 
  ArrowLeft,
  Mail,
  Clock,
  CheckCircle,
  XCircle
} from 'lucide-react'
import Link from 'next/link'
import type { InviteWithDetails, InviteResponse, UserRole } from '@/types'

const ROLE_OPTIONS = [
  { value: 'viewer', label: 'Viewer - Read-only access' },
  { value: 'editor', label: 'Editor - Can create and edit' },
  { value: 'admin', label: 'Admin - Full access' },
]

export default function AdminInvitesPage() {
  const { activeRole } = useAuth()
  const [invites, setInvites] = useState<InviteWithDetails[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Create invite form
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newInviteEmail, setNewInviteEmail] = useState('')
  const [newInviteRole, setNewInviteRole] = useState<UserRole>('editor')
  const [isCreating, setIsCreating] = useState(false)

  // Confirmation dialog
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [pendingInvite, setPendingInvite] = useState<{ email: string; role: UserRole } | null>(null)

  // Created invite with link
  const [createdInvite, setCreatedInvite] = useState<InviteResponse | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)

  // Edit dialog
  const [editingInvite, setEditingInvite] = useState<InviteWithDetails | null>(null)
  const [editEmail, setEditEmail] = useState('')
  const [editRole, setEditRole] = useState<UserRole>('editor')
  const [isUpdating, setIsUpdating] = useState(false)

  // Delete confirmation
  const [deletingInvite, setDeletingInvite] = useState<InviteWithDetails | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Fetch invites
  const fetchInvites = useCallback(async () => {
    try {
      const response = await fetch('/api/invites')
      if (!response.ok) throw new Error('Failed to fetch invites')
      const data = await response.json()
      setInvites(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invites')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchInvites()
  }, [fetchInvites])

  // Check if user is admin
  if (activeRole !== 'admin') {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="text-center py-12">
          <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-4">You need admin access to manage invites.</p>
          <Link href="/dashboard">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  // Handle create invite
  const handleCreateClick = () => {
    if (!newInviteEmail.trim()) {
      setError('Please enter an email address')
      return
    }
    setPendingInvite({ email: newInviteEmail.trim().toLowerCase(), role: newInviteRole })
    setShowConfirmDialog(true)
  }

  const handleConfirmCreate = async () => {
    if (!pendingInvite) return

    setIsCreating(true)
    setError(null)

    try {
      const response = await fetch('/api/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: pendingInvite.email, role: pendingInvite.role }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create invite')
      }

      setCreatedInvite(data)
      setShowConfirmDialog(false)
      setShowCreateForm(false)
      setNewInviteEmail('')
      setNewInviteRole('editor')
      fetchInvites()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create invite')
      setShowConfirmDialog(false)
    } finally {
      setIsCreating(false)
    }
  }

  // Handle copy link
  const handleCopyLink = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link)
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2000)
    } catch {
      setError('Failed to copy link')
    }
  }

  // Handle edit invite
  const handleEditClick = (invite: InviteWithDetails) => {
    setEditingInvite(invite)
    setEditEmail(invite.email)
    setEditRole(invite.role)
  }

  const handleUpdateInvite = async () => {
    if (!editingInvite) return

    setIsUpdating(true)
    setError(null)

    try {
      const response = await fetch(`/api/invites/${editingInvite.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: editEmail.trim().toLowerCase(), role: editRole }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update invite')
      }

      setCreatedInvite(data)
      setEditingInvite(null)
      fetchInvites()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update invite')
    } finally {
      setIsUpdating(false)
    }
  }

  // Handle delete invite
  const handleDeleteInvite = async () => {
    if (!deletingInvite) return

    setIsDeleting(true)
    setError(null)

    try {
      const response = await fetch(`/api/invites/${deletingInvite.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete invite')
      }

      setDeletingInvite(null)
      fetchInvites()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete invite')
    } finally {
      setIsDeleting(false)
    }
  }

  // Handle resend (regenerate) invite
  const handleResendInvite = async (invite: InviteWithDetails) => {
    setError(null)

    try {
      const response = await fetch(`/api/invites/${invite.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}), // Empty body just regenerates token
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to regenerate invite')
      }

      setCreatedInvite(data)
      fetchInvites()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate invite')
    }
  }

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="warning"><Clock className="h-3 w-3 mr-1" />Pending</Badge>
      case 'accepted':
        return <Badge variant="success"><CheckCircle className="h-3 w-3 mr-1" />Accepted</Badge>
      case 'expired':
        return <Badge variant="danger"><XCircle className="h-3 w-3 mr-1" />Expired</Badge>
      default:
        return null
    }
  }

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Invite Team Members</h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1">Send invites to add new members to your company</p>
          </div>
          {!showCreateForm && (
            <Button onClick={() => setShowCreateForm(true)} className="sm:w-auto" title="New Invite">
              <UserPlus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">New Invite</span>
            </Button>
          )}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-center justify-between">
          <p className="text-sm text-red-600">{error}</p>
          <button 
            onClick={() => setError(null)} 
            className="text-red-600 hover:text-red-800"
            aria-label="Dismiss error"
          >
            <XCircle className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Create invite form */}
      {showCreateForm && (
        <div className="mb-6 p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
          <h3 className="font-medium text-gray-900 mb-4">Create New Invite</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Email Address"
              type="email"
              value={newInviteEmail}
              onChange={(e) => setNewInviteEmail(e.target.value)}
              placeholder="employee@company.com"
            />
            <Select
              label="Role"
              value={newInviteRole}
              onChange={(e) => setNewInviteRole(e.target.value as UserRole)}
              options={ROLE_OPTIONS}
            />
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={handleCreateClick} isLoading={isCreating}>
              <Mail className="h-4 w-4 mr-2" />
              Create Invite
            </Button>
            <Button variant="ghost" onClick={() => setShowCreateForm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Created invite with link */}
      {createdInvite && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-medium text-green-800 flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Invite Created Successfully!
              </h3>
              <p className="text-sm text-green-700 mt-1">
                Share this link with <strong>{createdInvite.invite.email}</strong>
              </p>
            </div>
            <button 
              onClick={() => setCreatedInvite(null)} 
              className="text-green-600 hover:text-green-800"
              aria-label="Dismiss success message"
            >
              <XCircle className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-3 flex gap-2">
            <Input
              value={createdInvite.inviteLink}
              readOnly
              className="font-mono text-sm bg-white"
            />
            <Button 
              variant="outline" 
              onClick={() => handleCopyLink(createdInvite.inviteLink)}
              className="shrink-0"
            >
              {copiedLink ? (
                <>
                  <Check className="h-4 w-4 mr-2 text-green-600" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Link
                </>
              )}
            </Button>
          </div>
          <p className="text-xs text-green-600 mt-2">
            This link expires in 7 days. You can regenerate it from the invite list if needed.
          </p>
        </div>
      )}

      {/* Invites list */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand mx-auto mb-4"></div>
          <p className="text-gray-600">Loading invites...</p>
        </div>
      ) : invites.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
          <UserPlus className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No invites yet</h3>
          <p className="text-gray-600 mb-4">Create your first invite to add team members</p>
          {!showCreateForm && (
            <Button onClick={() => setShowCreateForm(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Create Invite
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* Mobile Card View */}
          <div className="block md:hidden space-y-3">
            {invites.map((invite) => (
              <div key={invite.id} className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 truncate">{invite.email}</p>
                    <p className="text-xs text-gray-500">Invited {formatDate(invite.created_at)}</p>
                  </div>
                  {getStatusBadge(invite.status)}
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <div className="space-y-1">
                    <p className="text-gray-600">
                      <span className="text-gray-500">Role:</span> <span className="capitalize">{invite.role}</span>
                    </p>
                    <p className="text-gray-600">
                      <span className="text-gray-500">{invite.status === 'accepted' ? 'Accepted:' : 'Expires:'}</span>{' '}
                      {invite.status === 'accepted' ? formatDate(invite.used_at!) : formatDate(invite.expires_at)}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    {invite.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleResendInvite(invite)}
                          className="p-2 text-gray-600 hover:text-brand rounded-md hover:bg-gray-100"
                          title="Regenerate invite link"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleEditClick(invite)}
                          className="p-2 text-gray-600 hover:text-brand rounded-md hover:bg-gray-100"
                          title="Edit invite"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                    {invite.status === 'expired' && (
                      <button
                        onClick={() => handleResendInvite(invite)}
                        className="p-2 text-gray-600 hover:text-brand rounded-md hover:bg-gray-100"
                        title="Regenerate invite link"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => setDeletingInvite(invite)}
                      className="p-2 text-gray-600 hover:text-red-600 rounded-md hover:bg-gray-100"
                      title="Delete invite"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Expires
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {invites.map((invite) => (
                <tr key={invite.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{invite.email}</div>
                    <div className="text-xs text-gray-500">
                      Invited {formatDate(invite.created_at)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-900 capitalize">{invite.role}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(invite.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {invite.status === 'accepted' 
                      ? formatDate(invite.used_at!)
                      : formatDate(invite.expires_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                    <div className="flex items-center justify-end gap-2">
                      {invite.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleResendInvite(invite)}
                            className="text-gray-600 hover:text-brand p-1"
                            title="Regenerate invite link"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleEditClick(invite)}
                            className="text-gray-600 hover:text-brand p-1"
                            title="Edit invite"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                      {invite.status === 'expired' && (
                        <button
                          onClick={() => handleResendInvite(invite)}
                          className="text-gray-600 hover:text-brand p-1"
                          title="Regenerate invite link"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => setDeletingInvite(invite)}
                        className="text-gray-600 hover:text-red-600 p-1"
                        title="Delete invite"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </>
      )}

      {/* Confirmation dialog */}
      <Dialog
        open={showConfirmDialog}
        onOpenChange={setShowConfirmDialog}
        title="Confirm Invite"
        size="sm"
      >
        <div className="py-4">
          <p className="text-gray-700">
            You are about to invite:
          </p>
          <div className="mt-3 p-3 bg-gray-50 rounded-md">
            <p className="font-medium text-gray-900">{pendingInvite?.email}</p>
            <p className="text-sm text-gray-600 capitalize">Role: {pendingInvite?.role}</p>
          </div>
          <p className="mt-4 text-sm text-gray-600">
            Please verify the email address is correct. The invite will expire in 7 days.
          </p>
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={() => setShowConfirmDialog(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirmCreate} isLoading={isCreating}>
            Send Invite
          </Button>
        </div>
      </Dialog>

      {/* Edit dialog */}
      <Dialog
        open={!!editingInvite}
        onOpenChange={() => setEditingInvite(null)}
        title="Edit Invite"
        size="sm"
      >
        <div className="py-4 space-y-4">
          <Input
            label="Email Address"
            type="email"
            value={editEmail}
            onChange={(e) => setEditEmail(e.target.value)}
          />
          <Select
            label="Role"
            value={editRole}
            onChange={(e) => setEditRole(e.target.value as UserRole)}
            options={ROLE_OPTIONS}
          />
          <p className="text-sm text-gray-600">
            Updating this invite will generate a new link and reset the expiration to 7 days.
          </p>
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={() => setEditingInvite(null)}>
            Cancel
          </Button>
          <Button onClick={handleUpdateInvite} isLoading={isUpdating}>
            Update & Regenerate Link
          </Button>
        </div>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog
        open={!!deletingInvite}
        onOpenChange={() => setDeletingInvite(null)}
        title="Delete Invite"
        size="sm"
      >
        <div className="py-4">
          <p className="text-gray-700">
            Are you sure you want to delete the invite for{' '}
            <strong>{deletingInvite?.email}</strong>?
          </p>
          {deletingInvite?.status === 'pending' && (
            <p className="mt-2 text-sm text-gray-600">
              The invite link will no longer work.
            </p>
          )}
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={() => setDeletingInvite(null)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDeleteInvite} isLoading={isDeleting}>
            Delete Invite
          </Button>
        </div>
      </Dialog>
    </div>
  )
}
