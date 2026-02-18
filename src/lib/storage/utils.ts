/**
 * Storage Utilities
 *
 * Helper functions for file handling, path generation, and content type detection
 */

/**
 * Supported image content types
 */
export const SUPPORTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

export type SupportedImageType = (typeof SUPPORTED_IMAGE_TYPES)[number];

/**
 * Map of content types to file extensions
 */
const CONTENT_TYPE_TO_EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

/**
 * Map of file extensions to content types
 */
const EXTENSION_TO_CONTENT_TYPE: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
};

/**
 * Storage folders for organizing files
 */
export type StorageFolder = 'assets' | 'generations' | 'exports' | 'thumbnails' | 'temp';

/**
 * Generate a unique storage key
 * @param folder - The storage folder
 * @param userId - The user ID
 * @param filename - The original filename or base name
 * @param extension - Optional file extension
 */
export function generateStorageKey(
  folder: StorageFolder,
  userId: string,
  filename: string,
  extension?: string,
): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const sanitizedFilename = sanitizeFilename(filename);

  // Extract or use provided extension
  const ext = extension || getExtensionFromFilename(filename);

  if (ext) {
    return `${folder}/${userId}/${timestamp}-${random}-${sanitizedFilename}.${ext}`;
  }

  return `${folder}/${userId}/${timestamp}-${random}-${sanitizedFilename}`;
}

/**
 * Generate a storage key for AI generation output
 * @param userId - The user ID
 * @param task - The AI task type
 * @param generationId - The generation ID
 * @param extension - File extension
 */
export function generateGenerationKey(
  userId: string,
  task: string,
  generationId: string,
  extension: string = 'png',
): string {
  return `generations/${userId}/${task}/${generationId}.${extension}`;
}

/**
 * Generate a storage key for user asset
 * @param userId - The user ID
 * @param assetId - The asset ID
 * @param filename - The original filename
 */
export function generateAssetKey(userId: string, assetId: string, filename: string): string {
  const ext = getExtensionFromFilename(filename);
  return `assets/${userId}/${assetId}.${ext}`;
}

/**
 * Generate a thumbnail key from original key
 * @param originalKey - The original file key
 * @param size - Thumbnail size (width)
 */
export function generateThumbnailKey(originalKey: string, size: number = 200): string {
  const parts = originalKey.split('/');
  const filename = parts.pop() || '';
  const nameWithoutExt = filename.replace(/\.[^.]+$/, '');

  return `thumbnails/${parts.join('/')}/${nameWithoutExt}-${size}w.jpg`;
}

/**
 * Sanitize filename for storage
 * - Remove special characters
 * - Convert spaces to hyphens
 * - Lowercase
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 100); // Limit length
}

/**
 * Get file extension from filename
 */
export function getExtensionFromFilename(filename: string): string {
  const match = filename.match(/\.([a-zA-Z0-9]+)$/);
  return match ? match[1].toLowerCase() : '';
}

/**
 * Get content type from filename
 */
export function getContentTypeFromFilename(filename: string): string {
  const ext = getExtensionFromFilename(filename);
  return EXTENSION_TO_CONTENT_TYPE[ext] || 'application/octet-stream';
}

/**
 * Get content type from extension
 */
export function getContentTypeFromExtension(extension: string): string {
  return EXTENSION_TO_CONTENT_TYPE[extension.toLowerCase()] || 'application/octet-stream';
}

/**
 * Get extension from content type
 */
export function getExtensionFromContentType(contentType: string): string {
  return CONTENT_TYPE_TO_EXTENSION[contentType.toLowerCase()] || 'bin';
}

/**
 * Extract extension from data URL
 */
export function getExtensionFromDataUrl(dataUrl: string): string {
  const match = dataUrl.match(/^data:image\/([a-zA-Z0-9+]+);/);
  if (match) {
    const mime = match[1].toLowerCase();
    if (mime === 'jpeg' || mime === 'jpg') return 'jpg';
    if (mime === 'png') return 'png';
    if (mime === 'webp') return 'webp';
    if (mime === 'gif') return 'gif';
  }
  return 'png';
}

/**
 * Check if content type is a supported image type
 */
export function isSupportedImageType(contentType: string): boolean {
  return SUPPORTED_IMAGE_TYPES.includes(contentType.toLowerCase() as SupportedImageType);
}

/**
 * Parse storage key to extract components
 */
export function parseStorageKey(key: string): {
  folder: string;
  userId?: string;
  filename: string;
} {
  const parts = key.split('/');
  const filename = parts.pop() || '';
  const folder = parts[0] || '';

  // For user-specific paths (assets, generations)
  const userId = parts.length > 1 ? parts[1] : undefined;

  return { folder, userId, filename };
}

/**
 * Get file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Calculate expiry time for presigned URLs
 */
export function calculateExpiresAt(expiresInSeconds: number): Date {
  return new Date(Date.now() + expiresInSeconds * 1000);
}

/**
 * Maximum file sizes by folder type (in bytes)
 */
export const MAX_FILE_SIZES: Record<StorageFolder, number> = {
  assets: 50 * 1024 * 1024, // 50MB
  generations: 20 * 1024 * 1024, // 20MB
  exports: 50 * 1024 * 1024, // 50MB
  thumbnails: 5 * 1024 * 1024, // 5MB
  temp: 100 * 1024 * 1024, // 100MB
};

/**
 * Check if file size is within limits
 */
export function isFileSizeAllowed(folder: StorageFolder, size: number): boolean {
  return size <= MAX_FILE_SIZES[folder];
}
