import { useRef, useState } from 'react';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { uploadFileToStorage, getSignedFileUrl } from '../../engine/data/supabaseStore';

interface CompanyLogoUploadProps {
  logoUrl: string;
  onLogoUrlChange: (url: string) => void;
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
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const storagePath = `company/logo.${ext}`;
    const uploaded = await uploadFileToStorage('project-files', storagePath, file, file.type);
    if (!uploaded) {
      setUploading(false);
      toast.error('Logo upload failed — check Supabase Storage or paste a Logo URL below');
      return;
    }
    const url = await getSignedFileUrl('project-files', storagePath);
    setUploading(false);
    if (!url) {
      toast.error('Logo uploaded but could not get a preview URL — paste a Logo URL below if needed');
      return;
    }
    onLogoUrlChange(url);
    toast.success('Logo uploaded');
  };

  return (
    <div className="space-y-2 rounded-lg border border-dashed border-gray-200 bg-gray-50/80 p-4">
      <Label className="text-sm font-medium">Company logo</Label>
      <p className="text-xs text-muted-foreground">
        Upload PNG, JPEG, or WebP (max 2 MB). Shown on invoices, quotes, and receipts.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt="Company logo preview"
            className="h-14 max-w-[180px] object-contain rounded border bg-white p-1"
          />
        ) : (
          <div className="h-14 w-28 rounded border bg-white flex items-center justify-center text-xs text-muted-foreground">
            No logo
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Upload className="w-4 h-4 mr-2" />
          )}
          {logoUrl ? 'Replace logo' : 'Upload logo'}
        </Button>
        {logoUrl && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onLogoUrlChange('')}>
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}
