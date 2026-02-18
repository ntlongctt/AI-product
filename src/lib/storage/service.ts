import { promises as fs } from 'fs';
import path from 'path';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';

/**
 * Configuration for storage service
 */
interface StorageConfig {
  storagePath: string;
  publicUrl: string;
}

/**
 * Result from saving an image
 */
export interface SaveImageResult {
  filePath: string;
  publicUrl: string;
  fileName: string;
}

/**
 * Get storage configuration from environment variables
 */
function getStorageConfig(): StorageConfig {
  // In Node.js environment, use process.cwd() as base
  const basePath = process.cwd();
  const storagePath = process.env.STORAGE_PATH || 'public/generated';
  const publicUrl = process.env.PUBLIC_STORAGE_URL || '/generated';

  return {
    storagePath: path.isAbsolute(storagePath)
      ? storagePath
      : path.join(basePath, storagePath),
    publicUrl,
  };
}

/**
 * Storage service for saving generated images to disk
 */
export class StorageService {
  private config: StorageConfig;

  constructor(config?: Partial<StorageConfig>) {
    this.config = {
      ...getStorageConfig(),
      ...config,
    };
  }

  /**
   * Ensure the storage directory exists
   */
  async ensureDirectory(): Promise<void> {
    try {
      await fs.access(this.config.storagePath);
    } catch {
      await fs.mkdir(this.config.storagePath, { recursive: true });
    }
  }

  /**
   * Generate a unique filename for an image
   * @param task - The AI task type
   * @param extension - File extension (defaults to 'png')
   */
  generateFilename(task: string, extension = 'png'): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${task}-${timestamp}-${random}.${extension}`;
  }

  /**
   * Determine file extension from content type or URL
   */
  private getExtensionFromContentType(contentType: string): string {
    const mimeToExt: Record<string, string> = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/webp': 'webp',
      'image/gif': 'gif',
    };

    return mimeToExt[contentType.toLowerCase()] || 'png';
  }

  /**
   * Determine file extension from data URL
   */
  private getExtensionFromDataUrl(dataUrl: string): string {
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
   * Extract base64 data from data URL
   */
  private extractBase64FromDataUrl(dataUrl: string): string {
    const match = dataUrl.match(/^data:image\/[a-zA-Z0-9+]+;base64,(.+)$/);
    if (!match) {
      throw new Error('Invalid data URL format');
    }
    return match[1];
  }

  /**
   * Save a base64 data URL to disk
   */
  private async saveBase64Image(
    dataUrl: string,
    filename: string
  ): Promise<SaveImageResult> {
    await this.ensureDirectory();

    const extension = this.getExtensionFromDataUrl(dataUrl);
    const fileName = filename.endsWith(`.${extension}`)
      ? filename
      : `${filename}.${extension}`;

    const filePath = path.join(this.config.storagePath, fileName);
    const base64Data = this.extractBase64FromDataUrl(dataUrl);
    const buffer = Buffer.from(base64Data, 'base64');

    await fs.writeFile(filePath, buffer);

    return {
      filePath,
      publicUrl: `${this.config.publicUrl}/${fileName}`,
      fileName,
    };
  }

  /**
   * Download and save an image from HTTP URL
   */
  private async saveHttpImage(
    url: string,
    filename: string
  ): Promise<SaveImageResult> {
    await this.ensureDirectory();

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Failed to download image: ${response.status} ${response.statusText}`
      );
    }

    const contentType = response.headers.get('content-type') || 'image/png';
    const extension = this.getExtensionFromContentType(contentType);

    const fileName = filename.endsWith(`.${extension}`)
      ? filename
      : `${filename}.${extension}`;

    const filePath = path.join(this.config.storagePath, fileName);

    // Stream the response to file
    if (!response.body) {
      throw new Error('Response body is empty');
    }

    const fileStream = createWriteStream(filePath);
    // @ts-expect-error - Web streams compatibility with Node.js streams
    await pipeline(response.body, fileStream);

    return {
      filePath,
      publicUrl: `${this.config.publicUrl}/${fileName}`,
      fileName,
    };
  }

  /**
   * Save an image from URL (supports both data URLs and HTTP URLs)
   * @param url - The image URL (data URL or HTTP URL)
   * @param filename - Optional filename (will be generated if not provided)
   * @param task - The AI task type (used for filename generation)
   */
  async saveImage(
    url: string,
    task: string,
    filename?: string
  ): Promise<SaveImageResult> {
    const finalFilename = filename || this.generateFilename(task);

    if (url.startsWith('data:')) {
      return this.saveBase64Image(url, finalFilename);
    } else if (url.startsWith('http://') || url.startsWith('https://')) {
      return this.saveHttpImage(url, finalFilename);
    } else {
      throw new Error(
        'Unsupported URL format. Must be a data URL or HTTP/HTTPS URL.'
      );
    }
  }

  /**
   * Save multiple images
   * @param urls - Array of image URLs
   * @param task - The AI task type
   */
  async saveImages(
    urls: string[],
    task: string
  ): Promise<SaveImageResult[]> {
    const results: SaveImageResult[] = [];

    for (let i = 0; i < urls.length; i++) {
      const filename = this.generateFilename(`${task}-${i + 1}`);
      const result = await this.saveImage(urls[i], task, filename);
      results.push(result);
    }

    return results;
  }

  /**
   * Delete an image file
   * @param filePath - Absolute path to the file
   */
  async deleteImage(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      // Ignore if file doesn't exist
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * Get the storage path
   */
  getStoragePath(): string {
    return this.config.storagePath;
  }

  /**
   * Get the public URL base
   */
  getPublicUrlBase(): string {
    return this.config.publicUrl;
  }
}

// Singleton instance for application use
let globalStorageService: StorageService | null = null;

/**
 * Get the global storage service instance
 */
export function getStorageService(): StorageService {
  if (!globalStorageService) {
    globalStorageService = new StorageService();
  }
  return globalStorageService;
}

/**
 * Set a custom storage service (useful for testing)
 */
export function setStorageService(service: StorageService): void {
  globalStorageService = service;
}

/**
 * Reset the global storage service (useful for testing)
 */
export function resetStorageService(): void {
  globalStorageService = null;
}
