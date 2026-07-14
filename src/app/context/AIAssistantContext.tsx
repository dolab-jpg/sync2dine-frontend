import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import type { TradeId, WizardAnswers } from '../config/types';
import type { DetectedTrade } from '../engine/staffAiService';
import type { CopilotAction, PendingTaskPayload } from '../engine/ai/orchestratorService';
import { buildAgentContext, getAgentScope } from '../engine/ai/agentContext';
import {
  AI_STUDIO_PANEL_PREFS_EVENT,
  getPanelPrefs,
  hydrateAIStudioFromServer,
  patchPanelPrefs,
} from '../engine/ai/aiStudioStore';

export interface ChatFixOffer {
  jobId: string;
  errorCode: string;
  description: string;
  route: string;
  scope?: 'surgical' | 'needs_cursor_approval';
  resolved?: 'yes' | 'no';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  suggestions?: Record<string, { value: unknown; confidence: number; reason?: string }>;
  /** Self-heal Yes/No offer attached to this assistant message */
  fixOffer?: ChatFixOffer;
  /** Track an in-flight code-fix job for status updates */
  fixJobId?: string;
}

export interface AISettings {
  enabled: boolean;
  showOverlay: boolean;
  model: string;
  voiceInput: 'browser' | 'whisper' | 'auto';
  voiceOutput: 'openai' | 'browser' | 'off';
  voiceConversation: boolean;
  ttsVoice: string;
  maxPhotos: number;
  trades: Record<string, boolean>;
  defaultPanelOpen: boolean;
  panelDocked: boolean;
}

const DEFAULT_SETTINGS: AISettings = {
  enabled: true,
  showOverlay: true,
  model: 'gpt-4o',
  voiceInput: 'auto',
  voiceOutput: 'browser',
  voiceConversation: false,
  ttsVoice: 'fable',
  maxPhotos: 5,
  trades: {},
  defaultPanelOpen: true,
  panelDocked: true,
};

interface AIAssistantContextType {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  /** When true, AIChatPanel should auto-start hands-free voice once on open. */
  preferVoiceOnOpen: boolean;
  requestVoiceStart: () => void;
  clearPreferVoiceOnOpen: () => void;
  messages: ChatMessage[];
  addMessage: (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  updateMessage: (id: string, patch: Partial<ChatMessage>) => void;
  clearMessages: () => void;
  settings: AISettings;
  updateSettings: (s: Partial<AISettings>) => void;
  pendingQuoteFields: WizardAnswers | null;
  setPendingQuoteFields: (fields: WizardAnswers) => void;
  clearPendingQuoteFields: () => void;
  lastAcceptedFields: Record<string, unknown> | undefined;
  setLastAcceptedFields: (f: Record<string, unknown>) => void;
  pageContext: Record<string, unknown>;
  setPageContext: (ctx: Record<string, unknown>) => void;
  detectedTrades: DetectedTrade[];
  setDetectedTrades: (trades: DetectedTrade[]) => void;
  activeTradeId: TradeId | null;
  setActiveTradeId: (id: TradeId | null) => void;
  tradeOverride: boolean;
  setTradeOverride: (v: boolean) => void;
  clearTradeOverride: () => void;
  aiDetectedTrade: boolean;
  setAiDetectedTrade: (v: boolean) => void;
  jobGroupId: string | null;
  setJobGroupId: (id: string | null) => void;
  pendingCopilotActions: CopilotAction[];
  setPendingCopilotActions: (actions: CopilotAction[]) => void;
  pendingTask?: PendingTaskPayload;
  setPendingTask: (task: PendingTaskPayload | undefined) => void;
  clearPendingTask: () => void;
  bcSessionActive: boolean;
  setBcSessionActive: (active: boolean) => void;
}

const AIAssistantContext = createContext<AIAssistantContextType | null>(null);

function shallowRecordEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((key) => a[key] === b[key]);
}

function readAiPanelOpen(): boolean {
  try {
    const v = localStorage.getItem('aiPanelOpen');
    if (v === 'false' || v === '0') return false;
    if (v === 'true' || v === '1') return true;
  } catch {
    // ignore
  }
  return true;
}

function readStoredMessages(storageKey: string): ChatMessage[] {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is ChatMessage => (
        item &&
        typeof item === 'object' &&
        typeof item.id === 'string' &&
        (item.role === 'user' || item.role === 'assistant' || item.role === 'system') &&
        typeof item.content === 'string' &&
        typeof item.timestamp === 'string'
      ))
      .slice(-200);
  } catch {
    return [];
  }
}

export function AIAssistantProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpenState] = useState(readAiPanelOpen);
  const [preferVoiceOnOpen, setPreferVoiceOnOpen] = useState(false);

  const setIsOpen = useCallback((open: boolean) => {
    setIsOpenState(open);
    try {
      localStorage.setItem('aiPanelOpen', String(open));
    } catch {
      // ignore
    }
  }, []);

  const requestVoiceStart = useCallback(() => {
    setPreferVoiceOnOpen(true);
  }, []);

  const clearPreferVoiceOnOpen = useCallback(() => {
    setPreferVoiceOnOpen(false);
  }, []);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [settings, setSettings] = useState<AISettings>(() => {
    try {
      const saved = localStorage.getItem('aiSettings');
      const panelPrefs = getPanelPrefs();
      const base = saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
      return { ...base, ...panelPrefs };
    } catch {
      return { ...DEFAULT_SETTINGS, ...getPanelPrefs() };
    }
  });
  const [pendingQuoteFields, setPendingQuoteFieldsState] = useState<WizardAnswers | null>(null);
  const [lastAcceptedFields, setLastAcceptedFields] = useState<Record<string, unknown>>();
  const [pageContext, setPageContextState] = useState<Record<string, unknown>>({});
  const [detectedTrades, setDetectedTrades] = useState<DetectedTrade[]>([]);
  const [activeTradeId, setActiveTradeId] = useState<TradeId | null>(null);
  const [tradeOverride, setTradeOverrideState] = useState(false);
  const [aiDetectedTrade, setAiDetectedTrade] = useState(false);
  const [jobGroupId, setJobGroupId] = useState<string | null>(null);
  const [pendingCopilotActions, setPendingCopilotActions] = useState<CopilotAction[]>([]);
  const [pendingTask, setPendingTaskState] = useState<PendingTaskPayload | undefined>();
  const [bcSessionActive, setBcSessionActive] = useState(() => {
    try {
      return Boolean(localStorage.getItem('tradepro_bc_active_session'));
    } catch {
      return false;
    }
  });
  const chatStorageKey = useMemo(() => {
    const context = buildAgentContext(pageContext);
    let key: string;
    if (context.bcSessionId) {
      key = `copilotChat:${context.role}:bc:${context.bcSessionId}`;
    } else if (context.planningApplicationId) {
      key = `copilotChat:${context.role}:planning:${context.planningApplicationId}`;
    } else {
      const userId = typeof pageContext.userId === 'string' && pageContext.userId
        ? pageContext.userId
        : context.role;
      key = `copilotChat:user:${userId}`;
    }
    // #region agent log
    fetch('http://127.0.0.1:7261/ingest/6cf14313-b666-4982-884a-814f1f19f4c6',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d5e33b'},body:JSON.stringify({sessionId:'d5e33b',location:'AIAssistantContext.tsx:chatStorageKey',message:'storage key computed',data:{key,route:context.route,userId:pageContext.userId??null,bcSessionId:context.bcSessionId,role:context.role},timestamp:Date.now(),hypothesisId:'H1-H2-H5'})}).catch(()=>{});
    // #endregion
    return key;
  }, [pageContext]);

  const loadedKeyRef = React.useRef<string | null>(null);

  useEffect(() => {
    const loaded = readStoredMessages(chatStorageKey);
    setMessages(loaded);
    loadedKeyRef.current = chatStorageKey;
    // #region agent log
    fetch('http://127.0.0.1:7261/ingest/6cf14313-b666-4982-884a-814f1f19f4c6',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d5e33b'},body:JSON.stringify({sessionId:'d5e33b',location:'AIAssistantContext.tsx:reload',message:'messages loaded from storage',data:{chatStorageKey,loadedCount:loaded.length,firstContent:loaded[0]?.content?.slice(0,40)??null},timestamp:Date.now(),hypothesisId:'H3'})}).catch(()=>{});
    // #endregion
  }, [chatStorageKey]);

  const setTradeOverride = useCallback((v: boolean) => {
    setTradeOverrideState(v);
  }, []);

  const clearTradeOverride = useCallback(() => {
    setTradeOverrideState(false);
    setActiveTradeId(null);
    setAiDetectedTrade(false);
    try {
      localStorage.removeItem('aiActiveTradeId');
    } catch {
      // ignore
    }
  }, []);

  const previousScopeRef = React.useRef<string | null>(null);
  useEffect(() => {
    const context = buildAgentContext(pageContext);
    const scope = getAgentScope(context);
    if (previousScopeRef.current !== null && previousScopeRef.current !== scope && !tradeOverride) {
      setActiveTradeId(null);
      setAiDetectedTrade(false);
      setDetectedTrades([]);
      try {
        localStorage.removeItem('aiActiveTradeId');
      } catch {
        // ignore
      }
    }
    previousScopeRef.current = scope;
  }, [pageContext, tradeOverride]);

  useEffect(() => {
    if (activeTradeId && tradeOverride) {
      try {
        localStorage.setItem('aiActiveTradeId', activeTradeId);
      } catch {
        // ignore
      }
    }
  }, [activeTradeId, tradeOverride]);

  const setPageContext = useCallback((ctx: Record<string, unknown>) => {
    setPageContextState((prev) => {
      const next = { ...prev, ...ctx };
      return shallowRecordEqual(prev, next) ? prev : next;
    });
  }, []);

  useEffect(() => {
    void hydrateAIStudioFromServer();
  }, []);

  useEffect(() => {
    const onPanelPrefs = (event: Event) => {
      const detail = (event as CustomEvent<{ defaultPanelOpen: boolean; panelDocked: boolean }>).detail;
      if (!detail) return;
      setSettings((prev) => ({
        ...prev,
        defaultPanelOpen: detail.defaultPanelOpen,
        panelDocked: detail.panelDocked,
      }));
    };
    window.addEventListener(AI_STUDIO_PANEL_PREFS_EVENT, onPanelPrefs);
    return () => window.removeEventListener(AI_STUDIO_PANEL_PREFS_EVENT, onPanelPrefs);
  }, []);

  useEffect(() => {
    localStorage.setItem('aiSettings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    const writeAllowed = loadedKeyRef.current === chatStorageKey;
    // #region agent log
    fetch('http://127.0.0.1:7261/ingest/6cf14313-b666-4982-884a-814f1f19f4c6',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d5e33b'},body:JSON.stringify({sessionId:'d5e33b',location:'AIAssistantContext.tsx:persist',message:'persist attempt',data:{chatStorageKey,loadedKey:loadedKeyRef.current,writeAllowed,messageCount:messages.length},timestamp:Date.now(),hypothesisId:'H4'})}).catch(()=>{});
    // #endregion
    if (!writeAllowed) return;
    try {
      localStorage.setItem(chatStorageKey, JSON.stringify(messages.slice(-200)));
    } catch {
      // ignore storage write issues
    }
  }, [messages, chatStorageKey]);

  const addMessage = useCallback((msg: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    setMessages(prev => {
      const next = [...prev, { ...msg, id: Date.now().toString(), timestamp: new Date().toISOString() }];
      // #region agent log
      fetch('http://127.0.0.1:7261/ingest/6cf14313-b666-4982-884a-814f1f19f4c6',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d5e33b'},body:JSON.stringify({sessionId:'d5e33b',location:'AIAssistantContext.tsx:addMessage',message:'message added',data:{role:msg.role,prevCount:prev.length,nextCount:next.length,contentPreview:msg.content.slice(0,40)},timestamp:Date.now(),hypothesisId:'H1-H3'})}).catch(()=>{});
      // #endregion
      return next;
    });
  }, []);

  const updateMessage = useCallback((id: string, patch: Partial<ChatMessage>) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    try {
      localStorage.removeItem(chatStorageKey);
    } catch {
      // ignore
    }
  }, [chatStorageKey]);

  const updateSettings = useCallback((s: Partial<AISettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...s };
      if ('defaultPanelOpen' in s || 'panelDocked' in s) {
        patchPanelPrefs({
          defaultPanelOpen: next.defaultPanelOpen,
          panelDocked: next.panelDocked,
        });
      }
      return next;
    });
  }, []);

  const setPendingQuoteFields = useCallback((fields: WizardAnswers) => {
    setPendingQuoteFieldsState(fields);
  }, []);

  const clearPendingQuoteFields = useCallback(() => setPendingQuoteFieldsState(null), []);

  const setPendingTask = useCallback((task: PendingTaskPayload | undefined) => {
    setPendingTaskState(task);
  }, []);

  const clearPendingTask = useCallback(() => setPendingTaskState(undefined), []);

  const value = useMemo<AIAssistantContextType>(() => ({
    isOpen, setIsOpen,
    preferVoiceOnOpen, requestVoiceStart, clearPreferVoiceOnOpen,
    messages, addMessage, updateMessage, clearMessages,
    settings, updateSettings,
    pendingQuoteFields, setPendingQuoteFields, clearPendingQuoteFields,
    lastAcceptedFields, setLastAcceptedFields,
    pageContext, setPageContext,
    detectedTrades, setDetectedTrades,
    activeTradeId, setActiveTradeId,
    tradeOverride, setTradeOverride, clearTradeOverride,
    aiDetectedTrade, setAiDetectedTrade,
    jobGroupId, setJobGroupId,
    pendingCopilotActions, setPendingCopilotActions,
    pendingTask, setPendingTask, clearPendingTask,
    bcSessionActive, setBcSessionActive,
  }), [
    isOpen, setIsOpen,
    preferVoiceOnOpen, requestVoiceStart, clearPreferVoiceOnOpen,
    messages, addMessage, updateMessage, clearMessages,
    settings, updateSettings,
    pendingQuoteFields, setPendingQuoteFields, clearPendingQuoteFields,
    lastAcceptedFields, pageContext, setPageContext,
    detectedTrades, activeTradeId, tradeOverride, setTradeOverride, clearTradeOverride,
    aiDetectedTrade, jobGroupId, pendingCopilotActions,
    pendingTask, setPendingTask, clearPendingTask,
    bcSessionActive,
  ]);

  return (
    <AIAssistantContext.Provider value={value}>
      {children}
    </AIAssistantContext.Provider>
  );
}

export function useAIAssistant() {
  const ctx = useContext(AIAssistantContext);
  if (!ctx) throw new Error('useAIAssistant must be used within AIAssistantProvider');
  return ctx;
}
