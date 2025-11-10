'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth/context'
import { Tabs } from '@/components/tabs/tab-navigation'
import { Chat, type Message } from '@/components/chat/chat'
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
  
  // Lift chat state to dashboard to persist across tab switches
  const [chatMessages, setChatMessages] = useState<Message[]>([])
  const [chatThreadId, setChatThreadId] = useState<string | null>(null)

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand mx-auto"></div>
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
    <div className="flex flex-col h-full">
      {/* Tab Navigation - Centered at top */}
      <div className="flex justify-center border-b border-gray-200 bg-white">
        <Tabs
          tabs={tabs}
          activeTab={activeTab}
          // onTabChange receives a string; cast to the specific union type we use for state
          onTabChange={(tabId) => setActiveTab(tabId as 'chat' | 'work-orders')}
        />
      </div>

      {/* Tab Content - Full height on mobile */}
      <div className="flex-1 overflow-auto pt-6">
        {activeTab === 'chat' && (
          <Chat 
            messages={chatMessages} 
            setMessages={setChatMessages} 
            threadId={chatThreadId} 
            setThreadId={setChatThreadId} 
          />
        )}
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
