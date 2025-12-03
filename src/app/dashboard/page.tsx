'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth/context'
import { Chat, type Message } from '@/components/chat/chat'
import { WorkOrderList } from '@/components/work-orders/work-order-list'
import { WorkOrderCreateForm } from '@/components/work-orders/work-order-create-form'
import { WorkOrderDetail } from '@/components/work-orders/work-order-detail'
import { EquipmentList } from '@/components/equipment/equipment-list'
import { EquipmentCreateForm } from '@/components/equipment/equipment-create-form'
import { EquipmentDetail } from '@/components/equipment/equipment-detail'
import { DocumentList } from '@/components/documents/document-list'
import { DocumentUploadForm } from '@/components/documents/document-upload-form'
import { DocumentBulkUploadForm } from '@/components/documents/document-bulk-upload-form'
import { PhotoList } from '@/components/photos/photo-list'
import { PhotoUploadForm } from '@/components/photos/photo-upload-form'
import { PhotoBulkUploadForm } from '@/components/photos/photo-bulk-upload-form'
import { SideNav } from '@/components/navigation/side-nav'
import { MessageCircle, ClipboardList, Wrench, Database, FileText, Image } from 'lucide-react'
import { Tabs } from '@/components/tabs/tab-navigation'
import type { WorkOrder, Equipment } from '@/types'

export default function DashboardPage() {
  const { user, isLoading } = useAuth()
  const [activeNav, setActiveNav] = useState<'chat' | 'work-orders' | 'equipment' | 'data-hub'>('chat')
  const [dataHubTab, setDataHubTab] = useState<'documents' | 'photos'>('documents')
  
  // Work Order state
  const [isCreateWorkOrderOpen, setIsCreateWorkOrderOpen] = useState(false)
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null)
  const [workOrderRefreshTrigger, setWorkOrderRefreshTrigger] = useState(0)
  
  // Equipment state
  const [isCreateEquipmentOpen, setIsCreateEquipmentOpen] = useState(false)
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null)
  const [equipmentRefreshTrigger, setEquipmentRefreshTrigger] = useState(0)

  // Document state
  const [isUploadDocumentOpen, setIsUploadDocumentOpen] = useState(false)
  const [isBulkUploadDocumentOpen, setIsBulkUploadDocumentOpen] = useState(false)
  const [documentRefreshTrigger, setDocumentRefreshTrigger] = useState(0)

  // Photo state
  const [isUploadPhotoOpen, setIsUploadPhotoOpen] = useState(false)
  const [isBulkUploadPhotoOpen, setIsBulkUploadPhotoOpen] = useState(false)
  const [photoRefreshTrigger, setPhotoRefreshTrigger] = useState(0)
  
  // Chat state
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

  const navItems: Array<{ id: string; label: string; icon: React.ReactNode }> = [
    { id: 'chat', label: 'Chat', icon: <MessageCircle className="h-5 w-5" /> },
    { id: 'work-orders', label: 'Work Orders', icon: <ClipboardList className="h-5 w-5" /> },
    { id: 'equipment', label: 'Equipment', icon: <Wrench className="h-5 w-5" /> },
    { id: 'data-hub', label: 'Data Hub', icon: <Database className="h-5 w-5" /> },
  ]

  const dataHubTabs = [
    { id: 'documents', label: 'Documents', icon: <FileText className="h-4 w-4" /> },
    { id: 'photos', label: 'Photos', icon: <Image className="h-4 w-4" /> },
  ]

  const handleWorkOrderCreateSuccess = () => setWorkOrderRefreshTrigger((p) => p + 1)
  const handleWorkOrderUpdateSuccess = () => {
    setSelectedWorkOrder(null)
    setWorkOrderRefreshTrigger((p) => p + 1)
  }

  const handleEquipmentCreateSuccess = () => setEquipmentRefreshTrigger((p) => p + 1)
  const handleEquipmentUpdateSuccess = () => {
    setSelectedEquipment(null)
    setEquipmentRefreshTrigger((p) => p + 1)
  }

  const handleDocumentUploadSuccess = () => setDocumentRefreshTrigger((p) => p + 1)
  const handlePhotoUploadSuccess = () => setPhotoRefreshTrigger((p) => p + 1)

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-4rem)] md:h-[calc(100vh-4rem)]">
      {/* Side Navigation */}
      <SideNav
        items={navItems}
        activeItem={activeNav}
        onItemChange={(itemId) => setActiveNav(itemId as typeof activeNav)}
      />

      {/* Main Content Area - Account for bottom nav on mobile */}
      <main className="flex-1 overflow-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 pb-20 md:pb-8">
        {/* Welcome Section - Show only on chat tab when no messages */}
        {activeNav === 'chat' && chatMessages.length === 0 && (
          <div className="max-w-3xl mx-auto mb-8">
            <div className="bg-gradient-to-br from-white to-brand/5 rounded-2xl shadow-sm border border-brand/20 p-8 text-center">
              <div className="mb-4">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-brand/10 rounded-full mb-4">
                  <MessageCircle className="h-8 w-8 text-brand" />
                </div>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Welcome to Hermes AI
              </h1>
              <p className="text-gray-600 mb-6">
                Your intelligent technician assistant. Ask questions, get help with work orders, or manage equipment.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
                <div className="p-4 bg-white rounded-lg border border-gray-200">
                  <ClipboardList className="h-5 w-5 text-brand mb-2" />
                  <h3 className="font-medium text-gray-900 text-sm mb-1">Work Orders</h3>
                  <p className="text-xs text-gray-600">Track and manage your maintenance tasks</p>
                </div>
                <div className="p-4 bg-white rounded-lg border border-gray-200">
                  <Wrench className="h-5 w-5 text-brand mb-2" />
                  <h3 className="font-medium text-gray-900 text-sm mb-1">Equipment</h3>
                  <p className="text-xs text-gray-600">View and update equipment records</p>
                </div>
                <div className="p-4 bg-white rounded-lg border border-gray-200">
                  <Database className="h-5 w-5 text-brand mb-2" />
                  <h3 className="font-medium text-gray-900 text-sm mb-1">Data Hub</h3>
                  <p className="text-xs text-gray-600">Access manuals, photos and files</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeNav === 'chat' && (
          <Chat
            messages={chatMessages}
            setMessages={setChatMessages}
            threadId={chatThreadId}
            setThreadId={setChatThreadId}
          />
        )}

        {activeNav === 'work-orders' && (
          <WorkOrderList
            key={workOrderRefreshTrigger}
            onCreateClick={() => setIsCreateWorkOrderOpen(true)}
            onWorkOrderClick={setSelectedWorkOrder}
          />
        )}

        {activeNav === 'equipment' && (
          <EquipmentList
            key={equipmentRefreshTrigger}
            onCreateClick={() => setIsCreateEquipmentOpen(true)}
            onEquipmentClick={setSelectedEquipment}
          />
        )}

        {activeNav === 'data-hub' && (
          <div className="space-y-4">
            <div className="border-b border-gray-200">
              <Tabs
                tabs={dataHubTabs}
                activeTab={dataHubTab}
                onTabChange={(tabId) => setDataHubTab(tabId as 'documents' | 'photos')}
                className="px-0"
              />
            </div>
            
            {dataHubTab === 'documents' && (
              <DocumentList
                key={documentRefreshTrigger}
                onCreateClick={() => setIsUploadDocumentOpen(true)}
                onBulkUploadClick={() => setIsBulkUploadDocumentOpen(true)}
              />
            )}
            
            {dataHubTab === 'photos' && (
              <PhotoList
                key={photoRefreshTrigger}
                onCreateClick={() => setIsUploadPhotoOpen(true)}
                onBulkUploadClick={() => setIsBulkUploadPhotoOpen(true)}
              />
            )}
          </div>
        )}
      </main>

      {/* Work Order Modals */}
      <WorkOrderCreateForm
        open={isCreateWorkOrderOpen}
        onOpenChange={setIsCreateWorkOrderOpen}
        onSuccess={handleWorkOrderCreateSuccess}
      />

      <WorkOrderDetail
        workOrder={selectedWorkOrder}
        open={selectedWorkOrder !== null}
        onOpenChange={(open) => !open && setSelectedWorkOrder(null)}
        onSuccess={handleWorkOrderUpdateSuccess}
      />

      {/* Equipment Modals */}
      <EquipmentCreateForm
        open={isCreateEquipmentOpen}
        onOpenChange={setIsCreateEquipmentOpen}
        onSuccess={handleEquipmentCreateSuccess}
      />

      <EquipmentDetail
        equipment={selectedEquipment}
        open={selectedEquipment !== null}
        onOpenChange={(open) => !open && setSelectedEquipment(null)}
        onSuccess={handleEquipmentUpdateSuccess}
      />

      {/* Document Modals */}
      <DocumentUploadForm
        open={isUploadDocumentOpen}
        onOpenChange={setIsUploadDocumentOpen}
        onSuccess={handleDocumentUploadSuccess}
      />

      <DocumentBulkUploadForm
        open={isBulkUploadDocumentOpen}
        onOpenChange={setIsBulkUploadDocumentOpen}
        onSuccess={handleDocumentUploadSuccess}
      />

      {/* Photo Modals */}
      <PhotoUploadForm
        open={isUploadPhotoOpen}
        onOpenChange={setIsUploadPhotoOpen}
        onSuccess={handlePhotoUploadSuccess}
      />

      <PhotoBulkUploadForm
        open={isBulkUploadPhotoOpen}
        onOpenChange={setIsBulkUploadPhotoOpen}
        onSuccess={handlePhotoUploadSuccess}
      />
    </div>
  )
}
