import { useContext, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { ShieldCheck, Plus, History, X } from 'lucide-react';
import { AppContext } from '../../App';
import { BCDocLibrary } from './BCDocLibrary';
import { BCInquiryPanel } from './BCInquiryPanel';
import { BCUpdateReview } from './BCUpdateReview';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { TRADES } from '../../config/trades';
import type { TradeId } from '../../config/types';
import {
  createBCInquiry,
  getBCInquiry,
  getBCInquiryBySession,
  loadBCInquiries,
  resolveBCInquiry,
  setActiveBCSession,
  clearActiveBCSession,
  subscribeBCInquiries,
  type BCInquiry,
} from '../../engine/buildingControl/bcStore';
import { getProject, loadProjects } from '../../engine/project/projectStore';
import { useAIAssistant } from '../../context/AIAssistantContext';
import { uploadBase64File } from '../../engine/storage/storageService';
import { toast } from 'sonner';

export default function BuildingControlHub() {
  const context = useContext(AppContext);
  const [searchParams, setSearchParams] = useSearchParams();
  const { setPageContext, setBcSessionActive } = useAIAssistant();
  const [tradeFilter, setTradeFilter] = useState<TradeId | 'all'>('all');
  const [inquiries, setInquiries] = useState<BCInquiry[]>(loadBCInquiries);
  const [activeInquiry, setActiveInquiry] = useState<BCInquiry | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const urlInitialized = useRef(false);

  const user = context?.user;
  const canReview = user?.role === 'super_admin' || user?.role === 'manager';

  useEffect(() => {
    return subscribeBCInquiries(setInquiries);
  }, []);

  useEffect(() => {
    if (urlInitialized.current) return;

    const projectId = searchParams.get('projectId');
    const tradeId = searchParams.get('tradeId') as TradeId | null;
    const sourceEmail = searchParams.get('sourceEmail');
    const bcSession = searchParams.get('bcSession');
    const inquiryId = searchParams.get('inquiryId');

    if (inquiryId) {
      const found = getBCInquiry(inquiryId);
      if (found) {
        setActiveInquiry(found);
        setActiveBCSession(found.sessionId);
        setBcSessionActive(true);
        setPageContext({ bcSessionId: found.sessionId, bcInquiryId: found.id });
        urlInitialized.current = true;
        return;
      }
    }

    if (bcSession) {
      const found = getBCInquiryBySession(bcSession);
      if (found) {
        setActiveInquiry(found);
        setBcSessionActive(true);
        setPageContext({ bcSessionId: found.sessionId, bcInquiryId: found.id });
        urlInitialized.current = true;
        return;
      }
    }

    if (projectId && user) {
      const project = getProject(projectId);
      if (project) {
        const inquiry = createBCInquiry({
          createdBy: user.name,
          role: user.role,
          projectId: project.id,
          projectName: project.projectName,
          tradeId: tradeId ?? project.tradeId,
          sourceEmail: sourceEmail ?? undefined,
        });
        setActiveInquiry(inquiry);
        setBcSessionActive(true);
        setPageContext({ bcSessionId: inquiry.sessionId, bcInquiryId: inquiry.id, projectId: project.id });
        if (tradeId ?? project.tradeId) setTradeFilter((tradeId ?? project.tradeId) as TradeId);
        urlInitialized.current = true;
        return;
      }
    }

    if (sourceEmail && user) {
      const inquiry = createBCInquiry({
        createdBy: user.name,
        role: user.role,
        sourceEmail: decodeURIComponent(sourceEmail),
      });
      setActiveInquiry(inquiry);
      setBcSessionActive(true);
      setPageContext({ bcSessionId: inquiry.sessionId, bcInquiryId: inquiry.id });
      urlInitialized.current = true;
    }
  }, [searchParams, user, setPageContext, setBcSessionActive]);

  const startNewInquiry = () => {
    if (!user) return;
    const inquiry = createBCInquiry({
      createdBy: user.name,
      role: user.role,
      tradeId: tradeFilter !== 'all' ? tradeFilter : undefined,
    });
    setActiveInquiry(inquiry);
    setBcSessionActive(true);
    setPageContext({ bcSessionId: inquiry.sessionId, bcInquiryId: inquiry.id });
    setSearchParams({ bcSession: inquiry.sessionId });
    setShowHistory(false);
  };

  const resumeInquiry = (inquiry: BCInquiry) => {
    setActiveInquiry(inquiry);
    setActiveBCSession(inquiry.sessionId);
    setBcSessionActive(true);
    setPageContext({ bcSessionId: inquiry.sessionId, bcInquiryId: inquiry.id });
    setSearchParams({ bcSession: inquiry.sessionId });
    setShowHistory(false);
  };

  const endInquiry = () => {
    if (activeInquiry) resolveBCInquiry(activeInquiry.id);
    setActiveInquiry(null);
    clearActiveBCSession();
    setBcSessionActive(false);
    setPageContext({ bcSessionId: null, bcInquiryId: null });
    setSearchParams({});
  };

  const saveDraftToProject = async () => {
    if (!activeInquiry?.projectId || !activeInquiry.draftEmailReply) {
      toast.error('Link a project and generate a draft reply first');
      return;
    }
    const blob = new Blob([activeInquiry.draftEmailReply], { type: 'text/plain' });
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1];
      await uploadBase64File(
        activeInquiry.projectId!,
        `BC-reply-${Date.now()}.txt`,
        'text/plain',
        base64,
        'building_control',
        user?.name ?? 'Staff'
      );
      toast.success('Draft saved to project documents');
    };
    reader.readAsDataURL(blob);
  };

  const projects = loadProjects();

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-7 h-7 text-blue-600" />
            Building Control
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Ask the BC Agent — cross-references UK Approved Documents for your trade
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setShowHistory(!showHistory)}>
            <History className="w-4 h-4 mr-1" />
            {showHistory ? 'Hide' : 'History'}
          </Button>
          <Button size="sm" onClick={startNewInquiry}>
            <Plus className="w-4 h-4 mr-1" /> New inquiry
          </Button>
          {activeInquiry && (
            <Button variant="ghost" size="sm" onClick={endInquiry}>
              <X className="w-4 h-4 mr-1" /> End inquiry
            </Button>
          )}
        </div>
      </div>

      <BCUpdateReview canReview={canReview} />

      {showHistory && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Past inquiries</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-48 overflow-y-auto">
            {inquiries.length === 0 && (
              <p className="text-xs text-slate-500">No inquiries yet</p>
            )}
            {inquiries.map((inq) => (
              <button
                key={inq.id}
                type="button"
                className="w-full text-left text-sm p-2 rounded border hover:bg-slate-50"
                onClick={() => resumeInquiry(inq)}
              >
                <span className="font-medium">{inq.question?.slice(0, 60) || 'Photo/email inquiry'}</span>
                <span className="text-xs text-slate-400 block">
                  {new Date(inq.updatedAt).toLocaleString()} · {inq.status}
                </span>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2 items-center">
        <span className="text-sm text-slate-600">Filter by trade:</span>
        <Select value={tradeFilter} onValueChange={(v) => setTradeFilter(v as TradeId | 'all')}>
          <SelectTrigger className="w-40 h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All trades</SelectItem>
            {Object.entries(TRADES).map(([id, t]) => (
              <SelectItem key={id} value={id}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {activeInquiry?.projectId && (
          <span className="text-xs text-slate-500">
            Linked: {activeInquiry.projectName ?? activeInquiry.projectId}
          </span>
        )}
      </div>

      <div className="grid lg:grid-cols-12 gap-4 min-h-[520px]">
        <Card className="lg:col-span-3">
          <CardContent className="p-4">
            <BCDocLibrary
              tradeFilter={tradeFilter}
              onSelectDoc={(docId) => {
                if (!activeInquiry) startNewInquiry();
                toast.info(`Selected: ${docId} — ask the agent about this document`);
              }}
            />
          </CardContent>
        </Card>

        <Card className="lg:col-span-9">
          <CardHeader className="pb-2 border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">BC Agent</CardTitle>
              {activeInquiry?.draftEmailReply && activeInquiry.projectId && (
                <Button size="sm" variant="outline" onClick={saveDraftToProject}>
                  Save draft to project
                </Button>
              )}
            </div>
            {!activeInquiry && (
              <p className="text-xs text-slate-500">Start a new inquiry to ask questions</p>
            )}
          </CardHeader>
          <CardContent className="p-4 h-[calc(100%-4rem)]">
            {activeInquiry ? (
              <BCInquiryPanel
                inquiry={activeInquiry}
                userRole={user?.role ?? 'staff'}
                userId={user?.id}
                userName={user?.name}
                onUpdate={setActiveInquiry}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center text-slate-500 gap-3">
                <ShieldCheck className="w-12 h-12 text-slate-300" />
                <p className="text-sm">Start an inquiry to ask about UK building regulations</p>
                <Button onClick={startNewInquiry}>New inquiry</Button>
                {projects.length > 0 && (
                  <p className="text-xs">Or open from a project via &quot;Ask about compliance&quot;</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
