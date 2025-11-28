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
      const { message, threadId, streamMode = false, language } = body;

      console.log('[AI] Received request:', { userId: user?.id, streamMode, language, messageLength: message?.length });

      if (!message || typeof message !== 'string') {
        console.warn('[AI] Invalid message in request');
        return badRequest('message string required');
      }

      // Determine mode based on streamMode flag
      const mode = streamMode ? 'VOICE' : 'TEXT';

      const baseUrl = process.env.INTERNAL_API_BASE_URL;

      const runtimeContext = new RuntimeContext();
      runtimeContext.set('user', user);
      runtimeContext.set('cookie', request.headers.get('cookie') || '');
      runtimeContext.set('baseUrl', baseUrl);

      // Set company ID for RAG operations
      if (user?.companyId) {
        runtimeContext.set('companyId', user.companyId);
      }

      const conversationThreadId = threadId || `thread_${user?.id}_${Date.now()}`;

      const workflow = mastra.getWorkflow('assistantWorkflow');
      const run = await workflow.createRunAsync();

      console.log('[AI] Starting workflow:', { mode, language, threadId: conversationThreadId });

      const result = await run.start({
        inputData: {
          message,
          mode,
          language,  // Pass language to workflow
          threadId: conversationThreadId,
          resourceId: user?.id,
        },
        runtimeContext,
      });

      if (result.status !== 'success') {
        console.error('[AI] Workflow failed:', { status: result.status, result });
        return badRequest('Workflow execution failed');
      }

      const hasAudio = !!result.result.audioBase64;
      console.log('[AI] Workflow succeeded:', { mode, hasAudio, textLength: result.result.text?.length });

      return success({
        assistant: {
          text: result.result.text,
          audioBase64: result.result.audioBase64,
          action: null,
        },
        threadId: conversationThreadId,
      });
    } catch (err: unknown) {
      console.error('[AI] Route error:', err);
      return badRequest(String(err));
    }
  });
