import fs from 'node:fs';
import path from 'node:path';

export class DatabaseAdapter {
  private databaseUrl: string | null = null;
  private isPostgres: boolean = false;
  private isProduction: boolean = false;

  constructor() {
    this.isProduction = process.env.NODE_ENV === 'production';
    this.databaseUrl = process.env.DATABASE_URL || null;
    this.isPostgres = Boolean(this.databaseUrl && (this.databaseUrl.startsWith('postgres://') || this.databaseUrl.startsWith('postgresql://')));

    if (this.isPostgres) {
      console.log('[DatabaseAdapter] Initialized with PostgreSQL connection string.');
    } else if (this.isProduction) {
      console.error('[DatabaseAdapter] FATAL: Production environment detected without valid PostgreSQL DATABASE_URL. Silent fallback to JSON is strictly prohibited.');
    } else {
      console.log('[DatabaseAdapter] Development mode: Initialized with persistent JSON database.');
    }
  }

  isReady(): boolean {
    if (this.isProduction) {
      // In production, PostgreSQL is mandatory
      return this.isPostgres;
    }
    // Verify local JSON file is readable/writable in development
    try {
      const dbPath = path.resolve(process.cwd(), 'data/velora.db.json');
      return fs.existsSync(dbPath);
    } catch {
      return false;
    }
  }

  getEngine(): 'postgresql' | 'json' {
    return this.isPostgres ? 'postgresql' : 'json';
  }
}

export const databaseAdapter = new DatabaseAdapter();
