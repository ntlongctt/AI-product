/**
 * Storage Module
 *
 * Exports for Cloudflare R2-based file storage
 */

// R2 Client
export {
  getR2Client,
  getR2BucketName,
  getR2PublicUrl,
  resetR2Client,
  isR2Configured,
} from './r2.client';

// R2 Storage Service
export {
  StorageService,
  getStorageService,
  resetStorageService,
  type UploadResult,
  type PresignedUrlResult,
  type FileInfo,
  type UploadFromUrlOptions,
} from './r2.service';

// Local Storage Service (fallback for development)
export {
  StorageService as LocalStorageService,
  getStorageService as getLocalStorageService,
  type SaveImageResult,
} from './service';

// Utilities
export {
  generateStorageKey,
  generateGenerationKey,
  generateAssetKey,
  generateThumbnailKey,
  sanitizeFilename,
  getExtensionFromFilename,
  getContentTypeFromFilename,
  getContentTypeFromExtension,
  getExtensionFromContentType,
  isSupportedImageType,
  parseStorageKey,
  formatFileSize,
  type StorageFolder,
  type SupportedImageType,
  SUPPORTED_IMAGE_TYPES,
  MAX_FILE_SIZES,
} from './utils';
