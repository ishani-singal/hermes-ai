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
      const { message, threadId, resourceId } = body;

      if (!message || typeof message !== 'string') {
        return badRequest('message string required');
      }

      
      // Use internal API BASE URL for server-to-server calls (tools making fetch requests back to our API)
      // In production on Render: http://localhost:10000
      // In development: http://localhost:3000
      const baseUrl = process.env.INTERNAL_API_BASE_URL;

      // runtimeContext: put small, serializable objects here
      const runtimeContext = new RuntimeContext();
      runtimeContext.set('user', user);
      runtimeContext.set('cookie', request.headers.get('cookie') || '');
      runtimeContext.set('baseUrl', baseUrl);

      // Get the agent from the mastra instance
      const agent = mastra.getAgent('technicianAgent');

      // If no threadId provided, generate one for this new conversation
      // This allows frontend to maintain conversation context across messages
      const conversationThreadId = threadId || `thread_${user?.id}_${Date.now()}`;

      // Call the agent with the user message and memory context
      console.log('[api/ai] calling agent.generate, message length:', message.length, 'threadId:', conversationThreadId)
      
      const response = await agent.generate(message, 
        { 
          runtimeContext: runtimeContext,
          memory: {
            resource: resourceId || user?.id,
            thread: conversationThreadId,
          }
        });
      
      console.log('[api/ai] agent response text length:', response.text.length)
      
      return success({ 
        assistant: {
          text: response.text,
          action: null,
        },
        // Return threadId so frontend can send it in subsequent messages
        threadId: conversationThreadId,
      });
    } catch (err: unknown) {
      console.error('AI route error:', err);
      return badRequest(String(err));
    }
  });
