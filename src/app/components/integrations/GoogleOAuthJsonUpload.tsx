import { useRef, useState } from 'react';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Upload, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import {
  parseGoogleOAuthClientJson,
  validateGoogleOAuthForProduction,
  PRODUCTION_MAILBOX_REDIRECT_URI,
  type GoogleOAuthClientJson,
} from '../../engine/integrations/googleOAuthClientJson';

interface Props {
  onParsed: (parsed: GoogleOAuthClientJson) => void;
}

export function GoogleOAuthJsonUpload({ onParsed }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [summary, setSummary] = useState<GoogleOAuthClientJson | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const handleFile = async (file: File) => {
    try {
      const text = await file.text();
      const raw = JSON.parse(text) as unknown;
      const parsed = parseGoogleOAuthClientJson(raw);
      const warns = validateGoogleOAuthForProduction(parsed);
      setFileName(file.name);
      setSummary(parsed);
      setWarnings(warns);
      onParsed(parsed);
      if (warns.length) {
        toast.warning('Credentials loaded — check redirect URI warnings below');
      } else {
        toast.success('Google OAuth client JSON loaded — click Save to apply');
      }
    } catch (err) {
      setFileName(null);
      setSummary(null);
      setWarnings([]);
      toast.error(err instanceof Error ? err.message : 'Could not read OAuth JSON');
    }
  };

  return (
    <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200 space-y-3">
      <div>
        <Label className="font-semibold text-emerald-950">Upload Google OAuth client JSON</Label>
        <p className="text-xs text-emerald-900/80 mt-1 leading-relaxed">
          In Google Cloud → Credentials → your Web client → <strong>Download JSON</strong>
          (file name like <code className="text-[11px]">client_secret_….json</code>).
          Upload it here to fill Client ID, Client Secret, and confirm redirect URI{' '}
          <code className="text-[11px]">{PRODUCTION_MAILBOX_REDIRECT_URI}</code>.
          Then click <strong>Save</strong> below.
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = '';
        }}
      />

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="w-4 h-4 mr-1.5" />
        Upload client_secret JSON
      </Button>

      {fileName && summary && (
        <div className="text-xs space-y-1.5 bg-white border border-emerald-200 rounded-lg p-3">
          <p className="flex items-center gap-1.5 text-emerald-800 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Loaded {fileName}
          </p>
          <p><span className="text-slate-500">Client ID:</span> <code className="break-all">{summary.clientId}</code></p>
          <p><span className="text-slate-500">Client secret:</span> <code>••••••••{summary.clientSecret.slice(-4)}</code></p>
          {summary.projectId && (
            <p><span className="text-slate-500">Project:</span> {summary.projectId}</p>
          )}
          {summary.redirectUris.length > 0 && (
            <p><span className="text-slate-500">Redirect URIs:</span> {summary.redirectUris.join(', ')}</p>
          )}
          {warnings.map((w) => (
            <p key={w} className="flex items-start gap-1.5 text-amber-800">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              {w}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
