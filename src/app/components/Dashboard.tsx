import { useContext, useEffect, useState } from 'react';
import { AppContext } from '../App';
import { Link, useNavigate } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Users, FileText, Package, TrendingUp, Clock, CheckCircle2, XCircle, AlertCircle, Palette, UserPlus, FolderKanban, Sparkles, Mail } from 'lucide-react';
import { getDueFollowUps } from '../engine/leads/leadService';
import { fetchLeadInbox } from '../engine/leads/leadInboxService';
import { getAllTrades } from '../config/trades';

export default function Dashboard() {
  const context = useContext(AppContext);
  const navigate = useNavigate();
  if (!context) return null;

  const { customers, quotes, products, user } = context;

  useEffect(() => {
    if (user.role === 'builder') {
      navigate('/builder');
    } else if (user.role === 'recruitment') {
      navigate('/recruitment');
    } else if (user.role === 'customer') {
      navigate('/projects');
    }
  }, [user.role, navigate]);

  const stats = {
    totalCustomers: customers.length,
    leads: customers.filter(c => c.status === 'lead').length,
    quoted: customers.filter(c => c.status === 'quoted').length,
    won: customers.filter(c => c.status === 'won').length,
    lost: customers.filter(c => c.status === 'lost').length,
    totalQuotes: quotes.length,
    pendingQuotes: quotes.filter(q => q.status === 'sent' || q.status === 'draft').length,
    totalProducts: products.length,
    conversionRate: customers.length > 0
      ? ((customers.filter(c => c.status === 'won').length / customers.length) * 100).toFixed(1)
      : '0'
  };

  const followUpsDue = getDueFollowUps(customers);
  const awaitingApproval = quotes.filter(q => q.status === 'awaiting_approval').length;
  const sentQuotes = quotes.filter(q => q.status === 'sent').length;
  const [leadInboxCount, setLeadInboxCount] = useState(0);

  useEffect(() => {
    void fetchLeadInbox().then(data => setLeadInboxCount(data.actionRequired));
  }, []);

  const recentQuotes = quotes
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  return (
    <div className="bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="p-3 sm:p-6 max-w-7xl mx-auto">
        <div className="mb-6 sm:mb-8 bg-gradient-to-r from-slate-900 to-slate-800 p-5 sm:p-8 rounded-2xl sm:rounded-3xl shadow-2xl">
          <h1 className="text-2xl sm:text-4xl font-bold bg-gradient-to-r from-amber-400 to-amber-200 bg-clip-text text-transparent">
            Welcome back, {user.name}
          </h1>
          <p className="text-amber-100 mt-2 text-sm sm:text-lg">Here's what's happening across your construction trades today</p>

          <div className="mt-4 grid grid-cols-1 min-[420px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
            {getAllTrades().slice(0, 6).map(t => {
              const count = quotes.filter(q => q.tradeId === t.id).length;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => navigate(`/quote/${t.id}`)}
                  className="bg-white/10 hover:bg-white/20 rounded-xl p-3 text-left text-amber-50 border border-amber-500/30 min-h-11 min-w-0 touch-manipulation"
                >
                  <div className="text-xs text-amber-200 truncate">{t.name}</div>
                  <div className="text-sm sm:text-lg font-bold truncate">{count} quotes</div>
                </button>
              );
            })}
          </div>
        </div>

        {(followUpsDue.length > 0 || awaitingApproval > 0 || sentQuotes > 0 || leadInboxCount > 0) && (
          <Card className="mb-6 border-amber-200 bg-amber-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Jobs & follow-ups</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3 text-sm">
              {leadInboxCount > 0 && (
                <Button variant="outline" size="sm" onClick={() => navigate('/communications?tab=leads')}>
                  <Mail className="w-4 h-4 mr-1" />
                  {leadInboxCount} email lead{leadInboxCount > 1 ? 's' : ''} need action
                </Button>
              )}
              {followUpsDue.length > 0 && (
                <Button variant="outline" size="sm" onClick={() => navigate('/crm')}>
                  {followUpsDue.length} follow-up{followUpsDue.length > 1 ? 's' : ''} due
                </Button>
              )}
              {awaitingApproval > 0 && (
                <Button variant="outline" size="sm" onClick={() => navigate('/approvals')}>
                  {awaitingApproval} awaiting approval
                </Button>
              )}
              {sentQuotes > 0 && (
                <Button variant="outline" size="sm" onClick={() => navigate('/quotes')}>
                  {sentQuotes} sent quote{sentQuotes > 1 ? 's' : ''}
                </Button>
              )}
            </CardContent>
          </Card>
        )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/crm')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Customers</CardTitle>
            <Users className="w-4 h-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{stats.totalCustomers}</div>
            <p className="text-xs text-gray-500 mt-1">{stats.leads} new leads</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/quotes')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Active Quotes</CardTitle>
            <FileText className="w-4 h-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{stats.pendingQuotes}</div>
            <p className="text-xs text-gray-500 mt-1">{stats.totalQuotes} total quotes</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => user.role === 'super_admin' && navigate('/products')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Products</CardTitle>
            <Package className="w-4 h-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{stats.totalProducts}</div>
            <p className="text-xs text-gray-500 mt-1">in catalog</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/crm')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Conversion Rate</CardTitle>
            <TrendingUp className="w-4 h-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{stats.conversionRate}%</div>
            <p className="text-xs text-gray-500 mt-1">{stats.won} jobs won</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Customer Pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-yellow-600" />
                  <div>
                    <p className="font-medium text-gray-900">Leads</p>
                    <p className="text-sm text-gray-600">Awaiting contact</p>
                  </div>
                </div>
                <span className="text-2xl font-bold text-yellow-600">{stats.leads}</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="font-medium text-gray-900">Quoted</p>
                    <p className="text-sm text-gray-600">Awaiting decision</p>
                  </div>
                </div>
                <span className="text-2xl font-bold text-blue-600">{stats.quoted}</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="font-medium text-gray-900">Won</p>
                    <p className="text-sm text-gray-600">Jobs secured</p>
                  </div>
                </div>
                <span className="text-2xl font-bold text-green-600">{stats.won}</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <XCircle className="w-5 h-5 text-gray-600" />
                  <div>
                    <p className="font-medium text-gray-900">Lost</p>
                    <p className="text-sm text-gray-600">Not proceeding</p>
                  </div>
                </div>
                <span className="text-2xl font-bold text-gray-600">{stats.lost}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Quotes</CardTitle>
            <Link to="/quote">
              <Button size="sm">New Quote</Button>
            </Link>
          </CardHeader>
          <CardContent>
            {recentQuotes.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 mb-4">No quotes yet</p>
                <Link to="/quote">
                  <Button>Create First Quote</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {recentQuotes.map(quote => (
                  <button
                    key={quote.id}
                    type="button"
                    onClick={() => navigate('/quotes')}
                    className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-left min-h-11 touch-manipulation"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{quote.customerName}</p>
                      <p className="text-sm text-gray-600">
                        {new Date(quote.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right mr-4">
                      <p className="font-bold text-gray-900">£{quote.total.toLocaleString()}</p>
                      <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                        quote.status === 'sent' ? 'bg-blue-100 text-blue-700' :
                        quote.status === 'accepted' ? 'bg-green-100 text-green-700' :
                        quote.status === 'expired' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {quote.status}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <Link to="/crm">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer bg-gradient-to-br from-indigo-50 to-indigo-100">
            <CardContent className="pt-6">
              <div className="bg-indigo-600 text-white p-2 rounded-lg w-fit mb-3">
                <TrendingUp className="w-8 h-8" />
              </div>
              <h3 className="font-bold text-lg mb-1">Lead CRM</h3>
              <p className="text-sm text-gray-600">Social media leads & tracking</p>
            </CardContent>
          </Card>
        </Link>

        <Link to="/booking">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer bg-gradient-to-br from-blue-50 to-blue-100">
            <CardContent className="pt-6">
              <div className="bg-blue-600 text-white p-2 rounded-lg w-fit mb-3">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="font-bold text-lg mb-1">Book Visit</h3>
              <p className="text-sm text-gray-600">Schedule appointments</p>
            </CardContent>
          </Card>
        </Link>

        <Link to="/site-survey">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer bg-gradient-to-br from-green-50 to-green-100">
            <CardContent className="pt-6">
              <div className="bg-green-600 text-white p-2 rounded-lg w-fit mb-3">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <h3 className="font-bold text-lg mb-1">Site Survey</h3>
              <p className="text-sm text-gray-600">On-site conditions</p>
            </CardContent>
          </Card>
        </Link>

        <Link to="/ai-render">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer bg-gradient-to-br from-purple-50 to-purple-100">
            <CardContent className="pt-6">
              <div className="bg-purple-600 text-white p-2 rounded-lg w-fit mb-3">
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5zM9 17l-3-3 1.41-1.41L9 14.17l5.59-5.59L16 10l-7 7z"/>
                </svg>
              </div>
              <h3 className="font-bold text-lg mb-1">AI Design</h3>
              <p className="text-sm text-gray-600">Render visualizations</p>
            </CardContent>
          </Card>
        </Link>

        <Link to="/quote">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer bg-gradient-to-br from-amber-50 to-amber-100">
            <CardContent className="pt-6">
              <div className="bg-amber-600 text-white p-2 rounded-lg w-fit mb-3">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="font-bold text-lg mb-1">Quote</h3>
              <p className="text-sm text-gray-600">Smart pricing</p>
            </CardContent>
          </Card>
        </Link>

        <Link to="/projects">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer bg-gradient-to-br from-teal-50 to-teal-100">
            <CardContent className="pt-6">
              <div className="bg-teal-600 text-white p-2 rounded-lg w-fit mb-3">
                <FolderKanban className="w-8 h-8" />
              </div>
              <h3 className="font-bold text-lg mb-1">Projects</h3>
              <p className="text-sm text-gray-600">Track jobs & payments</p>
            </CardContent>
          </Card>
        </Link>
      </div>
      </div>
    </div>
  );
}
