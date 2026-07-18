import { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Building2, MessageCircle, Phone, PhoneCall, TrendingUp, Users,
} from 'lucide-react';
import { AppContext } from '../App';
import { useAIAssistant } from '../context/AIAssistantContext';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';

/**
 * Sync2Dine sales-org home (Super Master B2): CRM pipeline + phone agent
 * pulse + quick actions. Replaces the BD bathroom-trade dashboard.
 */

interface TodayStats {
  totalCalls: number;
  avgDurationSec: number;
  aiResolvedPct: number;
  callbacksBooked: number;
}

export default function SalesDashboard() {
  const context = useContext(AppContext);
  const navigate = useNavigate();
  const { setIsOpen: setAiOpen } = useAIAssistant();
  const [agentActive, setAgentActive] = useState<boolean | null>(null);
  const [today, setToday] = useState<TodayStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/agent/status');
        if (!res.ok) return;
        const data = await res.json() as { isActive?: boolean; todayStats?: TodayStats };
        if (cancelled) return;
        setAgentActive(data.isActive !== false);
        setToday(data.todayStats ?? null);
      } catch {
        if (!cancelled) setAgentActive(null);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!context) return null;
  const { customers, user } = context;

  const stats = {
    leads: customers.filter((c) => c.status === 'lead').length,
    contacted: customers.filter((c) => c.status === 'quoted').length,
    customers: customers.filter((c) => c.status === 'won').length,
    total: customers.length,
  };

  const quickActions: Array<{
    label: string;
    icon: typeof TrendingUp;
    onClick: () => void;
  }> = [
    { label: 'CRM & dial list', icon: TrendingUp, onClick: () => navigate('/crm') },
    { label: 'Call Centre', icon: Phone, onClick: () => navigate('/calls') },
    // Opens the floating Cynthia staff AI popup — not the full /cynthia page
    { label: 'Cynthia chat', icon: MessageCircle, onClick: () => setAiOpen(true) },
    ...(user.role === 'platform_owner'
      ? [
          { label: 'Platform clients', icon: Building2, onClick: () => navigate('/platform/clients') },
          { label: 'Sally offer', icon: TrendingUp, onClick: () => navigate('/platform/sally-offer') },
        ]
      : []),
  ];

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="rounded-[1.75rem] bg-s2d-teal-deep p-5 text-white shadow-xl">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-s2d-gold">Sync2Dine sales</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
          Welcome back, {user.name.split(' ')[0]}
        </h1>
        <p className="mt-1 text-s2d-cream/80">
          Phone agent {agentActive == null ? 'status unknown' : agentActive ? 'is answering' : 'is paused'}
          {today ? ` · ${today.totalCalls} calls today · ${today.callbacksBooked} callbacks booked` : ''}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {quickActions.map(({ label, icon: Icon, onClick }) => (
            <Button
              key={label}
              type="button"
              onClick={onClick}
              className="min-h-11 rounded-xl bg-s2d-gold font-bold text-s2d-teal-deep hover:bg-s2d-gold-soft"
            >
              <Icon className="mr-2 h-4 w-4" />
              {label}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="cursor-pointer transition-shadow hover:shadow-lg" onClick={() => navigate('/crm')}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">New leads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{stats.leads}</div>
            <p className="mt-1 text-xs text-gray-500">Restaurants to call</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer transition-shadow hover:shadow-lg" onClick={() => navigate('/crm')}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Contacted</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{stats.contacted}</div>
            <p className="mt-1 text-xs text-gray-500">Pitched / in conversation</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer transition-shadow hover:shadow-lg" onClick={() => navigate('/customers')}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Live customers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{stats.customers}</div>
            <p className="mt-1 text-xs text-gray-500">Restaurants on the platform</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer transition-shadow hover:shadow-lg" onClick={() => navigate('/calls')}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Calls today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{today?.totalCalls ?? '—'}</div>
            <p className="mt-1 text-xs text-gray-500">
              {today ? `${today.aiResolvedPct}% AI resolved` : 'Call Centre'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-s2d-teal" />
            Pipeline
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => navigate('/crm')}>
            Open CRM
          </Button>
        </CardHeader>
        <CardContent>
          {stats.total === 0 ? (
            <p className="py-6 text-center text-gray-500">
              No contacts yet — import a CSV dial list in the CRM to start calling restaurants.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ['Lead', stats.leads],
                ['In conversation', stats.contacted],
                ['Won', stats.customers],
              ].map(([label, count]) => (
                <div key={label as string} className="rounded-xl bg-s2d-cream px-4 py-3">
                  <p className="text-sm font-medium text-s2d-teal-deep">{label as string}</p>
                  <p className="text-2xl font-bold text-s2d-teal-ink">{count as number}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="cursor-pointer transition-shadow hover:shadow-lg" onClick={() => navigate('/calls')}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PhoneCall className="h-5 w-5 text-s2d-teal" />
            Outbound calling
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">
            Queue up to 5 simultaneous outbound lines, pause or stop the queue, and review transcripts in the Call Centre.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
