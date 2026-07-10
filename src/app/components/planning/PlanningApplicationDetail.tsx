import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  ArrowLeft, ScrollText, Upload, ExternalLink, Send, Sparkles, Undo2, Check,
  FileText, Plus, Loader2, Mail, Building2, CheckCircle2, XCircle, Copy,
} from 'lucide-react';
import { AppContext } from '../../App';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Textarea } from '../ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  addPlanningChangeRequest,
  addPlanningComment,
  getPlanningApplication,
  subscribePlanningApplications,
  undoPlanningAiAction,
  updateChangeRequest,
  updatePlanningApplication,
} from '../../engine/planning/planningStore';
import { runPlanningAgent } from '../../engine/planning/planningAiService';
import {
  PLANNING_STAGES,
  POST_APPROVAL_WORKSTREAMS,
  applicationTypeLabel,
  stageLabel,
  type PlanningApplication,
  type PlanningStage,
  type PlanningPostApproval,
} from '../../engine/planning/types';
import { toast } from 'sonner';

const gbp = (n?: number) => (n != null ? `£${n.toLocaleString('en-GB')}` : '—');

interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
  applied?: string[];
}

export default function PlanningApplicationDetail() {
  const { id } = useParams<{ id: string }>();
  const context = useContext(AppContext);
  const navigate = useNavigate();
  const user = context?.user;

  const [app, setApp] = useState<PlanningApplication | undefined>(() => (id ? getPlanningApplication(id) : undefined));
  const [chat, setChat] = useState<ChatTurn[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [councilEmail, setCouncilEmail] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [newChange, setNewChange] = useState('');
  const [newChangeDeadline, setNewChangeDeadline] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!id) return;
    setApp(getPlanningApplication(id));
    return subscribePlanningApplications(() => setApp(getPlanningApplication(id)));
  }, [id]);

  const userName = user?.name ?? 'Staff';

  const openChanges = useMemo(
    () => app?.changeRequests.filter((c) => c.status === 'open').length ?? 0,
    [app]
  );

  if (!app) {
    return (
      <div className="p-6">
        <Button variant="ghost" onClick={() => navigate('/planning')}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Planning
        </Button>
        <p className="text-slate-500 mt-6">Application not found.</p>
      </div>
    );
  }

  const patch = (p: Partial<PlanningApplication>) => updatePlanningApplication(app.id, p);

  const runAgent = async (userText: string, sourceEmail?: string) => {
    if (aiBusy) return;
    setAiBusy(true);
    const nextTurns: ChatTurn[] = [...chat, { role: 'user', content: userText }];
    setChat(nextTurns);
    setChatInput('');
    try {
      const fresh = getPlanningApplication(app.id);
      if (!fresh) return;
      const result = await runPlanningAgent({
        application: fresh,
        messages: nextTurns.map((t) => ({ role: t.role, content: t.content })),
        sourceEmail,
        userRole: user?.role,
        userName,
      });
      setChat([...nextTurns, { role: 'assistant', content: result.content, applied: result.applied }]);
      if (result.applied.length) toast.success(`AI completed ${result.applied.length} action(s)`);
    } catch {
      setChat([...nextTurns, { role: 'assistant', content: 'Sorry — the planning agent is unavailable right now.' }]);
      toast.error('Planning agent unavailable');
    } finally {
      setAiBusy(false);
    }
  };

  const handleUpload = (files: FileList | null) => {
    if (!files?.length) return;
    const file = files[0];
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const current = getPlanningApplication(app.id);
      if (!current) return;
      const version = (current.drawings[current.drawings.length - 1]?.version ?? 0) + 1;
      updatePlanningApplication(app.id, {
        drawings: [
          ...current.drawings,
          {
            id: `dwg-${Date.now()}`,
            filename: file.name,
            mimeType: file.type || 'application/pdf',
            dataUrl,
            version,
            uploadedAt: new Date().toISOString(),
            uploadedBy: userName,
          },
        ],
        stage: current.stage === 'pricing' ? 'drawings' : current.stage,
      });
      toast.success(`Uploaded ${file.name}`);
    };
    reader.readAsDataURL(file);
  };

  const copyApprovalLink = () => {
    const link = `${window.location.origin}/planning-approve/${app.customerApproval.token}`;
    navigator.clipboard?.writeText(link).then(
      () => toast.success('Approval link copied'),
      () => toast.error('Could not copy link')
    );
  };

  const addChange = () => {
    if (!newChange.trim()) return;
    addPlanningChangeRequest(app.id, { description: newChange.trim(), deadline: newChangeDeadline || undefined });
    setNewChange('');
    setNewChangeDeadline('');
    toast.success('Change request added');
  };

  const updateWorkstream = (key: keyof PlanningPostApproval, updates: Partial<PlanningPostApproval[keyof PlanningPostApproval]>) => {
    patch({ postApproval: { ...app.postApproval, [key]: { ...app.postApproval[key], ...updates } } });
  };

  const quickActions = [
    'Draft and send the pricing email for these planning services',
    'Send the drawings to the customer for approval',
    'Submit checklist: what do I need before submitting to the council?',
    'Send a courtesy email to the customer before approval',
  ];

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/planning')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <ScrollText className="w-6 h-6 text-indigo-600" />
              {app.title}
            </h1>
            <p className="text-sm text-slate-600">
              {app.customerName} · {applicationTypeLabel(app.applicationType)}{app.address ? ` · ${app.address}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-slate-500">Stage</Label>
          <Select value={app.stage} onValueChange={(v) => patch({ stage: v as PlanningStage })}>
            <SelectTrigger className="w-44 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PLANNING_STAGES.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 items-start">
        {/* Workflow column */}
        <div className="lg:col-span-2 space-y-4">
          <Tabs defaultValue="workflow">
            <TabsList>
              <TabsTrigger value="workflow">Workflow</TabsTrigger>
              <TabsTrigger value="council">
                Council {openChanges > 0 ? `(${openChanges})` : ''}
              </TabsTrigger>
              <TabsTrigger value="post">Post-approval</TabsTrigger>
            </TabsList>

            {/* WORKFLOW */}
            <TabsContent value="workflow" className="space-y-4">
              {/* Pricing */}
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Pricing</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="fee">Fee (£)</Label>
                      <Input
                        id="fee"
                        type="number"
                        defaultValue={app.pricing.amount ?? ''}
                        onBlur={(e) => patch({ pricing: { ...app.pricing, amount: e.target.value ? Number(e.target.value) : undefined } })}
                        className="mt-1"
                      />
                    </div>
                    <div className="flex items-end gap-2 text-sm">
                      {app.pricing.sentAt
                        ? <Badge className="bg-green-100 text-green-700">Sent {new Date(app.pricing.sentAt).toLocaleDateString('en-GB')}</Badge>
                        : <Badge variant="outline">Not sent</Badge>}
                      {app.pricing.acceptedAt && <Badge className="bg-emerald-100 text-emerald-700">Accepted</Badge>}
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="scope">Scope</Label>
                    <Textarea
                      id="scope"
                      defaultValue={app.pricing.scope ?? ''}
                      onBlur={(e) => patch({ pricing: { ...app.pricing, scope: e.target.value } })}
                      rows={2}
                      className="mt-1"
                      placeholder="What the planning service includes (drawings, submission, managing through to decision)…"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => void runAgent('Draft and send the pricing email for these planning services')}>
                      <Mail className="w-4 h-4 mr-1" /> AI: send pricing email
                    </Button>
                    {!app.pricing.acceptedAt && (
                      <Button size="sm" variant="ghost" onClick={() => patch({ pricing: { ...app.pricing, acceptedAt: new Date().toISOString() } })}>
                        Mark accepted
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Drawings */}
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Drawings</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".pdf,image/*"
                    className="hidden"
                    onChange={(e) => handleUpload(e.target.files)}
                  />
                  <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
                    <Upload className="w-4 h-4 mr-1" /> Upload drawing (PDF)
                  </Button>
                  {app.drawings.length === 0 && <p className="text-xs text-slate-500">No drawings uploaded yet.</p>}
                  {app.drawings.map((d) => (
                    <div key={d.id} className="flex items-center justify-between border rounded-lg p-2 text-sm">
                      <span className="flex items-center gap-2 min-w-0">
                        <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                        <span className="truncate">{d.filename}</span>
                        <Badge variant="outline" className="shrink-0">v{d.version}</Badge>
                      </span>
                      {d.dataUrl && (
                        <a href={d.dataUrl} target="_blank" rel="noreferrer" className="text-indigo-600 text-xs flex items-center gap-1">
                          View <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Customer approval */}
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Customer approval of drawings</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    {app.customerApproval.status === 'approved' && <Badge className="bg-green-100 text-green-700">Approved by customer</Badge>}
                    {app.customerApproval.status === 'changes' && <Badge className="bg-orange-100 text-orange-800">Customer requested changes</Badge>}
                    {app.customerApproval.status === 'pending' && <Badge variant="outline">{app.customerApproval.sentAt ? 'Awaiting customer' : 'Not sent'}</Badge>}
                  </div>
                  {app.customerApproval.note && (
                    <p className="text-sm text-slate-600 bg-slate-50 rounded p-2">"{app.customerApproval.note}"</p>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" variant="outline" onClick={() => void runAgent('Send the drawings to the customer for approval')}>
                      <Send className="w-4 h-4 mr-1" /> AI: send for approval
                    </Button>
                    <Button size="sm" variant="ghost" onClick={copyApprovalLink}>
                      <Copy className="w-4 h-4 mr-1" /> Copy approval link
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* COUNCIL */}
            <TabsContent value="council" className="space-y-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Council submission</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Authority (LPA)" value={app.council.name} onSave={(v) => patch({ council: { ...app.council, name: v } })} />
                    <Field label="Application reference" value={app.council.reference} onSave={(v) => patch({ council: { ...app.council, reference: v } })} />
                    <Field label="Validation officer" value={app.council.validationOfficer} onSave={(v) => patch({ council: { ...app.council, validationOfficer: v } })} />
                    <Field label="Officer email" value={app.council.validationOfficerEmail} onSave={(v) => patch({ council: { ...app.council, validationOfficerEmail: v } })} />
                    <Field label="Target decision date" type="date" value={app.council.targetDecisionDate} onSave={(v) => patch({ council: { ...app.council, targetDecisionDate: v } })} />
                    <Field label="Submitted date" type="date" value={app.council.submittedAt} onSave={(v) => patch({ council: { ...app.council, submittedAt: v, }, stage: v ? 'submitted' : app.stage })} />
                  </div>
                  <Field label="Portal URL" value={app.council.portalUrl} onSave={(v) => patch({ council: { ...app.council, portalUrl: v } })} />
                  <div className="flex gap-2 flex-wrap">
                    {app.council.portalUrl && (
                      <Button size="sm" variant="outline" asChild>
                        <a href={app.council.portalUrl} target="_blank" rel="noreferrer">
                          <Building2 className="w-4 h-4 mr-1" /> Open portal <ExternalLink className="w-3 h-3 ml-1" />
                        </a>
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => void runAgent('Do a portal status check and tell me what to look for and the next step')}>
                      AI: status check
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Validation / change requests</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-500">Paste a council validation email — AI will log the required changes &amp; deadlines</Label>
                    <Textarea value={councilEmail} onChange={(e) => setCouncilEmail(e.target.value)} rows={3} placeholder="Paste the planning officer's email here…" />
                    <Button
                      size="sm"
                      disabled={!councilEmail.trim() || aiBusy}
                      onClick={() => { void runAgent('Parse this validation email: log each requested change with any deadline, and add a short suggested response.', councilEmail.trim()); setCouncilEmail(''); }}
                    >
                      {aiBusy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
                      AI: parse email
                    </Button>
                  </div>

                  <div className="border-t pt-3 space-y-2">
                    <div className="flex gap-2">
                      <Input value={newChange} onChange={(e) => setNewChange(e.target.value)} placeholder="Add a change request manually…" />
                      <Input type="date" value={newChangeDeadline} onChange={(e) => setNewChangeDeadline(e.target.value)} className="w-40" />
                      <Button size="icon" variant="outline" onClick={addChange}><Plus className="w-4 h-4" /></Button>
                    </div>
                    {app.changeRequests.length === 0 && <p className="text-xs text-slate-500">No change requests logged.</p>}
                    {app.changeRequests.map((cr) => (
                      <div key={cr.id} className={`border rounded-lg p-3 text-sm ${cr.status === 'resolved' ? 'opacity-60' : ''}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-medium text-slate-800">{cr.description}</p>
                            {cr.deadline && <p className="text-xs text-orange-600 mt-0.5">Due {cr.deadline}</p>}
                            {cr.aiComment && <p className="text-xs text-slate-500 mt-1">AI: {cr.aiComment}</p>}
                          </div>
                          {cr.status === 'open' ? (
                            <Button size="sm" variant="ghost" onClick={() => updateChangeRequest(app.id, cr.id, { status: 'resolved', resolvedAt: new Date().toISOString() })}>
                              <Check className="w-4 h-4" />
                            </Button>
                          ) : (
                            <Badge className="bg-green-100 text-green-700 shrink-0">Resolved</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => void runAgent('Draft and send a reply to the validation team addressing the open change requests')}>
                    <Mail className="w-4 h-4 mr-1" /> AI: reply to council
                  </Button>
                </CardContent>
              </Card>

              {/* Decision */}
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Decision</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {app.decision ? (
                    <Badge className={app.decision === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                      {app.decision === 'approved' ? 'Approved' : 'Refused'}{app.decidedAt ? ` · ${new Date(app.decidedAt).toLocaleDateString('en-GB')}` : ''}
                    </Badge>
                  ) : <Badge variant="outline">Pending decision</Badge>}
                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" variant="outline" onClick={() => void runAgent('Send a courtesy email to the customer before approval')}>
                      <Mail className="w-4 h-4 mr-1" /> AI: courtesy email
                    </Button>
                    <Button size="sm" variant="ghost" className="text-green-700" onClick={() => patch({ decision: 'approved', decidedAt: new Date().toISOString(), stage: 'approved' })}>
                      <CheckCircle2 className="w-4 h-4 mr-1" /> Mark approved
                    </Button>
                    <Button size="sm" variant="ghost" className="text-red-700" onClick={() => patch({ decision: 'refused', decidedAt: new Date().toISOString(), stage: 'refused' })}>
                      <XCircle className="w-4 h-4 mr-1" /> Mark refused
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* POST-APPROVAL */}
            <TabsContent value="post" className="space-y-4">
              {POST_APPROVAL_WORKSTREAMS.map((ws) => {
                const stream = app.postApproval[ws.id];
                return (
                  <Card key={ws.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{ws.label}</CardTitle>
                        <Select value={stream.status} onValueChange={(v) => updateWorkstream(ws.id, { status: v as typeof stream.status })}>
                          <SelectTrigger className="w-36 h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="not_started">Not started</SelectItem>
                            <SelectItem value="in_progress">In progress</SelectItem>
                            <SelectItem value="done">Done</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <p className="text-xs text-slate-500">{ws.hint}</p>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {stream.tasks.length === 0 && <p className="text-xs text-slate-500">No tasks yet.</p>}
                      {stream.tasks.map((t) => (
                        <label key={t.id} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="checkbox"
                            checked={t.done}
                            onChange={(e) => updateWorkstream(ws.id, {
                              tasks: stream.tasks.map((x) => (x.id === t.id ? { ...x, done: e.target.checked } : x)),
                            })}
                          />
                          <span className={t.done ? 'line-through text-slate-400' : ''}>{t.title}</span>
                        </label>
                      ))}
                      <Button size="sm" variant="outline" onClick={() => void runAgent(`Generate the ${ws.label.toLowerCase()} checklist for this approved application`)}>
                        <Sparkles className="w-4 h-4 mr-1" /> AI: generate tasks
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
              {!app.projectId ? (
                <Button variant="outline" onClick={() => void runAgent('Convert this approved application into a delivery project')}>
                  Convert to delivery project
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  onClick={() => navigate('/projects', { state: { projectId: app.projectId } })}
                >
                  Open delivery project →
                </Button>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* AI + Activity column */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600" /> Planning agent
              </CardTitle>
              <p className="text-xs text-slate-500">Fully autonomous — it acts straight away. Every action is in the log below and can be undone.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {chat.length === 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {quickActions.map((q) => (
                      <button
                        key={q}
                        type="button"
                        className="text-xs text-left px-2 py-1 rounded border hover:bg-slate-50"
                        onClick={() => void runAgent(q)}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}
                {chat.map((t, i) => (
                  <div key={i} className={`text-sm rounded-lg p-2 ${t.role === 'user' ? 'bg-indigo-50 text-indigo-900' : 'bg-slate-50 text-slate-800'}`}>
                    <p className="whitespace-pre-wrap">{t.content}</p>
                    {t.applied && t.applied.length > 0 && (
                      <ul className="mt-1.5 space-y-0.5">
                        {t.applied.map((a, j) => (
                          <li key={j} className="text-xs text-green-700 flex items-center gap-1">
                            <Check className="w-3 h-3" />{a}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
                {aiBusy && <p className="text-xs text-slate-400 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Working…</p>}
              </div>
              <div className="flex gap-2">
                <Textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  rows={2}
                  placeholder="Tell the agent what to do…"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (chatInput.trim()) void runAgent(chatInput.trim());
                    }
                  }}
                />
                <Button size="icon" disabled={!chatInput.trim() || aiBusy} onClick={() => void runAgent(chatInput.trim())}>
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Activity &amp; audit</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {app.aiActions.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-slate-500">AI actions</p>
                  {app.aiActions.slice(0, 12).map((a) => (
                    <div key={a.id} className="flex items-center justify-between gap-2 text-xs border rounded p-1.5">
                      <span className={a.status === 'undone' ? 'line-through text-slate-400' : 'text-slate-700'}>{a.summary}</span>
                      {a.status === 'applied' && a.previous ? (
                        <Button size="sm" variant="ghost" className="h-6 px-1.5" onClick={() => { undoPlanningAiAction(app.id, a.id); toast.success('Action undone'); }}>
                          <Undo2 className="w-3 h-3 mr-1" /> Undo
                        </Button>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">{a.status}</Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-slate-500">Notes</p>
                {app.comments.length === 0 && <p className="text-xs text-slate-400">No notes yet.</p>}
                {app.comments.slice().reverse().slice(0, 15).map((c) => (
                  <div key={c.id} className="text-xs border-l-2 border-slate-200 pl-2">
                    <p className="text-slate-700 whitespace-pre-wrap">{c.body}</p>
                    <p className="text-slate-400">{c.source === 'ai' ? 'AI' : c.author} · {new Date(c.createdAt).toLocaleString('en-GB')}</p>
                  </div>
                ))}
              </div>
              <CommentBox onAdd={(body) => addPlanningComment(app.id, body, 'staff', userName)} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Field({
  label, value, onSave, type = 'text',
}: { label: string; value?: string; onSave: (v: string) => void; type?: string }) {
  return (
    <div>
      <Label className="text-xs text-slate-500">{label}</Label>
      <Input
        type={type}
        defaultValue={value ?? ''}
        onBlur={(e) => { if (e.target.value !== (value ?? '')) onSave(e.target.value); }}
        className="mt-1"
      />
    </div>
  );
}

function CommentBox({ onAdd }: { onAdd: (body: string) => void }) {
  const [value, setValue] = useState('');
  return (
    <div className="flex gap-2 pt-1">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Add a note…"
        onKeyDown={(e) => { if (e.key === 'Enter' && value.trim()) { onAdd(value.trim()); setValue(''); } }}
      />
      <Button size="icon" variant="outline" onClick={() => { if (value.trim()) { onAdd(value.trim()); setValue(''); } }}>
        <Plus className="w-4 h-4" />
      </Button>
    </div>
  );
}
