/**
 * Storage Service
 *
 * High-level storage operations using Cloudflare R2
 * Provides presigned URLs, uploads, downloads, and file management
 */

import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
  CopyObjectCommand,
  type PutObjectCommandInput,
  type GetObjectCommandInput,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Upload } from '@aws-sdk/lib-storage';
import { getR2Client, getR2BucketName, getR2PublicUrl } from './r2.client';
import {
  generateStorageKey,
  generateThumbnailKey,
  getContentTypeFromFilename,
  getExtensionFromDataUrl,
  getExtensionFromContentType,
  type StorageFolder,
  calculateExpiresAt,
  isSupportedImageType,
  isFileSizeAllowed,
} from './utils';

// =============================================================================
// Types
// =============================================================================

export interface UploadResult {
  url: string;
  key: string;
  size: number;
  contentType: string;
}

export interface PresignedUrlResult {
  uploadUrl: string;
  publicUrl: string;
  key: string;
  expiresAt: Date;
}

export interface FileInfo {
  key: string;
  size: number;
  contentType: string;
  lastModified: Date;
  etag: string;
}

export interface UploadFromUrlOptions {
  contentType?: string;
  metadata?: Record<string, string>;
}

// =============================================================================
// Storage Service Class
// =============================================================================

export class StorageService {
  private client = getR2Client();
  private bucket = getR2BucketName();

  // ===========================================================================
  // Presigned URLs
  // ===========================================================================

  /**
   * Generate a presigned URL for client-side upload
   * @param userId - The user ID
   * @param filename - The original filename
   * @param contentType - The content type
   * @param folder - The storage folder
   * @param expiresIn - URL expiration in seconds (default: 1 hour)
   */
  async getPresignedUploadUrl(
    userId: string,
    filename: string,
    contentType: string,
    folder: StorageFolder = 'assets',
    expiresIn: number = 3600,
  ): Promise<PresignedUrlResult> {
    // Validate content type
    if (!isSupportedImageType(contentType)) {
      throw new Error(`Unsupported content type: ${contentType}`);
    }

    // Generate storage key
    const key = generateStorageKey(folder, userId, filename);

    // Create upload command
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    // Generate presigned URL
    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn });

    return {
      uploadUrl,
      publicUrl: getR2PublicUrl(key),
      key,
      expiresAt: calculateExpiresAt(expiresIn),
    };
  }

  /**
   * Generate a presigned URL for download
   * @param key - The object key
   * @param expiresIn - URL expiration in seconds (default: 1 hour)
   */
  async getPresignedDownloadUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return getSignedUrl(this.client, command, { expiresIn });
  }

  // ===========================================================================
  // Upload Operations
  // ===========================================================================

  /**
   * Upload a buffer to R2
   * @param buffer - The file buffer
   * @param key - The storage key
   * @param contentType - The content type
   * @param metadata - Optional metadata
   */
  async uploadBuffer(
    buffer: Buffer,
    key: string,
    contentType: string,
    metadata?: Record<string, string>,
  ): Promise<UploadResult> {
    const input: PutObjectCommandInput = {
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      Metadata: metadata,
    };

    await this.client.send(new PutObjectCommand(input));

    return {
      url: getR2PublicUrl(key),
      key,
      size: buffer.length,
      contentType,
    };
  }

  /**
   * Upload from a URL (for AI provider outputs)
   * @param sourceUrl - The source URL
   * @param destinationKey - The destination storage key
   * @param options - Upload options
   */
  async uploadFromUrl(
    sourceUrl: string,
    destinationKey: string,
    options?: UploadFromUrlOptions,
  ): Promise<UploadResult> {
    // Handle data URLs
    if (sourceUrl.startsWith('data:')) {
      return this.uploadFromDataUrl(sourceUrl, destinationKey, options);
    }

    // Download from URL
    const response = await fetch(sourceUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch from URL: ${response.status} ${response.statusText}`);
    }

    const contentType = options?.contentType || response.headers.get('content-type') || 'image/png';

    // Get buffer from response
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return this.uploadBuffer(buffer, destinationKey, contentType, options?.metadata);
  }

  /**
   * Upload from a base64 data URL
   * @param dataUrl - The data URL
   * @param destinationKey - The destination storage key
   * @param options - Upload options
   */
  private async uploadFromDataUrl(
    dataUrl: string,
    destinationKey: string,
    options?: UploadFromUrlOptions,
  ): Promise<UploadResult> {
    // Extract base64 data
    const match = dataUrl.match(/^data:image\/[a-zA-Z0-9+]+;base64,(.+)$/);
    if (!match) {
      throw new Error('Invalid data URL format');
    }

    const extension = getExtensionFromDataUrl(dataUrl);
    const contentType = options?.contentType || `image/${extension === 'jpg' ? 'jpeg' : extension}`;
    const buffer = Buffer.from(match[1], 'base64');

    // Ensure key has correct extension
    const key = destinationKey.endsWith(`.${extension}`)
      ? destinationKey
      : `${destinationKey}.${extension}`;

    return this.uploadBuffer(buffer, key, contentType, options?.metadata);
  }

  /**
   * Upload using multipart for large files
   * @param buffer - The file buffer
   * @param key - The storage key
   * @param contentType - The content type
   */
  async uploadLargeFile(
    buffer: Buffer,
    key: string,
    contentType: string,
  ): Promise<UploadResult> {
    const upload = new Upload({
      client: this.client,
      params: {
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      },
    });

    await upload.done();

    return {
      url: getR2PublicUrl(key),
      key,
      size: buffer.length,
      contentType,
    };
  }

  // ===========================================================================
  // Download Operations
  // ===========================================================================

  /**
   * Download a file as buffer
   * @param key - The object key
   */
  async downloadBuffer(key: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    const response = await this.client.send(command);

    if (!response.Body) {
      throw new Error('Empty response body');
    }

    const arrayBuffer = await response.Body.transformToByteArray();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Get file stream (for large files)
   * @param key - The object key
   */
  async getFileStream(key: string): Promise<ReadableStream<Uint8Array> | null> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    const response = await this.client.send(command);
    return response.Body?.transformToWebStream() ?? null;
  }

  // ===========================================================================
  // File Management
  // ===========================================================================

  /**
   * Delete a file
   * @param key - The object key
   */
  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }

  /**
   * Delete multiple files
   * @param keys - Array of object keys
   */
  async deleteMany(keys: string[]): Promise<void> {
    if (keys.length === 0) return;

    await this.client.send(
      new DeleteObjectsCommand({
        Bucket: this.bucket,
        Delete: {
          Objects: keys.map((key) => ({ Key: key })),
          Quiet: true,
        },
      }),
    );
  }

  /**
   * Copy a file
   * @param sourceKey - Source object key
   * @param destinationKey - Destination object key
   */
  async copy(sourceKey: string, destinationKey: string): Promise<void> {
    await this.client.send(
      new CopyObjectCommand({
        Bucket: this.bucket,
        CopySource: `${this.bucket}/${sourceKey}`,
        Key: destinationKey,
      }),
    );
  }

  /**
   * Check if a file exists
   * @param key - The object key
   */
  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get file info
   * @param key - The object key
   */
  async getFileInfo(key: string): Promise<FileInfo | null> {
    try {
      const response = await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );

      return {
        key,
        size: response.ContentLength ?? 0,
        contentType: response.ContentType ?? 'application/octet-stream',
        lastModified: response.LastModified ?? new Date(),
        etag: response.ETag ?? '',
      };
    } catch {
      return null;
    }
  }

  // ===========================================================================
  // Thumbnail Generation
  // ===========================================================================

  /**
   * Generate a thumbnail key (actual generation would require image processing library)
   * This method prepares the thumbnail path and returns upload URL
   * @param originalKey - The original file key
   * @param width - Thumbnail width (default: 200)
   * @param expiresIn - URL expiration in seconds
   */
  async getThumbnailUploadUrl(
    originalKey: string,
    width: number = 200,
    expiresIn: number = 3600,
  ): Promise<PresignedUrlResult> {
    const thumbnailKey = generateThumbnailKey(originalKey, width);

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: thumbnailKey,
      ContentType: 'image/jpeg',
    });

    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn });

    return {
      uploadUrl,
      publicUrl: getR2PublicUrl(thumbnailKey),
      key: thumbnailKey,
      expiresAt: calculateExpiresAt(expiresIn),
    };
  }

  /**
   * Get thumbnail URL for an image
   * @param originalKey - The original file key
   * @param width - Thumbnail width
   */
  getThumbnailUrl(originalKey: string, width: number = 200): string {
    const thumbnailKey = generateThumbnailKey(originalKey, width);
    return getR2PublicUrl(thumbnailKey);
  }

  // ===========================================================================
  // Utility Methods
  // ===========================================================================

  /**
   * Get public URL for a key
   * @param key - The object key
   */
  getPublicUrl(key: string): string {
    return getR2PublicUrl(key);
  }

  /**
   * Generate a unique storage key
   */
  generateKey(folder: StorageFolder, userId: string, filename: string): string {
    return generateStorageKey(folder, userId, filename);
  }

  /**
   * Validate file size for folder
   */
  isFileSizeAllowed(folder: StorageFolder, size: number): boolean {
    return isFileSizeAllowed(folder, size);
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

let storageService: StorageService | null = null;

/**
 * Get the storage service instance
 */
export function getStorageService(): StorageService {
  if (!storageService) {
    storageService = new StorageService();
  }
  return storageService;
}

/**
 * Reset the storage service (useful for testing)
 */
export function resetStorageService(): void {
  storageService = null;
}
