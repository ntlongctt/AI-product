/**
 * Cloudflare R2 Client
 *
 * S3-compatible client for Cloudflare R2 storage
 * R2 provides S3-compatible API with zero egress fees
 */

import { S3Client, type S3ClientConfig } from '@aws-sdk/client-s3';

/**
 * R2 Configuration from environment
 */
interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrl?: string;
}

/**
 * Get R2 configuration from environment variables
 */
function getR2Config(): R2Config {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME;
  const publicUrl = process.env.R2_PUBLIC_URL;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    throw new Error(
      'Missing R2 configuration. Please set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME environment variables.',
    );
  }

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucketName,
    publicUrl,
  };
}

/**
 * Create R2 S3-compatible client
 */
function createR2Client(config: R2Config): S3Client {
  const clientConfig: S3ClientConfig = {
    region: 'auto',
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    // R2-specific settings
    maxAttempts: 3,
    retryMode: 'standard',
  };

  return new S3Client(clientConfig);
}

// Global client instance
let r2Client: S3Client | null = null;
let r2Config: R2Config | null = null;

/**
 * Get the R2 client instance
 * Creates a new client if one doesn't exist
 */
export function getR2Client(): S3Client {
  if (!r2Client) {
    r2Config = getR2Config();
    r2Client = createR2Client(r2Config);
  }
  return r2Client;
}

/**
 * Get the R2 configuration
 */
export function getR2ConfigInstance(): R2Config {
  if (!r2Config) {
    r2Config = getR2Config();
  }
  return r2Config;
}

/**
 * Get the R2 bucket name
 */
export function getR2BucketName(): string {
  return getR2ConfigInstance().bucketName;
}

/**
 * Get the public URL for an R2 object
 * Falls back to constructing URL from bucket and account ID if PUBLIC_URL not set
 */
export function getR2PublicUrl(key: string): string {
  const config = getR2ConfigInstance();

  if (config.publicUrl) {
    return `${config.publicUrl}/${key}`;
  }

  // Fallback: R2 public bucket URL format
  return `https://pub-${config.bucketName}.${config.accountId}.r2.dev/${key}`;
}

/**
 * Reset the R2 client (useful for testing)
 */
export function resetR2Client(): void {
  r2Client = null;
  r2Config = null;
}

/**
 * Check if R2 is configured
 */
export function isR2Configured(): boolean {
  try {
    getR2Config();
    return true;
  } catch {
    return false;
  }
}

// Re-export S3 types for convenience
export type { S3Client };
