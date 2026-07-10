import { useState, useContext, useEffect, useRef, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router';
import { AppContext } from '../App';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import {
  Calendar, Clock, MapPin, DollarSign, MessageSquare, Image as ImageIcon,
  CheckCircle2, AlertCircle, Send, ChevronLeft, ChevronRight, Eye, FileText,
  Hammer, TrendingUp, BarChart3, Users, Briefcase, Camera, Video, X, FolderKanban, ShieldCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { messagingHub } from '../engine/messaging/messagingHub';
import { testBuilders } from '../data/testData';
import { loadProjects, saveProjects, updateProject, syncToServer } from '../engine/project/projectStore';
import type { UnifiedProject } from '../engine/project/types';
import { uploadProjectFile } from '../engine/storage/storageService';
import { getContactsForCustomer } from '../engine/contacts/contactStore';
import { ProjectPhotosTab } from './project/ProjectPhotosTab';
import { ProjectPlanTab } from './project/ProjectPlanTab';
import { ProjectDocumentsTab } from './project/ProjectDocumentsTab';
import { ProjectAIPanel } from './project/ProjectAIPanel';
import ProjectSnaggingTab from './project/ProjectSnaggingTab';
import { ProjectCommsPanel } from './project/ProjectCommsPanel';
import { ProjectTeamTab } from './project/ProjectTeamTab';
import { DailyPlanCard } from './project/DailyPlanCard';
import { findPlanningApplicationByProjectId } from '../engine/planning/planningStore';
import { stageLabel } from '../engine/planning/types';
import { applyDerivedStatus } from '../engine/project/projectStatusService';

// Enhanced Project Interfaces
export interface DesignItem {
  id: string;
  category: 'tile' | 'fixture' | 'finish' | 'accessory';
  name: string;
  description: string;
  photo?: string;
  supplier?: string;
  cost?: number;
}

export interface ProjectMessage {
  id: string;
  from: string;
  fromRole: 'customer' | 'builder' | 'office' | 'admin';
  message: string;
  timestamp: string;
  attachments?: string[];
  emailSent?: boolean;
  channel?: 'app' | 'whatsapp' | 'portal' | 'email';
  senderPhone?: string;
  senderContactName?: string;
  senderContactRole?: string;
}

export interface BuilderPayment {
  builderId: string;
  builderName: string;
  paymentType: 'price_work' | 'day_rate';
  agreedAmount?: number; // for price work
  dayRate?: number; // for day work
  daysWorked?: number;
  totalEarned: number;
  status: 'pending' | 'approved' | 'paid';
}

export interface Invoice {
  id: string;
  projectId: string;
  type: 'customer' | 'builder';
  amount: number;
  issueDate: string;
  dueDate: string;
  paidDate?: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue';
}

export interface PaymentStage {
  id: string;
  name: string;
  percentage: number;
  amount: number;
  status: 'pending' | 'due' | 'paid';
  dueDate?: string;
  paidDate?: string;
  description: string;
}

export interface BuilderProject {
  id: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  tradeId?: string;
  tradeName?: string;
  address: string;
  startDate: string;
  finishDate: string;
  status: 'upcoming' | 'in_progress' | 'completed' | 'on_hold';
  designItems: DesignItem[];
  messages: ProjectMessage[];
  builderPayments: BuilderPayment[];
  paymentStages: PaymentStage[];
  invoices: Invoice[];
  totalCustomerCost: number;
  photos: string[];
  description: string;
  assignedBuilder: string;
  customerAutoUpdates?: boolean;
}

export default function BuilderProjectManagement() {
  const context = useContext(AppContext);
  if (!context) return null;

  const { user, customers } = context;
  const navigate = useNavigate();
  const location = useLocation();

  // Available builders - imported from test data
  const [builders] = useState(testBuilders);

  // Test data - imported from testData.ts with comprehensive realistic projects
  const [projects, setProjects] = useState<BuilderProject[]>(() => loadProjects() as unknown as BuilderProject[]);

  const persistProjects = (next: BuilderProject[]) => {
    saveProjects(next as unknown as UnifiedProject[]);
    setProjects(next);
    syncToServer();
  };

  const refreshProject = (updated: UnifiedProject) => {
    const next = projects.map(p => p.id === updated.id ? updated as unknown as BuilderProject : p);
    persistProjects(next);
    if (selectedProject?.id === updated.id) {
      setSelectedProject(updated as unknown as BuilderProject);
    }
  };

  useEffect(() => {
    syncToServer();
  }, []);

  useEffect(() => {
    const projectId = (location.state as { projectId?: string } | null)?.projectId;
    if (!projectId) return;
    const match = projects.find((p) => p.id === projectId);
    if (match) setSelectedProject(match);
  }, [location.state, projects]);

  // Set initial month - May 2026 for customer to see Amanda's project, or current date for others
  const getInitialMonth = () => {
    if (user.role === 'customer') {
      return new Date(2026, 4); // May 2026 - where Amanda's project is
    }
    return new Date(2026, 3); // April 2026 for staff/admin
  };

  const [currentMonth, setCurrentMonth] = useState(getInitialMonth());
  const [selectedProject, setSelectedProject] = useState<BuilderProject | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [view, setView] = useState<'calendar' | 'list'>('calendar');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isAssigningBuilder, setIsAssigningBuilder] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const linkedPlanningApp = useMemo(
    () => (selectedProject ? findPlanningApplicationByProjectId(selectedProject.id) : undefined),
    [selectedProject?.id],
  );

  // Filter projects based on user role AND remove sensitive data
  const filterProjectForCustomer = (project: BuilderProject): BuilderProject => {
    return {
      ...project,
      builderPayments: [], // Remove builder payment info from customers
      designItems: project.designItems.map(item => ({
        ...item,
        cost: undefined,     // Remove internal costs
        supplier: undefined  // Remove supplier information
      }))
    };
  };

  const builderProjects = useMemo(() => {
    if (user.role === 'builder') {
      return projects.filter(p => p.assignedBuilder === user.name);
    }
    if (user.role === 'customer') {
      return projects.filter(p => p.customerName === user.name).map(filterProjectForCustomer);
    }
    return projects;
  }, [user.role, user.name, projects]);

  // Auto-select project for customers with only one project
  useEffect(() => {
    if (user.role === 'customer' && builderProjects.length === 1 && !selectedProject) {
      setSelectedProject(builderProjects[0]);
    }
  }, [user.role, builderProjects, selectedProject]);

  // Calendar helper functions
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    return { daysInMonth, startingDayOfWeek, year, month };
  };

  const getProjectsForDay = (day: number) => {
    const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return builderProjects.filter(p => {
      const start = new Date(p.startDate);
      const end = new Date(p.finishDate);
      const current = new Date(dateStr);
      return current >= start && current <= end;
    });
  };

  // Helper to get message role from user role
  const getMessageRole = (userRole: string): 'customer' | 'builder' | 'office' | 'admin' => {
    if (userRole === 'customer') return 'customer';
    if (userRole === 'builder') return 'builder';
    if (userRole === 'super_admin') return 'admin';
    return 'office'; // staff and manager
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setAttachments([...attachments, ...Array.from(files)]);
      toast.success(`${files.length} file(s) attached`);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const sendMessage = async () => {
    if (!selectedProject || (!newMessage.trim() && attachments.length === 0) || isSendingMessage) return;

    setIsSendingMessage(true);
    const messageRole = getMessageRole(user.role);

    const attachmentNames: string[] = [];
    for (const file of attachments) {
      await uploadProjectFile(selectedProject.id, file, 'message', user.name, { caption: file.name });
      attachmentNames.push(file.name);
    }

    const unified = loadProjects().find(p => p.id === selectedProject.id);
    const portalUrl = unified?.portalToken ? `${window.location.origin}/portal/${unified.portalToken}` : '';

    const message: ProjectMessage = {
      id: `M${Date.now()}`,
      from: user.name,
      fromRole: messageRole,
      message: newMessage || '📎 Sent attachments',
      timestamp: new Date().toISOString(),
      attachments: attachmentNames.length > 0 ? attachmentNames : undefined,
      emailSent: user.role !== 'customer',
    };

    const updatedMessages = [...selectedProject.messages, message];
    const next = projects.map(p =>
      p.id === selectedProject.id ? { ...p, messages: updatedMessages } : p
    );
    persistProjects(next);
    setSelectedProject({ ...selectedProject, messages: updatedMessages });

    if (message.emailSent && context) {
      const customer = context.customers.find(c => c.id === selectedProject.customerId);
      const projectLabel = (selectedProject as unknown as UnifiedProject).projectName ?? selectedProject.customerName;
      if (customer) {
        await messagingHub.send({
          channels: ['email', 'whatsapp'],
          to: {
            email: selectedProject.customerEmail,
            phone: customer.phone,
            customerId: selectedProject.customerId,
            customerName: selectedProject.customerName,
          },
          subject: `Project update: ${projectLabel}`,
          body: `${user.name} sent a project update:\n\n${newMessage || 'See attachments in your project portal.'}\n\n${portalUrl}`,
          eventType: 'project_update',
          templateId: 'project_update',
        }, customer);
      }
      toast.success(`Message sent and notification sent to ${selectedProject.customerName}`);
    } else {
      toast.success('Message sent');
    }

    setNewMessage('');
    setAttachments([]);
    setIsSendingMessage(false);
  };

  // Get builder color
  const getBuilderColor = (builderName: string) => {
    const builder = builders.find(b => b.name === builderName);
    return builder?.color || '#6b7280';
  };

  // Assign or reassign builder to project
  const assignBuilder = async (projectId: string, builderName: string) => {
    if (isAssigningBuilder) return;

    setIsAssigningBuilder(true);
    await new Promise((resolve) => setTimeout(resolve, 500));

    const unified = loadProjects().find((p) => p.id === projectId);
    if (!unified) {
      setIsAssigningBuilder(false);
      return;
    }

    const builder = builders.find((b) => b.name === builderName);
    const withBuilder = {
      ...unified,
      assignedBuilder: builderName,
      builderPayments: unified.builderPayments.map((payment) => ({
        ...payment,
        builderId: builder?.id || payment.builderId,
        builderName,
      })),
    };
    const derived = applyDerivedStatus(withBuilder);
    const updated = updateProject(projectId, {
      assignedBuilder: derived.assignedBuilder,
      builderPayments: derived.builderPayments,
      status: derived.status,
    });

    if (updated) refreshProject(updated);
    toast.success(`Project assigned to ${builderName}`);
    setIsAssigningBuilder(false);
  };

  const toggleCustomerAutoUpdates = (projectId: string, enabled: boolean) => {
    const updated = updateProject(projectId, { customerAutoUpdates: enabled });
    if (!updated) {
      toast.error('Could not update customer auto updates');
      return;
    }
    refreshProject(updated);
    toast.success(enabled ? 'Customer auto updates enabled' : 'Customer auto updates disabled');
  };

  const renderCalendar = () => {
    const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(currentMonth);
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Helper to check if a date is in project range
    const isProjectOnDay = (project: BuilderProject, day: number) => {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const current = new Date(dateStr);
      const start = new Date(project.startDate);
      const end = new Date(project.finishDate);
      return current >= start && current <= end;
    };

    // Helper to check if this is the first day of project in this month
    const isProjectStart = (project: BuilderProject, day: number) => {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const current = new Date(dateStr);
      const start = new Date(project.startDate);
      return current.toDateString() === start.toDateString();
    };

    return (
      <div className="space-y-4">
        {/* Mobile-Optimized Navigation */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-0 mb-4">
          {/* Month Display - Top on mobile */}
          <div className="text-center sm:order-2 sm:flex-1">
            <h3 className="text-xl sm:text-2xl font-bold">
              {currentMonth.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
            </h3>
            {user.role !== 'customer' && (
              <p className="text-xs sm:text-sm text-slate-600">
                {builderProjects.length} project{builderProjects.length !== 1 ? 's' : ''} this month
              </p>
            )}
          </div>

          {/* Navigation Buttons - Bottom on mobile, full width */}
          <div className="flex gap-2 sm:order-1">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 sm:flex-none h-10 sm:h-9"
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
            >
              <ChevronLeft className="w-4 h-4 sm:mr-1" />
              <span className="hidden sm:inline">Previous</span>
              <span className="sm:hidden">Prev</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 sm:flex-none h-10 sm:h-9"
              onClick={() => setCurrentMonth(new Date())}
            >
              Today
            </Button>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="flex-1 sm:flex-none h-10 sm:h-9 sm:order-3"
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
          >
            <span className="hidden sm:inline">Next</span>
            <span className="sm:hidden">Next</span>
            <ChevronRight className="w-4 h-4 sm:ml-1" />
          </Button>
        </div>

        {/* Builder Legend - Hidden from customers - Mobile Responsive */}
        {user.role !== 'customer' && (
          <div className="flex flex-wrap gap-2 sm:gap-3 p-3 sm:p-4 bg-slate-50 rounded-lg">
            <p className="text-xs sm:text-sm font-semibold text-slate-700 w-full mb-1">Builders:</p>
            {builders.map(builder => (
              <div key={builder.id} className="flex items-center gap-1.5 sm:gap-2">
                <div
                  className="w-3 h-3 sm:w-4 sm:h-4 rounded"
                  style={{ backgroundColor: builder.color }}
                ></div>
                <span className="text-xs sm:text-sm font-medium text-slate-700">{builder.name}</span>
              </div>
            ))}
          </div>
        )}

        {/* Customer View - Enhanced Project Info with Progress - Mobile Responsive */}
        {user.role === 'customer' && builderProjects.length > 0 && (
          <div className="space-y-3">
            <div className="p-3 sm:p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg border-2 border-blue-200">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 mb-3">
                <div className="flex-1">
                  <p className="text-xs sm:text-sm text-slate-600">Your Project</p>
                  <h3 className="text-base sm:text-xl font-bold text-slate-900 mt-1">{builderProjects[0].description}</h3>
                </div>
                <div className="w-full sm:w-auto sm:text-right">
                  <Badge variant="default" className="mb-2 capitalize text-xs sm:text-sm">
                    {builderProjects[0].status.replace('_', ' ')}
                  </Badge>
                  <p className="text-xs sm:text-sm text-slate-600">
                    {new Date(builderProjects[0].startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} - {new Date(builderProjects[0].finishDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs sm:text-sm font-medium text-slate-700">Project Progress</span>
                  <span className="text-base sm:text-lg font-bold text-blue-600">
                    {(() => {
                      const start = new Date(builderProjects[0].startDate);
                      const end = new Date(builderProjects[0].finishDate);
                      const today = new Date();
                      const total = end.getTime() - start.getTime();
                      const elapsed = today.getTime() - start.getTime();
                      return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
                    })()}%
                  </span>
                </div>
                <div className="w-full h-2.5 bg-white/60 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500"
                    style={{
                      width: `${(() => {
                        const start = new Date(builderProjects[0].startDate);
                        const end = new Date(builderProjects[0].finishDate);
                        const today = new Date();
                        const total = end.getTime() - start.getTime();
                        const elapsed = today.getTime() - start.getTime();
                        return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
                      })()}%`
                    }}
                  ></div>
                </div>
              </div>

              {/* Payment Summary */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-white/60 rounded-lg p-2 sm:p-3">
                  <p className="text-[10px] sm:text-xs text-slate-600">Total Cost</p>
                  <p className="text-sm sm:text-base font-bold text-slate-900">£{builderProjects[0].totalCustomerCost.toLocaleString()}</p>
                </div>
                <div className="bg-white/60 rounded-lg p-2 sm:p-3">
                  <p className="text-[10px] sm:text-xs text-slate-600">Paid</p>
                  <p className="text-sm sm:text-base font-bold text-green-600">
                    £{builderProjects[0].paymentStages
                      .filter(s => s.status === 'paid')
                      .reduce((sum, s) => sum + s.amount, 0)
                      .toLocaleString()}
                  </p>
                </div>
                <div className="bg-white/60 rounded-lg p-2 sm:p-3">
                  <p className="text-[10px] sm:text-xs text-slate-600">Due</p>
                  <p className="text-sm sm:text-base font-bold text-amber-600">
                    £{builderProjects[0].paymentStages
                      .filter(s => s.status !== 'paid')
                      .reduce((sum, s) => sum + s.amount, 0)
                      .toLocaleString()}
                  </p>
                </div>
              </div>

              <Button
                onClick={() => setSelectedProject(builderProjects[0])}
                className="w-full mt-3 bg-blue-600 hover:bg-blue-700 touch-manipulation h-10"
              >
                View Full Project Details
              </Button>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-7 gap-0 border-b border-slate-200">
            {dayNames.map(name => (
              <div key={name} className="bg-gradient-to-b from-slate-800 to-slate-700 text-white text-center py-2 sm:py-3 font-bold text-xs sm:text-sm border-r border-slate-600 last:border-r-0">
                <span className="hidden sm:inline">{name}</span>
                <span className="sm:hidden">{name.slice(0, 1)}</span>
              </div>
            ))}
          </div>

          {/* Calendar Grid - Smaller cells on mobile */}
          <div className="grid grid-cols-7 gap-0">
            {/* Empty cells before month starts */}
            {Array.from({ length: startingDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-16 sm:min-h-32 p-1 sm:p-2 bg-slate-50 border-r border-b border-slate-200"></div>
            ))}

            {/* Days of the month */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const projectsToday = builderProjects.filter(p => isProjectOnDay(p, day));
              const isToday = new Date().getDate() === day &&
                              new Date().getMonth() === month &&
                              new Date().getFullYear() === year;

              return (
                <div
                  key={day}
                  className={`min-h-16 sm:min-h-32 p-1 sm:p-2 border-r border-b border-slate-200 last:border-r-0 relative ${
                    isToday ? 'bg-amber-50' : 'bg-white'
                  }`}
                >
                  {/* Day Number and Project Count */}
                  <div className="flex items-center justify-between mb-1 sm:mb-2">
                    <div className={`text-xs sm:text-sm font-bold ${
                      isToday ? 'text-amber-600 bg-amber-200 w-5 h-5 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-[10px] sm:text-sm' : 'text-slate-700'
                    }`}>
                      {day}
                    </div>
                    {projectsToday.length > 0 && user.role !== 'customer' && (
                      <Badge variant="secondary" className="text-[8px] sm:text-xs h-4 sm:h-5 px-1 sm:px-2">
                        {projectsToday.length}
                      </Badge>
                    )}
                  </div>

                  {/* Projects on this day - Touch friendly on mobile */}
                  <div className="space-y-0.5 sm:space-y-1">
                    {projectsToday.map(project => {
                      const showLabel = isProjectStart(project, day);
                      const builderColor = user.role === 'customer' ? '#3b82f6' : getBuilderColor(project.assignedBuilder); // Blue for customers

                      return (
                        <button
                          key={project.id}
                          onClick={() => setSelectedProject(project)}
                          className="w-full text-left transition-all active:opacity-70 sm:hover:opacity-80 group touch-manipulation cursor-pointer"
                        >
                          <div
                            className="px-1 sm:px-2 py-1 sm:py-1 rounded-sm text-[9px] sm:text-xs font-medium text-white shadow-sm group-hover:shadow-lg group-active:shadow-lg transition-all min-h-[24px] sm:min-h-0 cursor-pointer border border-white/20"
                            style={{ backgroundColor: builderColor }}
                          >
                            {showLabel && (
                              <>
                                {user.role === 'customer' ? (
                                  <>
                                    <div className="font-bold truncate hidden sm:block">Your Project</div>
                                    <div className="font-bold truncate sm:hidden">Your Project</div>
                                    <div className="text-[8px] sm:text-[10px] opacity-90 truncate hidden sm:block">In Progress</div>
                                  </>
                                ) : (
                                  <>
                                    <div className="font-bold truncate">{project.customerName}</div>
                                    <div className="text-[8px] sm:text-[10px] opacity-90 truncate hidden sm:block">{project.assignedBuilder}</div>
                                  </>
                                )}
                              </>
                            )}
                            {!showLabel && <div className="h-3 sm:h-4"></div>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderProjectList = () => (
    <div className="space-y-4">
      {['in_progress', 'upcoming', 'completed'].map(status => {
        const statusProjects = builderProjects.filter(p => p.status === status);
        if (statusProjects.length === 0) return null;

        return (
          <div key={status}>
            <h3 className="text-lg font-bold text-slate-900 mb-3 capitalize">
              {status.replace('_', ' ')} ({statusProjects.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {statusProjects.map(project => (
                <Card key={project.id} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setSelectedProject(project)}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">
                          {user.role === 'customer' ? `Your ${project.tradeName ?? 'Project'}` : project.customerName}
                        </CardTitle>
                        <p className="text-sm text-slate-600 mt-1 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {project.address}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge variant={
                          status === 'in_progress' ? 'default' :
                          status === 'upcoming' ? 'secondary' : 'outline'
                        }>
                          {status.replace('_', ' ')}
                        </Badge>
                        {project.customerAutoUpdates && (
                          <Badge variant="secondary" className="bg-blue-100 text-blue-800 border border-blue-200">
                            Auto updates on
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Calendar className="w-4 h-4" />
                      {new Date(project.startDate).toLocaleDateString('en-GB')} - {new Date(project.finishDate).toLocaleDateString('en-GB')}
                    </div>
                    {user.role !== 'customer' && project.builderPayments[0] && (
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <DollarSign className="w-4 h-4" />
                        {project.builderPayments[0].paymentType === 'price_work' ?
                          `Price work: £${project.builderPayments[0].agreedAmount} (£${project.builderPayments[0].totalEarned} earned)` :
                          `Day rate: £${project.builderPayments[0].dayRate}/day (${project.builderPayments[0].daysWorked || 0} days)`
                        }
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <MessageSquare className="w-4 h-4" />
                      {project.messages.length} message{project.messages.length !== 1 ? 's' : ''}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );

  // Role-based access check
  if (user.role !== 'builder' && user.role !== 'super_admin' && user.role !== 'manager' && user.role !== 'staff' && user.role !== 'customer') {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Card>
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold">Access Restricted</h2>
            <p className="text-slate-600 mt-2">You don't have access to this module.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header - Mobile Responsive */}
      <div className="bg-white border-b border-slate-200 p-3 sm:p-4">
        <div className="max-w-[1920px] mx-auto">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-3 sm:gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
                <Hammer className="w-5 h-5 sm:w-6 sm:h-6 text-amber-500" />
                {user.role === 'builder' ? 'My Projects' : user.role === 'customer' ? 'My Project' : 'Project Management'}
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 mt-1">
                {user.role === 'builder'
                  ? 'Manage your schedule and communicate with customers'
                  : user.role === 'customer'
                  ? 'Track your project progress and stay in touch with your team'
                  : 'Manage all building projects'}
              </p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button
                variant={view === 'calendar' ? 'default' : 'outline'}
                onClick={() => setView('calendar')}
                className="flex-1 sm:flex-none h-9 text-sm"
              >
                <Calendar className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Calendar</span>
              </Button>
              <Button
                variant={view === 'list' ? 'default' : 'outline'}
                onClick={() => setView('list')}
                className="flex-1 sm:flex-none h-9 text-sm"
              >
                <Briefcase className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">List</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area - Split View */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full max-w-[1920px] mx-auto flex flex-col lg:flex-row gap-0">
          {/* Left Panel - Projects/Calendar */}
          <div className={`${selectedProject ? 'hidden lg:flex' : 'flex'} flex-col lg:w-1/2 xl:w-3/5 border-r border-slate-200/60 bg-white overflow-hidden transition-all duration-300`}>
            <div className="flex-1 overflow-y-auto p-3 sm:p-4">
              {/* Stats - Mobile: 2 columns, Desktop: 4 columns */}
              <div className="grid grid-cols-2 gap-3 mb-4">
        <Card>
          <CardContent className="pt-4 md:pt-6">
            <div className="flex flex-col sm:flex-row items-center sm:justify-between gap-2">
              <div className="text-center sm:text-left">
                <p className="text-xs sm:text-sm text-slate-600">In Progress</p>
                <p className="text-xl sm:text-2xl font-bold text-blue-600">
                  {builderProjects.filter(p => p.status === 'in_progress').length}
                </p>
              </div>
              <Hammer className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 md:pt-6">
            <div className="flex flex-col sm:flex-row items-center sm:justify-between gap-2">
              <div className="text-center sm:text-left">
                <p className="text-xs sm:text-sm text-slate-600">Upcoming</p>
                <p className="text-xl sm:text-2xl font-bold text-green-600">
                  {builderProjects.filter(p => p.status === 'upcoming').length}
                </p>
              </div>
              <Clock className="w-6 h-6 sm:w-8 sm:h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 md:pt-6">
            <div className="flex flex-col sm:flex-row items-center sm:justify-between gap-2">
              <div className="text-center sm:text-left">
                <p className="text-xs sm:text-sm text-slate-600">Completed</p>
                <p className="text-xl sm:text-2xl font-bold text-slate-600">
                  {builderProjects.filter(p => p.status === 'completed').length}
                </p>
              </div>
              <CheckCircle2 className="w-6 h-6 sm:w-8 sm:h-8 text-slate-500" />
            </div>
          </CardContent>
        </Card>
        {user.role === 'builder' && (
          <Card>
            <CardContent className="pt-4 md:pt-6">
              <div className="flex flex-col sm:flex-row items-center sm:justify-between gap-2">
                <div className="text-center sm:text-left">
                  <p className="text-xs sm:text-sm text-slate-600">Total Earned</p>
                  <p className="text-xl sm:text-2xl font-bold text-amber-600">
                    £{builderProjects.reduce((sum, p) => sum + (p.builderPayments[0]?.totalEarned || 0), 0).toLocaleString()}
                  </p>
                </div>
                <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 text-amber-500" />
              </div>
            </CardContent>
          </Card>
        )}
              </div>

              {/* Main Content */}
              {view === 'calendar' ? renderCalendar() : renderProjectList()}
            </div>
          </div>

          {/* Right Panel - Project Details */}
          <div className={`${selectedProject ? 'flex' : 'hidden lg:flex'} flex-col lg:w-1/2 xl:w-2/5 bg-white overflow-hidden border-l border-slate-200/40 transition-all duration-300`}>
            {selectedProject ? (
              <>
                {/* Project Header */}
                <div
                  className="border-b border-slate-200/60 p-3 sm:p-4 bg-gradient-to-r from-slate-50/90 to-white/95"
                  onDoubleClick={() => setSelectedProject(null)}
                  title="Double-tap to close project"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Button
                          variant="ghost"
                          onClick={() => setSelectedProject(null)}
                          className="lg:hidden -ml-2 min-h-11 min-w-11 opacity-70 hover:opacity-100"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <h2 className="text-lg sm:text-xl font-bold text-slate-900 truncate">
                          {user.role === 'customer' ? `Your ${selectedProject.tradeName ?? 'Project'}` : `${selectedProject.customerName}'s ${selectedProject.tradeName ?? 'Project'}`}
                        </h2>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={
                          selectedProject.status === 'in_progress' ? 'default' :
                          selectedProject.status === 'upcoming' ? 'secondary' : 'outline'
                        } className="capitalize text-xs">
                          {selectedProject.status.replace('_', ' ')}
                        </Badge>
                        {(user.role === 'builder' || user.role === 'staff' || user.role === 'manager' || user.role === 'super_admin') && (
                          <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
                            <Link
                              to={`/building-control?projectId=${selectedProject.id}&tradeId=${selectedProject.tradeId ?? 'bathroom'}`}
                            >
                              <ShieldCheck className="w-3 h-3 mr-1" />
                              Ask about compliance
                            </Link>
                          </Button>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      onClick={() => setSelectedProject(null)}
                      className="hidden lg:flex -mr-2 min-h-11 min-w-11 opacity-40 hover:opacity-100"
                      title="Close (or double-tap header)"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Customer Communication Banner */}
                {user.role === 'customer' && (
                  <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-3 sm:p-4">
                    <div className="flex items-center gap-3">
                      <MessageSquare className="w-6 h-6 sm:w-8 sm:h-8 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="font-bold text-sm sm:text-base">Stay Connected with Your Project Team</p>
                        <p className="text-xs sm:text-sm opacity-90 mt-1">
                          Send messages, photos, and questions directly to your builder and office team • Quick responses guaranteed
                        </p>
                      </div>
                      {selectedProject.messages.length > 0 && (
                        <div className="flex-shrink-0">
                          <div className="bg-white text-blue-600 px-3 py-1 rounded-full font-bold text-sm">
                            {selectedProject.messages.length} messages
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Project Details Content */}
                <div className="flex-1 overflow-y-auto">
                  <Tabs defaultValue={user.role === 'customer' ? 'messages' : 'overview'} className="h-full flex flex-col">
                    <div className="border-b border-slate-200 px-2 sm:px-3 lg:px-4 overflow-x-auto scrollbar-thin">
                      <TabsList className={`inline-flex w-max min-w-full h-auto p-1 gap-0.5 bg-transparent text-xs sm:text-sm ${user.role === 'customer' ? '' : ''}`}>
                <TabsTrigger value="overview" className="shrink-0 px-3 sm:px-4 whitespace-nowrap">Overview</TabsTrigger>
                {user.role !== 'customer' && <TabsTrigger value="plan" className="shrink-0 px-3 sm:px-4 whitespace-nowrap">Plan</TabsTrigger>}
                {user.role !== 'customer' && <TabsTrigger value="photos" className="shrink-0 px-3 sm:px-4 whitespace-nowrap">Photos</TabsTrigger>}
                {user.role !== 'customer' && <TabsTrigger value="documents" className="shrink-0 px-3 sm:px-4 whitespace-nowrap">Docs</TabsTrigger>}
                {user.role !== 'customer' && <TabsTrigger value="ai" className="shrink-0 px-3 sm:px-4 whitespace-nowrap">AI</TabsTrigger>}
                {user.role !== 'customer' && <TabsTrigger value="comms" className="shrink-0 px-3 sm:px-4 whitespace-nowrap">Comms</TabsTrigger>}
                {user.role !== 'customer' && <TabsTrigger value="team" className="shrink-0 px-3 sm:px-4 whitespace-nowrap">Team</TabsTrigger>}
                {user.role !== 'customer' && <TabsTrigger value="snagging" className="shrink-0 px-3 sm:px-4 whitespace-nowrap">Snagging</TabsTrigger>}
                <TabsTrigger value="design" className="shrink-0 px-3 sm:px-4 whitespace-nowrap">
                  Design
                </TabsTrigger>
                <TabsTrigger value="messages" className="shrink-0 px-3 sm:px-4 whitespace-nowrap relative">
                  Messages
                  {selectedProject.messages.length > 0 && (
                    <span className="ml-1 inline-flex items-center justify-center min-w-5 h-5 text-xs font-bold text-white bg-blue-600 rounded-full px-1">
                      {selectedProject.messages.length}
                    </span>
                  )}
                </TabsTrigger>
                {user.role === 'customer' && <TabsTrigger value="payments" className="shrink-0 px-3 sm:px-4 whitespace-nowrap">Pay</TabsTrigger>}
                {user.role === 'customer' && <TabsTrigger value="invoices" className="shrink-0 px-3 sm:px-4 whitespace-nowrap">Invoice</TabsTrigger>}
                {user.role !== 'customer' && <TabsTrigger value="payments" className="shrink-0 px-3 sm:px-4 whitespace-nowrap">Payments</TabsTrigger>}
                {user.role !== 'customer' && <TabsTrigger value="builder-payment" className="shrink-0 px-3 sm:px-4 whitespace-nowrap">Builder Pay</TabsTrigger>}
                      </TabsList>
                    </div>

                    <div className="flex-1 overflow-y-auto p-3 sm:p-4">
              <TabsContent value="overview" className="space-y-3 sm:space-y-4 mt-0">
                {selectedProject && (
                  <DailyPlanCard project={selectedProject as unknown as UnifiedProject} />
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <Label className="text-slate-600 text-xs sm:text-sm">Customer</Label>
                    <button
                      type="button"
                      className="font-medium text-sm sm:text-base text-blue-700 hover:underline text-left"
                      onClick={() => navigate('/crm')}
                    >
                      {selectedProject.customerName}
                    </button>
                    <p className="text-xs sm:text-sm text-slate-600">{selectedProject.customerEmail}</p>
                  </div>
                  <div>
                    <Label className="text-slate-600 text-xs sm:text-sm">Address</Label>
                    <p className="font-medium flex items-center gap-1 text-sm sm:text-base">
                      <MapPin className="w-3 h-3 sm:w-4 sm:h-4 text-slate-400 flex-shrink-0" />
                      <span className="break-words">{selectedProject.address}</span>
                    </p>
                  </div>
                  <div>
                    <Label className="text-slate-600 text-xs sm:text-sm">Start Date</Label>
                    <p className="font-medium flex items-center gap-1 text-sm sm:text-base">
                      <Calendar className="w-3 h-3 sm:w-4 sm:h-4 text-slate-400 flex-shrink-0" />
                      <span className="break-words">{new Date(selectedProject.startDate).toLocaleDateString('en-GB', {
                        weekday: 'short', day: 'numeric', month: 'long', year: 'numeric'
                      })}</span>
                    </p>
                  </div>
                  <div>
                    <Label className="text-slate-600 text-xs sm:text-sm">Finish Date</Label>
                    <p className="font-medium flex items-center gap-1 text-sm sm:text-base">
                      <Calendar className="w-3 h-3 sm:w-4 sm:h-4 text-slate-400 flex-shrink-0" />
                      <span className="break-words">{new Date(selectedProject.finishDate).toLocaleDateString('en-GB', {
                        weekday: 'short', day: 'numeric', month: 'long', year: 'numeric'
                      })}</span>
                    </p>
                  </div>
                </div>

                {linkedPlanningApp && user.role !== 'customer' && (
                  <Card className="bg-indigo-50 border-indigo-200">
                    <CardContent className="pt-3 sm:pt-4 p-3 sm:p-6">
                      <Label className="text-slate-700 font-semibold text-xs sm:text-sm">Planning application</Label>
                      <button
                        type="button"
                        className="mt-2 block text-sm font-medium text-indigo-700 hover:underline text-left"
                        onClick={() => navigate(`/planning/${linkedPlanningApp.id}`)}
                      >
                        {linkedPlanningApp.title} · {stageLabel(linkedPlanningApp.stage)}
                      </button>
                    </CardContent>
                  </Card>
                )}

                {/* Builder Assignment - Staff/Admin Only (NOT shown to customers) - Mobile Responsive */}
                {(user.role === 'super_admin' || user.role === 'manager' || user.role === 'staff') && (
                  <Card className="bg-amber-50 border-amber-200">
                    <CardContent className="pt-3 sm:pt-4 p-3 sm:p-6">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="flex-1">
                          <Label className="text-slate-700 font-semibold text-xs sm:text-sm">Assigned Builder</Label>
                          <div className="flex items-center gap-2 mt-2">
                            <div
                              className="w-3 h-3 sm:w-4 sm:h-4 rounded flex-shrink-0"
                              style={{ backgroundColor: getBuilderColor(selectedProject.assignedBuilder) }}
                            ></div>
                            {selectedProject.assignedBuilder && selectedProject.assignedBuilder !== 'Unassigned' ? (
                              <button
                                type="button"
                                className="font-bold text-base sm:text-lg text-blue-700 hover:underline text-left"
                                onClick={() => navigate('/builder-management', { state: { builderName: selectedProject.assignedBuilder } })}
                              >
                                {selectedProject.assignedBuilder}
                              </button>
                            ) : (
                              <p className="font-bold text-base sm:text-lg text-slate-900">{selectedProject.assignedBuilder}</p>
                            )}
                          </div>
                        </div>
                        <Select
                          value={selectedProject.assignedBuilder}
                          onValueChange={(builderName) => assignBuilder(selectedProject.id, builderName)}
                        >
                          <SelectTrigger className="w-full sm:w-48 h-10">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {builders.map(builder => (
                              <SelectItem key={builder.id} value={builder.name}>
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-3 h-3 rounded"
                                    style={{ backgroundColor: builder.color }}
                                  ></div>
                                  {builder.name}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {user.role !== 'customer' && (
                  <Card className="bg-blue-50 border-blue-200">
                    <CardContent className="pt-3 sm:pt-4 p-3 sm:p-6">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <Label className="text-slate-700 font-semibold text-xs sm:text-sm">Customer auto updates</Label>
                          <p className="text-xs sm:text-sm text-slate-600">
                            Foreman updates are automatically relayed to the customer via WhatsApp/email.
                          </p>
                        </div>
                        <Switch
                          checked={Boolean(selectedProject.customerAutoUpdates)}
                          onCheckedChange={(checked) => toggleCustomerAutoUpdates(selectedProject.id, checked)}
                        />
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Project Status and Progress for Customers - Mobile Responsive */}
                {user.role === 'customer' && (
                  <Card className="bg-blue-50 border-blue-200">
                    <CardContent className="pt-3 sm:pt-4 p-3 sm:p-6">
                      <div>
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 mb-4">
                          <div className="flex-1">
                            <Label className="text-slate-700 font-semibold text-sm sm:text-lg">Project Status</Label>
                            <p className="text-xl sm:text-2xl font-bold text-blue-600 mt-1 capitalize">
                              {selectedProject.status.replace('_', ' ')}
                            </p>
                          </div>
                          <div className="text-left sm:text-right w-full sm:w-auto">
                            <Label className="text-slate-700 font-semibold text-xs sm:text-sm">Progress</Label>
                            <p className="text-2xl sm:text-3xl font-bold text-blue-600">
                              {(() => {
                                const start = new Date(selectedProject.startDate);
                                const end = new Date(selectedProject.finishDate);
                                const today = new Date();
                                const total = end.getTime() - start.getTime();
                                const elapsed = today.getTime() - start.getTime();
                                const progress = Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
                                return progress;
                              })()}%
                            </p>
                          </div>
                        </div>
                        <div className="w-full h-2.5 sm:h-3 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500"
                            style={{
                              width: `${(() => {
                                const start = new Date(selectedProject.startDate);
                                const end = new Date(selectedProject.finishDate);
                                const today = new Date();
                                const total = end.getTime() - start.getTime();
                                const elapsed = today.getTime() - start.getTime();
                                return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
                              })()}%`
                            }}
                          ></div>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-600 mt-3 text-center">
                          Our team is working on your bathroom renovation
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div>
                  <Label className="text-slate-600 text-xs sm:text-sm">Description</Label>
                  <p className="text-slate-900 mt-1 text-sm sm:text-base break-words">{selectedProject.description}</p>
                </div>

                {selectedProject.photos.length > 0 && (
                  <div>
                    <Label className="text-slate-600 mb-2 block text-xs sm:text-sm">Progress Photos</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {selectedProject.photos.map((photo, idx) => (
                        <div key={idx} className="aspect-square bg-slate-200 rounded-lg flex flex-col items-center justify-center p-2">
                          <Camera className="w-6 h-6 sm:w-8 sm:h-8 text-slate-400" />
                          <span className="mt-1 text-[10px] sm:text-xs text-slate-600 text-center break-words">{photo}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="design" className="space-y-3 sm:space-y-4 mt-0">
                {selectedProject.designItems.length === 0 ? (
                  <p className="text-center text-slate-500 py-8 text-sm sm:text-base">No design items specified</p>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:gap-4">
                    {selectedProject.designItems.map(item => (
                      <Card key={item.id}>
                        <CardHeader className="p-3 sm:p-6">
                          <CardTitle className="text-sm sm:text-base flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                            <span className="break-words">{item.name}</span>
                            <Badge variant="outline" className="capitalize text-xs">{item.category}</Badge>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 p-3 sm:p-6 pt-0 sm:pt-0">
                          {item.photo && (
                            <div className="aspect-video bg-slate-200 rounded-lg flex flex-col items-center justify-center p-2">
                              <ImageIcon className="w-6 h-6 sm:w-8 sm:h-8 text-slate-400" />
                              <span className="mt-1 text-[10px] sm:text-xs text-slate-600 text-center break-words">{item.photo}</span>
                            </div>
                          )}
                          <p className="text-xs sm:text-sm text-slate-600 break-words">{item.description}</p>
                          {item.supplier && (
                            <p className="text-[10px] sm:text-xs text-slate-500">Supplier: {item.supplier}</p>
                          )}
                          {user.role !== 'customer' && item.cost && (
                            <p className="text-sm font-medium text-slate-900">Cost: £{item.cost}</p>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="messages" className="mt-0 h-full flex flex-col">
                <div className="flex flex-col h-full">
                  {/* Conversation Participants */}
                  <div className="mb-3 p-3 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg border-2 border-blue-200">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-blue-600" />
                        <p className="text-xs sm:text-sm font-semibold text-blue-900">Active Conversation</p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1 px-2 py-1 bg-white rounded-full border border-blue-300">
                          <div className="w-2 h-2 rounded-full bg-green-500"></div>
                          <span className="text-xs font-medium text-slate-700">{selectedProject.customerName}</span>
                        </div>
                        {selectedProject.assignedBuilder && (
                          <div className="flex items-center gap-1 px-2 py-1 bg-white rounded-full border border-blue-300">
                            <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                            <span className="text-xs font-medium text-slate-700">{selectedProject.assignedBuilder}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1 px-2 py-1 bg-white rounded-full border border-blue-300">
                          <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                          <span className="text-xs font-medium text-slate-700">Office Team</span>
                        </div>
                      </div>
                    </div>
                    {user.role === 'customer' && (
                      <p className="text-xs text-blue-800 mt-2">
                        💬 Direct line to your project team • Messages sent via email • Response within 4 hours
                      </p>
                    )}
                  </div>

                  <div className="flex-1 bg-slate-50 rounded-lg p-2 sm:p-3 overflow-y-auto space-y-2 mb-3">
                    {selectedProject.messages.map(msg => {
                      const isMyMessage = msg.from === user.name;
                      return (
                      <div key={msg.id} className={`flex ${isMyMessage ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] sm:max-w-md rounded-lg p-2 sm:p-3 ${
                          isMyMessage
                            ? 'bg-amber-500 text-white shadow-lg'
                            : msg.fromRole === 'office' || msg.fromRole === 'admin'
                            ? 'bg-blue-100 text-blue-900 border-2 border-blue-300'
                            : msg.fromRole === 'builder'
                            ? 'bg-amber-100 text-amber-900 border-2 border-amber-300'
                            : 'bg-white text-slate-900 border-2 border-slate-300'
                        }`}>
                          <div className="flex items-center gap-1.5 sm:gap-2 mb-1 flex-wrap">
                            <p className="text-[10px] sm:text-xs font-bold">{msg.from}</p>
                            <Badge variant="secondary" className="text-[8px] sm:text-xs h-4 sm:h-5">
                              {msg.fromRole === 'office' || msg.fromRole === 'admin' ? '🏢 Office' :
                               msg.fromRole === 'builder' ? '👷 Builder' : '👤 Customer'}
                            </Badge>
                            {msg.emailSent && <Badge variant="secondary" className="text-[8px] sm:text-xs h-4 sm:h-5">📧 Emailed</Badge>}
                            {msg.channel && msg.channel !== 'app' && (
                              <Badge variant="secondary" className="text-[8px] sm:text-xs h-4 sm:h-5">
                                {msg.channel === 'whatsapp' ? 'WhatsApp' : msg.channel}
                              </Badge>
                            )}
                            {msg.senderContactName && msg.senderContactName !== msg.from && (
                              <Badge variant="outline" className="text-[8px] sm:text-xs h-4 sm:h-5">
                                {msg.senderContactName}{msg.senderContactRole ? ` (${msg.senderContactRole})` : ''}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs sm:text-sm break-words whitespace-pre-wrap">{msg.message}</p>

                          {/* Attachments */}
                          {msg.attachments && msg.attachments.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {msg.attachments.map((attachment, idx) => (
                                <div key={idx} className={`flex items-center gap-2 p-2 rounded ${
                                  isMyMessage ? 'bg-amber-600' : 'bg-white'
                                }`}>
                                  <Camera className="w-4 h-4 flex-shrink-0" />
                                  <span className="text-xs truncate">{attachment}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          <p className="text-[10px] sm:text-xs mt-1 opacity-75">
                            {new Date(msg.timestamp).toLocaleDateString('en-GB', {
                              day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                            })}
                          </p>
                        </div>
                      </div>
                      );
                    })}
                  </div>

                  {/* Attachments Preview */}
                  {attachments.length > 0 && (
                    <div className="mb-2 p-2 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-xs font-semibold text-blue-900 mb-2">Attachments ({attachments.length}):</p>
                      <div className="space-y-1">
                        {attachments.map((file, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 bg-white rounded">
                            <div className="flex items-center gap-2">
                              <Camera className="w-4 h-4 text-blue-600" />
                              <span className="text-xs text-slate-700">{file.name}</span>
                            </div>
                            <button onClick={() => removeAttachment(idx)} className="text-red-600 hover:text-red-800">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <div className="flex gap-2">
                      <Textarea
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type your message... (visible to all parties)"
                        rows={2}
                        className="flex-1 text-sm sm:text-base"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            sendMessage();
                          }
                        }}
                      />
                      <div className="flex flex-col gap-2">
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileUpload}
                          multiple
                          accept="image/*,video/*,.pdf,.doc,.docx"
                          className="hidden"
                        />
                        <Button
                          onClick={() => fileInputRef.current?.click()}
                          variant="outline"
                          className="h-auto px-3 sm:px-4 aspect-square"
                          title="Attach files"
                        >
                          <Camera className="w-4 h-4 sm:w-5 sm:h-5" />
                        </Button>
                        <Button
                          onClick={sendMessage}
                          disabled={(!newMessage.trim() && attachments.length === 0) || isSendingMessage}
                          className="h-auto px-3 sm:px-4 aspect-square"
                        >
                          {isSendingMessage ? (
                            <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Send className="w-4 h-4 sm:w-5 sm:h-5" />
                          )}
                        </Button>
                      </div>
                    </div>
                    {user.role === 'customer' && (
                      <p className="text-xs text-slate-600 px-1">
                        💡 Your message will be sent to your builder and our office team via email
                      </p>
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* Customer Payment Stages Tab - Shown to ALL users - Mobile Responsive */}
              <TabsContent value="payments" className="space-y-3 sm:space-y-4 mt-0">
                <Card>
                  <CardHeader className="p-4 sm:p-6">
                    <CardTitle className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                      <span className="text-base sm:text-lg">Payment Schedule</span>
                      <Badge variant="secondary" className="text-xs sm:text-sm">
                        Total: £{selectedProject.totalCustomerCost.toLocaleString()}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
                    {selectedProject.paymentStages.length === 0 ? (
                      <p className="text-center text-slate-500 py-8 text-sm sm:text-base">No payment stages configured</p>
                    ) : (
                      <div className="space-y-3 sm:space-y-4">
                        {selectedProject.paymentStages.map((stage, idx) => (
                          <Card key={stage.id} className={`${
                            stage.status === 'paid' ? 'bg-green-50 border-green-200' :
                            stage.status === 'due' ? 'bg-amber-50 border-amber-200' :
                            'bg-slate-50 border-slate-200'
                          }`}>
                            <CardContent className="pt-3 sm:pt-4 p-3 sm:p-6">
                              <div className="flex flex-col sm:flex-row items-start justify-between gap-3 mb-3">
                                <div className="flex items-start gap-2 sm:gap-3 w-full">
                                  <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-base sm:text-lg flex-shrink-0 ${
                                    stage.status === 'paid' ? 'bg-green-500 text-white' :
                                    stage.status === 'due' ? 'bg-amber-500 text-white' :
                                    'bg-slate-300 text-slate-600'
                                  }`}>
                                    {idx + 1}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <h3 className="font-bold text-sm sm:text-lg text-slate-900 break-words">{stage.name}</h3>
                                    <p className="text-xs sm:text-sm text-slate-600 mt-1 break-words">{stage.description}</p>
                                  </div>
                                </div>
                                <div className="text-left sm:text-right w-full sm:w-auto flex-shrink-0">
                                  <p className="text-xl sm:text-2xl font-bold text-slate-900">£{stage.amount.toLocaleString()}</p>
                                  <p className="text-xs sm:text-sm text-slate-600">{stage.percentage}% of total</p>
                                </div>
                              </div>

                              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-3 border-t border-slate-200">
                                <div className="flex-1">
                                  {stage.status === 'paid' && stage.paidDate && (
                                    <p className="text-xs sm:text-sm text-green-700 font-medium flex items-center gap-1.5 sm:gap-2">
                                      <CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                                      <span className="break-words">Paid on {new Date(stage.paidDate).toLocaleDateString('en-GB', {
                                        day: 'numeric', month: 'long', year: 'numeric'
                                      })}</span>
                                    </p>
                                  )}
                                  {stage.status === 'due' && stage.dueDate && (
                                    <p className="text-xs sm:text-sm text-amber-700 font-medium flex items-center gap-1.5 sm:gap-2">
                                      <AlertCircle className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                                      <span className="break-words">Due: {new Date(stage.dueDate).toLocaleDateString('en-GB', {
                                        day: 'numeric', month: 'long', year: 'numeric'
                                      })}</span>
                                    </p>
                                  )}
                                  {stage.status === 'pending' && stage.dueDate && (
                                    <p className="text-xs sm:text-sm text-slate-600 flex items-center gap-1.5 sm:gap-2">
                                      <Clock className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                                      <span className="break-words">Due: {new Date(stage.dueDate).toLocaleDateString('en-GB', {
                                        day: 'numeric', month: 'long', year: 'numeric'
                                      })}</span>
                                    </p>
                                  )}
                                </div>
                                <Badge variant={
                                  stage.status === 'paid' ? 'default' :
                                  stage.status === 'due' ? 'secondary' : 'outline'
                                } className="capitalize text-xs sm:text-sm">
                                  {stage.status}
                                </Badge>
                              </div>

                              {stage.status === 'due' && user.role === 'customer' && (
                                <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-amber-200">
                                  <Button className="w-full bg-amber-600 hover:bg-amber-700 h-11 sm:h-10 text-sm sm:text-base touch-manipulation">
                                    Pay Now - £{stage.amount.toLocaleString()}
                                  </Button>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Customer Invoices Tab - Customer Only */}
              {user.role === 'customer' && (
                <TabsContent value="invoices" className="space-y-3 sm:space-y-4 mt-0">
                  <Card>
                    <CardHeader className="p-4 sm:p-6">
                      <CardTitle className="text-base sm:text-lg">Your Invoices</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 sm:p-6 pt-0">
                      {selectedProject.invoices.filter(inv => inv.type === 'customer').length === 0 ? (
                        <p className="text-center text-slate-500 py-8 text-sm">No invoices yet</p>
                      ) : (
                        <div className="space-y-3">
                          {selectedProject.invoices.filter(inv => inv.type === 'customer').map(invoice => (
                            <Card key={invoice.id} className={`${
                              invoice.status === 'paid' ? 'bg-green-50 border-green-200' :
                              invoice.status === 'sent' ? 'bg-blue-50 border-blue-200' :
                              'bg-slate-50 border-slate-200'
                            }`}>
                              <CardContent className="p-3 sm:p-4">
                                <div className="flex flex-col sm:flex-row justify-between gap-3">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                      <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600" />
                                      <h3 className="font-bold text-base sm:text-lg">Invoice #{invoice.id}</h3>
                                    </div>
                                    <div className="space-y-1 text-xs sm:text-sm text-slate-600">
                                      <p>Issued: {new Date(invoice.issueDate).toLocaleDateString('en-GB', {
                                        day: 'numeric', month: 'long', year: 'numeric'
                                      })}</p>
                                      <p>Due: {new Date(invoice.dueDate).toLocaleDateString('en-GB', {
                                        day: 'numeric', month: 'long', year: 'numeric'
                                      })}</p>
                                      {invoice.paidDate && (
                                        <p className="text-green-700 font-medium flex items-center gap-1">
                                          <CheckCircle2 className="w-3 h-3" />
                                          Paid: {new Date(invoice.paidDate).toLocaleDateString('en-GB', {
                                            day: 'numeric', month: 'long', year: 'numeric'
                                          })}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  <div className="text-left sm:text-right flex flex-col justify-between gap-2">
                                    <div>
                                      <p className="text-2xl sm:text-3xl font-bold text-slate-900">£{invoice.amount.toLocaleString()}</p>
                                      <Badge variant={
                                        invoice.status === 'paid' ? 'default' :
                                        invoice.status === 'sent' ? 'secondary' : 'outline'
                                      } className="capitalize mt-1 text-xs">
                                        {invoice.status}
                                      </Badge>
                                    </div>
                                    <Button variant="outline" size="sm" className="w-full sm:w-auto touch-manipulation">
                                      <Eye className="w-4 h-4 mr-2" />
                                      View Invoice
                                    </Button>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Payment Summary for Customer */}
                  <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                    <CardHeader className="p-4 sm:p-6">
                      <CardTitle className="text-base sm:text-lg text-blue-900">Payment Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 sm:p-6 pt-0">
                      <div className="grid grid-cols-2 gap-3 sm:gap-4">
                        <div className="bg-white/60 rounded-lg p-3 sm:p-4">
                          <p className="text-xs sm:text-sm text-slate-600 mb-1">Total Cost</p>
                          <p className="text-xl sm:text-2xl font-bold text-slate-900">£{selectedProject.totalCustomerCost.toLocaleString()}</p>
                        </div>
                        <div className="bg-white/60 rounded-lg p-3 sm:p-4">
                          <p className="text-xs sm:text-sm text-slate-600 mb-1">Paid So Far</p>
                          <p className="text-xl sm:text-2xl font-bold text-green-600">
                            £{selectedProject.paymentStages
                              .filter(s => s.status === 'paid')
                              .reduce((sum, s) => sum + s.amount, 0)
                              .toLocaleString()}
                          </p>
                        </div>
                        <div className="bg-white/60 rounded-lg p-3 sm:p-4">
                          <p className="text-xs sm:text-sm text-slate-600 mb-1">Outstanding</p>
                          <p className="text-xl sm:text-2xl font-bold text-amber-600">
                            £{selectedProject.paymentStages
                              .filter(s => s.status !== 'paid')
                              .reduce((sum, s) => sum + s.amount, 0)
                              .toLocaleString()}
                          </p>
                        </div>
                        <div className="bg-white/60 rounded-lg p-3 sm:p-4">
                          <p className="text-xs sm:text-sm text-slate-600 mb-1">Payment Progress</p>
                          <p className="text-xl sm:text-2xl font-bold text-blue-600">
                            {Math.round((selectedProject.paymentStages
                              .filter(s => s.status === 'paid')
                              .reduce((sum, s) => sum + s.amount, 0) / selectedProject.totalCustomerCost) * 100)}%
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              )}

              {/* Builder Payment Tab - Staff/Admin Only */}
              {user.role !== 'customer' && (
                <TabsContent value="builder-payment" className="space-y-3 sm:space-y-4 mt-0">
                  {selectedProject.builderPayments.map(payment => (
                    <Card key={payment.builderId}>
                      <CardHeader>
                        <CardTitle className="text-lg">Builder Payment</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-slate-600">Builder</Label>
                            <p className="font-medium">{payment.builderName}</p>
                          </div>
                          <div>
                            <Label className="text-slate-600">Payment Type</Label>
                            <Badge className="capitalize">
                              {payment.paymentType.replace('_', ' ')}
                            </Badge>
                          </div>
                          {payment.paymentType === 'price_work' ? (
                            <>
                              <div>
                                <Label className="text-slate-600">Agreed Amount</Label>
                                <p className="text-xl font-bold text-slate-900">£{payment.agreedAmount}</p>
                              </div>
                              <div>
                                <Label className="text-slate-600">Earned So Far</Label>
                                <p className="text-xl font-bold text-green-600">£{payment.totalEarned}</p>
                              </div>
                            </>
                          ) : (
                            <>
                              <div>
                                <Label className="text-slate-600">Day Rate</Label>
                                <p className="text-xl font-bold text-slate-900">£{payment.dayRate}/day</p>
                              </div>
                              <div>
                                <Label className="text-slate-600">Days Worked</Label>
                                <p className="text-xl font-bold text-slate-900">{payment.daysWorked || 0} days</p>
                              </div>
                              <div>
                                <Label className="text-slate-600">Total Earned</Label>
                                <p className="text-xl font-bold text-green-600">£{payment.totalEarned}</p>
                              </div>
                            </>
                          )}
                          <div>
                            <Label className="text-slate-600">Status</Label>
                            <Badge variant={
                              payment.status === 'paid' ? 'default' :
                              payment.status === 'approved' ? 'secondary' : 'outline'
                            }>
                              {payment.status}
                            </Badge>
                          </div>
                        </div>

                        {user.role === 'super_admin' && (
                          <div className="flex gap-2 pt-4 border-t">
                            <Button variant="outline" size="sm">Edit Payment</Button>
                            <Button size="sm">Approve Payment</Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}

                  {user.role === 'super_admin' && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Customer Invoices</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {selectedProject.invoices.length === 0 ? (
                          <p className="text-slate-500 text-sm">No invoices yet</p>
                        ) : (
                          <div className="space-y-2">
                            {selectedProject.invoices.map(invoice => (
                              <div key={invoice.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                                <div>
                                  <p className="font-medium">Invoice #{invoice.id}</p>
                                  <p className="text-sm text-slate-600">
                                    Issued: {new Date(invoice.issueDate).toLocaleDateString('en-GB')}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="font-bold text-lg">£{invoice.amount}</p>
                                  <Badge variant={invoice.status === 'paid' ? 'default' : 'secondary'}>
                                    {invoice.status}
                                  </Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              )}

              {user.role !== 'customer' && selectedProject && (
                <>
                  <TabsContent value="plan" className="space-y-3 mt-0 p-2 sm:p-4">
                    <ProjectPlanTab
                      project={selectedProject as unknown as UnifiedProject}
                      onUpdate={refreshProject}
                      createdBy={user.name}
                    />
                  </TabsContent>
                  <TabsContent value="photos" className="space-y-3 mt-0 p-2 sm:p-4">
                    <ProjectPhotosTab
                      project={selectedProject as unknown as UnifiedProject}
                      uploadedBy={user.name}
                      userRole={user.role}
                      onUpdate={refreshProject}
                    />
                  </TabsContent>
                  <TabsContent value="documents" className="space-y-3 mt-0 p-2 sm:p-4">
                    <ProjectDocumentsTab
                      project={selectedProject as unknown as UnifiedProject}
                      customerPhone={customers.find(c => c.id === selectedProject.customerId)?.phone}
                      customerWhatsappOptIn={customers.find(c => c.id === selectedProject.customerId)?.whatsappOptIn}
                      onUpdate={refreshProject}
                    />
                  </TabsContent>
                  <TabsContent value="ai" className="space-y-3 mt-0 p-2 sm:p-4">
                    <ProjectAIPanel
                      project={selectedProject as unknown as UnifiedProject}
                      userName={user.name}
                      onUpdate={refreshProject}
                    />
                  </TabsContent>
                  <TabsContent value="comms" className="space-y-3 mt-0 p-2 sm:p-4">
                    <ProjectCommsPanel
                      project={selectedProject as unknown as UnifiedProject}
                      contacts={getContactsForCustomer(selectedProject.customerId)}
                      onUpdate={refreshProject}
                    />
                  </TabsContent>
                  <TabsContent value="snagging" className="space-y-3 mt-0 p-2 sm:p-4">
                    <ProjectSnaggingTab
                      project={selectedProject as unknown as UnifiedProject}
                      onUpdate={refreshProject}
                    />
                  </TabsContent>
                  <TabsContent value="team" className="space-y-3 mt-0 p-2 sm:p-4">
                    <ProjectTeamTab
                      project={selectedProject as unknown as UnifiedProject}
                      onUpdate={refreshProject}
                    />
                  </TabsContent>
                </>
              )}
                    </div>
                  </Tabs>
                </div>
              </>
            ) : (
              <div className="hidden lg:flex flex-col items-center justify-center h-full p-8 text-center bg-slate-50">
                <FolderKanban className="w-16 h-16 text-slate-300 mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 mb-2">No Project Selected</h3>
                <p className="text-sm text-slate-600">
                  Click on a project from the calendar or list to view details
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
