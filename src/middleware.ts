import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

/**
 * Middleware to handle Supabase authentication and session management
 * Uses Supabase SSR for proper cookie handling and session refresh
 */
export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

/**
 * Configure which routes the middleware should run on
 * Exclude static files and image optimization
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     * - Static assets (svg, png, jpg, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
