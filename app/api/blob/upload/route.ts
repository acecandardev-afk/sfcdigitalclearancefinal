import path from 'path';
import { mkdir, writeFile } from 'fs/promises';
import { NextResponse } from 'next/server';
import { getAppSession } from '@/lib/getAppSession';
import { put } from '@vercel/blob';

export const runtime = 'nodejs';

function hasBlobToken() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

/** Save under public/uploads so Next can serve as static files; returns absolute URL for this request. */
async function saveLocalPublicUpload(req: Request, relativePath: string, file: File) {
  const root = path.join(process.cwd(), 'public', 'uploads');
  const fullPath = path.join(root, relativePath);
  await mkdir(path.dirname(fullPath), { recursive: true });
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(fullPath, buf);

  const url = new URL(req.url);
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
    `${url.protocol}//${url.host}`;
  const publicPath = `/uploads/${relativePath.split(path.sep).join('/')}`;
  return `${base}${publicPath}`;
}

export async function POST(req: Request) {
  const session = await getAppSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get('file');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 });
  }

  const userId = (session.user as any).id as string;
  const folder = String(form.get('folder') || 'clearance-files').replace(/[^a-zA-Z0-9._-]/g, '_') || 'clearance-files';
  const ts = Date.now();
  const safeName = String(file.name || 'upload').replace(/[^a-zA-Z0-9._-]/g, '_');
  const relativePath = path.join(folder, userId, `${ts}-${safeName}`);

  try {
    if (hasBlobToken()) {
      const pathname = `${folder}/${userId}/${ts}-${safeName}`;
      const blob = await put(pathname, file, {
        access: 'public',
        addRandomSuffix: false,
        contentType: file.type || undefined,
      });
      return NextResponse.json({
        file_name: file.name,
        content_type: file.type || null,
        blob_url: blob.url,
      });
    }

    const blob_url = await saveLocalPublicUpload(req, relativePath, file);
    return NextResponse.json({
      file_name: file.name,
      content_type: file.type || null,
      blob_url,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[blob/upload]', e);
    return NextResponse.json({ error: msg || 'Upload failed' }, { status: 500 });
  }
}
