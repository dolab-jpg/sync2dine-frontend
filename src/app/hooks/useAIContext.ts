import { useEffect } from 'react';
import { useLocation, useParams, useSearchParams } from 'react-router';
import { useContext } from 'react';
import { AppContext } from '../App';
import { useAIAssistant } from '../context/AIAssistantContext';
import { getActiveBCSession } from '../engine/buildingControl/bcStore';
import { getProject } from '../engine/project/projectStore';
import { isValidTradeId } from '../config/trades';
import type { TradeId } from '../config/types';

const EMPTY_INTERESTED_TRADES: TradeId[] = [];

function inferRouteEntityId(pathname: string, entity: string): string | null {
  const segments = pathname.split('/').filter(Boolean);
  const entityIndex = segments.findIndex((segment) => segment === entity);
  if (entityIndex < 0) return null;
  const value = segments[entityIndex + 1];
  return value ?? null;
}

export function useAIContextSync() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { tradeId, customerId, projectId: routeProjectId, quoteId: routeQuoteId, builderId: routeBuilderId } = useParams();
  const app = useContext(AppContext);
  const {
    setPageContext,
    setActiveTradeId,
    tradeOverride,
    aiDetectedTrade,
  } = useAIAssistant();
  const userRole = app?.user.role;
  const projectId = routeProjectId
    ?? searchParams.get('projectId')
    ?? inferRouteEntityId(location.pathname, 'projects');
  const quoteId = routeQuoteId
    ?? searchParams.get('quoteId')
    ?? inferRouteEntityId(location.pathname, 'quotes');
  const builderId = routeBuilderId
    ?? searchParams.get('builderId')
    ?? inferRouteEntityId(location.pathname, 'builder');

  const bcSessionFromUrl = searchParams.get('bcSession');
  const activeBcSession = bcSessionFromUrl ?? getActiveBCSession() ?? null;
  const bcInquiryId = searchParams.get('inquiryId');

  const planningApplicationId = inferRouteEntityId(location.pathname, 'planning');

  const project = projectId ? getProject(projectId) : undefined;
  const quote = quoteId ? app?.quotes.find(q => q.id === quoteId) : undefined;
  const customer = customerId ? app?.customers.find(c => c.id === customerId) : undefined;
  const customerInterestedTrades = customer?.interestedTrades ?? EMPTY_INTERESTED_TRADES;

  const routeTrade = tradeId && isValidTradeId(tradeId) ? tradeId : searchParams.get('tradeId');
  const contextTradeId =
    (routeTrade && isValidTradeId(routeTrade) ? routeTrade : null)
    ?? (project?.tradeId && isValidTradeId(project.tradeId) ? project.tradeId : null)
    ?? (quote?.tradeId && isValidTradeId(quote.tradeId) ? quote.tradeId : null)
    ?? null;

  useEffect(() => {
    setPageContext({
      route: location.pathname,
      tradeId: routeTrade && isValidTradeId(routeTrade) ? routeTrade : searchParams.get('tradeId') ?? null,
      customerId: customerId ?? null,
      projectId: projectId ?? null,
      quoteId: quoteId ?? null,
      builderId: builderId ?? null,
      userRole,
      userId: app?.user.id ?? null,
      userName: app?.user.name ?? null,
      bcSessionId: activeBcSession,
      bcInquiryId,
      planningApplicationId,
      projectTradeId: project?.tradeId ?? null,
      quoteTradeId: quote?.tradeId ?? null,
      customerInterestedTrades,
    });
    // #region agent log
    fetch('http://127.0.0.1:7261/ingest/6cf14313-b666-4982-884a-814f1f19f4c6',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'a8afb5'},body:JSON.stringify({sessionId:'a8afb5',location:'useAIContext.ts:sync',message:'AI page context synced',data:{pathname:location.pathname,userRole},timestamp:Date.now(),hypothesisId:'F'})}).catch(()=>{});
    // #endregion
  }, [
    location.pathname,
    location.search,
    tradeId,
    customerId,
    projectId,
    quoteId,
    builderId,
    userRole,
    activeBcSession,
    bcInquiryId,
    planningApplicationId,
    app?.user.id,
    app?.user.name,
    project?.tradeId,
    quote?.tradeId,
    customerInterestedTrades,
    routeTrade,
    setPageContext,
  ]);

  useEffect(() => {
    if (tradeOverride || aiDetectedTrade) return;
    if (contextTradeId) {
      setActiveTradeId(contextTradeId as TradeId);
    }
  }, [contextTradeId, tradeOverride, aiDetectedTrade, setActiveTradeId]);
}
