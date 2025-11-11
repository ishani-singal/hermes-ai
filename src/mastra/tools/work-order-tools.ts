import { z } from 'zod';
import { createTool } from '@mastra/core/tools';
import { RuntimeContext } from '@mastra/core/runtime-context';
import { localDateToUTC } from '@/lib/utils/date-timezone';

// =============================================
// Helper Functions
// =============================================

/**
 * Get the base URL for API calls
 * Uses INTERNAL_API_BASE_URL for server-to-server communication to avoid external network issues
 */
function getBaseUrl(runtimeContext: RuntimeContext): string {
  const baseUrl = runtimeContext.get('baseUrl');

  if (baseUrl) {
    return String(baseUrl);
  }
  
  // Fallback to environment variable or localhost
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
    redirect: 'manual', // Don't automatically follow redirects
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
 * Format priority with visual indicator
 */
function formatPriority(priority: string): string {
  const indicators: Record<string, string> = {
    low: '🟢 Low',
    medium: '🟡 Medium',
    high: '🟠 High',
    critical: '🔴 Critical',
  };
  return indicators[priority] || priority;
}

/**
 * Format status with visual indicator
 */
function formatStatus(status: string): string {
  const indicators: Record<string, string> = {
    open: '📂 Open',
    in_progress: '⚙️ In Progress',
    completed: '✅ Completed',
    cancelled: '❌ Cancelled',
  };
  return indicators[status] || status;
}

/**
 * Safely get string value from unknown
 */
function getString(value: unknown, fallback = ''): string {
  return value ? String(value) : fallback;
}

/**
 * Format work orders as a readable table
 */
function formatWorkOrdersAsTable(workOrders: Array<Record<string, unknown>>): string {
  if (!workOrders || workOrders.length === 0) {
    return 'No work orders found.';
  }

  let table = '## Work Orders\n\n';
  table += '| ID | Title | Status | Priority | Assigned To | Due Date |\n';
  table += '|----|-------|--------|----------|-------------|----------|\n';

  for (const wo of workOrders) {
    const displayId = String(wo.display_id || wo.id || 'N/A');
    const title = String(wo.title || 'Untitled').substring(0, 30);
    const status = formatStatus(String(wo.status || 'open'));
    const priority = formatPriority(String(wo.priority || 'medium'));
    
    // Get assigned user name if available
    let assignedTo = 'Unassigned';
    if (wo.assigned_to_user && typeof wo.assigned_to_user === 'object') {
      const user = wo.assigned_to_user as Record<string, unknown>;
      assignedTo = String(user.full_name || 'Unknown');
    } else if (wo.assigned_to) {
      assignedTo = 'Assigned';
    }
    
    const dueDate = formatDate(String(wo.due_date || ''));

    table += `| ${displayId} | ${title} | ${status} | ${priority} | ${assignedTo} | ${dueDate} |\n`;
  }

  table += `\n**Total:** ${workOrders.length} work order(s)`;
  table += `\n\nTo view details of a specific work order, use the get-wo-tool with the work order ID from the first column.`;

  return table;
}

/**
 * Format a single work order with full details
 */
function formatSingleWorkOrder(wo: Record<string, unknown>): string {
  if (!wo) {
    return 'No work order data available.';
  }

  let output = '## Work Order Details\n\n';
  output += `**ID:** ${getString(wo.display_id, getString(wo.id, 'N/A'))}\n\n`;
  output += `**Title:** ${getString(wo.title, 'Untitled')}\n\n`;
  output += `**Status:** ${formatStatus(getString(wo.status, 'open'))}\n\n`;
  output += `**Priority:** ${formatPriority(getString(wo.priority, 'medium'))}\n\n`;
  
  if (wo.description) {
    output += `**Description:**\n${getString(wo.description)}\n\n`;
  }
  
  output += `**Due Date:** ${formatDate(getString(wo.due_date))}\n\n`;
  
  // Format assigned user
  if (wo.assigned_to_user && typeof wo.assigned_to_user === 'object') {
    const user = wo.assigned_to_user as Record<string, unknown>;
    output += `**Assigned To:** ${getString(user.full_name, 'Unknown')}\n\n`;
  } else if (wo.assigned_to) {
    output += `**Assigned To:** Assigned (details unavailable)\n\n`;
  } else {
    output += `**Assigned To:** Unassigned\n\n`;
  }
  
  // Format created by user
  if (wo.created_by_user && typeof wo.created_by_user === 'object') {
    const user = wo.created_by_user as Record<string, unknown>;
    output += `**Created By:** ${getString(user.full_name, 'Unknown')}\n\n`;
  } else {
    output += `**Created By:** Unknown\n\n`;
  }
  
  output += `**Created At:** ${formatDate(getString(wo.created_at))}\n\n`;
  output += `**Updated At:** ${formatDate(getString(wo.updated_at))}\n\n`;
  
  if (wo.equipment_id) {
    output += `**Equipment ID:** ${getString(wo.equipment_id)}\n\n`;
  }
  
  if (wo.custom_fields && Object.keys(wo.custom_fields).length > 0) {
    output += `**Custom Fields:**\n`;
    for (const [key, value] of Object.entries(wo.custom_fields)) {
      output += `- ${key}: ${getString(value)}\n`;
    }
    output += '\n';
  }

  return output;
}

// =============================================
// CRUD Operations - Work Orders
// =============================================

/**
 * List Work Orders Tool
 * Lists all work orders for the current company with optional filtering
 */
export const listWorkOrdersTool = createTool({
  id: 'list-wo-tool',
  description: 'List all work orders for the current company. Use this to see all work orders or to find a work order by title.',
  inputSchema: z.object({
    search: z.string().optional().describe('Search term to filter work orders by title or description'),
    status: z.enum(['open', 'in_progress', 'completed', 'cancelled']).optional().describe('Filter by status'),
    priority: z.enum(['low', 'medium', 'high', 'critical']).optional().describe('Filter by priority'),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  execute: async ({ context, runtimeContext }: { context?: any; runtimeContext: RuntimeContext }) => {
    try {
      const BASE_URL = getBaseUrl(runtimeContext);
      const params = new URLSearchParams();
      
      if (context?.search) params.append('search', String(context.search));
      if (context?.status) params.append('status', String(context.status));
      if (context?.priority) params.append('priority', String(context.priority));
      
      const queryString = params.toString();
      const url = `${BASE_URL}/api/work-orders${queryString ? `?${queryString}` : ''}`;
      
      const fetchOptions = createFetchOptions(runtimeContext, 'GET');
      const res = await fetch(url, fetchOptions);

      const response = await handleApiResponse(res);
      
      // OPTIMIZATION: Return only essential fields to reduce LLM processing time
      // The full objects with nested user/company data cause 20+ second delays
      if (response.ok && Array.isArray(response.result)) {
        response.result = response.result.map((wo: Record<string, unknown>) => ({
          display_id: wo.display_id,
          title: wo.title,
          status: wo.status,
          priority: wo.priority,
          assigned_to_name: (wo.assigned_to_user as Record<string, unknown>)?.full_name || 'Unassigned',
          due_date: wo.due_date,
        }));
      }
      
      return response;
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  },
});

/**
 * Get Work Order Tool
 * Retrieves a specific work order by display ID
 * Note: Users should use list-wo-tool with search first to find the ID from a title
 */
export const getWorkOrderTool = createTool({
  id: 'get-wo-tool',
  description: 'Get a specific work order by display ID (e.g., WO-ACME-20251031-001). If you only have a title, use list-wo-tool with search parameter first to find the work order.',
  inputSchema: z.object({
    id: z.string().describe('The work order display ID (e.g., WO-ACME-20251031-001)'),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  execute: async ({ context, runtimeContext }: { context?: any; runtimeContext: RuntimeContext }) => {
    try {
      const { id } = context || {};

      if (!id) {
        return { ok: false, error: 'Work order ID is required' };
      }

      const BASE_URL = getBaseUrl(runtimeContext);
      const fetchOptions = createFetchOptions(runtimeContext, 'GET');
      
      // Always use display-id route
      const endpoint = `${BASE_URL}/api/work-orders/display-id/${id}`;
      
      const res = await fetch(endpoint, fetchOptions);

      return await handleApiResponse(res);
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  },
});

/**
 * Create Work Order Tool
 * Creates a new work order
 */
export const createWorkOrderTool = createTool({
  id: 'create-wo-tool',
  description: 'Create a new work order with title, description, priority, and other details.',
  inputSchema: z.object({
    title: z.string().describe('Work order title (required, max 255 characters)'),
    description: z.string().optional().describe('Work order description (optional, max 5000 characters)'),
    priority: z.enum(['low', 'medium', 'high', 'critical']).optional().describe('Priority level (default: medium)'),
    equipment_id: z.string().optional().describe('Equipment ID'),
    assigned_to: z.string().optional().describe('User ID to assign to (admin only)'),
    due_date: z.string().optional().describe('Due date (ISO format, e.g., "2025-11-10" or full ISO string)'),
    custom_fields: z.record(z.string(), z.unknown()).optional().describe('Custom fields object'),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  execute: async ({ context, runtimeContext }: { context?: any; runtimeContext: RuntimeContext }) => {
    try {
      const payload = context || {};

      if (!payload.title || typeof payload.title !== 'string' || !payload.title.trim()) {
        return { ok: false, error: 'Title is required to create a work order' };
      }

      // Validate description - CRITICAL: Description must be provided by user, never auto-generated
      if (!payload.description || typeof payload.description !== 'string' || !payload.description.trim()) {
        return { ok: false, error: 'Description is required. Please ask the user for a description of the work order before creating it.' };
      }

      // Validate description length and content
      const trimmedDescription = payload.description.trim();
      if (trimmedDescription.length < 10) {
        return { ok: false, error: 'Description must be at least 10 characters. Please ask the user to provide more details.' };
      }

      if (trimmedDescription.length > 5000) {
        return { ok: false, error: 'Description must be 5000 characters or less' };
      }

      // Convert due_date if provided in YYYY-MM-DD format
      let dueDate = payload.due_date;
      if (dueDate && typeof dueDate === 'string') {
        // Check if it looks like YYYY-MM-DD format (not full ISO string)
        if (dueDate.match(/^\d{4}-\d{2}-\d{2}$/) && !dueDate.includes('T')) {
          try {
            // Convert local date to UTC using timezone helper
            dueDate = localDateToUTC(dueDate);
          } catch (err) {
            return { ok: false, error: `Invalid date format: ${dueDate}. Use YYYY-MM-DD format.` };
          }
        }
      }

      const createPayload = {
        title: payload.title,
        description: trimmedDescription,
        priority: payload.priority || 'medium',
        equipment_id: payload.equipment_id || null,
        assigned_to: payload.assigned_to || null,
        due_date: dueDate || null,
        custom_fields: payload.custom_fields || {},
      };

      const BASE_URL = getBaseUrl(runtimeContext);
      const fetchOptions = createFetchOptions(runtimeContext, 'POST', createPayload);
      const res = await fetch(`${BASE_URL}/api/work-orders`, fetchOptions);

      return await handleApiResponse(res);
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  },
});

/**
 * Update Work Order Tool
 * Updates an existing work order
 * Note: Users should use list-wo-tool with search first to find the ID from a title
 */
export const updateWorkOrderTool = createTool({
  id: 'update-wo-tool',
  description: 'Update an existing work order by display ID (e.g., WO-ACME-20251031-001). If you only have a title, use list-wo-tool with search parameter first to find the work order.',
  inputSchema: z.object({
    id: z.string().describe('The work order display ID (e.g., WO-ACME-20251031-001)'),
    title: z.string().optional().describe('Work order title'),
    description: z.string().optional().describe('Work order description'),
    priority: z.enum(['low', 'medium', 'high', 'critical']).optional().describe('Priority level'),
    status: z.enum(['open', 'in_progress', 'completed', 'cancelled']).optional().describe('Work order status'),
    assigned_to: z.string().optional().describe('User ID to assign to'),
    due_date: z.string().optional().describe('Due date (ISO format, e.g., "2025-11-10" or full ISO string)'),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  execute: async ({ context, runtimeContext }: { context?: any; runtimeContext: RuntimeContext }) => {
    try {
      const { id, ...updatePayload } = context || {};

      if (!id) {
        return { ok: false, error: 'Work order ID is required' };
      }

      // Convert due_date if provided in YYYY-MM-DD format
      if (updatePayload.due_date && typeof updatePayload.due_date === 'string') {
        // Check if it looks like YYYY-MM-DD format (not full ISO string)
        if (updatePayload.due_date.match(/^\d{4}-\d{2}-\d{2}$/) && !updatePayload.due_date.includes('T')) {
          try {
            // Convert local date to UTC using timezone helper
            updatePayload.due_date = localDateToUTC(updatePayload.due_date);
          } catch (err) {
            return { ok: false, error: `Invalid date format: ${updatePayload.due_date}. Use YYYY-MM-DD format.` };
          }
        }
      }

      const BASE_URL = getBaseUrl(runtimeContext);
      const fetchOptions = createFetchOptions(runtimeContext, 'PATCH', updatePayload);
      
      // Always use display-id route
      const endpoint = `${BASE_URL}/api/work-orders/display-id/${id}`;
      const res = await fetch(endpoint, fetchOptions);

      return await handleApiResponse(res);
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  },
});

// =============================================
// Display & Formatting Tools
// =============================================

/**
 * Format Work Orders Tool
 * Formats work order data into a readable table format for display in chat
 */
export const formatWorkOrdersTool = createTool({
  id: 'format-wo-tool',
  description: 'Format work order data into a readable table. Use this to display work orders to users instead of showing raw JSON. Pass the result from list/get/create/update operations.',
  inputSchema: z.object({
    data: z.unknown().describe('Work order data to format (single object or array)'),
    format: z.enum(['table', 'detailed']).optional().describe('Format type: "table" for lists, "detailed" for single work order (default: auto-detect)'),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  execute: async ({ context }: { context?: any }) => {
    try {
      const { data, format } = context || {};

      if (!data) {
        return { ok: false, error: 'No data provided to format' };
      }

      // Auto-detect format if not specified
      let formattedOutput: string;
      
      if (Array.isArray(data)) {
        // It's a list of work orders
        formattedOutput = formatWorkOrdersAsTable(data);
      } else if (format === 'table' && data) {
        // Single work order but requested as table
        formattedOutput = formatWorkOrdersAsTable([data]);
      } else if (data) {
        // Single work order with detailed view
        formattedOutput = formatSingleWorkOrder(data);
      } else {
        return { ok: false, error: 'Invalid data format' };
      }

      return { ok: true, result: formattedOutput };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  },
});
