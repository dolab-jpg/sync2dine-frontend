import { useRef, useState } from 'react';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { uploadFileToStorage, getSignedFileUrl } from '../../engine/data/supabaseStore';
import { loadIntegrationsStore, saveIntegrationsStore } from '../../engine/integrations/integrationsStore';

interface CompanyLogoUploadProps {
  logoUrl: string;
  onLogoUrlChange: (url: string) => void;
}

/** Convert any browser-decodable image (incl. WebP) to PNG bytes for pdf-lib compatibility. */
async function fileToPngFile(file: File): Promise<File> {
  if (file.type === 'image/png') return file;
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.drawImage(bitmap, 0, 0);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('PNG convert failed');
  return new File([blob], 'logo.png', { type: 'image/png' });
}

function persistLogoStoragePath(storagePath: string) {
  const store = loadIntegrationsStore();
  const company = store.integrations.company ?? { enabled: true, mockMode: false, values: {}, status: 'connected' as const };
  store.integrations.company = {
    ...company,
    values: { ...company.values, logoStoragePath: storagePath },
  };
  saveIntegrationsStore(store);
}

export function CompanyLogoUpload({ logoUrl, onLogoUrlChange }: CompanyLogoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File | null) => {
    if (!file) return;
    const allowed = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowed.includes(file.type)) {
      toast.error('Logo must be PNG, JPEG, or WebP');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Logo must be under 2 MB');
      return;
    }
    setUploading(true);
    try {
      // Always store PNG so quote/invoice/contract PDFs can embed the logo.
      const pngFile = await fileToPngFile(file);
      const storagePath = 'company/logo.png';
      const uploaded = await uploadFileToStorage('project-files', storagePath, pngFile, 'image/png');
      if (!uploaded) {
        toast.error('Logo upload failed — check Supabase Storage or paste a Logo URL below');
        return;
      }
      persistLogoStoragePath(storagePath);
      const url = await getSignedFileUrl('project-files', storagePath);
      if (!url) {
        toast.error('Logo uploaded but could not get a preview URL — paste a Logo URL below if needed');
        return;
      }
      onLogoUrlChange(url);
      toast.success('Logo uploaded (PNG — ready for PDFs)');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Logo upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2 rounded-lg border border-dashed border-gray-200 bg-gray-50/80 p-4">
      <Label className="text-sm font-medium">Company logo</Label>
      <p className="text-xs text-muted-foreground">
        PNG or JPEG preferred. WebP is converted to PNG so quotes, invoices, and contracts keep the logo.
      </p>
      {logoUrl ? (
        <div className="flex items-center gap-3">
          <img
            src={logoUrl}
            alt="Company logo"
            className="h-14 w-auto max-w-[160px] object-contain rounded border bg-white p-1"
          />
        </div>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept="image/png,image/jpeg,image/webp"
        onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
        {logoUrl ? 'Replace logo' : 'Upload logo'}
      </Button>
      {logoUrl && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-destructive"
          onClick={() => {
            onLogoUrlChange('');
            persistLogoStoragePath('');
          }}
        >
          Remove
        </Button>
      )}
    </div>
  );
}
