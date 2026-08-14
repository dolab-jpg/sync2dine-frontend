'use client';

import { useState, useEffect, useCallback, useContext, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { Switch } from '../ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  Phone, PhoneIncoming, PhoneOutgoing,
  RefreshCw, Play, Send, Voicemail, Mic, Search,
  ChevronDown, ChevronUp, User, ExternalLink, Power, Volume2, Plus, Trash2, Radio,
  PhoneForwarded, ShieldCheck, Globe, UserPlus,
} from 'lucide-react';
import { toast } from 'sonner';
import { SoftPhonePanel } from './SoftPhonePanel';
import LapsedCampaignPanel from './LapsedCampaignPanel';
import { OutboundQueueControlBar } from '../crm/OutboundQueueControlBar';
import { AppContext } from '../../App';
import { integrationService } from '../../engine/integrations/integrationService';
import { getExperience } from '../../engine/platform/experience';
import CallRecordingPlayer from '../restaurant/CallRecordingPlayer';
import CallTranscriptTurns from './CallTranscriptTurns';
import CallContextChip from '../restaurant/CallContextChip';
import LiveCallSpeakerButton from '../restaurant/LiveCallSpeakerButton';
import CallLinkedOrderSync from './CallLinkedOrderSync';

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
  recordingUrl?: string;
  stereoRecordingUrl?: string;
  recordingStoragePath?: string;
  displayPhone?: string;
  lineDid?: string;
  partyPhone?: string;
  hasRecording?: boolean;
  recordingPlaybackPath?: string;
  providerCallId?: string;
  metadata?: {
    callerKind?: 'customer' | 'staff' | 'foreman';
    callerRole?: string;
    phoneAuth?: 'verified' | 'pending' | 'locked' | 'n/a';
    callLanguage?: string;
    transferNumber?: string;
    partyPhone?: string;
    lineDid?: string;
    vapiCallId?: string;
    vapiSummary?: string;
    vapiEndedReason?: string;
    vapiCost?: number | string;
    disposition?: string;
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
  { key: 'sales', label: 'Sales (Sally handoff)', placeholder: '+442037732809' },
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
    listenUrl?: string;
    isGuest?: boolean;
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
    listenUrl?: string;
    isGuest?: boolean;
  }>;
  ringingCount?: number;
  inProgressCount?: number;
  capacity?: {
    inboundActive: number;
    outboundActive: number;
    maxInbound: number;
    maxOutbound: number;
    maxTotal: number;
    overflowArmed: boolean;
    overflowNumber?: string;
  };
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
  { value: 'customer_review', label: 'Customer Review' },
  { value: 'customer_reorder', label: 'Reorder Reminder' },
  { value: 'lapse_winback', label: 'Lapse Win-back' },
];

function formatPhone(phone?: string | null): string {
  if (!phone) return 'Withheld / not provided';
  if (phone.startsWith('44') && phone.length >= 12) {
    return `+${phone.slice(0, 2)} ${phone.slice(2, 6)} ${phone.slice(6)}`;
  }
  return phone;
}

function callPartyDisplay(call: CallRecord): string {
  return call.displayPhone
    || call.partyPhone
    || call.metadata?.partyPhone
    || (call.direction === 'outbound' ? call.to : call.from)
    || '';
}

function callLineDid(call: CallRecord): string {
  return call.lineDid
    || call.metadata?.lineDid
    || (call.direction === 'outbound' ? call.from : call.to)
    || '';
}

function formatTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-GB', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

function callWhen(call: Pick<CallRecord, 'startedAt' | 'endedAt'>): string {
  return formatTime(call.startedAt || call.endedAt);
}

const cardShell = 'rounded-2xl border border-s2d-teal/15 bg-white shadow-sm';

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
  const [refreshingCallId, setRefreshingCallId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [togglingAgent, setTogglingAgent] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

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
  const [leadCallbackPolicy, setLeadCallbackPolicy] = useState<'alert_only' | 'outbound_first' | 'inbound_only'>('alert_only');
  const [defaultOutboundBrief, setDefaultOutboundBrief] = useState('');
  const [queueSettingsSaving, setQueueSettingsSaving] = useState(false);

  const app = useContext(AppContext);
  /** Platform sales shell uses Sally; restaurant tenants keep Judie (food orders). */
  const agentLabel = getExperience(app?.user?.role ?? 'staff') === 'sales' ? 'Sally' : 'Judie';
  const isSalesShell = agentLabel === 'Sally';
  const [leadFormCallId, setLeadFormCallId] = useState<string | null>(null);
  const [leadFormRestaurant, setLeadFormRestaurant] = useState('');
  const [leadFormName, setLeadFormName] = useState('');
  const [leadFormEmail, setLeadFormEmail] = useState('');
  const [leadFormNotes, setLeadFormNotes] = useState('');
  const [creatingLead, setCreatingLead] = useState(false);

  const playJudieAudio = useCallback(async (text: string) => {
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
      toast.error(err instanceof Error ? err.message : 'Could not play Judie voice');
    }
  }, [activeVoiceId]);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/agent/settings');
      const data = await res.json();
      setIsActive(data.isActive !== false);
      setActiveVoiceId(data.activeVoiceId ?? null);
      if (data.leadCallbackPolicy === 'outbound_first' || data.leadCallbackPolicy === 'inbound_only' || data.leadCallbackPolicy === 'alert_only') {
        setLeadCallbackPolicy(data.leadCallbackPolicy);
      }
      if (typeof data.defaultOutboundBrief === 'string') setDefaultOutboundBrief(data.defaultOutboundBrief);
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

  const refreshCallFromProvider = useCallback(async (callId: string) => {
    setRefreshingCallId(callId);
    try {
      const res = await fetch(`/api/calls/${encodeURIComponent(callId)}/refresh-from-provider`, {
        method: 'POST',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || 'Could not refresh from provider');
        return;
      }
      toast.success(
        data.recordingUrl || data.recordingStoragePath
          ? 'Call refreshed — recording updated'
          : 'Call refreshed from provider',
      );
      await fetchCalls();
    } catch {
      toast.error('Refresh failed');
    } finally {
      setRefreshingCallId(null);
    }
  }, [fetchCalls]);

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
      toast.success(
        checked
          ? `${agentLabel} is now live`
          : `${agentLabel} paused — calls will not be answered`,
      );
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
      if (agentLine) void playJudieAudio(agentLine);
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
      if (agentLine) void playJudieAudio(agentLine);
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
      toast.success('Transfer numbers saved — Judie will use these for live handoffs');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save transfer numbers');
    } finally {
      setTransferSaving(false);
    }
  }

  async function saveCallQueueSettings() {
    setQueueSettingsSaving(true);
    try {
      const res = await fetch('/api/agent/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadCallbackPolicy,
          defaultOutboundBrief,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to save');
      if (data.leadCallbackPolicy) setLeadCallbackPolicy(data.leadCallbackPolicy);
      if (typeof data.defaultOutboundBrief === 'string') setDefaultOutboundBrief(data.defaultOutboundBrief);
      toast.success('Call Queue / AI dial settings saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setQueueSettingsSaving(false);
    }
  }

  async function queueOutbound() {
    if (!outboundTo.trim()) {
      toast.error('Enter a phone number');
      return;
    }
    // Sales shell dials are Sally sales calls; a generic aim must not fall back to Judie.
    const aim = isSalesShell && (!outboundAim.trim() || outboundAim === 'other')
      ? 'sales_outreach'
      : outboundAim;
    try {
      const res = await fetch('/api/calls/outbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: outboundTo,
          template: outboundTemplate,
          context: {
            aim,
            brief: aim,
            customerId: outboundCustomerId || undefined,
            ...(isSalesShell ? { agentPersona: 'sally' } : {}),
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

  function openLeadForm(call: Pick<CallRecord, 'id' | 'from' | 'contactName' | 'displayPhone' | 'partyPhone' | 'metadata'>) {
    setLeadFormCallId(call.id);
    setLeadFormRestaurant('');
    setLeadFormName(call.contactName && call.contactName !== 'Guest' ? call.contactName : '');
    setLeadFormEmail('');
    setLeadFormNotes('');
  }

  function closeLeadForm() {
    setLeadFormCallId(null);
  }

  async function submitLeadFromCall(call: Pick<CallRecord, 'id' | 'from' | 'displayPhone' | 'partyPhone' | 'metadata'>) {
    if (!leadFormRestaurant.trim()) {
      toast.error('Enter the restaurant name');
      return;
    }
    if (!leadFormName.trim()) {
      toast.error('Enter the point of contact');
      return;
    }
    setCreatingLead(true);
    try {
      const phone = call.displayPhone || call.partyPhone || call.metadata?.partyPhone || call.from || '';
      const res = await fetch('/api/leads/from-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callId: call.id,
          phone,
          name: leadFormRestaurant.trim(),
          contactName: leadFormName.trim(),
          email: leadFormEmail.trim() || undefined,
          notes: leadFormNotes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message ?? data.error ?? 'Failed to create lead');
      toast.success(`Lead created for ${leadFormRestaurant.trim()} — ${leadFormName.trim()}`);
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
      <div className="p-3 rounded-xl border border-s2d-teal/15 bg-s2d-cream/40 space-y-3">
        <p className="text-sm font-medium text-s2d-teal-deep">New lead — phone pre-filled from caller ID</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label>Phone (from caller ID)</Label>
            <Input value={formatPhone(call.from)} disabled className="font-mono" />
          </div>
          <div>
            <Label>Restaurant name</Label>
            <Input
              value={leadFormRestaurant}
              onChange={e => setLeadFormRestaurant(e.target.value)}
              placeholder="Venue trading name"
              autoFocus
            />
          </div>
          <div>
            <Label>Point of contact</Label>
            <Input
              value={leadFormName}
              onChange={e => setLeadFormName(e.target.value)}
              placeholder="Manager or owner from the call"
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
            disabled={creatingLead || !leadFormRestaurant.trim() || !leadFormName.trim()}
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
  const capacity = agentStatus?.capacity;

  function renderActiveCallCards() {
    if (activeCalls.length === 0) {
      return (
        <p className="text-sm text-s2d-ink-muted py-2">No active calls right now</p>
      );
    }
    return (
      <div className="space-y-3 max-h-[420px] overflow-y-auto">
        {activeCalls.map(call => {
          const matched = calls.find(c => c.id === call.id);
          const customerId = call.customerId ?? matched?.customerId;
          return (
            <div
              key={call.id}
              className="p-4 rounded-xl border border-s2d-teal/20 bg-s2d-cream/50 space-y-3"
            >
              <div className="flex items-center gap-4">
                <span className="relative flex h-3 w-3 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-s2d-gold opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-s2d-teal" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-s2d-teal-deep truncate">
                    On call with {call.contactName && call.contactName !== 'Guest' ? call.contactName : 'Guest — new caller'}
                  </p>
                  <p className="text-sm text-s2d-ink-body">
                    <span className="text-s2d-ink-muted">Caller: </span>
                    <span className="font-mono font-semibold text-s2d-teal-deep">{formatPhone(call.from)}</span>
                    {call.lineLabel ? ` · ${call.lineLabel}` : ''}
                    {call.to ? ` · to ${formatPhone(call.to)}` : ''}
                    {' · '}{formatDuration(call.elapsedSec ?? undefined)} elapsed
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {matched?.metadata?.phoneAuth && PHONE_AUTH_LABELS[matched.metadata.phoneAuth] && (
                      <Badge
                        variant={matched.metadata.phoneAuth === 'verified' ? 'default' : 'secondary'}
                        className={`text-xs ${matched.metadata.phoneAuth === 'verified' ? 'bg-s2d-teal' : ''}`}
                      >
                        PIN {PHONE_AUTH_LABELS[matched.metadata.phoneAuth]}
                      </Badge>
                    )}
                    {(!call.contactName || call.contactName === 'Guest') && (
                      <Badge variant="outline" className="text-xs border-s2d-teal/20">
                        Company: {integrationService.getConfig('company').companyName || 'Builder Diddies'}
                        {integrationService.getConfig('company').website
                          ? ` · ${integrationService.getConfig('company').website}`
                          : ''}
                      </Badge>
                    )}
                  </div>
                </div>
                <Badge className="shrink-0 bg-s2d-teal-deep text-s2d-cream">{call.status.replace(/_/g, ' ')}</Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <LiveCallSpeakerButton listenUrl={call.listenUrl} />
                {customerId ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 border-s2d-teal/20"
                    onClick={() => navigate(`/crm?customerId=${customerId}`)}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Open in CRM
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 border-s2d-teal/20"
                    onClick={() => openLeadForm({ id: call.id, from: call.from, contactName: call.contactName })}
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Create lead
                  </Button>
                )}
              </div>
              <CallContextChip
                callId={call.id}
                customerId={customerId}
                phone={call.from}
                contactName={call.contactName}
                status={call.status}
                isGuest={call.isGuest || !call.contactName || call.contactName === 'Guest'}
                listenUrl={call.listenUrl}
                elapsedSec={call.elapsedSec}
                compact
              />
              {renderLeadForm({ id: call.id, from: call.from })}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-s2d-teal-deep flex items-center gap-2 tracking-tight">
            <Phone className="w-7 h-7 text-s2d-gold" />
            Call Centre — {agentLabel}
          </h1>
          <p className="text-s2d-ink-muted mt-1 text-sm">
            {isSalesShell
              ? 'Sally sells Sync2Dine to restaurants (outbound signup) — separate from restaurant order-taking'
              : 'Live lines, transcripts, and outbound queue'}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={refreshAll}
          disabled={loading}
          className="border-s2d-teal/20 text-s2d-teal-deep hover:bg-s2d-cream"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Always-visible ops strip */}
      <div className={`${cardShell} overflow-hidden`}>
        <div className="flex flex-col gap-3 p-3 sm:p-4 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
          <div className="flex flex-wrap items-center gap-3 min-w-0">
            <div
              className={`flex items-center gap-2.5 rounded-xl px-3 py-2 ${
                isActive ? 'bg-s2d-cream' : 'bg-red-50'
              }`}
            >
              <Power className={`w-4 h-4 shrink-0 ${isActive ? 'text-s2d-teal' : 'text-red-500'}`} />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-s2d-teal-deep leading-tight">Agent on / off</p>
                <p className="text-[11px] text-s2d-ink-muted truncate max-w-[14rem] sm:max-w-none">
                  {isActive
                    ? (isSalesShell ? 'Sally can place outbound sales calls' : 'Judie is answering inbound')
                    : `${agentLabel} paused — not answering`}
                </p>
              </div>
              <Switch
                checked={isActive}
                onCheckedChange={toggleAgent}
                disabled={togglingAgent}
                className="ml-1"
              />
              <Badge
                variant={isActive ? 'default' : 'destructive'}
                className={`text-[10px] ${isActive ? 'bg-s2d-teal hover:bg-s2d-teal' : ''}`}
              >
                {isActive ? 'Answering' : 'Off'}
              </Badge>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-s2d-teal/10 bg-white px-3 py-2">
              {activeCalls.length > 0 ? (
                <>
                  <span className="relative flex h-2.5 w-2.5 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-s2d-gold opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-s2d-teal" />
                  </span>
                  <span className="text-sm font-semibold text-s2d-teal-deep">
                    On call: {activeCalls.length}
                  </span>
                </>
              ) : (
                <>
                  <span className="h-2.5 w-2.5 rounded-full bg-s2d-teal/25 shrink-0" />
                  <span className="text-sm font-medium text-s2d-ink-muted">Idle</span>
                </>
              )}
              {linesSummary && (
                <span className="text-[11px] text-s2d-ink-muted hidden sm:inline">
                  · {linesSummary.registered}/{linesSummary.total} lines · {linesSummary.onCall} on line
                </span>
              )}
            </div>
          </div>

          {capacity && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded-lg border border-s2d-teal/15 bg-s2d-cream/60 px-2.5 py-1 text-xs font-semibold text-s2d-teal-deep">
                Inbound {capacity.inboundActive}/{capacity.maxInbound}
              </span>
              <span className="rounded-lg border border-s2d-teal/15 bg-s2d-cream/60 px-2.5 py-1 text-xs font-semibold text-s2d-teal-deep">
                Outbound {capacity.outboundActive}/{capacity.maxOutbound}
              </span>
              <span className="rounded-lg border border-s2d-teal/15 bg-s2d-cream/60 px-2.5 py-1 text-xs font-semibold text-s2d-teal-deep">
                Max {capacity.maxTotal}
              </span>
              {capacity.overflowArmed && (
                <span className="rounded-lg border border-s2d-gold/40 bg-s2d-gold-soft/50 px-2.5 py-1 text-xs font-medium text-s2d-teal-deep">
                  Overflow ready{capacity.overflowNumber ? ` · ${capacity.overflowNumber}` : ''}
                </span>
              )}
              <OutboundQueueControlBar compact className="ml-1" />
            </div>
          )}
          {!capacity && (
            <OutboundQueueControlBar compact />
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 border-t border-s2d-teal/10 divide-x divide-s2d-teal/10">
          <div className="px-3 py-2.5 sm:px-4">
            <p className="text-xl font-bold text-s2d-teal-deep tabular-nums">{stats?.totalCalls ?? 0}</p>
            <p className="text-[11px] text-s2d-ink-muted">Calls today</p>
          </div>
          <div className="px-3 py-2.5 sm:px-4">
            <p className="text-xl font-bold text-s2d-teal-deep tabular-nums">{formatDuration(stats?.avgDurationSec)}</p>
            <p className="text-[11px] text-s2d-ink-muted">Avg duration</p>
          </div>
          <div className="px-3 py-2.5 sm:px-4">
            <p className="text-xl font-bold text-s2d-teal-deep tabular-nums">{stats?.aiResolvedPct ?? 0}%</p>
            <p className="text-[11px] text-s2d-ink-muted">Resolved by AI</p>
          </div>
          <div className="px-3 py-2.5 sm:px-4">
            <p className="text-xl font-bold text-s2d-teal-deep tabular-nums">{stats?.callbacksBooked ?? 0}</p>
            <p className="text-[11px] text-s2d-ink-muted">Callbacks booked</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue={initialTab} key={initialTab} className="gap-3">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-s2d-cream/80 p-1 rounded-xl border border-s2d-teal/10">
          <TabsTrigger
            value="dashboard"
            className="rounded-lg data-[state=active]:bg-s2d-teal-deep data-[state=active]:text-s2d-cream data-[state=active]:shadow-none"
          >
            Overview
          </TabsTrigger>
          <TabsTrigger
            value="lines"
            className="rounded-lg data-[state=active]:bg-s2d-teal-deep data-[state=active]:text-s2d-cream data-[state=active]:shadow-none"
          >
            Lines
          </TabsTrigger>
          <TabsTrigger
            value="softphone"
            className="rounded-lg data-[state=active]:bg-s2d-teal-deep data-[state=active]:text-s2d-cream data-[state=active]:shadow-none"
          >
            Soft phone
          </TabsTrigger>
          <TabsTrigger
            value="test"
            className="rounded-lg data-[state=active]:bg-s2d-teal-deep data-[state=active]:text-s2d-cream data-[state=active]:shadow-none"
          >
            Test call
          </TabsTrigger>
          <TabsTrigger
            value="outbound"
            className="rounded-lg data-[state=active]:bg-s2d-teal-deep data-[state=active]:text-s2d-cream data-[state=active]:shadow-none"
          >
            Outbound
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-1 space-y-4">
          {activeCalls.length > 0 && (
            <div className={`${cardShell} p-4 space-y-3`}>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-bold text-s2d-teal-deep">Live now</h2>
                <span className="text-[11px] text-s2d-ink-muted">Updates every 5 seconds</span>
              </div>
              {renderActiveCallCards()}
            </div>
          )}

          {/* Recent calls log */}
          <div className={cardShell}>
            <div className="px-4 pt-4 pb-2">
              <h2 className="text-base font-bold text-s2d-teal-deep">Recent calls</h2>
              <p className="text-sm text-s2d-ink-muted">Last 20 — click to expand transcript</p>
            </div>
            <div className="px-3 pb-4 space-y-2">
              {calls.length === 0 && (
                <p className="text-s2d-ink-muted text-sm py-8 text-center">No calls yet — use the Test call tab to simulate</p>
              )}
              {calls.map(call => {
                const expanded = expandedCallId === call.id;
                const partyPhone = callPartyDisplay(call);
                const lineDid = callLineDid(call);
                const playbackPath = call.recordingPlaybackPath
                  || (call.hasRecording || call.recordingUrl || call.recordingStoragePath
                    ? `/api/calls/${encodeURIComponent(call.id)}/recording`
                    : undefined);
                return (
                  <div key={call.id} className="border border-s2d-teal/12 rounded-xl overflow-hidden bg-white">
                    <button
                      type="button"
                      onClick={() => setExpandedCallId(expanded ? null : call.id)}
                      className="w-full text-left p-3 hover:bg-s2d-cream/40 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {call.direction === 'inbound'
                            ? <PhoneIncoming className="w-4 h-4 text-s2d-teal shrink-0" />
                            : <PhoneOutgoing className="w-4 h-4 text-s2d-teal-soft shrink-0" />}
                          <span className="font-semibold text-sm text-s2d-teal-deep truncate">{call.contactName ?? formatPhone(partyPhone)}</span>
                          <span className="text-xs text-s2d-ink-muted hidden sm:inline">{formatPhone(partyPhone)}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-s2d-ink-muted">{callWhen(call)}</span>
                          <span className="text-xs text-s2d-ink-body font-medium">{formatDuration(call.durationSec)}</span>
                          {expanded ? <ChevronUp className="w-4 h-4 text-s2d-teal" /> : <ChevronDown className="w-4 h-4 text-s2d-teal" />}
                        </div>
                      </div>
                      <div className="flex gap-1.5 mt-2 flex-wrap">
                        {call.outcome && <Badge variant="outline" className="text-xs border-s2d-teal/20">{call.outcome}</Badge>}
                        {call.outcome === 'stale_timeout' && (
                          <Badge variant="secondary" className="text-xs">
                            Closed without provider hang-up
                          </Badge>
                        )}
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
                        {expanded && call.metadata?.callerKind && call.metadata.callerKind !== 'customer' && (
                          <Badge variant="outline" className="text-xs gap-1 border-s2d-teal/20">
                            <ShieldCheck className="w-3 h-3" />
                            {call.metadata.callerRole ?? call.metadata.callerKind}
                          </Badge>
                        )}
                        {expanded && call.metadata?.phoneAuth && PHONE_AUTH_LABELS[call.metadata.phoneAuth] && (
                          <Badge
                            variant={call.metadata.phoneAuth === 'verified' ? 'default' : 'destructive'}
                            className={`text-xs ${call.metadata.phoneAuth === 'verified' ? 'bg-s2d-teal' : ''}`}
                          >
                            {PHONE_AUTH_LABELS[call.metadata.phoneAuth]}
                          </Badge>
                        )}
                        {expanded && call.metadata?.callLanguage && call.metadata.callLanguage !== 'en' && (
                          <Badge variant="outline" className="text-xs gap-1 border-s2d-teal/20">
                            <Globe className="w-3 h-3" />
                            {call.metadata.callLanguage.toUpperCase()}
                          </Badge>
                        )}
                        {(call.status === 'transferred' || call.transferredTo) && (
                          <Badge variant="outline" className="text-xs gap-1 border-s2d-teal/20">
                            <PhoneForwarded className="w-3 h-3" />
                            Transferred{call.transferredTo ? ` · ${call.transferredTo}` : ''}
                          </Badge>
                        )}
                      </div>
                    </button>
                    {expanded && (
                      <div className="border-t border-s2d-teal/10 p-3 bg-s2d-cream/30 space-y-3">
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="flex items-center gap-2 p-2 rounded-lg bg-white border border-s2d-teal/10">
                            <Phone className="w-4 h-4 text-s2d-teal/50 shrink-0" />
                            <div className="min-w-0">
                              <span className="text-xs text-s2d-ink-muted">
                                {call.direction === 'outbound' ? 'Called number:' : 'Caller number:'}
                              </span>
                              <p className="font-mono font-semibold text-sm text-s2d-teal-deep truncate">
                                {formatPhone(partyPhone)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 p-2 rounded-lg bg-white border border-s2d-teal/10">
                            <Phone className="w-4 h-4 text-s2d-teal/50 shrink-0" />
                            <div className="min-w-0">
                              <span className="text-xs text-s2d-ink-muted">Our line (DID):</span>
                              <p className="font-mono font-semibold text-sm text-s2d-teal-deep truncate">
                                {formatPhone(lineDid)}
                              </p>
                            </div>
                          </div>
                        </div>
                        {(call.metadata?.vapiSummary || call.metadata?.vapiEndedReason || call.metadata?.disposition) && (
                          <div className="rounded-lg border border-s2d-teal/10 bg-white p-2 space-y-1 text-xs text-s2d-ink-body">
                            {call.metadata?.vapiSummary && (
                              <p><span className="font-semibold text-s2d-teal-deep">Summary:</span> {call.metadata.vapiSummary}</p>
                            )}
                            {call.metadata?.disposition && (
                              <p><span className="font-semibold text-s2d-teal-deep">Disposition:</span> {call.metadata.disposition}</p>
                            )}
                            {call.metadata?.vapiEndedReason && (
                              <p><span className="font-semibold text-s2d-teal-deep">Ended reason:</span> {call.metadata.vapiEndedReason}</p>
                            )}
                            {call.metadata?.vapiCost != null && (
                              <p><span className="font-semibold text-s2d-teal-deep">Cost:</span> {String(call.metadata.vapiCost)}</p>
                            )}
                          </div>
                        )}
                        {(call.providerCallId || call.metadata?.vapiCallId) && (
                          <p className="text-[11px] font-mono text-s2d-ink-muted break-all">
                            Provider id: {call.providerCallId || call.metadata?.vapiCallId}
                          </p>
                        )}
                        {call.outcome === 'stale_timeout' && (
                          <p className="text-xs text-amber-900 bg-s2d-gold-soft/40 border border-s2d-gold/30 rounded-lg p-2">
                            Session was closed without a provider hang-up. Try Refresh from provider to recover recording and transcript if still available upstream.
                          </p>
                        )}
                        <CallRecordingPlayer
                          recordingUrl={call.recordingUrl || call.stereoRecordingUrl}
                          playbackPath={playbackPath}
                          callId={call.id}
                          showEmptyState
                          emptyHint={
                            call.outcome === 'stale_timeout'
                              ? 'No recording stored. Use Refresh from provider if this was a real Vapi call.'
                              : undefined
                          }
                          onRefreshFromProvider={() => refreshCallFromProvider(call.id)}
                          refreshing={refreshingCallId === call.id}
                          testId={`callcenter-recording-${call.id}`}
                        />
                        <CallLinkedOrderSync callId={call.id} />
                        {Array.isArray(call.transcript) && call.transcript.length > 0 ? (
                          <CallTranscriptTurns turns={call.transcript} agentLabel={agentLabel} />
                        ) : (
                          <p className="text-xs text-s2d-ink-muted rounded-lg border border-dashed border-s2d-teal/20 bg-white p-3">
                            No transcript yet.
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-s2d-teal/20"
                            disabled={refreshingCallId === call.id}
                            onClick={() => void refreshCallFromProvider(call.id)}
                          >
                            <RefreshCw className={`w-4 h-4 mr-2 ${refreshingCallId === call.id ? 'animate-spin' : ''}`} />
                            Refresh from provider
                          </Button>
                          {call.customerId ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-s2d-teal/20"
                              onClick={() => navigate(`/crm?customerId=${call.customerId}`)}
                            >
                              <ExternalLink className="w-4 h-4 mr-2" />
                              Open in CRM
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-s2d-teal/20"
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
            </div>
          </div>

          <div className={cardShell}>
            <button
              type="button"
              onClick={() => setAdvancedOpen(o => !o)}
              className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-s2d-cream/30 transition-colors rounded-2xl"
            >
              <div>
                <p className="text-sm font-bold text-s2d-teal-deep">Advanced</p>
                <p className="text-xs text-s2d-ink-muted">Voice settings and CRM contact lookup</p>
              </div>
              {advancedOpen ? <ChevronUp className="w-4 h-4 text-s2d-teal" /> : <ChevronDown className="w-4 h-4 text-s2d-teal" />}
            </button>
            {advancedOpen && (
              <div className="border-t border-s2d-teal/10 px-4 pb-4 pt-3 grid md:grid-cols-2 gap-4">
                <div className="space-y-4 rounded-xl border border-s2d-teal/10 bg-s2d-cream/30 p-4">
                  <div className="flex items-center gap-2">
                    <Mic className="w-4 h-4 text-s2d-teal" />
                    <h3 className="text-sm font-bold text-s2d-teal-deep">Voice settings</h3>
                  </div>
                  {voiceFallbackNote && (
                    <p className="text-xs text-amber-800">{voiceFallbackNote}</p>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    {voices.map(v => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => selectVoice(v.id)}
                        className={`p-3 rounded-lg border text-left text-sm transition-colors ${
                          activeVoiceId === v.id
                            ? 'border-s2d-gold bg-s2d-gold-soft/40 ring-1 ring-s2d-gold'
                            : 'border-s2d-teal/10 hover:bg-white'
                        }`}
                      >
                        <p className="font-medium text-s2d-teal-deep">{v.name}</p>
                        <p className="text-xs text-s2d-ink-muted capitalize">{v.provider}</p>
                      </button>
                    ))}
                  </div>
                  <div className="border-t border-s2d-teal/10 pt-4 space-y-3">
                    <p className="text-sm font-medium text-s2d-teal-deep">Live phone voice</p>
                    <p className="text-xs text-s2d-ink-muted">
                      Real calls use <strong>Vapi + ElevenLabs</strong> (female Cockney). Configure
                      <code className="mx-1">VAPI_ELEVENLABS_VOICE_ID</code> on the API host — see docs/VOICE_SETUP.md.
                      Chatterbox WAV upload below is legacy / mock only and does not change live phone TTS.
                    </p>
                    <p className="text-sm font-medium text-s2d-teal-deep pt-2">Legacy: upload cloned voice (WAV)</p>
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
                    <Button onClick={uploadVoice} disabled={uploadingVoice} variant="outline" className="w-full border-s2d-teal/20">
                      {uploadingVoice ? 'Uploading…' : 'Upload to Chatterbox (legacy)'}
                    </Button>
                  </div>
                </div>

                <div className="space-y-4 rounded-xl border border-s2d-teal/10 bg-s2d-cream/30 p-4">
                  <div className="flex items-center gap-2">
                    <Search className="w-4 h-4 text-s2d-teal" />
                    <h3 className="text-sm font-bold text-s2d-teal-deep">Contact lookup test</h3>
                  </div>
                  <p className="text-xs text-s2d-ink-muted">Verify CRM connection before go-live</p>
                  <div className="flex gap-2">
                    <Input
                      placeholder="447700900123"
                      value={lookupPhone}
                      onChange={e => setLookupPhone(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && runContactLookup()}
                    />
                    <Button onClick={runContactLookup} disabled={lookupLoading} className="bg-s2d-teal-deep hover:bg-s2d-teal">
                      <Search className="w-4 h-4" />
                    </Button>
                  </div>
                  {lookupResult && (
                    lookupResult.found ? (
                      <div className="p-4 rounded-lg border border-s2d-teal/10 bg-white space-y-2">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-s2d-ink-muted" />
                          <span className="font-semibold text-s2d-teal-deep">{lookupResult.name}</span>
                          <Badge variant="secondary">{lookupResult.status}</Badge>
                        </div>
                        {lookupResult.accountValue != null && (
                          <p className="text-sm text-s2d-ink-body">Account value: £{lookupResult.accountValue.toLocaleString('en-GB')}</p>
                        )}
                        {lookupResult.lastInteraction && (
                          <p className="text-sm text-s2d-ink-body">Last interaction: {formatTime(lookupResult.lastInteraction)}</p>
                        )}
                        {lookupResult.customerId && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-s2d-teal/20"
                            onClick={() => navigate(`/crm?customerId=${lookupResult.customerId}`)}
                          >
                            Open in CRM
                          </Button>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-s2d-ink-body p-4 rounded-lg border border-s2d-teal/10 bg-white">
                        {lookupResult.message ?? 'Judie will create a new contact when this number calls.'}
                      </p>
                    )
                  )}
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="lines" className="mt-1 space-y-4">
          <div className={`${cardShell} p-4 space-y-4`}>
            <div>
              <h2 className="text-base font-bold text-s2d-teal-deep flex items-center gap-2">
                <PhoneForwarded className="w-5 h-5 text-s2d-teal" />
                Call transfer destinations
              </h2>
              <p className="text-sm text-s2d-ink-muted mt-1">
                {isSalesShell
                  ? 'Where Sally puts callers through for a human. Sales should be your softphone DID so warm transfers ring your extension.'
                  : 'Where Judie puts calls through when she or the caller asks for a human. Leave blank to only take a message for that department.'}
              </p>
            </div>
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
            <Button onClick={saveTransferNumbers} disabled={transferSaving} className="bg-s2d-teal-deep hover:bg-s2d-teal">
              {transferSaving ? 'Saving…' : 'Save transfer numbers'}
            </Button>
          </div>

          <div className={`${cardShell} p-4 space-y-4`}>
            <div>
              <h2 className="text-base font-bold text-s2d-teal-deep flex items-center gap-2">
                <Phone className="w-5 h-5 text-s2d-teal" />
                Call queue & AI dial settings
              </h2>
              <p className="text-sm text-s2d-ink-muted mt-1">
                Controls CRM “Call this person” defaults and lead callback policy. Sally writes the CRM note after each call.
              </p>
            </div>
              <div>
                <Label>Lead callback policy</Label>
                <Select
                  value={leadCallbackPolicy}
                  onValueChange={(v) => setLeadCallbackPolicy(v as typeof leadCallbackPolicy)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alert_only">Alert only (staff dials)</SelectItem>
                    <SelectItem value="outbound_first">Outbound first (AI may dial)</SelectItem>
                    <SelectItem value="inbound_only">Inbound only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Default brief for “Call this person”</Label>
                <Textarea
                  className="mt-1 min-h-[80px]"
                  value={defaultOutboundBrief}
                  onChange={(e) => setDefaultOutboundBrief(e.target.value)}
                  placeholder="What Sally should cover by default…"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={saveCallQueueSettings} disabled={queueSettingsSaving} className="bg-s2d-teal-deep hover:bg-s2d-teal">
                  {queueSettingsSaving ? 'Saving…' : 'Save dial settings'}
                </Button>
                <Button variant="outline" className="border-s2d-teal/20" onClick={() => navigate('/crm?tab=queue')}>
                  Open Call Queue in CRM
                </Button>
              </div>
          </div>

          <div className={`${cardShell} p-4 space-y-4`}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-s2d-teal-deep flex items-center gap-2">
                  <Radio className="w-5 h-5 text-s2d-teal" />
                  Soho66 phone lines
                </h2>
                <p className="text-sm text-s2d-ink-muted mt-1">
                  Judie AI lines use purpose &quot;aria&quot; (compat) and answer via Vapi + Soho66. Staff softphones use Soft phone for credentials and Groundwire/VOIS links (external).
                </p>
              </div>
              <Button onClick={registerAllLines} disabled={registeringLines || phoneLines.length === 0} variant="outline" className="border-s2d-teal/20">
                <RefreshCw className={`w-4 h-4 mr-2 ${registeringLines ? 'animate-spin' : ''}`} />
                Register all lines
              </Button>
            </div>
            <div className="space-y-3">
              {phoneLines.length === 0 && (
                <p className="text-s2d-ink-muted text-sm py-4 text-center">No lines yet — add your Soho66 extensions below</p>
              )}
              {phoneLines.map(line => (
                <div key={line.id} className="p-4 border border-s2d-teal/12 rounded-xl flex flex-col sm:flex-row sm:items-center gap-3 bg-s2d-cream/20">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-s2d-teal-deep">{line.label}</p>
                    <p className="text-sm text-s2d-ink-body">{line.sipUsername}@{line.sipDomain} · {formatPhone(line.did)}</p>
                    <p className="text-xs text-s2d-ink-muted mt-0.5">
                      {(line.purpose ?? 'staff') === 'aria' ? 'Judie AI' : 'Staff softphone'}
                      {line.assignedUserId ? ` · user ${line.assignedUserId}` : ''}
                    </p>
                    {line.lastError && <p className="text-xs text-red-600 mt-1">{line.lastError}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge
                      variant={line.status === 'registered' ? 'default' : line.status === 'error' ? 'destructive' : 'secondary'}
                      className={line.status === 'registered' ? 'bg-s2d-teal' : ''}
                    >
                      {LINE_STATUS_LABELS[line.status] ?? line.status}
                    </Badge>
                    <Button size="sm" variant="outline" className="border-s2d-teal/20" onClick={() => testLine(line.id)}>Test</Button>
                    <Button size="sm" variant="outline" className="border-s2d-teal/20" onClick={() => startEditLine(line)}>Edit</Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteLine(line.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={`${cardShell} p-4 space-y-4`}>
            <div>
              <h2 className="text-base font-bold text-s2d-teal-deep">{editingLineId ? 'Edit line' : 'Add line'}</h2>
              <p className="text-sm text-s2d-ink-muted mt-1">SIP login from your Soho66 portal — one extension per line</p>
            </div>
            <div className="space-y-4">
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
                    className="mt-1 w-full border border-s2d-teal/15 rounded-md h-10 px-3 text-sm bg-white"
                    value={lineForm.purpose}
                    onChange={e => setLineForm(f => ({ ...f, purpose: e.target.value as 'staff' | 'aria' }))}
                  >
                    <option value="staff">Staff softphone</option>
                    <option value="aria">Judie AI (Vapi)</option>
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
                <Button onClick={savePhoneLine} disabled={linesLoading} className="bg-s2d-teal-deep hover:bg-s2d-teal">
                  <Plus className="w-4 h-4 mr-2" />
                  {editingLineId ? 'Update line' : 'Add line'}
                </Button>
                {editingLineId && (
                  <Button variant="outline" className="border-s2d-teal/20" onClick={() => { setEditingLineId(null); setLineForm({ label: '', sipUsername: '', sipPassword: '', sipDomain: 'sbc.soho66.co.uk', did: '', assignedUserId: '', purpose: 'staff' }); }}>
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="softphone" className="mt-1">
          <div className={`${cardShell} p-4 space-y-4`}>
            <div>
              <h2 className="text-base font-bold text-s2d-teal-deep">Soft phone</h2>
              <p className="text-sm text-s2d-ink-muted mt-1">
                {isSalesShell
                  ? 'Copy your Soho66 SIP login into Groundwire or VOIS (outside Sync2Dine). Point Sally Sales handoffs at this DID so transfers ring that app.'
                  : 'Phone answering stays outside Sync2Dine. Download Groundwire or VOIS, paste your SIP credentials, and use only one device per line.'}
              </p>
            </div>
            <SoftPhonePanel salesMode={isSalesShell} />
          </div>
        </TabsContent>

        <TabsContent value="test" className="mt-1">
          <div className={`${cardShell} p-4 space-y-4`}>
            <div>
              <h2 className="text-base font-bold text-s2d-teal-deep flex items-center gap-2">
                <Voicemail className="w-5 h-5 text-s2d-teal" />
                Test call
              </h2>
              <p className="text-sm text-s2d-ink-muted mt-1">Simulate inbound calls without a phone line</p>
            </div>
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Caller number</Label>
                  <Input value={testFrom} onChange={e => setTestFrom(e.target.value)} placeholder="447700900123" />
                </div>
                <div className="flex items-end">
                  <Button onClick={startTestCall} disabled={testRunning} className="w-full bg-s2d-teal-deep hover:bg-s2d-teal">
                    <Play className="w-4 h-4 mr-2" />
                    {testCallId ? 'New call' : 'Start call'}
                  </Button>
                </div>
              </div>
              {testTranscript.length > 0 && (
                <div className="border border-s2d-teal/12 rounded-xl p-4 space-y-3 max-h-[300px] overflow-y-auto bg-s2d-cream/40">
                  {testTranscript.map((turn, i) => (
                    <div key={i} className={`p-2 rounded-lg text-sm flex gap-2 ${turn.role === 'agent' ? 'bg-s2d-gold-soft/50' : 'bg-white border border-s2d-teal/10'}`}>
                      <div className="flex-1">
                        <span className="font-medium text-xs text-s2d-ink-muted">{turn.role === 'agent' ? `${agentLabel}:` : 'You:'}</span>{' '}
                        {turn.content}
                      </div>
                      {turn.role === 'agent' && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="shrink-0 h-7 w-7 p-0"
                          onClick={() => playJudieAudio(turn.content)}
                          title={`Play ${agentLabel} voice`}
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
                  <Button onClick={sendTestSpeech} disabled={testRunning || !testSpeech.trim()} className="bg-s2d-teal-deep hover:bg-s2d-teal">
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="outbound" className="mt-1">
          <div className="grid md:grid-cols-2 gap-4">
            <div className={`${cardShell} p-4 space-y-4`}>
              <div>
                <h2 className="text-base font-bold text-s2d-teal-deep">Queue outbound call</h2>
                <p className="text-sm text-s2d-ink-muted mt-1">Chase calls via the connected voice API</p>
              </div>
              <div>
                <Label>To number</Label>
                <Input value={outboundTo} onChange={e => setOutboundTo(e.target.value)} placeholder="+447700900123" />
              </div>
              <div>
                <Label>Campaign template</Label>
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
                  <p className="text-xs text-s2d-ink-muted mt-1">Linked CRM lead: {outboundCustomerId}</p>
                )}
              </div>
              <Button onClick={queueOutbound} className="w-full bg-s2d-teal-deep hover:bg-s2d-teal">
                <PhoneOutgoing className="w-4 h-4 mr-2" />
                Queue / dial now
              </Button>
            </div>
            <div className={`${cardShell} p-4 space-y-3`}>
              <h2 className="text-base font-bold text-s2d-teal-deep">Outbound queue</h2>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {outboundQueue.length === 0 && (
                  <p className="text-s2d-ink-muted text-sm py-8 text-center">No outbound jobs queued</p>
                )}
                {outboundQueue.map(job => (
                  <div key={job.id} className="p-3 border border-s2d-teal/12 rounded-xl bg-s2d-cream/20">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm text-s2d-teal-deep">{formatPhone(job.to)}</span>
                      <Badge variant={job.status === 'failed' ? 'destructive' : 'secondary'}>{job.status}</Badge>
                    </div>
                    <p className="text-xs text-s2d-ink-muted mt-1">
                      {CAMPAIGN_TEMPLATES.find(t => t.value === job.template)?.label ?? job.template}
                      {' · '}{formatTime(job.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4 space-y-4">
            <LapsedCampaignPanel onQueued={() => void fetchCalls()} />
            <div className={`${cardShell} p-4 space-y-2`}>
              <h2 className="text-base font-bold text-s2d-teal-deep">Venue lead dials</h2>
              <p className="text-sm text-s2d-ink-muted">
                Queue every CRM lead with a phone from Call Queue. Call Centre keeps one-off dials and lapsed-customer campaigns here.
              </p>
              <Button variant="outline" className="border-s2d-teal/20" onClick={() => navigate('/crm?tab=queue')}>
                Open CRM Call Queue
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
