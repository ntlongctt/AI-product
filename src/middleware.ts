/**
 * Clerk Authentication Middleware
 *
 * Protects routes and API endpoints that require authentication
 */

import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// =============================================================================
// Route Matchers
// =============================================================================

/**
 * Routes that require authentication
 */
const isProtectedRoute = createRouteMatcher([
  // Dashboard routes
  '/studio(.*)',
  '/projects(.*)',
  '/assets(.*)',
  '/templates(.*)',
  '/settings(.*)',

  // API routes (except webhooks and public endpoints)
  '/api/projects(.*)',
  '/api/assets(.*)',
  '/api/ai(.*)',
  '/api/user(.*)',
  '/api/export(.*)',
]);

/**
 * Routes that are public (no auth required)
 */
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks(.*)',
  '/api/health',
  '/api/templates', // Template listing is public
  '/api/templates/(.*)',
]);

/**
 * Routes that should redirect authenticated users away
 */
const isAuthRoute = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)']);

// =============================================================================
// Middleware
// =============================================================================

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();

  // If user is authenticated and trying to access auth routes, redirect to dashboard
  if (userId && isAuthRoute(req)) {
    const dashboardUrl = new URL('/projects', req.url);
    return NextResponse.redirect(dashboardUrl);
  }

  // If route is protected and user is not authenticated, protect it
  if (isProtectedRoute(req)) {
    await auth.protect();
  }

  // Allow the request to continue
  return NextResponse.next();
});

// =============================================================================
// Configuration
// =============================================================================

export const config = {
  matcher: [
    // Match all routes except static files and Next.js internals
    '/((?!_next/static|_next/image|favicon.ico|public|generated).*)',
  ],
};
