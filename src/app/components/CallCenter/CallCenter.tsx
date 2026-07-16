'use client';

import { useState, useEffect, useCallback, useContext, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Switch } from '../ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  Phone, PhoneIncoming, PhoneOutgoing, Clock, MessageSquare,
  RefreshCw, Play, Send, AlertCircle, Voicemail, Mic, Search,
  ChevronDown, ChevronUp, User, ExternalLink, Power, Volume2, Plus, Trash2, Radio,
  PhoneForwarded, ShieldCheck, Globe, UserPlus,
} from 'lucide-react';
import { toast } from 'sonner';
import { SoftPhonePanel } from './SoftPhonePanel';
import { AppContext } from '../../App';
import { integrationService } from '../../engine/integrations/integrationService';

interface CallTurn {
  role: 'caller' | 'agent' | 'system';
  content: string;
  timestamp: string;
}

interface CallRecord {
  id: string;
  direction: 'inbound' | 'outbound';
  from: string;
  to: string;
  status: string;
  intent?: string;
  outcome?: string;
  customerId?: string;
  contactName?: string;
  sentiment?: 'negative' | 'neutral' | 'positive';
  durationSec?: number;
  transcript: CallTurn[];
  escalated?: boolean;
  startedAt: string;
  endedAt?: string;
  campaignTemplate?: string;
  transferredTo?: string;
  metadata?: {
    callerKind?: 'customer' | 'staff' | 'foreman';
    callerRole?: string;
    phoneAuth?: 'verified' | 'pending' | 'locked' | 'n/a';
    callLanguage?: string;
    transferNumber?: string;
  };
}

interface TransferNumbers {
  general?: string;
  sales?: string;
  projects?: string;
  recruitment?: string;
  accounts?: string;
}

const TRANSFER_DEPARTMENTS: Array<{ key: keyof TransferNumbers; label: string; placeholder: string }> = [
  { key: 'general', label: 'Default / General', placeholder: '+4420...' },
  { key: 'sales', label: 'Sales', placeholder: '+4420...' },
  { key: 'projects', label: 'Projects', placeholder: '+4420...' },
  { key: 'recruitment', label: 'Recruitment', placeholder: '+4420...' },
  { key: 'accounts', label: 'Accounts', placeholder: '+4420...' },
];

const PHONE_AUTH_LABELS: Record<string, string> = {
  verified: 'PIN verified',
  pending: 'PIN pending',
  locked: 'PIN locked',
  'n/a': '',
};

interface OutboundJob {
  id: string;
  to: string;
  template: string;
  status: string;
  createdAt: string;
  callId?: string;
  error?: string;
}

interface AgentStatus {
  isActive: boolean;
  activeCall: {
    id: string;
    from: string;
    contactName?: string;
    elapsedSec?: number;
    status: string;
    lineLabel?: string;
    to?: string;
    customerId?: string;
  } | null;
  activeCalls?: Array<{
    id: string;
    from: string;
    to?: string;
    contactName?: string;
    elapsedSec?: number;
    status: string;
    lineLabel?: string;
    customerId?: string;
  }>;
  linesSummary?: { total: number; registered: number; onCall: number };
  todayStats: {
    totalCalls: number;
    avgDurationSec: number;
    aiResolvedPct: number;
    callbacksBooked: number;
  };
}

export interface PhoneLine {
  id: string;
  label: string;
  sipUsername: string;
  sipPassword: string;
  sipDomain: string;
  did: string;
  enabled: boolean;
  status: 'disconnected' | 'registering' | 'registered' | 'error';
  lastError?: string;
  registeredAt?: string;
  assignedUserId?: string;
  purpose?: 'staff' | 'aria';
}

interface VoiceOption {
  id: string;
  name: string;
  provider: string;
}

interface ContactLookupResult {
  found: boolean;
  name?: string;
  status?: string;
  accountValue?: number;
  lastInteraction?: string;
  customerId?: string;
  message?: string;
}

const LINE_STATUS_LABELS: Record<string, string> = {
  disconnected: 'Disconnected',
  registering: 'Registering…',
  registered: 'Registered',
  error: 'Error',
};

const INTENT_LABELS: Record<string, string> = {
  new_sales_lead: 'New Sales Lead',
  existing_customer: 'Existing Customer',
  recruitment: 'Recruitment',
  supplier: 'Supplier',
  complaint: 'Complaint',
  general: 'General',
  after_hours: 'After Hours',
};

const SENTIMENT_LABELS: Record<string, string> = {
  negative: 'Negative',
  neutral: 'Neutral',
  positive: 'Positive',
};

const CAMPAIGN_TEMPLATES = [
  { value: 'quote_chase', label: 'Quote Follow-up' },
  { value: 'payment_reminder', label: 'Payment Reminder' },
  { value: 'appointment_reminder', label: 'Appointment Reminder' },
  { value: 'recruitment_screening', label: 'Recruitment Screening' },
  { value: 'satisfaction_check', label: 'Satisfaction Check' },
  { value: 'lead_callback', label: 'Lead Callback' },
];

function formatPhone(phone?: string | null): string {
  if (!phone) return 'Unknown';
  if (phone.startsWith('44') && phone.length >= 12) {
    return `+${phone.slice(0, 2)} ${phone.slice(2, 6)} ${phone.slice(6)}`;
  }
  return phone;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-GB', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatDuration(sec?: number): string {
  if (sec == null) return '—';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default function CallCenter() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialTab = useMemo(() => {
    const tab = searchParams.get('tab');
    if (tab === 'softphone' || tab === 'lines' || tab === 'test' || tab === 'outbound' || tab === 'dashboard') {
      return tab;
    }
    return 'dashboard';
  }, [searchParams]);

  const [isActive, setIsActive] = useState(true);
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null);
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [outboundQueue, setOutboundQueue] = useState<OutboundJob[]>([]);
  const [expandedCallId, setExpandedCallId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [togglingAgent, setTogglingAgent] = useState(false);

  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [activeVoiceId, setActiveVoiceId] = useState<string | null>(null);
  const [voiceFallbackNote, setVoiceFallbackNote] = useState<string | null>(null);
  const [voiceUploadName, setVoiceUploadName] = useState('');
  const [voiceUploadFile, setVoiceUploadFile] = useState<File | null>(null);
  const [uploadingVoice, setUploadingVoice] = useState(false);

  const [lookupPhone, setLookupPhone] = useState('');
  const [lookupResult, setLookupResult] = useState<ContactLookupResult | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);

  const [testCallId, setTestCallId] = useState<string | null>(null);
  const [testFrom, setTestFrom] = useState('447700900123');
  const [testSpeech, setTestSpeech] = useState('');
  const [testTranscript, setTestTranscript] = useState<Array<{ role: string; content: string }>>([]);
  const [testRunning, setTestRunning] = useState(false);
  const [outboundTo, setOutboundTo] = useState(() => searchParams.get('to') || '');
  const [outboundTemplate, setOutboundTemplate] = useState(() => {
    const aim = searchParams.get('aim');
    if (aim === 'callback') return 'lead_callback';
    if (aim === 'quote_chase') return 'quote_chase';
    return 'quote_chase';
  });
  const [outboundAim, setOutboundAim] = useState(() => searchParams.get('aim') || 'other');
  const [outboundCustomerId] = useState(() => searchParams.get('customerId') || '');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [phoneLines, setPhoneLines] = useState<PhoneLine[]>([]);
  const [bridgeUrl, setBridgeUrl] = useState('');
  const [linesLoading, setLinesLoading] = useState(false);
  const [registeringLines, setRegisteringLines] = useState(false);
  const [lineForm, setLineForm] = useState({
    label: '',
    sipUsername: '',
    sipPassword: '',
    sipDomain: 'sbc.soho66.co.uk',
    did: '',
    assignedUserId: '',
    purpose: 'staff' as 'staff' | 'aria',
  });
  const [editingLineId, setEditingLineId] = useState<string | null>(null);

  const [transferNumbers, setTransferNumbers] = useState<TransferNumbers>({});
  const [transferSaving, setTransferSaving] = useState(false);

  const app = useContext(AppContext);
  const [leadFormCallId, setLeadFormCallId] = useState<string | null>(null);
  const [leadFormName, setLeadFormName] = useState('');
  const [leadFormEmail, setLeadFormEmail] = useState('');
  const [leadFormNotes, setLeadFormNotes] = useState('');
  const [creatingLead, setCreatingLead] = useState(false);

  const playCynthiaAudio = useCallback(async (text: string) => {
    if (!text.trim()) return;
    try {
      const res = await fetch('/api/agent/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          voiceId: activeVoiceId ?? undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? 'TTS failed');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = audioRef.current ?? new Audio();
      audio.src = url;
      audioRef.current = audio;
      await audio.play();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not play Cynthia voice');
    }
  }, [activeVoiceId]);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/agent/settings');
      const data = await res.json();
      setIsActive(data.isActive !== false);
      setActiveVoiceId(data.activeVoiceId ?? null);
    } catch {
      // keep defaults
    }
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/agent/status');
      const data = await res.json();
      setAgentStatus(data);
      setIsActive(data.isActive !== false);
    } catch {
      // silent poll failure
    }
  }, []);

  const fetchCalls = useCallback(async () => {
    try {
      const res = await fetch('/api/calls?limit=20');
      const data = await res.json();
      setCalls(data.calls ?? []);
      setOutboundQueue(data.outboundQueue ?? []);
    } catch {
      toast.error('Failed to load calls');
    }
  }, []);

  const fetchVoices = useCallback(async () => {
    try {
      const res = await fetch('/api/agent/voices');
      const data = await res.json();
      setVoices(data.voices ?? []);
      setActiveVoiceId(data.activeVoiceId ?? null);
      setVoiceFallbackNote(data.fallback ? (data.message ?? 'Using OpenAI TTS fallback') : null);
    } catch {
      setVoiceFallbackNote('Could not load voices');
    }
  }, []);

  const fetchLines = useCallback(async () => {
    try {
      const res = await fetch('/api/agent/lines');
      const data = await res.json();
      setPhoneLines(data.lines ?? []);
      setBridgeUrl(data.bridgeUrl ?? '');
    } catch {
      toast.error('Failed to load phone lines');
    }
  }, []);

  const fetchTransferNumbers = useCallback(async () => {
    try {
      const res = await fetch('/api/agent/transfer-numbers');
      const data = await res.json();
      setTransferNumbers(data.transferNumbers ?? {});
    } catch {
      // keep defaults
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchSettings(), fetchStatus(), fetchCalls(), fetchVoices(), fetchLines(), fetchTransferNumbers()]);
    setLoading(false);
  }, [fetchSettings, fetchStatus, fetchCalls, fetchVoices, fetchLines, fetchTransferNumbers]);

  useEffect(() => { refreshAll(); }, [refreshAll]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchStatus();
      fetchCalls();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchStatus, fetchCalls]);

  // Deep-link support: /calls?callId=... (e.g. from a "View call" link on a CRM lead)
  useEffect(() => {
    const linkedCallId = searchParams.get('callId');
    if (linkedCallId && calls.some(c => c.id === linkedCallId)) {
      setExpandedCallId(linkedCallId);
    }
  }, [searchParams, calls]);

  async function toggleAgent(checked: boolean) {
    setTogglingAgent(true);
    setIsActive(checked);
    try {
      const res = await fetch('/api/agent/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: checked }),
      });
      const data = await res.json();
      setIsActive(data.isActive !== false);
      toast.success(checked ? 'Cynthia is now answering calls' : 'Cynthia paused — calls will not be answered');
    } catch {
      setIsActive(!checked);
      toast.error('Failed to update agent status');
    } finally {
      setTogglingAgent(false);
    }
  }

  async function selectVoice(voiceId: string) {
    try {
      const res = await fetch('/api/agent/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activeVoiceId: voiceId }),
      });
      const data = await res.json();
      setActiveVoiceId(data.activeVoiceId ?? voiceId);
      toast.success('Active voice updated');
    } catch {
      toast.error('Failed to set active voice');
    }
  }

  async function uploadVoice() {
    if (!voiceUploadName.trim() || !voiceUploadFile) {
      toast.error('Enter a name and select a WAV file');
      return;
    }
    setUploadingVoice(true);
    try {
      const form = new FormData();
      form.append('name', voiceUploadName.trim());
      form.append('file', voiceUploadFile);
      const res = await fetch('/api/agent/voices', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Upload failed');
      toast.success('Voice uploaded to Chatterbox (legacy — does not change live phone TTS)');
      setVoiceUploadName('');
      setVoiceUploadFile(null);
      fetchVoices();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploadingVoice(false);
    }
  }

  async function runContactLookup() {
    if (!lookupPhone.trim()) return;
    setLookupLoading(true);
    setLookupResult(null);
    try {
      const res = await fetch(`/api/contacts/lookup?phone=${encodeURIComponent(lookupPhone.trim())}`);
      const data = await res.json();
      setLookupResult(data);
    } catch {
      toast.error('Lookup failed');
    } finally {
      setLookupLoading(false);
    }
  }

  async function startTestCall() {
    setTestRunning(true);
    setTestTranscript([]);
    setTestCallId(null);
    try {
      const res = await fetch('/api/calls/mock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: testFrom }),
      });
      const data = await res.json();
      setTestCallId(data.callId);
      const agentLine = data.speak;
      setTestTranscript([{ role: 'agent', content: agentLine }]);
      if (agentLine) void playCynthiaAudio(agentLine);
      fetchCalls();
      fetchStatus();
    } catch {
      toast.error('Failed to start test call');
    } finally {
      setTestRunning(false);
    }
  }

  async function sendTestSpeech() {
    if (!testSpeech.trim()) return;
    setTestRunning(true);
    const userMsg = testSpeech;
    setTestSpeech('');
    setTestTranscript(prev => [...prev, { role: 'caller', content: userMsg }]);
    try {
      const res = await fetch('/api/calls/mock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: testFrom, speech: userMsg, callId: testCallId }),
      });
      const data = await res.json();
      setTestCallId(data.callId);
      const agentLine = data.speak;
      setTestTranscript(prev => [...prev, { role: 'agent', content: agentLine }]);
      if (agentLine) void playCynthiaAudio(agentLine);
      fetchCalls();
      fetchStatus();
    } catch {
      toast.error('Failed to process speech');
    } finally {
      setTestRunning(false);
    }
  }

  async function savePhoneLine() {
    if (!lineForm.label.trim() || !lineForm.sipUsername.trim() || !lineForm.did.trim()) {
      toast.error('Fill in label, SIP username, and DID');
      return;
    }
    if (!editingLineId && !lineForm.sipPassword.trim()) {
      toast.error('SIP password is required for new lines');
      return;
    }
    setLinesLoading(true);
    try {
      const url = editingLineId ? `/api/agent/lines/${editingLineId}` : '/api/agent/lines';
      const method = editingLineId ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...lineForm,
          assignedUserId: lineForm.assignedUserId.trim() || null,
          purpose: lineForm.purpose,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to save line');
      toast.success(editingLineId ? 'Line updated' : 'Line added');
      setLineForm({ label: '', sipUsername: '', sipPassword: '', sipDomain: 'sbc.soho66.co.uk', did: '', assignedUserId: '', purpose: 'staff' });
      setEditingLineId(null);
      fetchLines();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save line');
    } finally {
      setLinesLoading(false);
    }
  }

  async function registerAllLines() {
    setRegisteringLines(true);
    try {
      const res = await fetch('/api/agent/lines/register-all', { method: 'POST' });
      const data = await res.json();
      setPhoneLines(data.lines ?? []);
      toast.success(`Registered ${data.registered ?? 0} line(s)${data.failed ? `, ${data.failed} failed` : ''}`);
      fetchStatus();
    } catch {
      toast.error('Failed to register lines');
    } finally {
      setRegisteringLines(false);
    }
  }

  async function testLine(lineId: string) {
    try {
      const res = await fetch(`/api/agent/lines/${lineId}/test`, { method: 'POST' });
      const data = await res.json();
      if (data.ok) toast.success(data.message);
      else toast.error(data.message ?? 'Line test failed');
    } catch {
      toast.error('Line test failed');
    }
  }

  async function deleteLine(lineId: string) {
    try {
      const res = await fetch(`/api/agent/lines/${lineId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      toast.success('Line removed');
      fetchLines();
    } catch {
      toast.error('Failed to delete line');
    }
  }

  function startEditLine(line: PhoneLine) {
    setEditingLineId(line.id);
    setLineForm({
      label: line.label,
      sipUsername: line.sipUsername,
      sipPassword: line.sipPassword === '••••••' ? '' : line.sipPassword,
      sipDomain: line.sipDomain || 'sbc.soho66.co.uk',
      did: line.did,
      assignedUserId: line.assignedUserId ?? '',
      purpose: line.purpose === 'aria' ? 'aria' : 'staff',
    });
  }

  async function saveTransferNumbers() {
    setTransferSaving(true);
    try {
      const res = await fetch('/api/agent/transfer-numbers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(transferNumbers),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to save');
      setTransferNumbers(data.transferNumbers ?? transferNumbers);
      toast.success('Transfer numbers saved — Cynthia will use these for live handoffs');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save transfer numbers');
    } finally {
      setTransferSaving(false);
    }
  }

  async function queueOutbound() {
    if (!outboundTo.trim()) {
      toast.error('Enter a phone number');
      return;
    }
    try {
      const res = await fetch('/api/calls/outbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: outboundTo,
          template: outboundTemplate,
          context: {
            aim: outboundAim,
            customerId: outboundCustomerId || undefined,
            source: 'call_centre',
          },
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Outbound call queued');
        setOutboundTo('');
        fetchCalls();
      } else {
        toast.error(data.error ?? 'Failed to queue call');
      }
    } catch {
      toast.error('Failed to queue outbound call');
    }
  }

  function openLeadForm(call: Pick<CallRecord, 'id' | 'from' | 'contactName'>) {
    setLeadFormCallId(call.id);
    setLeadFormName(call.contactName && call.contactName !== 'Guest' ? call.contactName : '');
    setLeadFormEmail('');
    setLeadFormNotes('');
  }

  function closeLeadForm() {
    setLeadFormCallId(null);
  }

  async function submitLeadFromCall(call: Pick<CallRecord, 'id' | 'from'>) {
    if (!leadFormName.trim()) {
      toast.error('Enter the caller\'s name to create a lead');
      return;
    }
    setCreatingLead(true);
    try {
      const res = await fetch('/api/leads/from-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callId: call.id,
          phone: call.from,
          name: leadFormName.trim(),
          email: leadFormEmail.trim() || undefined,
          notes: leadFormNotes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message ?? data.error ?? 'Failed to create lead');
      toast.success(`Lead created for ${leadFormName.trim()} — visible in CRM`);
      if (app?.upsertCustomer && data.customer?.id) {
        app.upsertCustomer(data.customer as Parameters<typeof app.upsertCustomer>[0]);
      }
      closeLeadForm();
      fetchCalls();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create lead');
    } finally {
      setCreatingLead(false);
    }
  }

  function renderLeadForm(call: Pick<CallRecord, 'id' | 'from'>) {
    if (leadFormCallId !== call.id) return null;
    return (
      <div className="p-3 rounded-lg border bg-white space-y-3">
        <p className="text-sm font-medium text-slate-700">New lead — phone pre-filled from caller ID</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label>Phone (from caller ID)</Label>
            <Input value={formatPhone(call.from)} disabled className="font-mono" />
          </div>
          <div>
            <Label>Caller name</Label>
            <Input
              value={leadFormName}
              onChange={e => setLeadFormName(e.target.value)}
              placeholder="Name from the call, or type it in"
              autoFocus
            />
          </div>
          <div>
            <Label>Email (optional)</Label>
            <Input
              value={leadFormEmail}
              onChange={e => setLeadFormEmail(e.target.value)}
              placeholder="customer@example.com"
            />
          </div>
          <div>
            <Label>Notes (optional)</Label>
            <Input
              value={leadFormNotes}
              onChange={e => setLeadFormNotes(e.target.value)}
              placeholder="Enquiry details for follow-up"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => submitLeadFromCall(call)}
            disabled={creatingLead || !leadFormName.trim()}
          >
            {creatingLead ? 'Creating…' : 'Save as new lead'}
          </Button>
          <Button size="sm" variant="ghost" onClick={closeLeadForm} disabled={creatingLead}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  const activeCalls = agentStatus?.activeCalls ?? (agentStatus?.activeCall ? [agentStatus.activeCall] : []);
  const linesSummary = agentStatus?.linesSummary;
  const stats = agentStatus?.todayStats;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Phone className="w-7 h-7 text-amber-600" />
            Call Centre — Cynthia
          </h1>
          <p className="text-slate-600 mt-1">AI voice agent control dashboard</p>
        </div>
        <Button variant="outline" onClick={refreshAll} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Section 1: Master on/off */}
      <Card className={isActive ? 'border-green-200 bg-green-50/30' : 'border-red-200 bg-red-50/30'}>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <Power className={`w-6 h-6 ${isActive ? 'text-green-600' : 'text-red-500'}`} />
              <div>
                <p className="font-semibold text-slate-900">AI Agent Master Switch</p>
                <p className="text-sm text-slate-600">
                  {isActive ? 'Cynthia is answering inbound calls' : 'Cynthia is paused — calls will not be answered'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={isActive ? 'default' : 'destructive'} className={isActive ? 'bg-green-600' : ''}>
                {isActive ? 'Agent answering' : 'Agent paused'}
              </Badge>
              <Switch
                checked={isActive}
                onCheckedChange={toggleAgent}
                disabled={togglingAgent}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Live call status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Live Call Status</CardTitle>
          <CardDescription>
            Updates every 5 seconds
            {linesSummary && (
              <> · {linesSummary.registered}/{linesSummary.total} lines registered · {linesSummary.onCall} on call</>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {activeCalls.length > 0 ? (
            <div className="space-y-3 max-h-[360px] overflow-y-auto">
              {activeCalls.map(call => {
                const matched = calls.find(c => c.id === call.id);
                const customerId = call.customerId ?? matched?.customerId;
                return (
                  <div key={call.id} className="p-4 rounded-lg bg-amber-50 border border-amber-200 space-y-3">
                    <div className="flex items-center gap-4">
                      <span className="relative flex h-3 w-3 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 truncate">
                          On call with {call.contactName && call.contactName !== 'Guest' ? call.contactName : 'Guest — new caller'}
                        </p>
                        <p className="text-sm text-slate-600">
                          <span className="text-slate-500">Caller: </span>
                          <span className="font-mono font-semibold text-slate-900">{formatPhone(call.from)}</span>
                          {call.lineLabel ? ` · ${call.lineLabel}` : ''}
                          {call.to ? ` · to ${formatPhone(call.to)}` : ''}
                          {' · '}{formatDuration(call.elapsedSec ?? undefined)} elapsed
                        </p>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {matched?.metadata?.phoneAuth && PHONE_AUTH_LABELS[matched.metadata.phoneAuth] && (
                            <Badge
                              variant={matched.metadata.phoneAuth === 'verified' ? 'default' : 'secondary'}
                              className={`text-xs ${matched.metadata.phoneAuth === 'verified' ? 'bg-green-600' : ''}`}
                            >
                              PIN {PHONE_AUTH_LABELS[matched.metadata.phoneAuth]}
                            </Badge>
                          )}
                          {(!call.contactName || call.contactName === 'Guest') && (
                            <Badge variant="outline" className="text-xs">
                              Company: {integrationService.getConfig('company').companyName || 'Builder Diddies'}
                              {integrationService.getConfig('company').website
                                ? ` · ${integrationService.getConfig('company').website}`
                                : ''}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Badge className="shrink-0">{call.status.replace(/_/g, ' ')}</Badge>
                      {customerId ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="shrink-0"
                          onClick={() => navigate(`/crm?customerId=${customerId}`)}
                        >
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Open in CRM
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="shrink-0"
                          onClick={() => openLeadForm({ id: call.id, from: call.from, contactName: call.contactName })}
                        >
                          <UserPlus className="w-4 h-4 mr-2" />
                          Create lead
                        </Button>
                      )}
                    </div>
                    {renderLeadForm({ id: call.id, from: call.from })}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-slate-500 text-sm py-2">No active calls right now</p>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 rounded-lg border bg-white">
              <p className="text-2xl font-bold">{stats?.totalCalls ?? 0}</p>
              <p className="text-xs text-slate-500">Calls today</p>
            </div>
            <div className="p-3 rounded-lg border bg-white">
              <p className="text-2xl font-bold">{formatDuration(stats?.avgDurationSec)}</p>
              <p className="text-xs text-slate-500">Avg duration</p>
            </div>
            <div className="p-3 rounded-lg border bg-white">
              <p className="text-2xl font-bold">{stats?.aiResolvedPct ?? 0}%</p>
              <p className="text-xs text-slate-500">Resolved by AI</p>
            </div>
            <div className="p-3 rounded-lg border bg-white">
              <p className="text-2xl font-bold">{stats?.callbacksBooked ?? 0}</p>
              <p className="text-xs text-slate-500">Callbacks booked</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue={initialTab} key={initialTab}>
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="lines">Phone Lines</TabsTrigger>
          <TabsTrigger value="test">Test Call (Mock)</TabsTrigger>
          <TabsTrigger value="softphone">Soft Phone</TabsTrigger>
          <TabsTrigger value="outbound">Outbound Queue</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-4 space-y-6">
          {/* Section 3: Recent calls log */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Calls</CardTitle>
              <CardDescription>Last 20 calls — click to expand transcript</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {calls.length === 0 && (
                <p className="text-slate-500 text-sm py-8 text-center">No calls yet — use the Test Call tab to simulate</p>
              )}
              {calls.map(call => {
                const expanded = expandedCallId === call.id;
                return (
                  <div key={call.id} className="border rounded-lg overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setExpandedCallId(expanded ? null : call.id)}
                      className="w-full text-left p-3 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {call.direction === 'inbound'
                            ? <PhoneIncoming className="w-4 h-4 text-green-600 shrink-0" />
                            : <PhoneOutgoing className="w-4 h-4 text-blue-600 shrink-0" />}
                          <span className="font-medium text-sm truncate">{call.contactName ?? formatPhone(call.from)}</span>
                          <span className="text-xs text-slate-400">{formatPhone(call.from)}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-slate-400">{formatTime(call.startedAt)}</span>
                          <span className="text-xs text-slate-500">{formatDuration(call.durationSec)}</span>
                          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </div>
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {call.outcome && <Badge variant="outline" className="text-xs">{call.outcome}</Badge>}
                        {call.sentiment && (
                          <Badge
                            variant={call.sentiment === 'negative' ? 'destructive' : 'secondary'}
                            className="text-xs"
                          >
                            {SENTIMENT_LABELS[call.sentiment] ?? call.sentiment}
                          </Badge>
                        )}
                        {call.intent && (
                          <Badge variant="secondary" className="text-xs">{INTENT_LABELS[call.intent] ?? call.intent}</Badge>
                        )}
                        {call.metadata?.callerKind && call.metadata.callerKind !== 'customer' && (
                          <Badge variant="outline" className="text-xs gap-1">
                            <ShieldCheck className="w-3 h-3" />
                            {call.metadata.callerRole ?? call.metadata.callerKind}
                          </Badge>
                        )}
                        {call.metadata?.phoneAuth && PHONE_AUTH_LABELS[call.metadata.phoneAuth] && (
                          <Badge
                            variant={call.metadata.phoneAuth === 'verified' ? 'default' : 'destructive'}
                            className={`text-xs ${call.metadata.phoneAuth === 'verified' ? 'bg-green-600' : ''}`}
                          >
                            {PHONE_AUTH_LABELS[call.metadata.phoneAuth]}
                          </Badge>
                        )}
                        {call.metadata?.callLanguage && call.metadata.callLanguage !== 'en' && (
                          <Badge variant="outline" className="text-xs gap-1">
                            <Globe className="w-3 h-3" />
                            {call.metadata.callLanguage.toUpperCase()}
                          </Badge>
                        )}
                        {(call.status === 'transferred' || call.transferredTo) && (
                          <Badge variant="outline" className="text-xs gap-1">
                            <PhoneForwarded className="w-3 h-3" />
                            Transferred{call.transferredTo ? ` · ${call.transferredTo}` : ''}
                          </Badge>
                        )}
                      </div>
                    </button>
                    {expanded && (
                      <div className="border-t p-3 bg-slate-50 space-y-3">
                        <div className="flex items-center gap-2 p-2 rounded-md bg-white border">
                          <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                          <span className="text-xs text-slate-500">Caller number:</span>
                          <span className="font-mono font-semibold text-sm text-slate-900">{formatPhone(call.from)}</span>
                        </div>
                        <div className="space-y-2 max-h-[240px] overflow-y-auto">
                          {(call.transcript ?? []).map((turn, i) => (
                            <div
                              key={i}
                              className={`p-2 rounded text-sm ${turn.role === 'agent' ? 'bg-amber-100 ml-4' : 'bg-white border mr-4'}`}
                            >
                              <span className="text-xs text-slate-400">{turn.role === 'agent' ? 'Cynthia' : 'Caller'}: </span>
                              {turn.content}
                            </div>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {call.customerId ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => navigate(`/crm?customerId=${call.customerId}`)}
                            >
                              <ExternalLink className="w-4 h-4 mr-2" />
                              Open in CRM
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openLeadForm(call)}
                            >
                              <UserPlus className="w-4 h-4 mr-2" />
                              Create lead from this call
                            </Button>
                          )}
                        </div>
                        {renderLeadForm(call)}
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Section 4: Voice settings */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Mic className="w-5 h-5" />
                  Voice Settings
                </CardTitle>
                {voiceFallbackNote && (
                  <CardDescription className="text-amber-700">{voiceFallbackNote}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  {voices.map(v => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => selectVoice(v.id)}
                      className={`p-3 rounded-lg border text-left text-sm transition-colors ${
                        activeVoiceId === v.id ? 'border-amber-500 bg-amber-50 ring-1 ring-amber-400' : 'hover:bg-slate-50'
                      }`}
                    >
                      <p className="font-medium">{v.name}</p>
                      <p className="text-xs text-slate-400 capitalize">{v.provider}</p>
                    </button>
                  ))}
                </div>
                <div className="border-t pt-4 space-y-3">
                  <p className="text-sm font-medium text-slate-700">Live phone voice</p>
                  <p className="text-xs text-slate-500">
                    Real calls use <strong>Vapi + ElevenLabs</strong> (female Cockney). Configure
                    <code className="mx-1">VAPI_ELEVENLABS_VOICE_ID</code> on the API host — see docs/VOICE_SETUP.md.
                    Chatterbox WAV upload below is legacy / mock only and does not change live phone TTS.
                  </p>
                  <p className="text-sm font-medium text-slate-700 pt-2">Legacy: upload cloned voice (WAV)</p>
                  <Input
                    placeholder="Voice name"
                    value={voiceUploadName}
                    onChange={e => setVoiceUploadName(e.target.value)}
                  />
                  <Input
                    type="file"
                    accept=".wav,audio/wav"
                    onChange={e => setVoiceUploadFile(e.target.files?.[0] ?? null)}
                  />
                  <Button onClick={uploadVoice} disabled={uploadingVoice} variant="outline" className="w-full">
                    {uploadingVoice ? 'Uploading…' : 'Upload to Chatterbox (legacy)'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Section 5: Contact lookup test */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Search className="w-5 h-5" />
                  Contact Lookup Test
                </CardTitle>
                <CardDescription>Verify CRM connection before go-live</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="447700900123"
                    value={lookupPhone}
                    onChange={e => setLookupPhone(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && runContactLookup()}
                  />
                  <Button onClick={runContactLookup} disabled={lookupLoading}>
                    <Search className="w-4 h-4" />
                  </Button>
                </div>
                {lookupResult && (
                  lookupResult.found ? (
                    <div className="p-4 rounded-lg border bg-white space-y-2">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-slate-400" />
                        <span className="font-semibold">{lookupResult.name}</span>
                        <Badge variant="secondary">{lookupResult.status}</Badge>
                      </div>
                      {lookupResult.accountValue != null && (
                        <p className="text-sm text-slate-600">Account value: £{lookupResult.accountValue.toLocaleString('en-GB')}</p>
                      )}
                      {lookupResult.lastInteraction && (
                        <p className="text-sm text-slate-600">Last interaction: {formatTime(lookupResult.lastInteraction)}</p>
                      )}
                      {lookupResult.customerId && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/crm?customerId=${lookupResult.customerId}`)}
                        >
                          Open in CRM
                        </Button>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-600 p-4 rounded-lg border bg-slate-50">
                      {lookupResult.message ?? 'Cynthia will create a new contact when this number calls.'}
                    </p>
                  )
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="lines" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PhoneForwarded className="w-5 h-5" />
                Call Transfer Destinations
              </CardTitle>
              <CardDescription>
                Where Cynthia puts calls through when she or the caller asks for a human. Leave blank to only take a message for that department.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {TRANSFER_DEPARTMENTS.map((dept) => (
                  <div key={dept.key}>
                    <Label>{dept.label}</Label>
                    <Input
                      value={transferNumbers[dept.key] ?? ''}
                      onChange={(e) => setTransferNumbers((prev) => ({ ...prev, [dept.key]: e.target.value }))}
                      placeholder={dept.placeholder}
                    />
                  </div>
                ))}
              </div>
              <Button onClick={saveTransferNumbers} disabled={transferSaving}>
                {transferSaving ? 'Saving…' : 'Save transfer numbers'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Radio className="w-5 h-5" />
                    Soho66 Phone Lines
                  </CardTitle>
                  <CardDescription>
                    Cynthia AI lines use purpose "aria" (compat) and answer via Vapi + Soho66. Staff softphones use Calls → Soft Phone.
                  </CardDescription>
                </div>
                <Button onClick={registerAllLines} disabled={registeringLines || phoneLines.length === 0}>
                  <RefreshCw className={`w-4 h-4 mr-2 ${registeringLines ? 'animate-spin' : ''}`} />
                  Register all lines
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {phoneLines.length === 0 && (
                <p className="text-slate-500 text-sm py-4 text-center">No lines yet — add your Soho66 extensions below</p>
              )}
              {phoneLines.map(line => (
                <div key={line.id} className="p-4 border rounded-lg flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900">{line.label}</p>
                    <p className="text-sm text-slate-600">{line.sipUsername}@{line.sipDomain} · {formatPhone(line.did)}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {(line.purpose ?? 'staff') === 'aria' ? 'Cynthia AI' : 'Staff softphone'}
                      {line.assignedUserId ? ` · user ${line.assignedUserId}` : ''}
                    </p>
                    {line.lastError && <p className="text-xs text-red-600 mt-1">{line.lastError}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={line.status === 'registered' ? 'default' : line.status === 'error' ? 'destructive' : 'secondary'}>
                      {LINE_STATUS_LABELS[line.status] ?? line.status}
                    </Badge>
                    <Button size="sm" variant="outline" onClick={() => testLine(line.id)}>Test</Button>
                    <Button size="sm" variant="outline" onClick={() => startEditLine(line)}>Edit</Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteLine(line.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{editingLineId ? 'Edit Line' : 'Add Line'}</CardTitle>
              <CardDescription>SIP login from your Soho66 portal — one extension per line</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Label</Label>
                  <Input value={lineForm.label} onChange={e => setLineForm(f => ({ ...f, label: e.target.value }))} placeholder="Sales Line 1" />
                </div>
                <div>
                  <Label>DID (phone number)</Label>
                  <Input value={lineForm.did} onChange={e => setLineForm(f => ({ ...f, did: e.target.value }))} placeholder="+442012345678" />
                </div>
                <div>
                  <Label>SIP Username</Label>
                  <Input value={lineForm.sipUsername} onChange={e => setLineForm(f => ({ ...f, sipUsername: e.target.value }))} />
                </div>
                <div>
                  <Label>SIP Password</Label>
                  <Input type="password" value={lineForm.sipPassword} onChange={e => setLineForm(f => ({ ...f, sipPassword: e.target.value }))} />
                </div>
                <div>
                  <Label>SIP Domain</Label>
                  <Input value={lineForm.sipDomain} onChange={e => setLineForm(f => ({ ...f, sipDomain: e.target.value }))} placeholder="sbc.soho66.co.uk" />
                </div>
                <div>
                  <Label>Purpose</Label>
                  <select
                    className="mt-1 w-full border rounded-md h-10 px-3 text-sm"
                    value={lineForm.purpose}
                    onChange={e => setLineForm(f => ({ ...f, purpose: e.target.value as 'staff' | 'aria' }))}
                  >
                    <option value="staff">Staff softphone</option>
                    <option value="aria">Cynthia AI (Vapi)</option>
                  </select>
                </div>
                <div>
                  <Label>Assigned user ID (optional)</Label>
                  <Input
                    value={lineForm.assignedUserId}
                    onChange={e => setLineForm(f => ({ ...f, assignedUserId: e.target.value }))}
                    placeholder="Profile / user id"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={savePhoneLine} disabled={linesLoading}>
                  <Plus className="w-4 h-4 mr-2" />
                  {editingLineId ? 'Update line' : 'Add line'}
                </Button>
                {editingLineId && (
                  <Button variant="outline" onClick={() => { setEditingLineId(null); setLineForm({ label: '', sipUsername: '', sipPassword: '', sipDomain: 'sbc.soho66.co.uk', did: '', assignedUserId: '', purpose: 'staff' }); }}>
                    Cancel
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="softphone" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Soft Phone (JsSIP)</CardTitle>
              <CardDescription>
                Registers your assigned Soho66 extension. Incoming calls ring until you answer or reject.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SoftPhonePanel />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="test" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Voicemail className="w-5 h-5" />
                Mock Phone Test
              </CardTitle>
              <CardDescription>Simulate inbound calls without a phone line</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Caller Number</Label>
                  <Input value={testFrom} onChange={e => setTestFrom(e.target.value)} placeholder="447700900123" />
                </div>
                <div className="flex items-end">
                  <Button onClick={startTestCall} disabled={testRunning} className="w-full">
                    <Play className="w-4 h-4 mr-2" />
                    {testCallId ? 'New Call' : 'Start Call'}
                  </Button>
                </div>
              </div>
              {testTranscript.length > 0 && (
                <div className="border rounded-lg p-4 space-y-3 max-h-[300px] overflow-y-auto bg-slate-50">
                  {testTranscript.map((turn, i) => (
                    <div key={i} className={`p-2 rounded text-sm flex gap-2 ${turn.role === 'agent' ? 'bg-amber-100' : 'bg-white border'}`}>
                      <div className="flex-1">
                        <span className="font-medium text-xs text-slate-500">{turn.role === 'agent' ? 'Cynthia:' : 'You:'}</span>{' '}
                        {turn.content}
                      </div>
                      {turn.role === 'agent' && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="shrink-0 h-7 w-7 p-0"
                          onClick={() => playCynthiaAudio(turn.content)}
                          title="Play Cynthia voice"
                        >
                          <Volume2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <audio ref={audioRef} className="hidden" />
              {testCallId && (
                <div className="flex gap-2">
                  <Input
                    value={testSpeech}
                    onChange={e => setTestSpeech(e.target.value)}
                    placeholder="Type what the caller says..."
                    onKeyDown={e => e.key === 'Enter' && sendTestSpeech()}
                  />
                  <Button onClick={sendTestSpeech} disabled={testRunning || !testSpeech.trim()}>
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="outbound" className="mt-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Queue Outbound Call</CardTitle>
                <CardDescription>Queue chase calls (quote follow-up, payment reminder, lead callback) via the connected voice API</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>To Number</Label>
                  <Input value={outboundTo} onChange={e => setOutboundTo(e.target.value)} placeholder="+447700900123" />
                </div>
                <div>
                  <Label>Campaign Template</Label>
                  <Select value={outboundTemplate} onValueChange={setOutboundTemplate}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CAMPAIGN_TEMPLATES.map(t => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Call aim</Label>
                  <Input
                    value={outboundAim}
                    onChange={(e) => setOutboundAim(e.target.value)}
                    placeholder="discovery, callback, trial_followup…"
                  />
                  {outboundCustomerId && (
                    <p className="text-xs text-slate-500 mt-1">Linked CRM lead: {outboundCustomerId}</p>
                  )}
                </div>
                <Button onClick={queueOutbound} className="w-full">
                  <PhoneOutgoing className="w-4 h-4 mr-2" />
                  Queue / Dial Now
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Outbound Queue</CardTitle></CardHeader>
              <CardContent className="space-y-2 max-h-[400px] overflow-y-auto">
                {outboundQueue.length === 0 && (
                  <p className="text-slate-500 text-sm py-8 text-center">No outbound jobs queued</p>
                )}
                {outboundQueue.map(job => (
                  <div key={job.id} className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{formatPhone(job.to)}</span>
                      <Badge variant={job.status === 'failed' ? 'destructive' : 'secondary'}>{job.status}</Badge>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {CAMPAIGN_TEMPLATES.find(t => t.value === job.template)?.label ?? job.template}
                      {' · '}{formatTime(job.createdAt)}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
