import { useCallback, useEffect, useState } from 'react';
import { Loader2, Languages, Save } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from 'sonner';

import { LANG_OPTIONS } from '../../i18n/languages';

const LANGS = LANG_OPTIONS.map((o) => ({
  code: o.code,
  label: `${o.flag} ${o.label} (${o.persona})`,
}));

interface LanguagePack {
  label: string;
  systemInstruction: string;
  phrases: Record<string, string>;
}

type PacksMap = Record<string, LanguagePack>;

const PHRASE_KEYS = [
  'greeting',
  'thanks',
  'confirm_yes_no',
  'done',
  'error_generic',
  'unknown_contact',
  'need_more_info',
] as const;

export function LanguagePacksPanel() {
  const [packs, setPacks] = useState<PacksMap>({});
  const [lang, setLang] = useState<string>('en');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/language-packs');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPacks((data.packs ?? {}) as PacksMap);
    } catch {
      toast.error('Could not load language packs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const pack = packs[lang] ?? {
    label: LANGS.find((l) => l.code === lang)?.label ?? lang,
    systemInstruction: '',
    phrases: {},
  };

  const updatePack = (patch: Partial<LanguagePack>) => {
    setPacks((prev) => ({
      ...prev,
      [lang]: {
        ...pack,
        ...patch,
        phrases: patch.phrases ? { ...pack.phrases, ...patch.phrases } : pack.phrases,
      },
    }));
  };

  const setPhrase = (key: string, value: string) => {
    updatePack({ phrases: { ...pack.phrases, [key]: value } });
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/language-packs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packs }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPacks((data.packs ?? packs) as PacksMap);
      toast.success('Language packs saved');
    } catch {
      toast.error('Save failed — is the API running?');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center gap-2 text-slate-600">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading language packs…
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Languages className="w-5 h-5 text-amber-500" />
          Language packs
        </CardTitle>
        <p className="text-sm text-slate-600 font-normal">
          Channel phrases and spoken-reply instructions for WhatsApp/phone. Does not translate the app UI.
          Business outputs (emails, contracts, quotes, pricing) stay English.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px]">
            <Label>Language</Label>
            <Select value={lang} onValueChange={setLang}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LANGS.map((l) => (
                  <SelectItem key={l.code} value={l.code}>
                    {l.label} ({l.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="button" onClick={() => void save()} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
            Save packs
          </Button>
        </div>

        <div>
          <Label>Display label</Label>
          <Input
            value={pack.label}
            onChange={(e) => updatePack({ label: e.target.value })}
          />
        </div>

        <div>
          <Label>System instruction (sent to AI for this language)</Label>
          <Textarea
            value={pack.systemInstruction}
            onChange={(e) => updatePack({ systemInstruction: e.target.value })}
            rows={3}
            placeholder="Reply only in …"
          />
        </div>

        <div className="space-y-3">
          <Label>Phrases</Label>
          {PHRASE_KEYS.map((key) => (
            <div key={key}>
              <Label className="text-xs text-slate-500">{key}</Label>
              <Textarea
                value={pack.phrases[key] ?? ''}
                onChange={(e) => setPhrase(key, e.target.value)}
                rows={2}
              />
            </div>
          ))}
          {Object.keys(pack.phrases)
            .filter((k) => !(PHRASE_KEYS as readonly string[]).includes(k))
            .map((key) => (
              <div key={key}>
                <Label className="text-xs text-slate-500">{key}</Label>
                <Textarea
                  value={pack.phrases[key] ?? ''}
                  onChange={(e) => setPhrase(key, e.target.value)}
                  rows={2}
                />
              </div>
            ))}
        </div>
      </CardContent>
    </Card>
  );
}
