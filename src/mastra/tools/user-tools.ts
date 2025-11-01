import { z } from 'zod';
import { createTool } from '@mastra/core/tools';
import { RuntimeContext } from '@mastra/core/runtime-context';

// =============================================
// Types
// =============================================

interface UserData {
  id: string;
  email: string;
  full_name: string;
  user_id: string;
}

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
function createFetchOptions(runtimeContext: RuntimeContext, method: string = 'GET'): RequestInit {
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

// =============================================
// User Lookup Tools
// =============================================

/**
 * List Users Tool
 * Lists all users in the company with their names and emails
 * Does not expose user_id by default unless explicitly requested
 */
export const listUsersTool = createTool({
  id: 'list-users-tool',
  description: 'List all users in your company with their names and emails. Use this to find users when you need to assign work orders.',
  inputSchema: z.object({
    search: z.string().optional().describe('Optional search term to filter users by name or email'),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  execute: async ({ context, runtimeContext }: { context?: any; runtimeContext: RuntimeContext }) => {
    try {
      const BASE_URL = getBaseUrl(runtimeContext);
      const fetchOptions = createFetchOptions(runtimeContext, 'GET');
      
      // Fetch all users in the company (via user-companies endpoint or similar)
      // For now, we'll use a basic query - this may need adjustment based on your actual API
      const res = await fetch(`${BASE_URL}/api/users`, fetchOptions);

      const response = await handleApiResponse(res);
      
      if (!response.ok) {
        return response;
      }

      // Filter by search if provided
      const allUsers = Array.isArray(response.result) ? response.result as UserData[] : [];
      
      let users = allUsers;
      if (context?.search) {
        const searchLower = String(context.search).toLowerCase();
        users = allUsers.filter((user: UserData) => {
          const name = String(user.full_name || '').toLowerCase();
          const email = String(user.email || '').toLowerCase();
          return name.includes(searchLower) || email.includes(searchLower);
        });
      }

      // Format users for display
      if (users.length === 0) {
        return { ok: true, result: 'No users found.' };
      }

      let output = '## Users\n\n';
      users.forEach((user: UserData) => {
        output += `- **${user.full_name || 'Unknown'}** (${user.email || 'no-email'})\n`;
        output += `  - User ID: \`${user.id}\` (use this ID when assigning work orders)\n`;
      });

      return { ok: true, result: output };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  },
});

/**
 * Find User Tool
 * Searches for a user by name or email and returns their GUID for API operations
 * This tool is used internally when the AI needs to get a user ID for assignments
 */
export const findUserTool = createTool({
  id: 'find-user-tool',
  description: 'Find a user by name or email and get their ID for assigning work orders. Returns the user GUID needed for API calls.',
  inputSchema: z.object({
    query: z.string().describe('User name or email to search for'),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  execute: async ({ context, runtimeContext }: { context?: any; runtimeContext: RuntimeContext }) => {
    try {
      const { query } = context || {};

      if (!query || typeof query !== 'string' || !query.trim()) {
        return { ok: false, error: 'Query is required to find a user' };
      }

      const BASE_URL = getBaseUrl(runtimeContext);
      const fetchOptions = createFetchOptions(runtimeContext, 'GET');
      
      // Fetch all users and search
      const res = await fetch(`${BASE_URL}/api/users`, fetchOptions);
      const response = await handleApiResponse(res);
      
      if (!response.ok) {
        return response;
      }

      const users = Array.isArray(response.result) ? response.result as UserData[] : [];
      
      // Search by name or email
      const queryLower = query.toLowerCase();
      const matches = users.filter((user: UserData) => {
        const name = String(user.full_name || '').toLowerCase();
        const email = String(user.email || '').toLowerCase();
        return name.includes(queryLower) || email.includes(queryLower);
      });

      if (matches.length === 0) {
        return { 
          ok: false, 
          error: `No user found matching "${query}". Use list-users-tool to see all available users.` 
        };
      }

      if (matches.length > 1) {
        let output = `Multiple users found matching "${query}":\n\n`;
        matches.forEach((user: UserData) => {
          output += `- **${user.full_name || 'Unknown'}** (${user.email || 'no-email'})\n`;
          output += `  - ID: \`${user.id}\`\n`;
        });
        output += '\nPlease be more specific or use the exact email address.';
        return { ok: false, error: output };
      }

      // Single match found
      const user = matches[0];
      return {
        ok: true,
        result: {
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          user_id: user.user_id,
          message: `Found user: ${user.full_name || 'Unknown'} (${user.email || 'no-email'}). Use ID: ${user.id} for assignments.`
        }
      };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  },
});

