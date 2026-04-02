import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import type { ErrnoException } from 'node:fs';
import { get, put } from '@vercel/blob';

const LOCAL_DATA_DIR = path.join(process.cwd(), '.data');

function hasBlobStorage(): boolean {
  return Boolean(import.meta.env.BLOB_READ_WRITE_TOKEN);
}

export async function saveJsonRecord<T>(
  pathname: string,
  data: T,
): Promise<void> {
  const body = JSON.stringify(data, null, 2);

  if (hasBlobStorage()) {
    await put(pathname, body, {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json; charset=utf-8',
    });
    return;
  }

  const filePath = path.join(LOCAL_DATA_DIR, pathname);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, body, 'utf8');
}

export async function readJsonRecord<T>(pathname: string): Promise<T | null> {
  if (hasBlobStorage()) {
    const result = await get(pathname, {
      access: 'private',
      useCache: false,
    });

    if (!result || result.statusCode !== 200 || !result.stream) {
      return null;
    }

    const body = await new Response(result.stream).text();
    return JSON.parse(body) as T;
  }

  try {
    const filePath = path.join(LOCAL_DATA_DIR, pathname);
    const body = await readFile(filePath, 'utf8');
    return JSON.parse(body) as T;
  } catch (error) {
    if ((error as ErrnoException).code === 'ENOENT') {
      return null;
    }

    throw error;
  }
}
