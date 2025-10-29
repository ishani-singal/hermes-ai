import { NextRequest } from 'next/server';
import { route, type RouteContext } from '../../../lib/auth/route-builder';
import { success, badRequest } from '../../../lib/auth/middleware';
import { mastra } from '../../../mastra';
import { RuntimeContext } from '@mastra/core/runtime-context';

// POST /api/ai — requires auth so we have user context for any actions
export const POST = route()
  .auth()
  .handle(async (request: NextRequest, context: RouteContext) => {
    try {
      const { user } = context;

      const body = await request.json();
      const { message } = body;

      if (!message || typeof message !== 'string') {
        return badRequest('message string required');
      }

      // Determine origin for absolute URL construction
      const origin = new URL(request.url).origin || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001';

      // runtimeContext: put small, serializable objects here
      const runtimeContext = new RuntimeContext();
      runtimeContext.set('user', user);
      runtimeContext.set('cookie', request.headers.get('cookie') || '');
      runtimeContext.set('origin', origin);

      // Get the agent from the mastra instance
      const agent = mastra.getAgent('technicianAgent');

      // Call the agent with the user message
      console.log('[api/ai] calling agent.generate, message length:', typeof message === 'string' ? message.length : 0)
      // Pass serialized runtimeContext to improve tool-context propagation
      // cast to any to satisfy TypeScript typings for Mastra API while ensuring
      // the runtimeContext is serialized for tool propagation at runtime.
      const response = await agent.generate(message, 
        { runtimeContext: runtimeContext });
      console.log('[api/ai] agent response:', response)

      return success({ 
        assistant: {
          text: response.text,
          action: null,
        },
      });
    } catch (err: unknown) {
      console.error('AI route error:', err);
      return badRequest(String(err));
    }
});
