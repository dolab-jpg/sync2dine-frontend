import { useContext, useMemo, useState } from 'react';
import { AppContext } from '../App';
import { computeLeadAttribution } from '../engine/leads/leadService';
import { getOfficeTeamRoster } from '../engine/team/teamSnapshot';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import {
  TrendingUp, Users, DollarSign, Target, Award, Calendar,
  FileText, CheckCircle, XCircle, Clock, ArrowUp, ArrowDown,
  Shield, BarChart3, PieChart, Activity
} from 'lucide-react';

export default function SalesManagement() {
  const context = useContext(AppContext);
  if (!context) return null;

  const { user, customers, quotes } = context;
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'quarter'>('month');

  const teamMembers = useMemo(() => getOfficeTeamRoster().map((m) => ({
    id: m.id,
    name: m.name,
    role: m.role === 'manager' ? 'Manager' : 'Staff',
    ...m.performance,
  })), []);

  const leadSources = useMemo(() => computeLeadAttribution(customers, quotes).map((row) => ({
    source: row.source,
    leads: row.leads,
    won: row.won,
    spent: 0,
    revenue: row.revenue,
    roi: row.revenue > 0 ? Math.round(row.revenue / 100) : 0,
  })), [customers, quotes]);

  if (user.role !== 'super_admin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="pt-6 text-center">
            <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
            <p className="text-gray-600">Only super administrators can access sales management.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const revenueData = {
    thisMonth: teamMembers.reduce((s, m) => s + m.revenue, 0),
    lastMonth: 265000,
    thisQuarter: 845000,
    target: 900000,
    growth: 12.8
  };

  const pipelineData = {
    leads: customers.filter(c => c.status === 'lead').length,
    contacted: customers.filter(c => c.source && c.status === 'lead').length,
    quoted: customers.filter(c => c.status === 'quoted').length,
    won: customers.filter(c => c.status === 'won').length,
    lost: customers.filter(c => c.status === 'lost').length
  };

  const totalRevenue = teamMembers.reduce((sum, member) => sum + member.revenue, 0);
  const totalLeads = teamMembers.reduce((sum, member) => sum + member.leads, 0);
  const totalWon = teamMembers.reduce((sum, member) => sum + member.won, 0);
  const overallConversion = ((totalWon / totalLeads) * 100).toFixed(1);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-8 bg-gradient-to-r from-slate-900 to-slate-800 p-8 rounded-3xl shadow-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-400 to-amber-200 bg-clip-text text-transparent">
                Sales Management Dashboard
              </h1>
              <p className="text-amber-100 mt-2 text-lg">Complete overview of your business performance</p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => setSelectedPeriod('week')}
                className={`px-6 py-3 rounded-xl ${
                  selectedPeriod === 'week'
                    ? 'bg-amber-500 text-white'
                    : 'bg-white/10 text-amber-100 hover:bg-white/20'
                }`}
              >
                Week
              </Button>
              <Button
                onClick={() => setSelectedPeriod('month')}
                className={`px-6 py-3 rounded-xl ${
                  selectedPeriod === 'month'
                    ? 'bg-amber-500 text-white'
                    : 'bg-white/10 text-amber-100 hover:bg-white/20'
                }`}
              >
                Month
              </Button>
              <Button
                onClick={() => setSelectedPeriod('quarter')}
                className={`px-6 py-3 rounded-xl ${
                  selectedPeriod === 'quarter'
                    ? 'bg-amber-500 text-white'
                    : 'bg-white/10 text-amber-100 hover:bg-white/20'
                }`}
              >
                Quarter
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <DollarSign className="w-8 h-8" />
                <div className="flex items-center gap-1 bg-white/20 px-2 py-1 rounded-lg">
                  <ArrowUp className="w-4 h-4" />
                  <span className="text-sm font-bold">{revenueData.growth}%</span>
                </div>
              </div>
              <p className="text-sm opacity-90 mb-1">Total Revenue</p>
              <p className="text-3xl font-bold">£{(totalRevenue / 1000).toFixed(0)}k</p>
              <p className="text-xs opacity-75 mt-1">This {selectedPeriod}</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <Users className="w-8 h-8" />
                <Activity className="w-6 h-6 opacity-75" />
              </div>
              <p className="text-sm opacity-90 mb-1">Total Leads</p>
              <p className="text-3xl font-bold">{totalLeads}</p>
              <p className="text-xs opacity-75 mt-1">{totalWon} converted</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <Target className="w-8 h-8" />
                <BarChart3 className="w-6 h-6 opacity-75" />
              </div>
              <p className="text-sm opacity-90 mb-1">Conversion Rate</p>
              <p className="text-3xl font-bold">{overallConversion}%</p>
              <p className="text-xs opacity-75 mt-1">Overall performance</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <Award className="w-8 h-8" />
                <TrendingUp className="w-6 h-6 opacity-75" />
              </div>
              <p className="text-sm opacity-90 mb-1">Avg Deal Size</p>
              <p className="text-3xl font-bold">£{(totalRevenue / totalWon).toFixed(0)}</p>
              <p className="text-xs opacity-75 mt-1">Per won deal</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl flex items-center gap-3">
                <PieChart className="w-7 h-7" />
                Sales Pipeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-yellow-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <Clock className="w-6 h-6 text-yellow-600" />
                    <div>
                      <p className="font-bold text-gray-900">New Leads</p>
                      <p className="text-sm text-gray-600">Not yet contacted</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-yellow-600">{pipelineData.leads}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-blue-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <Activity className="w-6 h-6 text-blue-600" />
                    <div>
                      <p className="font-bold text-gray-900">In Contact</p>
                      <p className="text-sm text-gray-600">Active discussions</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-blue-600">{pipelineData.contacted}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-purple-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <FileText className="w-6 h-6 text-purple-600" />
                    <div>
                      <p className="font-bold text-gray-900">Quoted</p>
                      <p className="text-sm text-gray-600">Awaiting decision</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-purple-600">{pipelineData.quoted}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-green-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                    <div>
                      <p className="font-bold text-gray-900">Won</p>
                      <p className="text-sm text-gray-600">Jobs secured</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-green-600">{pipelineData.won}</p>
                    <p className="text-sm text-gray-600">£{(totalRevenue / 1000).toFixed(0)}k revenue</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-2xl flex items-center gap-3">
                <BarChart3 className="w-7 h-7" />
                Lead Source Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {leadSources.map((source) => (
                  <div key={source.source} className="bg-gray-50 p-4 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-bold text-gray-900">{source.source}</p>
                      <div className="text-right">
                        <p className="text-sm font-bold text-green-600">£{(source.revenue / 1000).toFixed(0)}k</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-xs">
                      <div>
                        <p className="text-gray-500">Leads</p>
                        <p className="font-bold text-blue-600">{source.leads}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Won</p>
                        <p className="font-bold text-green-600">{source.won}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Spent</p>
                        <p className="font-bold text-red-600">£{source.spent}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">ROI</p>
                        <p className="font-bold text-purple-600">{source.roi > 0 ? `${source.roi}%` : 'N/A'}</p>
                      </div>
                    </div>
                    <div className="mt-2 bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-green-500 h-full rounded-full transition-all"
                        style={{ width: `${(source.won / source.leads) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-3">
              <Users className="w-7 h-7" />
              Team Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="text-left py-4 px-4">Team Member</th>
                    <th className="text-center py-4 px-4">Leads</th>
                    <th className="text-center py-4 px-4">Quotes</th>
                    <th className="text-center py-4 px-4">Won</th>
                    <th className="text-center py-4 px-4">Lost</th>
                    <th className="text-center py-4 px-4">Pending</th>
                    <th className="text-center py-4 px-4">Revenue</th>
                    <th className="text-center py-4 px-4">Conv. Rate</th>
                    <th className="text-center py-4 px-4">Avg Deal</th>
                  </tr>
                </thead>
                <tbody>
                  {teamMembers.map((member, index) => (
                    <tr
                      key={member.id}
                      className={`border-b border-gray-100 hover:bg-gray-50 ${
                        index === 0 ? 'bg-amber-50' : ''
                      }`}
                    >
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          {index === 0 && <Award className="w-5 h-5 text-amber-500" />}
                          <div>
                            <p className="font-bold text-gray-900">{member.name}</p>
                            <p className="text-sm text-gray-600">{member.role}</p>
                          </div>
                        </div>
                      </td>
                      <td className="text-center py-4 px-4 font-bold text-blue-600">{member.leads}</td>
                      <td className="text-center py-4 px-4 font-bold text-purple-600">{member.quotes}</td>
                      <td className="text-center py-4 px-4 font-bold text-green-600">{member.won}</td>
                      <td className="text-center py-4 px-4 font-bold text-red-600">{member.lost}</td>
                      <td className="text-center py-4 px-4 font-bold text-yellow-600">{member.pending}</td>
                      <td className="text-center py-4 px-4 font-bold text-gray-900">
                        £{(member.revenue / 1000).toFixed(0)}k
                      </td>
                      <td className="text-center py-4 px-4">
                        <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                          member.conversionRate >= 55
                            ? 'bg-green-100 text-green-700'
                            : member.conversionRate >= 50
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {member.conversionRate}%
                        </span>
                      </td>
                      <td className="text-center py-4 px-4 font-bold text-gray-900">
                        £{member.avgDealSize.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-900 text-white font-bold">
                    <td className="py-4 px-4">TOTAL</td>
                    <td className="text-center py-4 px-4">{totalLeads}</td>
                    <td className="text-center py-4 px-4">{teamMembers.reduce((s, m) => s + m.quotes, 0)}</td>
                    <td className="text-center py-4 px-4">{totalWon}</td>
                    <td className="text-center py-4 px-4">{teamMembers.reduce((s, m) => s + m.lost, 0)}</td>
                    <td className="text-center py-4 px-4">{teamMembers.reduce((s, m) => s + m.pending, 0)}</td>
                    <td className="text-center py-4 px-4">£{(totalRevenue / 1000).toFixed(0)}k</td>
                    <td className="text-center py-4 px-4">{overallConversion}%</td>
                    <td className="text-center py-4 px-4">£{(totalRevenue / totalWon).toFixed(0)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
          <Card className="border-2 border-green-500">
            <CardHeader>
              <CardTitle className="text-xl text-green-700">Revenue Target</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl font-bold text-gray-900">
                    £{(revenueData.thisQuarter / 1000).toFixed(0)}k
                  </span>
                  <span className="text-sm text-gray-600">
                    / £{(revenueData.target / 1000).toFixed(0)}k
                  </span>
                </div>
                <div className="bg-gray-200 rounded-full h-4 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-green-500 to-green-600 h-full rounded-full transition-all"
                    style={{ width: `${(revenueData.thisQuarter / revenueData.target) * 100}%` }}
                  />
                </div>
              </div>
              <p className="text-sm text-gray-600">
                {((revenueData.thisQuarter / revenueData.target) * 100).toFixed(1)}% of quarterly target
              </p>
            </CardContent>
          </Card>

          <Card className="border-2 border-blue-500">
            <CardHeader>
              <CardTitle className="text-xl text-blue-700">Active Opportunities</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">In Pipeline</span>
                  <span className="font-bold text-2xl text-blue-600">
                    {pipelineData.leads + pipelineData.contacted + pipelineData.quoted}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Est. Value</span>
                  <span className="font-bold text-green-600">£{((pipelineData.quoted * 7000) / 1000).toFixed(0)}k</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-purple-500">
            <CardHeader>
              <CardTitle className="text-xl text-purple-700">This Month</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Revenue</span>
                  <span className="font-bold text-2xl text-purple-600">
                    £{(revenueData.thisMonth / 1000).toFixed(0)}k
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <ArrowUp className="w-4 h-4 text-green-600" />
                  <span className="text-green-600 font-bold">{revenueData.growth}%</span>
                  <span className="text-gray-500">vs last month</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
