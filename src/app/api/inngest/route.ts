/**
 * Inngest API Route Handler
 *
 * Serves all Inngest functions and handles webhook requests
 * Endpoint: /api/inngest
 */

import { serve } from 'inngest/next';
import { inngest } from '@/lib/queue/client';
import { jobs } from '@/lib/queue/jobs';

// Create the Inngest serve handler
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: jobs,
  // Enable Inngest dev dashboard in development
  ...(process.env.NODE_ENV === 'development' && {
    signingKey: process.env.INNGEST_SIGNING_KEY,
  }),
});
