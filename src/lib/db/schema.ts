/**
 * Database Schema for Product Image AI Studio
 *
 * Tables:
 * - users: User accounts synced from Clerk
 * - projects: User projects with layers
 * - assets: User-uploaded assets (products, backgrounds, models)
 * - templates: Pre-made project templates
 * - generations: AI generation job history
 * - usage_logs: Usage tracking for analytics
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  integer,
  boolean,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core';

// =============================================================================
// ENUMS
// =============================================================================

export const projectStatusEnum = pgEnum('project_status', [
  'active',
  'archived',
  'deleted',
]);

export const assetTypeEnum = pgEnum('asset_type', [
  'model',
  'product',
  'background',
  'brand',
  'prop',
]);

export const generationStatusEnum = pgEnum('generation_status', [
  'pending',
  'processing',
  'completed',
  'failed',
]);

export const planEnum = pgEnum('plan', ['free', 'pro', 'agency']);

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface UserPreferences {
  defaultExportFormat: 'jpeg' | 'png';
  jpegQuality: number;
  shareUsageData: boolean;
}

export interface Layer {
  id: string;
  type: 'image' | 'background' | 'text';
  name: string;
  url?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scale: number;
  opacity: number;
  zIndex: number;
  visible: boolean;
  locked: boolean;
}

export interface ProjectSettings {
  width: number;
  height: number;
  backgroundColor?: string;
}

export interface AssetMetadata {
  originalFilename?: string;
  description?: string;
}

// =============================================================================
// TABLES
// =============================================================================

/**
 * Users table - synced from Clerk via webhooks
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clerkId: text('clerk_id').unique().notNull(),
    email: text('email').notNull(),
    name: text('name'),
    avatarUrl: text('avatar_url'),
    plan: planEnum('plan').default('free').notNull(),
    stripeCustomerId: text('stripe_customer_id'),
    stripeSubscriptionId: text('stripe_subscription_id'),
    generationsUsed: integer('generations_used').default(0).notNull(),
    generationsLimit: integer('generations_limit').default(10).notNull(),
    billingCycleStart: timestamp('billing_cycle_start'),
    preferences: jsonb('preferences')
      .default({})
      .$type<UserPreferences>(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('users_clerk_id_idx').on(table.clerkId)],
);

/**
 * Projects table - user's workspace projects
 */
export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    name: text('name').notNull(),
    sku: text('sku'),
    thumbnailUrl: text('thumbnail_url'),
    layers: jsonb('layers').default([]).$type<Layer[]>(),
    settings: jsonb('settings')
      .default({ width: 1200, height: 1200 })
      .$type<ProjectSettings>(),
    status: projectStatusEnum('status').default('active').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('projects_user_id_idx').on(table.userId),
    index('projects_status_idx').on(table.status),
  ],
);

/**
 * Assets table - user's uploaded assets
 */
export const assets = pgTable(
  'assets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    type: assetTypeEnum('type').notNull(),
    name: text('name').notNull(),
    url: text('url').notNull(),
    thumbnailUrl: text('thumbnail_url'),
    fileSize: integer('file_size'),
    width: integer('width'),
    height: integer('height'),
    mimeType: text('mime_type'),
    tags: text('tags').array().default([]),
    metadata: jsonb('metadata').default({}).$type<AssetMetadata>(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('assets_user_id_idx').on(table.userId),
    index('assets_type_idx').on(table.type),
  ],
);

/**
 * Templates table - pre-made project templates
 */
export const templates = pgTable(
  'templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    slug: text('slug').unique().notNull(),
    category: text('category').notNull(),
    thumbnailUrl: text('thumbnail_url').notNull(),
    layers: jsonb('layers').default([]).$type<Layer[]>(),
    prompt: text('prompt'),
    promptVariables: jsonb('prompt_variables').default([]).$type<string[]>(),
    usageCount: integer('usage_count').default(0).notNull(),
    isFree: boolean('is_free').default(true).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    sortOrder: integer('sort_order').default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('templates_category_idx').on(table.category),
    index('templates_slug_idx').on(table.slug),
  ],
);

/**
 * Generations table - AI generation job history
 */
export const generations = pgTable(
  'generations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    projectId: uuid('project_id').references(() => projects.id, {
      onDelete: 'set null',
    }),

    // Task info
    task: text('task').notNull(), // remove-bg, upscale, scene-gen, try-on, etc.
    provider: text('provider').notNull(), // fal, replicate, openai, gemini, zai
    model: text('model').notNull(),

    // Input/Output
    inputUrl: text('input_url'),
    inputUrls: jsonb('input_urls').default([]).$type<string[]>(),
    prompt: text('prompt'),
    options: jsonb('options').default({}),
    outputUrl: text('output_url'),
    outputUrls: jsonb('output_urls').default([]).$type<string[]>(),

    // Status
    status: generationStatusEnum('status').default('pending').notNull(),
    externalJobId: text('external_job_id'), // Provider's job ID

    // Metrics
    cost: integer('cost'), // in cents
    durationMs: integer('duration_ms'),
    retryCount: integer('retry_count').default(0),

    // Error handling
    error: text('error'),
    errorCode: text('error_code'),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),
  },
  (table) => [
    index('generations_user_id_idx').on(table.userId),
    index('generations_status_idx').on(table.status),
    index('generations_task_idx').on(table.task),
  ],
);

/**
 * Usage logs table - for analytics and billing
 */
export const usageLogs = pgTable(
  'usage_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    generationId: uuid('generation_id').references(() => generations.id, {
      onDelete: 'set null',
    }),
    task: text('task').notNull(),
    provider: text('provider').notNull(),
    cost: integer('cost').default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('usage_logs_user_id_idx').on(table.userId)],
);

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;

export type Asset = typeof assets.$inferSelect;
export type NewAsset = typeof assets.$inferInsert;

export type Template = typeof templates.$inferSelect;
export type NewTemplate = typeof templates.$inferInsert;

export type Generation = typeof generations.$inferSelect;
export type NewGeneration = typeof generations.$inferInsert;

export type UsageLog = typeof usageLogs.$inferSelect;
export type NewUsageLog = typeof usageLogs.$inferInsert;

// Union types for status enums
export type ProjectStatus = (typeof projectStatusEnum.enumValues)[number];
export type AssetType = (typeof assetTypeEnum.enumValues)[number];
export type GenerationStatus = (typeof generationStatusEnum.enumValues)[number];
export type Plan = (typeof planEnum.enumValues)[number];

// AI Task types
export type AITask =
  | 'remove-bg'
  | 'upscale'
  | 'scene-gen'
  | 'try-on'
  | 'polish'
  | 'relight'
  | 'object-removal';

// AI Provider types
export type AIProvider = 'fal' | 'replicate' | 'openai' | 'gemini' | 'zai';
