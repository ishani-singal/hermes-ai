/**
 * Pinecone Cleanup Utilities
 * 
 * Functions for removing resource vectors from Pinecone index.
 */

import { namespace } from './client';

/**
 * Delete all vectors associated with a document
 * 
 * @param documentId - The UUID of the document to delete
 */
export async function deleteDocumentVectors(documentId: string): Promise<void> {
  return deleteResourceVectors(documentId, 'document');
}

/**
 * Delete all vectors associated with a photo
 * 
 * @param photoId - The UUID of the photo to delete
 */
export async function deletePhotoVectors(photoId: string): Promise<void> {
  return deleteResourceVectors(photoId, 'photo');
}

/**
 * Delete all vectors associated with any resource (document, photo, etc.)
 * 
 * @param resourceId - The UUID of the resource to delete
 * @param resourceType - Optional type filter (document, photo, etc.)
 */
export async function deleteResourceVectors(resourceId: string, resourceType?: string): Promise<void> {
  try {
    console.log(`[Pinecone] Deleting vectors for resource: ${resourceId}${resourceType ? ` (type: ${resourceType})` : ''}`);

    const filter: Record<string, { $eq: string }> = {
      resource_id: { $eq: resourceId },
    };

    if (resourceType) {
      filter.resource_type = { $eq: resourceType };
    }

    await namespace.deleteMany({ filter });

    console.log(`[Pinecone] Successfully deleted vectors for resource: ${resourceId}`);
  } catch (error) {
    console.error(`[Pinecone] Error deleting vectors for resource ${resourceId}:`, error);
    // Don't throw - deletion from Pinecone is not critical for file deletion
    // The file is already deleted from storage and database
    console.warn(`[Pinecone] Continuing despite error - resource ${resourceId} may have orphaned vectors`);
  }
}

/**
 * Delete all vectors for a company (use with caution!)
 * 
 * @param companyId - The UUID of the company
 */
export async function deleteCompanyVectors(companyId: string): Promise<void> {
  try {
    console.log(`[Pinecone] Deleting all vectors for company: ${companyId}`);

    await namespace.deleteMany({
      filter: {
        company_id: { $eq: companyId },
      },
    });

    console.log(`[Pinecone] Successfully deleted vectors for company: ${companyId}`);
  } catch (error) {
    console.error(`[Pinecone] Error deleting vectors for company ${companyId}:`, error);
    throw new Error(`Failed to delete company vectors: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Delete all vectors for specific equipment
 * 
 * @param equipmentId - The UUID of the equipment
 */
export async function deleteEquipmentVectors(equipmentId: string): Promise<void> {
  try {
    console.log(`[Pinecone] Deleting vectors for equipment: ${equipmentId}`);

    await namespace.deleteMany({
      filter: {
        equipment_id: { $eq: equipmentId },
      },
    });

    console.log(`[Pinecone] Successfully deleted vectors for equipment: ${equipmentId}`);
  } catch (error) {
    console.error(`[Pinecone] Error deleting vectors for equipment ${equipmentId}:`, error);
    throw new Error(`Failed to delete equipment vectors: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
