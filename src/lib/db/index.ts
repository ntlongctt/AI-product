/**
 * Database Client
 *
 * Uses Drizzle ORM with PostgreSQL (via postgres.js driver)
 * Supports both pooled (DATABASE_URL) and direct (DIRECT_URL) connections
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Check for database URL
const databaseUrl = process.env.DATABASE_URL;
const directUrl = process.env.DIRECT_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is not set');
}

// Connection configuration
const connectionString = directUrl || databaseUrl;

// Create postgres connection
// For migrations and direct queries, use a single connection
// For query execution, use a connection pool
const queryClient = postgres(connectionString, {
  max: 10, // Connection pool size
  idle_timeout: 20,
  connect_timeout: 10,
});

// Create Drizzle instance with schema
export const db = drizzle(queryClient, { schema });

// Export schema for use in repositories
export * from './schema';

// Export types
export type { User, Project, Asset, Template, Generation, UsageLog } from './schema';

// Graceful shutdown helper
export async function closeDbConnection() {
  await queryClient.end();
}
