import { useContext, useEffect, useMemo, useState } from 'react';
import { AppContext, canAccessAccounts } from '../../App';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  Landmark,
  TrendingUp,
  TrendingDown,
  Wallet,
  Sparkles,
  Receipt,
  Shield,
  RefreshCw,
  Link2,
} from 'lucide-react';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '../ui/chart';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Pie, PieChart, Cell } from 'recharts';
import { loadProjects, loadProjectsAsync, subscribeProjectsCache } from '../../engine/project/projectStore';
import { getPortfolioProfit } from '../../engine/costing/profitCalculator';
import type { UnifiedProject } from '../../engine/project/types';
import {
  loadBankAccounts,
  loadBankTransactions,
  loadClientReceipts,
  categorizeTransaction,
  getTotalCashBalance,
  getIncomingTotal,
  getOutgoingTotal,
  initBankingStore,
} from '../../engine/banking/bankingStore';
import type { BankAccount, BankTransaction, TransactionCategory } from '../../engine/banking/types';
import { CATEGORY_LABELS, EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../../engine/banking/types';
import {
  fetchBankAccounts,
  fetchBankTransactions,
  initiateBankConnect,
  aiCategorizeTransaction,
} from '../../engine/banking/bankingService';
import { issueClientReceipt, suggestPaymentMatches } from '../../engine/banking/clientReceiptService';
import { toast } from 'sonner';
import { getIntegrationValues } from '../../engine/integrations/integrationsStore';
import { integrationService } from '../../engine/integrations/integrationService';

type TabId = 'overview' | 'bank' | 'income' | 'outgoings' | 'job-costing' | 'receipts';

function formatGBP(value: number): string {
  return `£${value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const CHART_COLORS = ['#059669', '#dc2626', '#2563eb', '#d97706', '#7c3aed', '#0891b2'];

export default function AccountsHub() {
  const context = useContext(AppContext);
  const [tab, setTab] = useState<TabId>('overview');
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [projects, setProjects] = useState<UnifiedProject[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [syncing, setSyncing] = useState(false);
  const [categorizingId, setCategorizingId] = useState<string | null>(null);

  if (!context) return null;
  const { user, customers, accountsAccess } = context;

  if (!canAccessAccounts(user.role, accountsAccess)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="pt-6 text-center">
            <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
            <p className="text-gray-600">Accounts access must be granted by a super administrator.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const refreshLocal = () => {
    setAccounts(loadBankAccounts());
    setTransactions(loadBankTransactions());
    setProjects(loadProjects());
  };

  useEffect(() => {
    void initBankingStore().finally(refreshLocal);
    void loadProjectsAsync().then(refreshLocal);
    return subscribeProjectsCache(() => refreshLocal());
  }, []);

  const portfolio = useMemo(() => getPortfolioProfit(projects), [projects]);
  const receipts = useMemo(() => loadClientReceipts(), [transactions]);

  const filteredTx = useMemo(() => {
    if (selectedAccount === 'all') return transactions;
    return transactions.filter((t) => t.accountId === selectedAccount);
  }, [transactions, selectedAccount]);

  const incoming = useMemo(() => getIncomingTotal(filteredTx), [filteredTx]);
  const outgoing = useMemo(() => getOutgoingTotal(filteredTx), [filteredTx]);
  const cashBalance = getTotalCashBalance();

  const plChartData = useMemo(
    () => [
      { name: 'Revenue', value: portfolio.totalRevenue, fill: CHART_COLORS[0] },
      { name: 'Job costs', value: portfolio.totalCosts, fill: CHART_COLORS[1] },
      { name: 'Bank in', value: incoming, fill: CHART_COLORS[2] },
      { name: 'Bank out', value: outgoing, fill: CHART_COLORS[3] },
    ],
    [portfolio, incoming, outgoing]
  );

  const expenseBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of filteredTx.filter((x) => x.direction === 'out')) {
      const cat = t.category === 'uncategorised' ? 'other' : t.category;
      map[cat] = (map[cat] ?? 0) + t.amount;
    }
    return Object.entries(map).map(([key, value]) => ({
      category: CATEGORY_LABELS[key as TransactionCategory] ?? key,
      value,
    }));
  }, [filteredTx]);

  const jobCostRows = useMemo(() => portfolio.projects, [portfolio]);

  const bankingProvider = getIntegrationValues('open_banking').provider || 'mock';
  const bankingIsMock =
    bankingProvider === 'mock'
    || integrationService.isMockMode('open_banking')
    || integrationService.getStatus('open_banking') !== 'connected';

  const handleSync = async () => {
    setSyncing(true);
    try {
      const acc = await fetchBankAccounts();
      const tx = await fetchBankTransactions();
      setAccounts(acc);
      setTransactions(tx);
      toast.success('Bank feed synced');
    } catch {
      refreshLocal();
      toast.info('Using local bank data (server offline)');
    } finally {
      setSyncing(false);
    }
  };

  const handleConnect = async () => {
    const result = await initiateBankConnect();
    if (result.authUrl) {
      toast.message(result.message, { description: result.authUrl });
    } else {
      toast.success(result.message);
    }
    await handleSync();
  };

  const handleAiCategorize = async (tx: BankTransaction) => {
    setCategorizingId(tx.id);
    try {
      const result = await aiCategorizeTransaction(tx, {
        projects: projects.map((p) => ({
          id: p.id,
          projectName: p.projectName,
          customerName: p.customerName,
          customerId: p.customerId,
        })),
        customers: customers.map((c) => ({ id: c.id, name: c.name })),
      });
      categorizeTransaction(tx.id, result.category, result.reason, {
        matchedProjectId: result.suggestedMatch?.projectId,
        matchedCustomerId: result.suggestedMatch?.customerId,
        matchedInvoiceId: result.suggestedMatch?.invoiceId,
        matchedStageId: result.suggestedMatch?.stageId,
      });
      refreshLocal();
      toast.success(`Categorised as ${CATEGORY_LABELS[result.category]}`, { description: result.reason });
    } finally {
      setCategorizingId(null);
    }
  };

  const handleIssueReceipt = async (tx: BankTransaction, projectId: string) => {
    const project = projects.find((p) => p.id === projectId);
    const customer = customers.find((c) => c.id === project?.customerId);
    if (!project || !customer) {
      toast.error('Project or customer not found');
      return;
    }
    const match = suggestPaymentMatches(tx, projects)[0];
    const result = await issueClientReceipt({
      transactionId: tx.id,
      projectId,
      customer,
      stageId: match?.stage?.id,
    });
    if (result.success) toast.success(result.message);
    else toast.error(result.message);
    refreshLocal();
  };

  const tabs: { id: TabId; label: string }[] = [
    { id: 'overview', label: 'Overview / P&L' },
    { id: 'bank', label: 'Bank Feed' },
    { id: 'income', label: 'Income & Payments' },
    { id: 'outgoings', label: 'Outgoings' },
    { id: 'job-costing', label: 'Job Costing' },
    { id: 'receipts', label: 'Receipts' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-3 sm:p-6 overflow-x-hidden">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6 min-w-0">
        <div className="bg-gradient-to-r from-indigo-900 to-slate-800 p-4 sm:p-8 rounded-2xl sm:rounded-3xl shadow-2xl flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl sm:text-4xl font-bold bg-gradient-to-r from-indigo-200 to-violet-200 bg-clip-text text-transparent flex items-center gap-2 sm:gap-3">
              <Landmark className="w-8 h-8 sm:w-10 sm:h-10 text-indigo-300 shrink-0" />
              <span className="break-words">Accounts & Banking</span>
            </h1>
            <p className="text-indigo-100 mt-2">
              CRM-connected financials — income, outgoings, job costing, and client receipts
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <Badge className={bankingIsMock ? 'bg-amber-500/90 text-white' : 'bg-emerald-500/90 text-white'}>
                {bankingIsMock ? 'Demo bank feed' : `Connected · ${bankingProvider}`}
              </Badge>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={handleConnect} className="gap-2">
              <Link2 className="w-4 h-4" />
              Connect bank
            </Button>
            <Button onClick={handleSync} disabled={syncing} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              Sync feed
            </Button>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin">
          {tabs.map((t) => (
            <Button
              key={t.id}
              variant={tab === t.id ? 'default' : 'outline'}
              size="sm"
              className="shrink-0 min-h-11 touch-manipulation"
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </Button>
          ))}
        </div>

        {tab === 'overview' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
                <CardContent className="pt-6">
                  <TrendingUp className="w-8 h-8 mb-2 opacity-90" />
                  <p className="text-sm opacity-90">CRM revenue (jobs)</p>
                  <p className="text-3xl font-bold">{formatGBP(portfolio.totalRevenue)}</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white">
                <CardContent className="pt-6">
                  <TrendingDown className="w-8 h-8 mb-2 opacity-90" />
                  <p className="text-sm opacity-90">Job costs</p>
                  <p className="text-3xl font-bold">{formatGBP(portfolio.totalCosts)}</p>
                </CardContent>
              </Card>
              <Card className={`bg-gradient-to-br ${portfolio.grossProfit >= 0 ? 'from-green-500 to-green-600' : 'from-red-500 to-red-600'} text-white`}>
                <CardContent className="pt-6">
                  <Wallet className="w-8 h-8 mb-2 opacity-90" />
                  <p className="text-sm opacity-90">Gross profit</p>
                  <p className="text-3xl font-bold">{formatGBP(portfolio.grossProfit)}</p>
                  <p className="text-xs opacity-80 mt-1">{portfolio.marginPct.toFixed(1)}% margin</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white">
                <CardContent className="pt-6">
                  <Landmark className="w-8 h-8 mb-2 opacity-90" />
                  <p className="text-sm opacity-90">Cash position</p>
                  <p className="text-3xl font-bold">{formatGBP(cashBalance)}</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Making vs costing</CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer
                    config={{
                      revenue: { label: 'Revenue', color: CHART_COLORS[0] },
                      costs: { label: 'Costs', color: CHART_COLORS[1] },
                    }}
                    className="h-[280px] w-full"
                  >
                    <BarChart data={plChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis tickFormatter={(v) => `£${v}`} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="value" radius={4} />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Connected accounts</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {accounts.map((a) => (
                    <div key={a.id} className="flex justify-between items-center p-3 rounded-xl bg-slate-50 border">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">{a.name}</p>
                          <Badge variant="outline" className="text-xs capitalize">
                            {a.provider === 'mock' || bankingIsMock ? 'Mock' : 'Live'}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {a.sortCode} · {a.accountNumberMasked} · {a.provider}
                        </p>
                      </div>
                      <p className="font-bold text-emerald-700">{formatGBP(a.balance)}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {(tab === 'bank' || tab === 'income' || tab === 'outgoings') && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
              <CardTitle>
                {tab === 'bank' && 'Bank transactions'}
                {tab === 'income' && 'Incoming payments'}
                {tab === 'outgoings' && 'Outgoings & expenses'}
              </CardTitle>
              <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Account" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All accounts</SelectItem>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[520px] overflow-y-auto">
                {filteredTx
                  .filter((t) => {
                    if (tab === 'income') return t.direction === 'in';
                    if (tab === 'outgoings') return t.direction === 'out';
                    return true;
                  })
                  .map((tx) => (
                    <div
                      key={tx.id}
                      className="flex flex-wrap items-center justify-between gap-2 p-4 rounded-xl border bg-white"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{tx.description}</p>
                        <p className="text-xs text-muted-foreground">{tx.date}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          <Badge variant="outline">{CATEGORY_LABELS[tx.category]}</Badge>
                          {tx.reconciled && <Badge className="bg-emerald-100 text-emerald-800">Reconciled</Badge>}
                          {tx.aiCategoryReason && (
                            <span className="text-xs text-muted-foreground">{tx.aiCategoryReason}</span>
                          )}
                        </div>
                      </div>
                      <p className={`font-bold ${tx.direction === 'in' ? 'text-emerald-600' : 'text-red-600'}`}>
                        {tx.direction === 'in' ? '+' : '-'}{formatGBP(tx.amount)}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={categorizingId === tx.id}
                          onClick={() => handleAiCategorize(tx)}
                          className="gap-1"
                        >
                          <Sparkles className="w-3 h-3" />
                          What is this?
                        </Button>
                        {tab === 'income' && tx.direction === 'in' && !tx.reconciled && (
                          <Button
                            size="sm"
                            onClick={() => {
                              const match = suggestPaymentMatches(tx, projects)[0];
                              if (match) handleIssueReceipt(tx, match.project.id);
                              else toast.error('No project match — categorise first');
                            }}
                          >
                            Issue receipt
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}

        {tab === 'outgoings' && expenseBreakdown.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Spend by category</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={{ value: { label: 'Amount', color: CHART_COLORS[4] } }} className="h-[260px]">
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Pie data={expenseBreakdown} dataKey="value" nameKey="category" cx="50%" cy="50%" outerRadius={90}>
                    {expenseBreakdown.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
            </CardContent>
          </Card>
        )}

        {tab === 'job-costing' && (
          <Card>
            <CardHeader>
              <CardTitle>Per-project P&amp;L</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-4">Project</th>
                    <th className="py-2 pr-4">Customer</th>
                    <th className="py-2 pr-4">Revenue</th>
                    <th className="py-2 pr-4">Materials</th>
                    <th className="py-2 pr-4">Labour</th>
                    <th className="py-2 pr-4">Other</th>
                    <th className="py-2 pr-4">Profit</th>
                    <th className="py-2">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {jobCostRows.map((row) => (
                    <tr key={row.projectId} className="border-b">
                      <td className="py-3 pr-4 font-medium">{row.projectName}</td>
                      <td className="py-3 pr-4">{row.customerName}</td>
                      <td className="py-3 pr-4">{formatGBP(row.revenue)}</td>
                      <td className="py-3 pr-4">{formatGBP(row.materialCosts)}</td>
                      <td className="py-3 pr-4">{formatGBP(row.labourCosts)}</td>
                      <td className="py-3 pr-4">{formatGBP(row.otherCosts)}</td>
                      <td className={`py-3 pr-4 font-semibold ${row.grossProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {formatGBP(row.grossProfit)}
                      </td>
                      <td className="py-3">{row.marginPct.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {tab === 'receipts' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="w-5 h-5" />
                Client payment receipts
              </CardTitle>
            </CardHeader>
            <CardContent>
              {receipts.length === 0 ? (
                <p className="text-muted-foreground">No receipts issued yet. Match incoming payments and click Issue receipt.</p>
              ) : (
                <div className="space-y-2">
                  {receipts.map((r) => (
                    <div key={r.id} className="flex justify-between items-center p-4 rounded-xl border bg-white">
                      <div>
                        <p className="font-medium">{r.customerName} — {r.projectName}</p>
                        <p className="text-xs text-muted-foreground">{r.date} · sent via {r.sentVia ?? 'pending'}</p>
                      </div>
                      <p className="font-bold text-emerald-600">{formatGBP(r.amount)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <p className="text-xs text-muted-foreground text-center">
          Internal only — customers and builders cannot see bank data, job margins, or this section.
          Categories: {INCOME_CATEGORIES.length} income · {EXPENSE_CATEGORIES.length} expense types.
        </p>
      </div>
    </div>
  );
}
