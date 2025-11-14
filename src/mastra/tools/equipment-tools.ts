import { z } from 'zod';
import { createTool } from '@mastra/core/tools';
import { RuntimeContext } from '@mastra/core/runtime-context';

// =============================================
// Helper Functions
// =============================================

/**
 * Get the base URL for API calls
 */
function getBaseUrl(runtimeContext: RuntimeContext): string {
  const baseUrl = runtimeContext.get('baseUrl');

  if (baseUrl) {
    return String(baseUrl);
  }
  
  return process.env.INTERNAL_API_BASE_URL || 'http://localhost:3000';
}

/**
 * Create fetch options with authentication
 */
function createFetchOptions(runtimeContext: RuntimeContext, method: string = 'GET', body?: unknown): RequestInit {
  const cookieValue = runtimeContext.get('cookie');
  const cookieHeader = cookieValue ? String(cookieValue) : '';
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (cookieHeader) {
    headers['cookie'] = cookieHeader;
  }
  
  const options: RequestInit = {
    method,
    headers,
    redirect: 'manual',
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  return options;
}

/**
 * Handle API response
 */
async function handleApiResponse(res: Response) {
  if (!res.ok) {
    const errorText = await res.text();
    return { ok: false, error: errorText || `HTTP ${res.status}` };
  }
  
  const json = await res.json();
  return { ok: true, result: json.data ?? json };
}

/**
 * Format a date string for display
 */
function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'N/A';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  } catch {
    return dateStr;
  }
}

/**
 * Safely get string value from unknown
 */
function getString(value: unknown, fallback = ''): string {
  return value ? String(value) : fallback;
}

/**
 * Format equipment as a readable table
 */
function formatEquipmentAsTable(equipment: Array<Record<string, unknown>>): string {
  if (!equipment || equipment.length === 0) {
    return 'No equipment found.';
  }

  let table = '## Equipment\n\n';
  table += '| Display ID | Name | Type | Manufacturer | Model |\n';
  table += '|-----------|------|------|--------------|-------|\n';

  for (const eq of equipment) {
    const displayId = String(eq.display_id || eq.id || 'N/A');
    const name = String(eq.name || 'Unnamed').substring(0, 30);
    const type = String(eq.type || 'N/A').substring(0, 20);
    const manufacturer = String(eq.manufacturer || 'N/A').substring(0, 20);
    const model = String(eq.model || 'N/A').substring(0, 20);

    table += `| ${displayId} | ${name} | ${type} | ${manufacturer} | ${model} |\n`;
  }

  table += `\n**Total:** ${equipment.length} equipment item(s)`;
  table += `\n\nTo view details of a specific equipment, use the get-eq-tool with the display ID from the first column.`;

  return table;
}

/**
 * Format a single equipment with full details
 */
function formatSingleEquipment(eq: Record<string, unknown>): string {
  if (!eq) {
    return 'No equipment data available.';
  }

  let output = '## Equipment Details\n\n';
  output += `**Display ID:** ${getString(eq.display_id, getString(eq.id, 'N/A'))}\n\n`;
  output += `**Name:** ${getString(eq.name, 'Unnamed')}\n\n`;
  output += `**Type:** ${getString(eq.type, 'N/A')}\n\n`;
  output += `**Manufacturer:** ${getString(eq.manufacturer, 'N/A')}\n\n`;
  output += `**Model:** ${getString(eq.model, 'N/A')}\n\n`;
  output += `**Serial Number:** ${getString(eq.serial_number, 'N/A')}\n\n`;
  output += `**Location:** ${getString(eq.location, 'N/A')}\n\n`;
  output += `**Created At:** ${formatDate(getString(eq.created_at))}\n\n`;
  output += `**Updated At:** ${formatDate(getString(eq.updated_at))}\n\n`;
  
  if (eq.metadata && Object.keys(eq.metadata).length > 0) {
    output += `**Metadata:**\n`;
    for (const [key, value] of Object.entries(eq.metadata)) {
      output += `- ${key}: ${getString(value)}\n`;
    }
    output += '\n';
  }

  return output;
}

// =============================================
// CRUD Operations - Equipment
// =============================================

/**
 * List Equipment Tool
 * Lists all equipment for the current company with optional filtering
 */
export const listEquipmentTool = createTool({
  id: 'list-eq-tool',
  description: 'List all equipment for the current company. Use this to find equipment by name, type, or manufacturer.',
  inputSchema: z.object({
    search: z.string().optional().describe('Search term to filter equipment by name, serial number, or other fields'),
    type: z.string().optional().describe('Filter by equipment type (e.g., pump, motor, compressor)'),
    manufacturer: z.string().optional().describe('Filter by manufacturer name'),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  execute: async ({ context, runtimeContext }: { context?: any; runtimeContext: RuntimeContext }) => {
    try {
      const BASE_URL = getBaseUrl(runtimeContext);
      const params = new URLSearchParams();
      
      if (context?.search) params.append('search', String(context.search));
      if (context?.type) params.append('type', String(context.type));
      if (context?.manufacturer) params.append('manufacturer', String(context.manufacturer));
      
      const queryString = params.toString();
      const url = `${BASE_URL}/api/equipment${queryString ? `?${queryString}` : ''}`;
      
      const fetchOptions = createFetchOptions(runtimeContext, 'GET');
      const res = await fetch(url, fetchOptions);

      const response = await handleApiResponse(res);
      
      if (!response.ok) {
        return response;
      }
      
      // PERFORMANCE OPTIMIZATION: Format immediately to avoid secondary LLM call
      const equipment = response.result?.data || response.result || [];
      const formattedOutput = formatEquipmentAsTable(equipment);
      
      return { 
        ok: true, 
        result: {
          formatted: formattedOutput,
          raw: equipment, // Keep raw data for agent memory/context
          count: equipment.length
        }
      };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  },
});

/**
 * Get Equipment Tool
 * Retrieves a specific equipment by display ID
 */
export const getEquipmentTool = createTool({
  id: 'get-eq-tool',
  description: 'Get a specific equipment by display ID (e.g., EQ-ACME-PUMP-001). If you only have a name, use list-eq-tool with search parameter first to find the equipment.',
  inputSchema: z.object({
    id: z.string().describe('The equipment display ID (e.g., EQ-ACME-PUMP-001)'),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  execute: async ({ context, runtimeContext }: { context?: any; runtimeContext: RuntimeContext }) => {
    try {
      const { id } = context || {};

      if (!id) {
        return { ok: false, error: 'Equipment ID is required' };
      }

      const BASE_URL = getBaseUrl(runtimeContext);
      const fetchOptions = createFetchOptions(runtimeContext, 'GET');
      
      // Use display-id route
      const endpoint = `${BASE_URL}/api/equipment/display-id/${id}`;
      
      const res = await fetch(endpoint, fetchOptions);

      const response = await handleApiResponse(res);
      
      if (!response.ok) {
        return response;
      }
      
      // PERFORMANCE OPTIMIZATION: Format immediately
      const equipment = response.result;
      const formattedOutput = formatSingleEquipment(equipment);
      
      return { 
        ok: true, 
        result: {
          formatted: formattedOutput,
          raw: equipment,
        }
      };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  },
});
