import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Middleware to protect routes and handle authentication redirects
 * 
 * Note: This is a simple version for MVP. For production, use Supabase middleware
 * to properly validate sessions server-side.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Get auth token from cookies (Supabase stores it as sb-*-auth-token)
  const authCookie = request.cookies.getAll().find(
    (cookie) => cookie.name.includes('sb-') && cookie.name.includes('auth-token')
  )

  const isAuthenticated = !!authCookie

  // Public routes (no auth required)
  const publicRoutes = ['/login', '/signup']
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route))

  // Redirect authenticated users away from auth pages
  if (isAuthenticated && isPublicRoute) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Redirect unauthenticated users to login
  // (All routes except public routes require authentication)
  if (!isAuthenticated && !isPublicRoute) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

/**
 * Configure which routes the middleware should run on
 * Exclude static files, API routes, and Next.js internals
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     * - public files (public folder)
     * - api routes (they handle their own auth)
     */
    '/((?!_next/static|_next/image|favicon.ico|api|.*\\..*$).*)',
  ],
}
