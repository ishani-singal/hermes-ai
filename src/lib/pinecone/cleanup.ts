/**
 * Pinecone Cleanup Utilities
 * 
 * Functions for removing document vectors from Pinecone index.
 */

import { namespace } from './client';

/**
 * Delete all vectors associated with a document
 * 
 * @param documentId - The UUID of the document to delete
 */
export async function deleteDocumentVectors(documentId: string): Promise<void> {
  try {
    console.log(`[Pinecone] Deleting vectors for document: ${documentId}`);
    
    // Delete by metadata filter (company_id is required in filter)
    // We need to use deleteMany with a filter
    await namespace.deleteMany({
      filter: {
        document_id: { $eq: documentId },
      },
    });

    console.log(`[Pinecone] Successfully deleted vectors for document: ${documentId}`);
  } catch (error) {
    console.error(`[Pinecone] Error deleting vectors for document ${documentId}:`, error);
    throw new Error(`Failed to delete document vectors: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
