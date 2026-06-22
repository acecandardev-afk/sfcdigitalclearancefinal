import path from 'path';
import { mkdir, writeFile } from 'fs/promises';
import { NextResponse } from 'next/server';
import { getAppSession } from '@/lib/getAppSession';
import { put } from '@vercel/blob';
import { ensureDeploymentEnv, publicAppBaseUrl } from '@/lib/resolveDeploymentUrl';

export const runtime = 'nodejs';

ensureDeploymentEnv();

function isVercelRuntime() {
  return Boolean(process.env.VERCEL);
}

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/webp',
]);
const ALLOWED_EXTENSIONS = new Set(['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'webp']);

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
  const base = publicAppBaseUrl(`${url.protocol}//${url.host}`) ?? `${url.protocol}//${url.host}`;
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
    return NextResponse.json({ error: 'Please choose a file to upload.' }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: 'File is too large. Maximum upload size is 10 MB.' }, { status: 413 });
  }

  const ext = String(file.name || '').split('.').pop()?.toLowerCase() ?? '';
  if (!ALLOWED_EXTENSIONS.has(ext) || (file.type && !ALLOWED_CONTENT_TYPES.has(file.type))) {
    return NextResponse.json(
      { error: 'Unsupported file type. Upload PDF, Word document, JPG, PNG, or WebP files only.' },
      { status: 400 }
    );
  }

  const userId = (session.user as any).id as string;
  const folder = String(form.get('folder') || 'clearance-files').replace(/[^a-zA-Z0-9._-]/g, '_') || 'clearance-files';
  const ts = Date.now();
  const safeName = String(file.name || 'upload').replace(/[^a-zA-Z0-9._-]/g, '_');
  const relativePath = path.join(folder, userId, `${ts}-${safeName}`);

  try {
    if (!hasBlobToken() && isVercelRuntime()) {
      return NextResponse.json(
        {
          error:
            'File uploads are not configured for this deployment. Add a Vercel Blob store and set BLOB_READ_WRITE_TOKEN.',
        },
        { status: 503 }
      );
    }

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
    console.error('[blob/upload]', e);
    return NextResponse.json({ error: 'Could not upload the file. Try again or use a smaller file.' }, { status: 500 });
  }
}
