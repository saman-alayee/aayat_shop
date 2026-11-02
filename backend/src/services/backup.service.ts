import { spawn } from 'child_process';
import { createWriteStream, createReadStream, existsSync, promises as fs } from 'fs';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';
import path from 'path';
import os from 'os';
import type { Response } from 'express';
import { config } from '../config';
import prisma from '../config/database';
import { AppError } from '../utils/errors';

export interface MysqlConnectionParts {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

export function parseMysqlUrl(databaseUrl: string): MysqlConnectionParts {
  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new AppError(500, 'آدرس دیتابیس نامعتبر است');
  }

  if (!parsed.protocol.startsWith('mysql')) {
    throw new AppError(500, 'آدرس دیتابیس MySQL نامعتبر است');
  }

  const database = decodeURIComponent(parsed.pathname.replace(/^\//, '').split('?')[0] || '');
  if (!database) {
    throw new AppError(500, 'نام دیتابیس در تنظیمات پیدا نشد');
  }

  return {
    host: parsed.hostname || 'localhost',
    port: parsed.port || '3306',
    user: decodeURIComponent(parsed.username || ''),
    password: decodeURIComponent(parsed.password || ''),
    database,
  };
}

/** Resolve Prisma `file:...` URL to an absolute filesystem path. */
export function resolveSqlitePath(databaseUrl: string): string {
  if (!databaseUrl.startsWith('file:')) {
    throw new AppError(500, 'آدرس دیتابیس SQLite نامعتبر است');
  }

  let raw = databaseUrl.slice('file:'.length);
  // file:///var/... or file:/var/...
  if (raw.startsWith('///')) raw = raw.slice(2);
  else if (raw.startsWith('//') && !raw.startsWith('///')) {
    // file://localhost/path — rare; strip host
    const withoutHost = raw.replace(/^\/\/[^/]*/, '');
    raw = withoutHost || raw;
  }

  const decoded = decodeURIComponent(raw);
  if (path.isAbsolute(decoded)) {
    if (!existsSync(decoded)) {
      throw new AppError(500, 'فایل دیتابیس پیدا نشد');
    }
    return decoded;
  }

  const relative = decoded.replace(/^\.\//, '');
  const candidates = [
    path.resolve(process.cwd(), 'prisma', relative),
    path.resolve(process.cwd(), relative),
    path.resolve(__dirname, '../../prisma', relative),
    path.resolve(__dirname, '../prisma', relative),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  throw new AppError(500, 'فایل دیتابیس پیدا نشد');
}

function buildMysqlFilename(database: string) {
  const safeDb = database.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${safeDb}-backup-${stamp()}.sql.gz`;
}

function buildSqliteFilename(dbPath: string) {
  const base = path.basename(dbPath, path.extname(dbPath)) || 'database';
  const safe = base.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${safe}-backup-${stamp()}.db.gz`;
}

export class BackupService {
  async streamDatabaseBackup(res: Response) {
    const url = config.databaseUrl || '';
    if (url.startsWith('file:')) {
      return this.streamSqliteBackup(res, url);
    }
    if (url.startsWith('mysql')) {
      return this.streamMysqlBackup(res, url);
    }
    throw new AppError(500, 'نوع دیتابیس برای بکاپ پشتیبانی نمی‌شود');
  }

  private async streamSqliteBackup(res: Response, databaseUrl: string) {
    const dbPath = resolveSqlitePath(databaseUrl);
    const filename = buildSqliteFilename(dbPath);
    const tmpDb = path.join(os.tmpdir(), `aayat-sqlite-${Date.now()}.db`);
    const tmpGz = `${tmpDb}.gz`;

    try {
      // Consistent online snapshot (includes WAL contents).
      const escaped = tmpDb.replace(/'/g, "''");
      await prisma.$executeRawUnsafe(`VACUUM INTO '${escaped}'`);

      const snapStat = await fs.stat(tmpDb);
      if (!snapStat.size) {
        throw new AppError(500, 'فایل بکاپ خالی است');
      }

      await pipeline(createReadStream(tmpDb), createGzip({ level: 9 }), createWriteStream(tmpGz));

      const gzStat = await fs.stat(tmpGz);
      if (!gzStat.size) {
        throw new AppError(500, 'فایل بکاپ خالی است');
      }

      res.setHeader('Content-Type', 'application/gzip');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', String(gzStat.size));
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Backup-Filename', filename);

      await new Promise<void>((resolve, reject) => {
        const stream = createReadStream(tmpGz);
        stream.on('error', reject);
        res.on('error', reject);
        res.on('finish', resolve);
        stream.pipe(res);
      });

      return { filename, database: path.basename(dbPath), bytes: gzStat.size };
    } finally {
      await fs.unlink(tmpDb).catch(() => undefined);
      await fs.unlink(tmpGz).catch(() => undefined);
    }
  }

  private async streamMysqlBackup(res: Response, databaseUrl: string) {
    const db = parseMysqlUrl(databaseUrl);
    const filename = buildMysqlFilename(db.database);
    const tmpPath = path.join(os.tmpdir(), `aayat-mysql-${Date.now()}-${filename}`);

    const args = [
      `--host=${db.host}`,
      `--port=${db.port}`,
      `--user=${db.user}`,
      '--single-transaction',
      '--routines',
      '--triggers',
      '--events',
      '--hex-blob',
      '--default-character-set=utf8mb4',
      db.database,
    ];

    try {
      await this.runMysqldumpToGzip(args, db.password, tmpPath);

      const stat = await fs.stat(tmpPath);
      if (!stat.size) {
        throw new AppError(500, 'فایل بکاپ خالی است');
      }

      res.setHeader('Content-Type', 'application/gzip');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', String(stat.size));
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Backup-Filename', filename);

      await new Promise<void>((resolve, reject) => {
        const stream = createReadStream(tmpPath);
        stream.on('error', reject);
        res.on('error', reject);
        res.on('finish', resolve);
        stream.pipe(res);
      });

      return { filename, database: db.database, bytes: stat.size };
    } finally {
      await fs.unlink(tmpPath).catch(() => undefined);
    }
  }

  private runMysqldumpToGzip(args: string[], password: string, outPath: string) {
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const fail = (error: Error) => {
        if (settled) return;
        settled = true;
        reject(error);
      };
      const ok = () => {
        if (settled) return;
        settled = true;
        resolve();
      };

      const child = spawn('mysqldump', args, {
        env: {
          ...process.env,
          MYSQL_PWD: password,
        },
        windowsHide: true,
      });

      let stderr = '';
      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString('utf8');
      });

      child.on('error', (error) => {
        const message =
          (error as NodeJS.ErrnoException).code === 'ENOENT'
            ? 'ابزار mysqldump روی سرور نصب نیست. بسته mysql-client را نصب کنید.'
            : 'اجرای بکاپ دیتابیس ناموفق بود';
        fail(new AppError(500, message));
      });

      const gzip = createGzip({ level: 9 });
      const output = createWriteStream(outPath);

      let dumpCode: number | null = null;
      let pipeDone = false;

      const maybeFinish = () => {
        if (dumpCode === null || !pipeDone) return;
        if (dumpCode === 0) {
          ok();
          return;
        }
        const detail = stderr.trim().slice(0, 300);
        fail(
          new AppError(
            500,
            detail ? `بکاپ دیتابیس ناموفق بود: ${detail}` : 'بکاپ دیتابیس ناموفق بود'
          )
        );
      };

      pipeline(child.stdout, gzip, output)
        .then(() => {
          pipeDone = true;
          maybeFinish();
        })
        .catch((error) => {
          fail(error instanceof Error ? error : new Error(String(error)));
        });

      child.on('close', (code) => {
        dumpCode = code ?? 1;
        maybeFinish();
      });
    });
  }
}

export const backupService = new BackupService();
