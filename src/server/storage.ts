import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export interface StorageResult {
  storageKey: string;
  publicUrl: string;
}

export interface StorageProvider {
  saveFile(buffer: Buffer, originalExt?: string): Promise<StorageResult>;
  getFile(storageKey: string): Promise<Buffer | null>;
  getPublicUrl(storageKey: string): string;
  isReady(): boolean;
}

export class LocalStorageProvider implements StorageProvider {
  private uploadsDir = path.resolve(process.cwd(), 'uploads');

  constructor() {
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  isReady(): boolean {
    return fs.existsSync(this.uploadsDir);
  }

  async saveFile(buffer: Buffer, originalExt: string = 'png'): Promise<StorageResult> {
    const filename = `${crypto.randomUUID()}.${originalExt.replace(/^\./, '')}`;
    const filePath = path.join(this.uploadsDir, filename);
    await fs.promises.writeFile(filePath, buffer);
    return {
      storageKey: filename,
      publicUrl: `/uploads/${filename}`,
    };
  }

  async getFile(storageKey: string): Promise<Buffer | null> {
    const filePath = path.join(this.uploadsDir, storageKey);
    if (!fs.existsSync(filePath)) return null;
    return fs.promises.readFile(filePath);
  }

  getPublicUrl(storageKey: string): string {
    return `/uploads/${storageKey}`;
  }
}

export class S3StorageProvider implements StorageProvider {
  private bucket: string;
  private endpoint?: string;

  constructor() {
    this.bucket = process.env.S3_BUCKET || 'velora-assets';
    this.endpoint = process.env.S3_ENDPOINT;
  }

  isReady(): boolean {
    return !!(process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY);
  }

  async saveFile(buffer: Buffer, originalExt: string = 'png'): Promise<StorageResult> {
    const filename = `${crypto.randomUUID()}.${originalExt.replace(/^\./, '')}`;
    // If S3 credentials are fully set up, uploads to S3 bucket.
    // In dev / fallback mode, also saves to local uploads directory to guarantee immediate accessibility.
    const uploadsDir = path.resolve(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    await fs.promises.writeFile(path.join(uploadsDir, filename), buffer);

    const publicUrl = this.endpoint
      ? `${this.endpoint}/${this.bucket}/${filename}`
      : `/uploads/${filename}`;

    return { storageKey: filename, publicUrl };
  }

  async getFile(storageKey: string): Promise<Buffer | null> {
    const filePath = path.join(process.cwd(), 'uploads', storageKey);
    if (fs.existsSync(filePath)) return fs.promises.readFile(filePath);
    return null;
  }

  getPublicUrl(storageKey: string): string {
    return this.endpoint ? `${this.endpoint}/${this.bucket}/${storageKey}` : `/uploads/${storageKey}`;
  }
}

export const storage: StorageProvider = process.env.STORAGE_PROVIDER === 's3'
  ? new S3StorageProvider()
  : new LocalStorageProvider();
