import { useContext, useMemo, useCallback } from 'react';
import { AppContext } from '../App';
import { useAIAssistant } from '../context/AIAssistantContext';
import { getProject } from '../engine/project/projectStore';
import { resolveActiveTrade } from '../engine/ai/resolveTrade';
import { isValidTradeId } from '../config/trades';
import type { TradeId } from '../config/types';

export function useResolvedTrade() {
  const app = useContext(AppContext);
  const {
    pageContext,
    detectedTrades,
    aiDetectedTrade,
    activeTradeId,
    setActiveTradeId,
    setAiDetectedTrade,
    tradeOverride,
    setTradeOverride,
    clearTradeOverride,
  } = useAIAssistant();

  const routeTradeId = isValidTradeId(String(pageContext.tradeId ?? ''))
    ? (pageContext.tradeId as TradeId)
    : null;

  const projectId = typeof pageContext.projectId === 'string' ? pageContext.projectId : null;
  const quoteId = typeof pageContext.quoteId === 'string' ? pageContext.quoteId : null;
  const customerId = typeof pageContext.customerId === 'string' ? pageContext.customerId : null;

  const projectTradeId = useMemo(() => {
    if (typeof pageContext.projectTradeId === 'string') return pageContext.projectTradeId;
    if (!projectId) return null;
    return getProject(projectId)?.tradeId ?? null;
  }, [pageContext.projectTradeId, projectId]);

  const quoteTradeId = useMemo(() => {
    if (typeof pageContext.quoteTradeId === 'string') return pageContext.quoteTradeId;
    if (!quoteId || !app) return null;
    return app.quotes.find(q => q.id === quoteId)?.tradeId ?? null;
  }, [pageContext.quoteTradeId, quoteId, app]);

  const customerInterestedTrades = useMemo(() => {
    if (Array.isArray(pageContext.customerInterestedTrades)) {
      return pageContext.customerInterestedTrades as string[];
    }
    if (!customerId || !app) return [];
    return app.customers.find(c => c.id === customerId)?.interestedTrades ?? [];
  }, [pageContext.customerInterestedTrades, customerId, app]);

  const resolved = useMemo(
    () =>
      resolveActiveTrade({
        tradeOverride,
        overrideTradeId: tradeOverride ? activeTradeId : null,
        aiDetectedTrade,
        detectedTrades,
        routeTradeId,
        projectTradeId,
        quoteTradeId,
        customerInterestedTrades,
      }),
    [
      tradeOverride,
      activeTradeId,
      aiDetectedTrade,
      detectedTrades,
      routeTradeId,
      projectTradeId,
      quoteTradeId,
      customerInterestedTrades,
    ]
  );

  const setTradeOverrideId = useCallback(
    (id: TradeId | null) => {
      if (id) {
        setActiveTradeId(id);
        setTradeOverride(true);
        setAiDetectedTrade(false);
      } else {
        clearTradeOverride();
      }
    },
    [setActiveTradeId, setTradeOverride, setAiDetectedTrade, clearTradeOverride]
  );

  return {
    tradeId: resolved.tradeId,
    tradeName: resolved.tradeName,
    source: resolved.source,
    detectedTrades,
    isAiDetected: aiDetectedTrade && resolved.source === 'ai_detected',
    isGeneralMode: resolved.tradeId === null,
    setTradeOverride: setTradeOverrideId,
    clearOverride: clearTradeOverride,
  };
}
