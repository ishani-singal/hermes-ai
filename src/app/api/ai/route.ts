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
      const { message, threadId, resourceId, mode = 'TEXT' } = body;

      if (!message || typeof message !== 'string') {
        return badRequest('message string required');
      }

      const baseUrl = process.env.INTERNAL_API_BASE_URL;

      const runtimeContext = new RuntimeContext();
      runtimeContext.set('user', user);
      runtimeContext.set('cookie', request.headers.get('cookie') || '');
      runtimeContext.set('baseUrl', baseUrl);

      const conversationThreadId = threadId || `thread_${user?.id}_${Date.now()}`;

      const workflow = mastra.getWorkflow('assistantWorkflow');
      const run = await workflow.createRunAsync();
      
      const result = await run.start({
        inputData: {
          message,
          mode,
          threadId: conversationThreadId,
          resourceId: resourceId || user?.id,
        },
        runtimeContext,
      });

      if (result.status !== 'success') {
        return badRequest('Workflow execution failed');
      }
      
      return success({ 
        assistant: {
          text: result.result.text,
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
