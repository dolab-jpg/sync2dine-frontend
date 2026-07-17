import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Upload } from 'lucide-react';
import { toast } from 'sonner';

/** Bulk CSV → outbound queue (name,phone[,notes]). Respects agent capacity slots. */
export default function CsvCampaignUploadPanel({ onQueued }: { onQueued?: () => void }) {
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState('');
  const [template, setTemplate] = useState('lead_callback');
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<{ queued: number; skipped: number } | null>(null);

  async function queueUpload() {
    if (!csvText.trim()) {
      toast.error('Paste or choose a CSV first');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/campaigns/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: csvText, template }),
      });
      const data = await res.json().catch(() => ({})) as {
        error?: string;
        queued?: number;
        skipped?: number;
      };
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setLastResult({ queued: data.queued ?? 0, skipped: data.skipped ?? 0 });
      toast.success(`Queued ${data.queued ?? 0} calls${data.skipped ? ` (${data.skipped} skipped)` : ''}`);
      onQueued?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Upload call list (CSV)
        </CardTitle>
        <CardDescription>
          Columns: name, phone, optional notes. Queues one-by-one using outbound agent slots
          (restaurant default: 1 outbound, 4 inbound reserved).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label>CSV file</Label>
          <Input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setFileName(file.name);
              const reader = new FileReader();
              reader.onload = () => setCsvText(String(reader.result ?? ''));
              reader.readAsText(file);
            }}
          />
          {fileName ? <p className="text-xs text-slate-500 mt-1">{fileName}</p> : null}
        </div>
        <div>
          <Label>Or paste CSV</Label>
          <textarea
            className="w-full min-h-28 rounded-md border px-3 py-2 text-sm font-mono"
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder={'name,phone,notes\nJane Smith,07700900123,Asked about menu'}
          />
        </div>
        <div>
          <Label>Template id</Label>
          <Input value={template} onChange={(e) => setTemplate(e.target.value)} />
        </div>
        <Button type="button" disabled={busy} onClick={() => void queueUpload()} className="w-full font-bold min-h-11">
          {busy ? 'Queueing…' : 'Queue calls'}
        </Button>
        {lastResult ? (
          <p className="text-sm text-slate-600">
            Last upload: {lastResult.queued} queued · {lastResult.skipped} skipped
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
