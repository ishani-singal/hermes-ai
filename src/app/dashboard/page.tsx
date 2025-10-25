'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth/context'
import { Tabs } from '@/components/tabs/tab-navigation'
import { ChatPlaceholder } from '@/components/chat/chat-placeholder'
import { WorkOrderList } from '@/components/work-orders/work-order-list'
import { WorkOrderCreateForm } from '@/components/work-orders/work-order-create-form'
import { WorkOrderDetail } from '@/components/work-orders/work-order-detail'
import { MessageCircle, ClipboardList } from 'lucide-react'
import type { WorkOrder } from '@/types'

export default function DashboardPage() {
  const { user, isLoading } = useAuth()
  const [activeTab, setActiveTab] = useState<'chat' | 'work-orders'>('chat')
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // If NOT authenticated, middleware will redirect to /login
  if (!user) return null

  const tabs = [
    { id: 'chat', label: 'Chat', icon: <MessageCircle className="h-4 w-4" /> },
    { id: 'work-orders', label: 'Work Orders', icon: <ClipboardList className="h-4 w-4" /> },
  ]

  const handleCreateSuccess = () => setRefreshTrigger((p) => p + 1)
  const handleUpdateSuccess = () => {
    setSelectedWorkOrder(null)
    setRefreshTrigger((p) => p + 1)
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Welcome back, {user?.full_name}!</h1>
        <p className="mt-1 text-sm text-gray-500">Manage your work orders and chat with AI assistant</p>
      </div>

      {/* Tab Navigation */}
      <Tabs tabs={tabs} activeTab={activeTab} onTabChange={(tabId) => setActiveTab(tabId as any)} />

      {/* Tab Content */}
      <div className="pt-4">
        {activeTab === 'chat' && <ChatPlaceholder />}
        {activeTab === 'work-orders' && (
          <WorkOrderList key={refreshTrigger} onCreateClick={() => setIsCreateModalOpen(true)} onWorkOrderClick={setSelectedWorkOrder} />
        )}
      </div>

      {/* Create Work Order Modal */}
      <WorkOrderCreateForm open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen} onSuccess={handleCreateSuccess} />

      {/* Work Order Detail Modal */}
      <WorkOrderDetail workOrder={selectedWorkOrder} open={selectedWorkOrder !== null} onOpenChange={(open) => !open && setSelectedWorkOrder(null)} onSuccess={handleUpdateSuccess} />
    </div>
  )
}
