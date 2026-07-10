import { useContext, useEffect, useMemo, useState, Fragment } from 'react';
import { AppContext } from '../App';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  DollarSign, TrendingUp, TrendingDown, AlertTriangle, Clock,
  Receipt, Sparkles, ChevronDown, ChevronUp, Shield,
} from 'lucide-react';
import { loadProjects } from '../engine/project/projectStore';
import { loadBuilders } from '../engine/builder/builderStore';
import {
  getPortfolioProfit,
  getFlaggedEntries,
  generateCostInsights,
  fixCostEntry,
  correctTimesheet,
} from '../engine/costing/costingService';
import type { UnifiedProject } from '../engine/project/types';

function formatGBP(value: number): string {
  return `£${value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function CostingDashboard() {
  const context = useContext(AppContext);
  const [projects, setProjects] = useState<UnifiedProject[]>([]);
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [aiInsights, setAiInsights] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiQuestion, setAiQuestion] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'flagged' | 'timesheets'>('overview');

  if (!context) return null;
  const { user } = context;

  const canView = user.role === 'super_admin' || user.role === 'manager';
  if (!canView) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="pt-6 text-center">
            <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
            <p className="text-gray-600">Only super admin and managers can view profit & costing.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const refresh = () => setProjects(loadProjects());

  useEffect(() => {
    refresh();
  }, []);

  const portfolio = useMemo(() => getPortfolioProfit(projects), [projects]);
  const flagged = useMemo(() => getFlaggedEntries(), [projects]);
  const builders = useMemo(() => loadBuilders(), []);

  const loadInsights = async (question?: string) => {
    setAiLoading(true);
    try {
      const text = await generateCostInsights(projects, question);
      setAiInsights(text);
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    void loadInsights();
  }, [projects.length]);

  const handleFixEntry = (projectId: string, entryId: string, total: number) => {
    fixCostEntry(projectId, entryId, { total });
    refresh();
  };

  const handleCorrectHours = (projectId: string, timesheetId: string, hours: number) => {
    correctTimesheet(projectId, timesheetId, { hours });
    refresh();
  };

  const allTimesheets = projects.flatMap((p) =>
    (p.timesheets ?? []).map((t) => ({
      ...t,
      projectName: p.projectName,
      customerName: p.customerName,
    }))
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-gradient-to-r from-emerald-900 to-slate-800 p-8 rounded-3xl shadow-2xl">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-300 to-teal-200 bg-clip-text text-transparent">
            Profit & Costing
          </h1>
          <p className="text-emerald-100 mt-2">AI-powered job costing — revenue minus materials and labour</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <CardContent className="pt-6">
              <DollarSign className="w-8 h-8 mb-2 opacity-90" />
              <p className="text-sm opacity-90">Total Revenue</p>
              <p className="text-3xl font-bold">{formatGBP(portfolio.totalRevenue)}</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white">
            <CardContent className="pt-6">
              <Receipt className="w-8 h-8 mb-2 opacity-90" />
              <p className="text-sm opacity-90">Total Costs</p>
              <p className="text-3xl font-bold">{formatGBP(portfolio.totalCosts)}</p>
            </CardContent>
          </Card>
          <Card className={`bg-gradient-to-br ${portfolio.grossProfit >= 0 ? 'from-green-500 to-green-600' : 'from-red-500 to-red-600'} text-white`}>
            <CardContent className="pt-6">
              {portfolio.grossProfit >= 0 ? (
                <TrendingUp className="w-8 h-8 mb-2 opacity-90" />
              ) : (
                <TrendingDown className="w-8 h-8 mb-2 opacity-90" />
              )}
              <p className="text-sm opacity-90">Gross Profit</p>
              <p className="text-3xl font-bold">{formatGBP(portfolio.grossProfit)}</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
            <CardContent className="pt-6">
              <Sparkles className="w-8 h-8 mb-2 opacity-90" />
              <p className="text-sm opacity-90">Margin</p>
              <p className="text-3xl font-bold">{portfolio.marginPct.toFixed(1)}%</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>AI Insights</CardTitle>
              <Button size="sm" variant="outline" onClick={() => void loadInsights()} disabled={aiLoading}>
                {aiLoading ? 'Analysing…' : 'Refresh'}
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-gray-800 whitespace-pre-wrap min-h-[120px]">
                {aiLoading ? 'AI is analysing your costing data…' : aiInsights || 'No insights yet.'}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Ask about profit, margins, or overspend…"
                  value={aiQuestion}
                  onChange={(e) => setAiQuestion(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void loadInsights(aiQuestion)}
                />
                <Button onClick={() => void loadInsights(aiQuestion)} disabled={aiLoading}>
                  Ask AI
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Flagged Receipts
              </CardTitle>
            </CardHeader>
            <CardContent>
              {flagged.length === 0 ? (
                <p className="text-sm text-gray-500">No flagged entries — AI recorded everything cleanly.</p>
              ) : (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {flagged.map(({ project, entry }) => (
                    <div key={entry.id} className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
                      <p className="font-bold">{project.projectName}</p>
                      <p className="text-gray-600">{entry.supplier} — {formatGBP(entry.total)}</p>
                      <p className="text-xs text-amber-700 mt-1">{entry.aiSummary}</p>
                      <Button
                        size="sm"
                        className="mt-2"
                        onClick={() => handleFixEntry(project.id, entry.id, entry.total)}
                      >
                        Mark as recorded
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex gap-2">
          {(['overview', 'flagged', 'timesheets'] as const).map((tab) => (
            <Button
              key={tab}
              variant={activeTab === tab ? 'default' : 'outline'}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'overview' ? 'Project P&L' : tab === 'flagged' ? 'Flagged' : 'Timesheets'}
            </Button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <Card>
            <CardHeader>
              <CardTitle>Per-Project Profit & Loss</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="py-2 pr-4">Project</th>
                      <th className="py-2 pr-4">Revenue</th>
                      <th className="py-2 pr-4">Materials</th>
                      <th className="py-2 pr-4">Labour</th>
                      <th className="py-2 pr-4">Hours</th>
                      <th className="py-2 pr-4">Profit</th>
                      <th className="py-2 pr-4">Margin</th>
                      <th className="py-2">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portfolio.projects.map((summary) => {
                      const project = projects.find((p) => p.id === summary.projectId);
                      const isExpanded = expandedProject === summary.projectId;
                      return (
                        <Fragment key={summary.projectId}>
                          <tr className="border-b hover:bg-gray-50">
                            <td className="py-3 pr-4">
                              <p className="font-medium">{summary.projectName}</p>
                              <p className="text-xs text-gray-500">{summary.customerName}</p>
                            </td>
                            <td className="py-3 pr-4">{formatGBP(summary.revenue)}</td>
                            <td className="py-3 pr-4">{formatGBP(summary.materialCosts)}</td>
                            <td className="py-3 pr-4">{formatGBP(summary.labourCosts)}</td>
                            <td className="py-3 pr-4">{summary.totalHours.toFixed(1)}h</td>
                            <td className={`py-3 pr-4 font-bold ${summary.grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {formatGBP(summary.grossProfit)}
                            </td>
                            <td className="py-3 pr-4">{summary.marginPct.toFixed(1)}%</td>
                            <td className="py-3">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setExpandedProject(isExpanded ? null : summary.projectId)}
                              >
                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </Button>
                            </td>
                          </tr>
                          {isExpanded && project && (
                            <tr key={`${summary.projectId}-detail`}>
                              <td colSpan={8} className="py-4 bg-gray-50 px-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <h4 className="font-bold mb-2 flex items-center gap-2">
                                      <Receipt className="w-4 h-4" /> Cost Entries ({project.costEntries?.length ?? 0})
                                    </h4>
                                    {(project.costEntries ?? []).length === 0 ? (
                                      <p className="text-xs text-gray-500">No receipts recorded yet.</p>
                                    ) : (
                                      <div className="space-y-2 max-h-48 overflow-y-auto">
                                        {(project.costEntries ?? []).map((entry) => (
                                          <div key={entry.id} className="text-xs p-2 bg-white rounded border">
                                            <p className="font-medium">{entry.supplier} — {formatGBP(entry.total)}</p>
                                            <p className="text-gray-500">{entry.aiSummary}</p>
                                            {entry.items.map((item, i) => (
                                              <p key={i} className="text-gray-600">
                                                {item.description} ({item.category}): {formatGBP(item.total)}
                                              </p>
                                            ))}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  <div>
                                    <h4 className="font-bold mb-2">Category Breakdown</h4>
                                    {Object.entries(summary.categoryBreakdown).map(([cat, amount]) => (
                                      <div key={cat} className="flex justify-between text-xs py-1">
                                        <span className="capitalize">{cat}</span>
                                        <span>{formatGBP(amount)}</span>
                                      </div>
                                    ))}
                                    {summary.status === 'completed' && (
                                      <div className="mt-4 p-3 bg-emerald-100 rounded-lg text-sm">
                                        <p className="font-bold text-emerald-900">Final Deduction</p>
                                        <p>Revenue {formatGBP(summary.revenue)} − Costs {formatGBP(summary.totalCosts)} = {formatGBP(summary.grossProfit)}</p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === 'flagged' && (
          <Card>
            <CardHeader><CardTitle>Flagged Receipt Entries</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {flagged.length === 0 ? (
                <p className="text-gray-500">All receipts recorded automatically with high confidence.</p>
              ) : flagged.map(({ project, entry }) => (
                <div key={entry.id} className="flex gap-4 p-4 bg-amber-50 rounded-xl border border-amber-200">
                  {entry.receiptPhoto && (
                    <img src={entry.receiptPhoto} alt="Receipt" className="w-24 h-24 object-cover rounded-lg" />
                  )}
                  <div className="flex-1">
                    <p className="font-bold">{project.projectName} — {entry.supplier}</p>
                    <p className="text-sm text-gray-600">{entry.aiSummary}</p>
                    <p className="text-sm">Confidence: {(entry.aiConfidence * 100).toFixed(0)}%</p>
                    <div className="flex gap-2 mt-2">
                      <Input
                        type="number"
                        defaultValue={entry.total}
                        className="w-32"
                        id={`fix-${entry.id}`}
                      />
                      <Button
                        size="sm"
                        onClick={() => {
                          const input = document.getElementById(`fix-${entry.id}`) as HTMLInputElement;
                          handleFixEntry(project.id, entry.id, Number(input.value));
                        }}
                      >
                        Fix & Record
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {activeTab === 'timesheets' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" /> Builder Timesheets
              </CardTitle>
            </CardHeader>
            <CardContent>
              {allTimesheets.length === 0 ? (
                <p className="text-gray-500">No timesheet entries yet. Builders clock in from their dashboard.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-gray-500">
                        <th className="py-2">Project</th>
                        <th className="py-2">Builder</th>
                        <th className="py-2">Clock In</th>
                        <th className="py-2">Clock Out</th>
                        <th className="py-2">Hours</th>
                        <th className="py-2">Rate</th>
                        <th className="py-2">Cost</th>
                        <th className="py-2">Edit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allTimesheets.map((t) => {
                        const builder = builders.find((b) => b.id === t.builderId);
                        return (
                          <tr key={t.id} className="border-b">
                            <td className="py-2">{t.projectName}</td>
                            <td className="py-2">{builder?.name ?? t.builderId}</td>
                            <td className="py-2">{new Date(t.clockIn).toLocaleString()}</td>
                            <td className="py-2">{t.clockOut ? new Date(t.clockOut).toLocaleString() : 'Active'}</td>
                            <td className="py-2">{t.hours?.toFixed(2) ?? '—'}</td>
                            <td className="py-2">{formatGBP(t.rate)}/hr</td>
                            <td className="py-2">{t.labourCost ? formatGBP(t.labourCost) : '—'}</td>
                            <td className="py-2">
                              <Input
                                type="number"
                                step="0.25"
                                defaultValue={t.hours ?? 0}
                                className="w-20 h-8"
                                id={`hrs-${t.id}`}
                              />
                              <Button
                                size="sm"
                                variant="ghost"
                                className="ml-1"
                                onClick={() => {
                                  const input = document.getElementById(`hrs-${t.id}`) as HTMLInputElement;
                                  handleCorrectHours(t.projectId, t.id, Number(input.value));
                                }}
                              >
                                Save
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
