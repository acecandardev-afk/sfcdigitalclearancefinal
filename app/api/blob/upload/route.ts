import { NextResponse } from 'next/server';
import { getAppSession } from '@/lib/getAppSession';
import { put } from '@vercel/blob';

export const runtime = 'nodejs';

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
  const folder = String(form.get('folder') || 'clearance-files');
  const ts = Date.now();
  const safeName = String(file.name || 'upload').replace(/[^a-zA-Z0-9._-]/g, '_');
  const pathname = `${folder}/${userId}/${ts}-${safeName}`;

  try {
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
  } catch (e: any) {
    const msg = String(e?.message || e || 'Upload failed');
    return NextResponse.json(
      { error: msg.includes('BLOB_READ_WRITE_TOKEN') ? 'Blob token missing' : msg },
      { status: 500 }
    );
  }
}
