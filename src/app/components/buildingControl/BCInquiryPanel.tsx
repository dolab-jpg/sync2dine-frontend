import { useState } from 'react';
import { Loader2, Copy, CheckSquare } from 'lucide-react';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { ChatComposer } from '../AI/ChatComposer';
import { PhotoCapture } from '../AI/PhotoCapture';
import { sendBuildingControlMessage } from '../../engine/buildingControl/buildingControlService';
import type { BCInquiry, BCCitation } from '../../engine/buildingControl/bcStore';
import { updateBCInquiry } from '../../engine/buildingControl/bcStore';
import { toast } from 'sonner';
import { Badge } from '../ui/badge';
import { logConversationMessage } from '../../engine/ai/conversationLogService';
import type { AgentRole } from '../../engine/ai/agentContext';

interface Props {
  inquiry: BCInquiry;
  userRole: string;
  userId?: string;
  userName?: string;
  onUpdate: (inquiry: BCInquiry) => void;
}

const BC_PHOTO_GUIDANCE = [
  'Show the area building control asked about',
  'Include labels or context if helpful',
  'Capture before covering up (e.g. waterproofing, wiring)',
];

export function BCInquiryPanel({ inquiry, userRole, userId, userName, onUpdate }: Props) {
  const [question, setQuestion] = useState(inquiry.question ?? '');
  const [sourceEmail, setSourceEmail] = useState(inquiry.sourceEmail ?? '');
  const [photos, setPhotos] = useState<string[]>(inquiry.photos);
  const [loading, setLoading] = useState(false);
  const [lastReply, setLastReply] = useState(inquiry.messages.filter((m) => m.role === 'assistant').at(-1)?.content ?? '');
  const [citations, setCitations] = useState<BCCitation[]>(inquiry.citations);
  const [actions, setActions] = useState<string[]>(inquiry.complianceActions);
  const [draftReply, setDraftReply] = useState(inquiry.draftEmailReply ?? '');

  const logMessage = (role: 'user' | 'assistant', content: string) => {
    if (!userId) return;
    void logConversationMessage({
      userId,
      userName: userName ?? 'Staff',
      role: userRole as AgentRole,
      scope: `bc:${inquiry.id}`,
      route: '/building-control',
      role_message: role,
      content,
    });
  };

  const handleAsk = async () => {
    if (!question.trim() && !sourceEmail.trim() && photos.length === 0) {
      toast.error('Enter a question, paste an email, or add a photo');
      return;
    }

    setLoading(true);
    const userContent = [
      question.trim(),
      sourceEmail.trim() ? `[Pasted BC email]\n${sourceEmail.trim()}` : '',
    ].filter(Boolean).join('\n\n');

    const messages = [
      ...inquiry.messages.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: userContent || 'Please review the attached site photo(s) for building control compliance.' },
    ];

    logMessage('user', userContent || 'Please review the attached site photo(s) for building control compliance.');

    try {
      const result = await sendBuildingControlMessage(messages, {
        tradeId: inquiry.tradeId,
        projectId: inquiry.projectId,
        projectName: inquiry.projectName,
        sourceEmail: sourceEmail.trim() || undefined,
        images: photos.length > 0 ? photos : undefined,
        userRole,
      });

      setLastReply(result.content);
      setCitations(result.citations);
      setActions(result.complianceActions);
      if (result.draftEmailReply) setDraftReply(result.draftEmailReply);
      logMessage('assistant', result.content);

      const updatedMessages = [
        ...inquiry.messages,
        { id: `u-${Date.now()}`, role: 'user' as const, content: userContent, timestamp: new Date().toISOString() },
        { id: `a-${Date.now()}`, role: 'assistant' as const, content: result.content, timestamp: new Date().toISOString() },
      ];

      const updated = updateBCInquiry(inquiry.id, {
        question,
        sourceEmail: sourceEmail.trim() || undefined,
        photos,
        messages: updatedMessages,
        citations: result.citations,
        complianceActions: result.complianceActions,
        draftEmailReply: result.draftEmailReply,
      });

      if (updated) onUpdate(updated);
    } catch {
      toast.error('Building Control Agent unavailable');
    } finally {
      setLoading(false);
    }
  };

  const copyDraft = () => {
    if (!draftReply) return;
    navigator.clipboard.writeText(draftReply);
    toast.success('Draft copied to clipboard');
  };

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="space-y-3 shrink-0">
        <div>
          <Label htmlFor="bc-question">Your question</Label>
          <div className="mt-1">
            <ChatComposer
              value={question}
              onChange={setQuestion}
              onSend={() => void handleAsk()}
              loading={loading}
              placeholder="e.g. Building control asked for ventilation evidence — what do we need?"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="bc-email">Paste building control email (optional)</Label>
          <Textarea
            id="bc-email"
            placeholder="Paste the email from your building control officer here..."
            value={sourceEmail}
            onChange={(e) => setSourceEmail(e.target.value)}
            rows={4}
            className="mt-1 font-mono text-xs"
          />
        </div>
        <div>
          <Label>Site photos (optional)</Label>
          <PhotoCapture
            photos={photos}
            onChange={setPhotos}
            maxPhotos={5}
            photoGuidance={BC_PHOTO_GUIDANCE}
          />
        </div>
        <Button onClick={() => void handleAsk()} disabled={loading} className="w-full">
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          Ask Building Control Agent
        </Button>
      </div>

      {(lastReply || citations.length > 0) && (
        <div className="flex-1 min-h-0 overflow-y-auto space-y-3 border-t pt-4">
          {lastReply && (
            <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-800 whitespace-pre-wrap">
              {lastReply}
              <p className="text-[10px] text-amber-700 mt-3 border-t pt-2">
                Guidance only — confirm with your building control officer before acting.
              </p>
            </div>
          )}

          {citations.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-600 mb-1">Citations</p>
              <div className="space-y-1">
                {citations.map((c) => (
                  <div key={c.chunkId} className="text-xs bg-blue-50 border border-blue-100 rounded p-2">
                    <span className="font-medium">{c.docTitle}</span>
                    <span className="text-slate-500"> — {c.section} (v{c.versionDate})</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {actions.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1">
                <CheckSquare className="w-3 h-3" /> Action checklist
              </p>
              <ul className="text-xs space-y-1">
                {actions.map((a, i) => (
                  <li key={i} className="flex gap-2">
                    <Badge variant="outline" className="h-4 w-4 p-0 justify-center shrink-0">{i + 1}</Badge>
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {draftReply && (
            <div className="bg-green-50 border border-green-100 rounded-lg p-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold text-green-800">Draft email reply</p>
                <Button size="sm" variant="ghost" onClick={copyDraft}>
                  <Copy className="w-3 h-3 mr-1" /> Copy
                </Button>
              </div>
              <pre className="text-xs whitespace-pre-wrap text-slate-700">{draftReply}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
