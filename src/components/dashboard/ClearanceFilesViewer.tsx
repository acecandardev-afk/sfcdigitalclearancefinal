import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FileText, Download, Loader2, File, Image, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';

interface ClearanceFile {
  id: string;
  file_name: string;
  content_type: string | null;
  blob_url: string;
  uploaded_at: string | null;
  signature_id?: string | null;
}

interface ClearanceFilesViewerProps {
  clearanceRequestId: string;
  clearanceTitle: string;
  studentName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ClearanceFilesViewer({
  clearanceRequestId,
  clearanceTitle,
  studentName,
  open,
  onOpenChange,
}: ClearanceFilesViewerProps) {
  const [files, setFiles] = useState<ClearanceFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<ClearanceFile | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    if (open && clearanceRequestId) {
      fetchFiles();
    }
  }, [open, clearanceRequestId]);

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/clearances/${clearanceRequestId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load files');
      const json = await res.json();
      setFiles((json.files || []) as ClearanceFile[]);
    } catch (error) {
      console.error('Error fetching files:', error);
      toast.error('Failed to load files');
    } finally {
      setLoading(false);
    }
  };

  const fileExt = (name: string) => name.split('.').pop()?.toLowerCase() || '';
  const isImage = (name: string) => ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExt(name));
  const isPdf = (name: string) => fileExt(name) === 'pdf';

  const openPreview = async (file: ClearanceFile) => {
    setPreviewing(file);
    setPreviewUrl(null);
    setPreviewLoading(true);
    try {
      setPreviewUrl(file.blob_url);
    } catch (e) {
      console.error('Error creating preview url:', e);
      toast.error('Failed to open preview');
      setPreviewing(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDownload = async (file: ClearanceFile) => {
    setDownloading(file.id);
    try {
      const a = document.createElement('a');
      a.href = file.blob_url;
      a.download = file.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      toast.success('File downloaded successfully');
    } catch (error) {
      console.error('Error downloading file:', error);
      toast.error('Failed to download file');
    } finally {
      setDownloading(null);
    }
  };

  const handleView = async (file: ClearanceFile) => {
    try {
      window.open(file.blob_url, '_blank');
    } catch (error) {
      console.error('Error viewing file:', error);
      toast.error('Failed to open file');
    }
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) {
      return <Image className="h-5 w-5" />;
    }
    if (['pdf'].includes(ext || '')) {
      return <FileText className="h-5 w-5" />;
    }
    if (['xls', 'xlsx', 'csv'].includes(ext || '')) {
      return <FileSpreadsheet className="h-5 w-5" />;
    }
    return <File className="h-5 w-5" />;
  };

  const formatFileSize = (_bytes: number | null) => '—';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Attached Documents</DialogTitle>
          <DialogDescription>
            Files submitted by {studentName} for "{clearanceTitle}"
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-10 w-10 mx-auto text-muted-foreground/50" />
              <p className="text-muted-foreground mt-2">No files attached</p>
            </div>
          ) : (
            files.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent/30 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 bg-primary/10 text-primary rounded-lg shrink-0">
                    {getFileIcon(file.file_name)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{file.file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(null)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openPreview(file)}
                  >
                    Preview
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleView(file)}
                  >
                    Open full
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDownload(file)}
                    disabled={downloading === file.id}
                  >
                    {downloading === file.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        <Dialog open={!!previewing} onOpenChange={(o) => (!o ? setPreviewing(null) : undefined)}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle className="font-display">Document preview</DialogTitle>
              <DialogDescription>
                {previewing?.file_name}
              </DialogDescription>
            </DialogHeader>
            <div className="min-h-[60vh]">
              {previewLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : !previewUrl || !previewing ? (
                <div className="text-sm text-muted-foreground">Unable to preview this file.</div>
              ) : isImage(previewing.file_name) ? (
                <div className="w-full flex items-center justify-center">
                  <img
                    src={previewUrl}
                    alt={previewing.file_name}
                    className="max-h-[70vh] w-auto rounded-lg border"
                  />
                </div>
              ) : isPdf(previewing.file_name) ? (
                <iframe
                  title={previewing.file_name}
                  src={previewUrl}
                  className="w-full h-[70vh] rounded-lg border"
                />
              ) : (
                <div className="flex items-center justify-center py-10">
                  <div className="text-center">
                    <FileText className="h-10 w-10 mx-auto text-muted-foreground/60" />
                    <p className="text-sm text-muted-foreground mt-2">Preview not available for this file type.</p>
                    <div className="mt-4 flex items-center justify-center gap-2">
                      <Button variant="outline" onClick={() => previewing && handleView(previewing)}>
                        Open full
                      </Button>
                      <Button onClick={() => previewing && handleDownload(previewing)}>
                        Download
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
