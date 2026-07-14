import { useState, useContext, useEffect, useMemo, useCallback } from 'react';
import { AppContext } from '../App';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { AddressMapLink } from './ui/AddressMapLink';
import { PhotoCapture } from './AI/PhotoCapture';
import { loadProjects, loadProjectsAsync, subscribeProjectsCache } from '../engine/project/projectStore';
import { loadBuilders } from '../engine/builder/builderStore';
import {
  clockIn, clockOut, getActiveClockIn, createCostEntryFromReceipt,
} from '../engine/costing/costingService';
import { parseReceiptPhoto } from '../engine/costing/receiptService';
import type { UnifiedProject } from '../engine/project/types';
import type { CostEntry } from '../engine/project/types';
import {
  Wrench, CheckCircle2, Clock, Calendar, MapPin,
  Camera, Plus, Upload, AlertCircle, FileText, Receipt,
  Play, Square, Loader2,
} from 'lucide-react';

interface JobUpdate {
  id: string;
  projectId: string;
  message: string;
  photos: string[];
  timestamp: string;
  createdBy: string;
}

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function BuilderDashboard() {
  const context = useContext(AppContext);
  if (!context) return null;

  const { user } = context;

  if (user.role !== 'builder') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="pt-6 text-center">
            <Wrench className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
            <p className="text-gray-600">This dashboard is only for builders.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const [projects, setProjects] = useState<UnifiedProject[]>([]);
  const [jobUpdates, setJobUpdates] = useState<JobUpdate[]>([]);
  const [newUpdate, setNewUpdate] = useState({ projectId: '', message: '', photos: [] as string[] });
  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [selectedView, setSelectedView] = useState<'all' | 'active' | 'completed' | 'today' | 'scheduled'>('all');
  const [receiptPhotos, setReceiptPhotos] = useState<string[]>([]);
  const [receiptProjectId, setReceiptProjectId] = useState('');
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [lastReceiptEntry, setLastReceiptEntry] = useState<CostEntry | null>(null);
  const [timerTick, setTimerTick] = useState(0);

  const builderRecord = useMemo(
    () => loadBuilders().find((b) => b.name.toLowerCase() === user.name.toLowerCase() || b.email === user.email),
    [user.name, user.email]
  );
  const builderId = builderRecord?.id ?? user.id;

  const refreshProjects = useCallback(() => {
    const all = loadProjects();
    const mine = all.filter(
      (p) =>
        p.status === 'in_progress'
        || p.status === 'planning'
        || p.assignedBuilder.toLowerCase().includes(user.name.toLowerCase())
        || user.name.toLowerCase().includes(p.assignedBuilder.toLowerCase())
    );
    setProjects(mine.length > 0 ? mine : all.filter((p) => p.status !== 'completed').slice(0, 5));
  }, [user.name]);

  useEffect(() => {
    void loadProjectsAsync().then(() => refreshProjects());
    const unsub = subscribeProjectsCache(() => refreshProjects());
    refreshProjects();
    return unsub;
  }, [refreshProjects]);

  useEffect(() => {
    const interval = setInterval(() => setTimerTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const myJobs = useMemo(() => projects.map((p) => ({
    id: p.id,
    customerName: p.customerName,
    address: p.address,
    startDate: p.startDate,
    endDate: p.finishDate,
    status: p.status === 'planning' ? 'scheduled' : p.status,
    tasks: p.tasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      dueToday: t.targetDate === new Date().toISOString().split('T')[0],
    })),
    nextPayment: p.paymentStages.find((s) => s.status === 'due' || s.status === 'pending')
      ? {
          stage: p.paymentStages.find((s) => s.status === 'due' || s.status === 'pending')!.name,
          amount: p.paymentStages.find((s) => s.status === 'due' || s.status === 'pending')!.amount,
          ready: true,
        }
      : undefined,
    activeClock: getActiveClockIn(p.id, builderId),
    recentCosts: (p.costEntries ?? []).slice(-3),
  })), [projects, builderId, timerTick]);

  const todaysTasks = myJobs.flatMap(job =>
    job.tasks
      .filter(task => task.dueToday && task.status !== 'completed')
      .map(task => ({ ...task, jobAddress: job.address, jobId: job.id }))
  );

  const activeJobs = myJobs.filter(job => job.status === 'in_progress');
  const scheduledJobs = myJobs.filter(job => job.status === 'scheduled');

  const completedTasksCount = myJobs.reduce((sum, job) =>
    sum + job.tasks.filter(t => t.status === 'completed').length, 0
  );
  const totalTasksCount = myJobs.reduce((sum, job) => sum + job.tasks.length, 0);

  const handleClockToggle = (projectId: string) => {
    const active = getActiveClockIn(projectId, builderId);
    if (active) {
      clockOut(projectId, builderId);
    } else {
      clockIn(projectId, builderId);
    }
    refreshProjects();
  };

  const handleReceiptUpload = async () => {
    if (!receiptPhotos.length || !receiptProjectId) return;
    setReceiptLoading(true);
    try {
      const project = projects.find((p) => p.id === receiptProjectId);
      const parsed = await parseReceiptPhoto(receiptPhotos[0], project?.projectName);
      const entry = createCostEntryFromReceipt(
        receiptProjectId,
        builderId,
        parsed,
        receiptPhotos[0]
      );
      setLastReceiptEntry(entry ?? null);
      setReceiptPhotos([]);
      refreshProjects();
    } catch (err) {
      console.error(err);
    } finally {
      setReceiptLoading(false);
    }
  };

  const addUpdate = () => {
    if (!newUpdate.message.trim() || !newUpdate.projectId) return;
    const update: JobUpdate = {
      id: Date.now().toString(),
      projectId: newUpdate.projectId,
      message: newUpdate.message,
      photos: newUpdate.photos,
      timestamp: new Date().toISOString(),
      createdBy: user.name,
    };
    setJobUpdates([update, ...jobUpdates]);
    setNewUpdate({ projectId: '', message: '', photos: [] });
    setShowUpdateForm(false);
  };

  const getFilteredJobs = () => {
    switch (selectedView) {
      case 'active': return activeJobs;
      case 'scheduled': return scheduledJobs;
      case 'today':
        return myJobs.filter(job => job.tasks.some(t => t.dueToday && t.status !== 'completed'));
      case 'completed':
        return myJobs.filter(job => job.tasks.every(t => t.status === 'completed'));
      default: return myJobs;
    }
  };

  const getRunningTime = (clockInIso: string) => {
    return formatElapsed(Date.now() - new Date(clockInIso).getTime());
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-8 bg-gradient-to-r from-slate-900 to-slate-800 p-8 rounded-3xl shadow-2xl">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-400 to-amber-200 bg-clip-text text-transparent">
            Builder Dashboard
          </h1>
          <p className="text-amber-100 mt-2 text-lg">Welcome back, {user.name}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <button onClick={() => setSelectedView('active')} className="text-left">
            <Card className={`bg-gradient-to-br from-blue-500 to-blue-600 text-white cursor-pointer hover:scale-105 transition-transform ${selectedView === 'active' ? 'ring-4 ring-amber-400' : ''}`}>
              <CardContent className="pt-6">
                <Wrench className="w-8 h-8 mb-2" />
                <p className="text-sm opacity-90 mb-1">Active Jobs</p>
                <p className="text-3xl font-bold">{activeJobs.length}</p>
              </CardContent>
            </Card>
          </button>
          <button onClick={() => setSelectedView('completed')} className="text-left">
            <Card className={`bg-gradient-to-br from-green-500 to-green-600 text-white cursor-pointer hover:scale-105 transition-transform ${selectedView === 'completed' ? 'ring-4 ring-amber-400' : ''}`}>
              <CardContent className="pt-6">
                <CheckCircle2 className="w-8 h-8 mb-2" />
                <p className="text-sm opacity-90 mb-1">Tasks Completed</p>
                <p className="text-3xl font-bold">{completedTasksCount}/{totalTasksCount}</p>
              </CardContent>
            </Card>
          </button>
          <button onClick={() => setSelectedView('today')} className="text-left">
            <Card className={`bg-gradient-to-br from-yellow-500 to-yellow-600 text-white cursor-pointer hover:scale-105 transition-transform ${selectedView === 'today' ? 'ring-4 ring-amber-400' : ''}`}>
              <CardContent className="pt-6">
                <Clock className="w-8 h-8 mb-2" />
                <p className="text-sm opacity-90 mb-1">Today&apos;s Tasks</p>
                <p className="text-3xl font-bold">{todaysTasks.length}</p>
              </CardContent>
            </Card>
          </button>
          <button onClick={() => setSelectedView('scheduled')} className="text-left">
            <Card className={`bg-gradient-to-br from-purple-500 to-purple-600 text-white cursor-pointer hover:scale-105 transition-transform ${selectedView === 'scheduled' ? 'ring-4 ring-amber-400' : ''}`}>
              <CardContent className="pt-6">
                <Calendar className="w-8 h-8 mb-2" />
                <p className="text-sm opacity-90 mb-1">Scheduled</p>
                <p className="text-3xl font-bold">{scheduledJobs.length}</p>
              </CardContent>
            </Card>
          </button>
        </div>

        <Card className="mb-6 border-2 border-emerald-200 bg-emerald-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-emerald-600" />
              Upload Receipt — AI reads & records automatically
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <select
              value={receiptProjectId}
              onChange={(e) => setReceiptProjectId(e.target.value)}
              className="w-full h-12 px-4 border border-gray-300 rounded-lg"
            >
              <option value="">Select job for this receipt…</option>
              {myJobs.map((job) => (
                <option key={job.id} value={job.id}>{job.customerName} — {job.address}</option>
              ))}
            </select>
            <PhotoCapture photos={receiptPhotos} onChange={setReceiptPhotos} maxPhotos={1} />
            <Button
              onClick={() => void handleReceiptUpload()}
              disabled={receiptLoading || !receiptPhotos.length || !receiptProjectId}
              className="w-full bg-emerald-600 hover:bg-emerald-700"
            >
              {receiptLoading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> AI reading receipt…</>
              ) : (
                <><Camera className="w-4 h-4 mr-2" /> Scan & Save Receipt</>
              )}
            </Button>
            {lastReceiptEntry && (
              <div className="p-4 bg-white rounded-xl border border-emerald-300">
                <p className="font-bold text-emerald-800">Saved — {lastReceiptEntry.supplier}</p>
                <p className="text-sm text-gray-600">{lastReceiptEntry.aiSummary}</p>
                <p className="text-lg font-bold mt-1">£{lastReceiptEntry.total.toFixed(2)}</p>
                {lastReceiptEntry.items.map((item, i) => (
                  <p key={i} className="text-xs text-gray-500">
                    {item.description} ({item.category}): £{item.total.toFixed(2)}
                  </p>
                ))}
                {lastReceiptEntry.status === 'flagged' && (
                  <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> AI flagged low confidence — office may review
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Today&apos;s Tasks</CardTitle>
                <AlertCircle className="w-6 h-6 text-amber-500" />
              </CardHeader>
              <CardContent>
                {todaysTasks.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-3" />
                    <p className="text-gray-600">All caught up! No urgent tasks for today.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {todaysTasks.map(task => (
                      <div key={task.id} className="p-4 bg-yellow-50 border-2 border-yellow-200 rounded-xl">
                        <h4 className="font-bold text-gray-900 mb-1">{task.title}</h4>
                        <p className="text-sm text-gray-600 flex items-center gap-2">
                          <MapPin className="w-4 h-4" />
                          <AddressMapLink address={task.jobAddress} />
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>
                    {selectedView === 'active' ? 'Active Jobs' :
                     selectedView === 'completed' ? 'Completed Jobs' :
                     selectedView === 'today' ? "Today's Jobs" :
                     selectedView === 'scheduled' ? 'Scheduled Jobs' : 'My Jobs'}
                  </span>
                  {selectedView !== 'all' && (
                    <Button onClick={() => setSelectedView('all')} size="sm" className="bg-gray-500 hover:bg-gray-600 text-white">
                      Show All
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {getFilteredJobs().map(job => (
                    <div key={job.id} className="bg-gray-50 p-4 rounded-xl">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="font-bold text-lg text-gray-900">{job.customerName}</h3>
                          <p className="text-sm text-gray-600 flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            <AddressMapLink address={job.address} />
                          </p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                          job.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {String(job.status).replace('_', ' ')}
                        </span>
                      </div>

                      <div className="mb-3 p-3 bg-white rounded-lg border">
                        <div className="flex items-center justify-between">
                          <div>
                            {job.activeClock ? (
                              <>
                                <p className="text-sm font-bold text-green-700 flex items-center gap-1">
                                  <Clock className="w-4 h-4 animate-pulse" /> Clocked in
                                </p>
                                <p className="text-2xl font-mono font-bold text-gray-900">
                                  {getRunningTime(job.activeClock.clockIn)}
                                </p>
                              </>
                            ) : (
                              <p className="text-sm text-gray-500">Not clocked in</p>
                            )}
                          </div>
                          <Button
                            onClick={() => handleClockToggle(job.id)}
                            className={job.activeClock ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}
                            size="lg"
                          >
                            {job.activeClock ? (
                              <><Square className="w-5 h-5 mr-2" /> Clock Out</>
                            ) : (
                              <><Play className="w-5 h-5 mr-2" /> Clock In</>
                            )}
                          </Button>
                        </div>
                      </div>

                      {job.recentCosts.length > 0 && (
                        <div className="mb-3 p-2 bg-emerald-50 rounded-lg text-xs">
                          <p className="font-bold text-emerald-800 mb-1">Recent costs (AI recorded)</p>
                          {job.recentCosts.map((c) => (
                            <p key={c.id} className="text-gray-600">{c.supplier}: £{c.total.toFixed(2)}</p>
                          ))}
                        </div>
                      )}

                      <div className="mb-3">
                        <p className="text-xs text-gray-500 mb-1">Progress</p>
                        <div className="bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-green-500 h-2 rounded-full transition-all"
                            style={{
                              width: `${job.tasks.length ? (job.tasks.filter(t => t.status === 'completed').length / job.tasks.length) * 100 : 0}%`,
                            }}
                          />
                        </div>
                        <p className="text-xs text-gray-600 mt-1">
                          {job.tasks.filter(t => t.status === 'completed').length}/{job.tasks.length} tasks completed
                        </p>
                      </div>

                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                        <Calendar className="w-4 h-4" />
                        <span>{job.startDate} → {job.endDate}</span>
                      </div>

                      {job.nextPayment && (
                        <div className="bg-green-50 border border-green-200 p-3 rounded-lg">
                          <p className="text-sm font-bold text-green-900">Next Payment Stage</p>
                          <p className="text-xs text-green-700">{job.nextPayment.stage}: £{job.nextPayment.amount.toLocaleString()}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Job Updates</CardTitle>
              <Button onClick={() => setShowUpdateForm(!showUpdateForm)} className="bg-amber-500 hover:bg-amber-600" size="sm">
                <Plus className="w-4 h-4 mr-2" /> Add Update
              </Button>
            </CardHeader>
            <CardContent>
              {showUpdateForm && (
                <div className="mb-4 p-4 bg-blue-50 rounded-xl">
                  <label className="block text-sm font-bold mb-2">Select Job</label>
                  <select
                    value={newUpdate.projectId}
                    onChange={(e) => setNewUpdate({ ...newUpdate, projectId: e.target.value })}
                    className="w-full h-12 px-4 mb-3 border border-gray-300 rounded-lg"
                  >
                    <option value="">Choose a job...</option>
                    {myJobs.map(job => (
                      <option key={job.id} value={job.id}>{job.customerName} - {job.address}</option>
                    ))}
                  </select>
                  <label className="block text-sm font-bold mb-2">Update Message</label>
                  <Textarea
                    value={newUpdate.message}
                    onChange={(e) => setNewUpdate({ ...newUpdate, message: e.target.value })}
                    placeholder="Describe the work completed, materials used, or any issues..."
                    className="mb-3 min-h-24"
                  />
                  <div className="flex gap-2">
                    <Button onClick={addUpdate} className="flex-1 bg-green-600 hover:bg-green-700">
                      <Upload className="w-4 h-4 mr-2" /> Post Update
                    </Button>
                    <Button onClick={() => setShowUpdateForm(false)} className="bg-gray-500 hover:bg-gray-600">
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
              <div className="space-y-3">
                {jobUpdates.map(update => {
                  const job = myJobs.find(j => j.id === update.projectId);
                  return (
                    <div key={update.id} className="bg-gray-50 p-4 rounded-xl border-l-4 border-blue-500">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-gray-900">{job?.customerName}</span>
                        <span className="text-xs text-gray-500">
                          {new Date(update.timestamp).toLocaleDateString()} {new Date(update.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 mb-2">{update.message}</p>
                      <p className="text-xs text-gray-500">
                        <FileText className="w-3 h-3 inline mr-1" />Posted by {update.createdBy}
                      </p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
