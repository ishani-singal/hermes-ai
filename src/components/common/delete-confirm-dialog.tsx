'use client'

import { Button } from '@/components/ui/button'

export interface DeleteConfirmDialogProps {
    open: boolean
    title: string
    itemName: string
    isDeleting?: boolean
    onConfirm: () => void
    onCancel: () => void
}

export function DeleteConfirmDialog({
    open,
    title,
    itemName,
    isDeleting = false,
    onConfirm,
    onCancel,
}: DeleteConfirmDialogProps) {
    if (!open) return null

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {title}
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                    Are you sure you want to delete <span className="font-medium">{itemName}</span>?
                    This action cannot be undone.
                </p>
                <div className="flex justify-end gap-3">
                    <Button
                        variant="outline"
                        onClick={onCancel}
                        disabled={isDeleting}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="danger"
                        onClick={onConfirm}
                        isLoading={isDeleting}
                    >
                        Delete
                    </Button>
                </div>
            </div>
        </div>
    )
}
