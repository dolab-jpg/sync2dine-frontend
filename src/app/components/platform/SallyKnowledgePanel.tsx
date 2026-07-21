import { useCallback, useEffect, useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { toast } from 'sonner';
import { BookOpen, RefreshCw, Check, X, Plus } from 'lucide-react';

type Source = {
  id: string;
  kind: string;
  url?: string | null;
  title?: string | null;
  enabled?: boolean;
  last_fetched_at?: string | null;
};

type Chunk = {
  id: string;
  category: string;
  title: string;
  body: string;
  status: string;
  source_url?: string | null;
  active?: boolean;
};

type Status = {
  ok: boolean;
  sources: number;
  chunks: number;
  pending: number;
  approved: number;
  lastJob?: { id: string; status: string; error?: string | null } | null;
};

export default function SallyKnowledgePanel() {
  const [status, setStatus] = useState<Status | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [loading, setLoading] = useState(true);
  const [pasteTitle, setPasteTitle] = useState('');
  const [pasteBody, setPasteBody] = useState('');
  const [url, setUrl] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, srcRes, cRes] = await Promise.all([
        fetch('/api/sally-knowledge/status'),
        fetch('/api/sally-knowledge/sources'),
        fetch('/api/sally-knowledge/chunks'),
      ]);
      const s = await sRes.json();
      const src = await srcRes.json();
      const c = await cRes.json();
      if (!sRes.ok) throw new Error(s.error || `Status ${sRes.status}`);
      setStatus(s);
      setSources(Array.isArray(src.sources) ? src.sources : []);
      setChunks(Array.isArray(c.chunks) ? c.chunks : []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load Sally knowledge');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const ingest = async () => {
    try {
      const res = await fetch('/api/sally-knowledge/ingest', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      toast.success(`Ingest queued (${data.jobId?.slice(0, 8)}ù)`);
      setTimeout(() => void load(), 3000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ingest failed');
    }
  };

  const decide = async (id: string, decision: 'approve' | 'reject') => {
    try {
      const res = await fetch('/api/sally-knowledge/chunks/decide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, decision }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      toast.success(decision === 'approve' ? 'Approved for Sally' : 'Rejected');
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Decide failed');
    }
  };

  const addUrl = async () => {
    if (!url.trim()) return;
    try {
      const res = await fetch('/api/sally-knowledge/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'url', url: url.trim(), title: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setUrl('');
      toast.success('Source added');
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Add URL failed');
    }
  };

  const addPaste = async () => {
    if (!pasteBody.trim()) return;
    try {
      const res = await fetch('/api/sally-knowledge/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'paste',
          title: pasteTitle.trim() || 'Pasted notes',
          raw_text: pasteBody.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setPasteTitle('');
      setPasteBody('');
      toast.success('Paste source saved');
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Paste failed');
    }
  };

  const pending = chunks.filter((c) => c.status === 'pending');
  const approved = chunks.filter((c) => c.status === 'approved');

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-teal-700" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Sally Knowledge</h1>
            <p className="text-sm text-slate-600">
              Separate from Judie/Studio ù approve talking points before they inject into Sally.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className="mr-1 h-4 w-4" /> Refresh
          </Button>
          <Button onClick={() => void ingest()}>Run ingest</Button>
        </div>
      </div>

      {status && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Sources" value={status.sources} />
          <Stat label="Pending" value={status.pending} />
          <Stat label="Approved" value={status.approved} />
          <Stat
            label="Last job"
            value={status.lastJob?.status || 'ù'}
            sub={status.lastJob?.error || undefined}
          />
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <h2 className="font-semibold text-slate-900">Sources</h2>
        <ul className="space-y-1 text-sm text-slate-700 max-h-40 overflow-auto">
          {sources.map((s) => (
            <li key={s.id}>
              <span className="font-medium">{s.title || s.kind}</span>
              {s.url ? <span className="text-slate-500"> ù {s.url}</span> : null}
            </li>
          ))}
          {!sources.length && <li className="text-slate-500">No sources yet ù ingest seeds defaults.</li>}
        </ul>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input placeholder="https://ù" value={url} onChange={(e) => setUrl(e.target.value)} />
          <Button variant="secondary" onClick={() => void addUrl()}>
            <Plus className="mr-1 h-4 w-4" /> Add URL
          </Button>
        </div>
        <div className="space-y-2 border-t pt-3">
          <Label>Paste sales notes</Label>
          <Input
            placeholder="Title"
            value={pasteTitle}
            onChange={(e) => setPasteTitle(e.target.value)}
          />
          <Textarea
            rows={4}
            placeholder="Internal sales notes / case study textù"
            value={pasteBody}
            onChange={(e) => setPasteBody(e.target.value)}
          />
          <Button variant="secondary" onClick={() => void addPaste()}>
            Save paste source
          </Button>
        </div>
      </section>

      <section className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 space-y-3">
        <h2 className="font-semibold text-slate-900">Pending approval ({pending.length})</h2>
        {pending.map((c) => (
          <div key={c.id} className="rounded-lg border bg-white p-3 space-y-2">
            <div className="text-xs uppercase tracking-wide text-slate-500">{c.category}</div>
            <div className="font-medium">{c.title}</div>
            <p className="text-sm text-slate-700">{c.body}</p>
            {c.source_url ? <p className="text-xs text-slate-500">{c.source_url}</p> : null}
            <div className="flex gap-2">
              <Button size="sm" onClick={() => void decide(c.id, 'approve')}>
                <Check className="mr-1 h-4 w-4" /> Approve
              </Button>
              <Button size="sm" variant="outline" onClick={() => void decide(c.id, 'reject')}>
                <X className="mr-1 h-4 w-4" /> Reject
              </Button>
            </div>
          </div>
        ))}
        {!pending.length && <p className="text-sm text-slate-600">No pending chunks ù run ingest after sources are set.</p>}
      </section>

      <section className="rounded-xl border border-teal-200 bg-teal-50/30 p-4 space-y-2">
        <h2 className="font-semibold text-slate-900">Live in Sally ({approved.length})</h2>
        {approved.slice(0, 30).map((c) => (
          <div key={c.id} className="text-sm border-b border-teal-100 py-2 last:border-0">
            <span className="font-medium">[{c.category}] {c.title}:</span> {c.body}
          </div>
        ))}
        {!approved.length && <p className="text-sm text-slate-600">Nothing approved yet.</p>}
      </section>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-lg border bg-white p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-lg font-semibold text-slate-900">{value}</div>
      {sub ? <div className="text-xs text-red-600 truncate">{sub}</div> : null}
    </div>
  );
}
