import { useState, useContext } from 'react';
import { AppContext } from '../App';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  CheckCircle2, Circle, Clock, DollarSign, Calendar,
  Plus, Trash2, Edit2, Save, X, User, AlertCircle, Camera, Upload, Video
} from 'lucide-react';

export interface PaymentStage {
  id: string;
  name: string;
  percentage: number;
  amount: number;
  status: 'pending' | 'ready' | 'released' | 'completed';
  dueDate?: string;
  paidDate?: string;
  notes: string;
}

export interface ProjectTask {
  id: string;
  title: string;
  description: string;
  assignedTo: string;
  status: 'todo' | 'in_progress' | 'completed';
  linkedStage?: string;
  createdAt: string;
  completedAt?: string;
  priority: 'low' | 'medium' | 'high';
  photos: string[];
  videos: string[];
  createdBy: string;
}

export interface Project {
  id: string;
  customerId: string;
  customerName: string;
  address: string;
  totalAmount: number;
  paymentType: 'finance' | 'self_pay';
  paymentStages: PaymentStage[];
  tasks: ProjectTask[];
  startDate: string;
  estimatedEndDate: string;
  actualEndDate?: string;
  status: 'planning' | 'in_progress' | 'completed' | 'on_hold';
  assignedBuilder?: string;
}

export default function ProjectManagement() {
  const context = useContext(AppContext);
  if (!context) return null;

  const { user, customers } = context;

  const [projects, setProjects] = useState<Project[]>([
    {
      id: '1',
      customerId: '3',
      customerName: 'Emma Clarke',
      address: '156 High Street, Birmingham, B4 7SL',
      totalAmount: 7225,
      paymentType: 'self_pay',
      paymentStages: [
        { id: 's1', name: 'Booking Deposit', percentage: 10, amount: 722.50, status: 'completed', paidDate: '2026-04-10', notes: 'Initial booking secured' },
        { id: 's2', name: 'Project Start', percentage: 40, amount: 2890, status: 'ready', dueDate: '2026-05-15', notes: 'Release when work begins' },
        { id: 's3', name: 'Mid-point Progress', percentage: 30, amount: 2167.50, status: 'pending', dueDate: '2026-05-22', notes: 'Release at 50% completion' },
        { id: 's4', name: 'Final Completion', percentage: 20, amount: 1445, status: 'pending', dueDate: '2026-05-29', notes: 'Release on job completion' }
      ],
      tasks: [
        { id: 't1', title: 'Remove old bathroom suite', description: 'Strip out existing toilet, basin, shower', assignedTo: 'Mike Wilson', status: 'completed', linkedStage: 's2', createdAt: '2026-04-10', completedAt: '2026-04-15', priority: 'high', photos: [], videos: [], createdBy: 'John Smith' },
        { id: 't2', title: 'Install waterproofing', description: 'Apply tanking system to walls and floor', assignedTo: 'Mike Wilson', status: 'in_progress', linkedStage: 's2', createdAt: '2026-04-10', priority: 'high', photos: [], videos: [], createdBy: 'John Smith' },
        { id: 't3', title: 'Apply microcement finish', description: 'White microcement on walls and floor', assignedTo: 'Mike Wilson', status: 'todo', linkedStage: 's3', createdAt: '2026-04-10', priority: 'medium', photos: [], videos: [], createdBy: 'John Smith' },
        { id: 't4', title: 'Install second fix items', description: 'Fit toilet, basin, shower screen', assignedTo: 'Mike Wilson', status: 'todo', linkedStage: 's4', createdAt: '2026-04-10', priority: 'medium', photos: [], videos: [], createdBy: 'Emma Clarke' }
      ],
      startDate: '2026-05-15',
      estimatedEndDate: '2026-05-29',
      status: 'in_progress',
      assignedBuilder: 'Mike Wilson'
    },
    {
      id: '2',
      customerId: '10',
      customerName: 'Daniel White',
      address: '78 Hill View, Sheffield, S10 3GE',
      totalAmount: 15800,
      paymentType: 'self_pay',
      paymentStages: [
        { id: 's5', name: 'Booking Deposit', percentage: 10, amount: 1580, status: 'completed', paidDate: '2026-04-08', notes: 'Deposit received' },
        { id: 's6', name: 'Project Start', percentage: 40, amount: 6320, status: 'pending', dueDate: '2026-05-20', notes: 'Release on start date' },
        { id: 's7', name: 'Mid-point Progress', percentage: 30, amount: 4740, status: 'pending', dueDate: '2026-06-05', notes: 'Release at halfway point' },
        { id: 's8', name: 'Final Completion', percentage: 20, amount: 3160, status: 'pending', dueDate: '2026-06-20', notes: 'Final payment on completion' }
      ],
      tasks: [
        { id: 't5', title: 'Plan bathroom layout', description: 'Finalize design and measurements', assignedTo: 'John Smith', status: 'completed', createdAt: '2026-04-08', completedAt: '2026-04-12', priority: 'high', photos: [], videos: [], createdBy: 'Sarah Johnson' },
        { id: 't6', title: 'Order materials', description: 'Purchase all fixtures and finishes', assignedTo: 'John Smith', status: 'in_progress', createdAt: '2026-04-08', priority: 'high', photos: [], videos: [], createdBy: 'Sarah Johnson' }
      ],
      startDate: '2026-05-20',
      estimatedEndDate: '2026-06-20',
      status: 'planning',
      assignedBuilder: 'John Smith'
    }
  ]);

  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [newTask, setNewTask] = useState({ title: '', description: '', priority: 'medium' as const });
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const updateTaskStatus = (projectId: string, taskId: string, status: ProjectTask['status']) => {
    if (isLoading) return;
    setIsLoading(true);

    setTimeout(() => {
      setProjects(projects.map(project => {
        if (project.id === projectId) {
          return {
            ...project,
            tasks: project.tasks.map(task =>
              task.id === taskId
                ? {
                    ...task,
                    status,
                    completedAt: status === 'completed' ? new Date().toISOString() : undefined
                  }
                : task
            )
          };
        }
        return project;
      }));
      setIsLoading(false);
    }, 300);
  };

  const releasePayment = (projectId: string, stageId: string) => {
    if (isLoading) return;
    setIsLoading(true);

    setTimeout(() => {
      setProjects(projects.map(project => {
        if (project.id === projectId) {
          return {
            ...project,
            paymentStages: project.paymentStages.map(stage =>
              stage.id === stageId
                ? { ...stage, status: 'released' as const, paidDate: new Date().toISOString().split('T')[0] }
                : stage
            )
          };
        }
        return project;
      }));
      setIsLoading(false);
    }, 300);
  };

  const addTask = (projectId: string) => {
    if (!newTask.title.trim() || isLoading) return;
    setIsLoading(true);

    const task: ProjectTask = {
      id: Date.now().toString(),
      title: newTask.title,
      description: newTask.description,
      assignedTo: user.role === 'builder' ? user.name : 'Mike Wilson',
      status: 'todo',
      createdAt: new Date().toISOString(),
      priority: newTask.priority,
      photos: [],
      videos: [],
      createdBy: user.name
    };

    setTimeout(() => {
      setProjects(projects.map(p =>
        p.id === projectId
          ? { ...p, tasks: [...p.tasks, task] }
          : p
      ));

      setNewTask({ title: '', description: '', priority: 'medium' });
      setShowTaskForm(false);
      setIsLoading(false);
    }, 300);
  };

  const addPhotoToTask = (projectId: string, taskId: string, photo: string) => {
    if (isLoading) return;
    setIsLoading(true);

    setTimeout(() => {
      setProjects(projects.map(project => {
        if (project.id === projectId) {
          return {
            ...project,
            tasks: project.tasks.map(task =>
              task.id === taskId
                ? { ...task, photos: [...task.photos, photo] }
                : task
            )
          };
        }
        return project;
      }));
      setIsLoading(false);
    }, 300);
  };

  const addVideoToTask = (projectId: string, taskId: string, video: string) => {
    if (isLoading) return;
    setIsLoading(true);

    setTimeout(() => {
      setProjects(projects.map(project => {
        if (project.id === projectId) {
          return {
            ...project,
            tasks: project.tasks.map(task =>
              task.id === taskId
                ? { ...task, videos: [...task.videos, video] }
                : task
            )
          };
        }
        return project;
      }));
      setIsLoading(false);
    }, 300);
  };

  const deleteTask = (projectId: string, taskId: string) => {
    if (isLoading) return;
    setIsLoading(true);

    setTimeout(() => {
      setProjects(projects.map(p =>
        p.id === projectId
          ? { ...p, tasks: p.tasks.filter(t => t.id !== taskId) }
          : p
      ));
      setIsLoading(false);
    }, 300);
  };

  const getStageStatusColor = (status: PaymentStage['status']) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-700 border-green-300';
      case 'released': return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'ready': return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      default: return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const getTaskStatusIcon = (status: ProjectTask['status']) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case 'in_progress': return <Clock className="w-5 h-5 text-blue-600" />;
      default: return <Circle className="w-5 h-5 text-gray-400" />;
    }
  };

  const getPriorityColor = (priority: ProjectTask['priority']) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-700';
      case 'medium': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-8 bg-gradient-to-r from-slate-900 to-slate-800 p-8 rounded-3xl shadow-2xl">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-400 to-amber-200 bg-clip-text text-transparent">
            {user.role === 'customer' ? 'My Project' : 'Project Management'}
          </h1>
          <p className="text-amber-100 mt-2 text-lg">
            {user.role === 'customer'
              ? 'View your project progress and add requests'
              : user.role === 'builder'
              ? 'Your jobs and tasks'
              : 'Track jobs, payments, and tasks'}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Active Projects</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {projects.map(project => (
                  <div
                    key={project.id}
                    onClick={() => setSelectedProject(project)}
                    className={`p-4 rounded-xl cursor-pointer transition-all ${
                      selectedProject?.id === project.id
                        ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-lg'
                        : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    <h3 className="font-bold text-lg mb-1">{project.customerName}</h3>
                    <p className={`text-sm mb-2 ${selectedProject?.id === project.id ? 'text-amber-100' : 'text-gray-600'}`}>
                      {project.address}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        selectedProject?.id === project.id
                          ? 'bg-white/20'
                          : project.status === 'in_progress'
                          ? 'bg-blue-100 text-blue-700'
                          : project.status === 'planning'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {project.status.replace('_', ' ')}
                      </span>
                      {(user.role !== 'builder' && user.role !== 'customer') && (
                        <span className={`font-bold ${selectedProject?.id === project.id ? 'text-white' : 'text-gray-900'}`}>
                          £{project.totalAmount.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {selectedProject && (
            <>
              {(user.role !== 'builder' && user.role !== 'customer') && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Payment Stages</CardTitle>
                    <DollarSign className="w-6 h-6 text-green-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {selectedProject.paymentStages.map(stage => (
                        <div
                          key={stage.id}
                          className={`p-4 rounded-xl border-2 ${getStageStatusColor(stage.status)}`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-bold">{stage.name}</h4>
                            <span className="font-bold text-lg">£{stage.amount.toLocaleString()}</span>
                          </div>
                          <div className="text-sm mb-2">
                            <p>{stage.percentage}% of total</p>
                            <p className="text-xs mt-1">{stage.notes}</p>
                          </div>
                        {stage.status === 'ready' && user.role === 'super_admin' && (
                          <Button
                            onClick={() => releasePayment(selectedProject.id, stage.id)}
                            disabled={isLoading}
                            className="w-full mt-2 bg-green-600 hover:bg-green-700 disabled:opacity-50"
                            size="sm"
                          >
                            {isLoading ? 'Processing...' : 'Release Payment'}
                          </Button>
                        )}
                        {stage.paidDate && (
                          <p className="text-xs mt-2">
                            <Calendar className="w-3 h-3 inline mr-1" />
                            Paid: {stage.paidDate}
                          </p>
                        )}
                        {stage.dueDate && stage.status === 'pending' && (
                          <p className="text-xs mt-2">
                            <AlertCircle className="w-3 h-3 inline mr-1" />
                            Due: {stage.dueDate}
                          </p>
                        )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {(user.role === 'builder' || user.role === 'customer') && (
                <Card>
                  <CardHeader>
                    <CardTitle>Project Progress</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {selectedProject.paymentStages.map(stage => (
                        <div
                          key={stage.id}
                          className={`p-4 rounded-xl border-2 ${getStageStatusColor(stage.status)}`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-bold">{stage.name}</h4>
                            <span className={`text-xs px-3 py-1 rounded-full font-bold ${
                              stage.status === 'completed' ? 'bg-green-600 text-white' :
                              stage.status === 'released' ? 'bg-blue-600 text-white' :
                              stage.status === 'ready' ? 'bg-yellow-600 text-white' :
                              'bg-gray-400 text-white'
                            }`}>
                              {stage.status}
                            </span>
                          </div>
                          <div className="text-sm mb-2">
                            <p className="text-xs mt-1">{stage.notes}</p>
                          </div>
                          {stage.paidDate && (
                            <p className="text-xs mt-2 text-green-700 font-bold">
                              <CheckCircle2 className="w-3 h-3 inline mr-1" />
                              Completed: {stage.paidDate}
                            </p>
                          )}
                          {stage.dueDate && stage.status === 'pending' && (
                            <p className="text-xs mt-2">
                              <AlertCircle className="w-3 h-3 inline mr-1" />
                              Target: {stage.dueDate}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Tasks & To-Do</CardTitle>
                  <Button
                    onClick={() => setShowTaskForm(!showTaskForm)}
                    size="sm"
                    className="bg-amber-500 hover:bg-amber-600"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </CardHeader>
                <CardContent>
                  {showTaskForm && (
                    <div className="mb-4 p-4 bg-blue-50 rounded-xl">
                      <Label className="mb-2 block">Task Title</Label>
                      <Input
                        value={newTask.title}
                        onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                        placeholder="e.g., Install shower screen"
                        className="mb-3"
                      />
                      <Label className="mb-2 block">Description</Label>
                      <Input
                        value={newTask.description}
                        onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                        placeholder="Task details..."
                        className="mb-3"
                      />
                      <Label className="mb-2 block">Priority</Label>
                      <select
                        value={newTask.priority}
                        onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as any })}
                        className="w-full h-10 px-3 mb-3 border border-gray-300 rounded-lg"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => addTask(selectedProject.id)}
                          disabled={isLoading}
                          className="bg-green-600 hover:bg-green-700 disabled:opacity-50"
                        >
                          <Save className="w-4 h-4 mr-2" /> {isLoading ? 'Saving...' : 'Save'}
                        </Button>
                        <Button
                          onClick={() => setShowTaskForm(false)}
                          disabled={isLoading}
                          className="bg-gray-500 hover:bg-gray-600 disabled:opacity-50"
                        >
                          <X className="w-4 h-4 mr-2" /> Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    {selectedProject.tasks.map(task => (
                      <div
                        key={task.id}
                        className={`p-3 rounded-xl border-2 ${
                          task.status === 'completed'
                            ? 'bg-green-50 border-green-200'
                            : task.status === 'in_progress'
                            ? 'bg-blue-50 border-blue-200'
                            : 'bg-gray-50 border-gray-200'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-start gap-2 flex-1">
                            {getTaskStatusIcon(task.status)}
                            <div className="flex-1">
                              <h4 className={`font-bold ${task.status === 'completed' ? 'line-through text-gray-500' : ''}`}>
                                {task.title}
                              </h4>
                              <p className="text-sm text-gray-600">{task.description}</p>
                            </div>
                          </div>
                          <Button
                            onClick={() => deleteTask(selectedProject.id, task.id)}
                            disabled={isLoading}
                            size="sm"
                            variant="ghost"
                            className="text-red-600 hover:text-red-700 disabled:opacity-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className={`text-xs px-2 py-1 rounded-full ${getPriorityColor(task.priority)}`}>
                            {task.priority}
                          </span>
                          <span className="text-xs text-gray-600">
                            <User className="w-3 h-3 inline mr-1" />
                            Assigned: {task.assignedTo}
                          </span>
                          <span className="text-xs text-gray-500">
                            • Created by: {task.createdBy}
                          </span>
                        </div>

                        {(task.photos.length > 0 || task.videos.length > 0) && (
                          <div className="mb-2 space-y-2">
                            {task.photos.length > 0 && (
                              <div>
                                <p className="text-xs text-gray-600 mb-1 flex items-center gap-1">
                                  <Camera className="w-3 h-3" />
                                  {task.photos.length} photo{task.photos.length !== 1 ? 's' : ''} attached
                                </p>
                                <div className="flex gap-2 flex-wrap">
                                  {task.photos.map((photo, idx) => (
                                    <div key={idx} className="w-16 h-16 bg-blue-200 rounded-lg flex items-center justify-center text-xs text-blue-700 font-bold">
                                      📷 {idx + 1}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {task.videos.length > 0 && (
                              <div>
                                <p className="text-xs text-gray-600 mb-1 flex items-center gap-1">
                                  <Video className="w-3 h-3" />
                                  {task.videos.length} video{task.videos.length !== 1 ? 's' : ''} attached
                                </p>
                                <div className="flex gap-2 flex-wrap">
                                  {task.videos.map((video, idx) => (
                                    <div key={idx} className="w-16 h-16 bg-purple-200 rounded-lg flex items-center justify-center text-xs text-purple-700 font-bold">
                                      🎥 {idx + 1}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {task.status !== 'completed' && (
                          <div className="flex gap-2 flex-wrap">
                            {task.status === 'todo' && (user.role === 'builder' || user.role !== 'customer') && (
                              <Button
                                onClick={() => updateTaskStatus(selectedProject.id, task.id, 'in_progress')}
                                disabled={isLoading}
                                size="sm"
                                className="bg-blue-600 hover:bg-blue-700 text-xs disabled:opacity-50"
                              >
                                {isLoading ? 'Starting...' : 'Start Task'}
                              </Button>
                            )}
                            {task.status === 'in_progress' && (user.role === 'builder' || user.role !== 'customer') && (
                              <Button
                                onClick={() => updateTaskStatus(selectedProject.id, task.id, 'completed')}
                                disabled={isLoading}
                                size="sm"
                                className="bg-green-600 hover:bg-green-700 text-xs disabled:opacity-50"
                              >
                                {isLoading ? 'Completing...' : 'Mark Complete'}
                              </Button>
                            )}
                            {(user.role === 'builder' || user.role === 'customer') && (
                              <>
                                <Button
                                  onClick={() => addPhotoToTask(selectedProject.id, task.id, `photo_${Date.now()}.jpg`)}
                                  disabled={isLoading}
                                  size="sm"
                                  className="bg-blue-600 hover:bg-blue-700 text-xs disabled:opacity-50"
                                >
                                  <Camera className="w-3 h-3 mr-1" />
                                  {isLoading ? 'Adding...' : 'Photo'}
                                </Button>
                                <Button
                                  onClick={() => addVideoToTask(selectedProject.id, task.id, `video_${Date.now()}.mp4`)}
                                  disabled={isLoading}
                                  size="sm"
                                  className="bg-purple-600 hover:bg-purple-700 text-xs disabled:opacity-50"
                                >
                                  <Video className="w-3 h-3 mr-1" />
                                  {isLoading ? 'Adding...' : 'Video'}
                                </Button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
