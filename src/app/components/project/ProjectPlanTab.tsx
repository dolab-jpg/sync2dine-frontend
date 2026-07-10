import { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent } from '../ui/card';
import { Plus, CheckCircle2, Circle } from 'lucide-react';
import type { UnifiedProject, ProjectTask } from '../../engine/project/types';
import { updateProject } from '../../engine/project/projectStore';
import { applyDerivedStatus } from '../../engine/project/projectStatusService';

interface Props {
  project: UnifiedProject;
  onUpdate: (project: UnifiedProject) => void;
  createdBy: string;
}

export function ProjectPlanTab({ project, onUpdate, createdBy }: Props) {
  const [newTask, setNewTask] = useState('');
  const [offDay, setOffDay] = useState('');

  const persist = (updates: Partial<UnifiedProject>) => {
    const merged = applyDerivedStatus({ ...project, ...updates });
    const updated = updateProject(project.id, { ...updates, status: merged.status })!;
    onUpdate(updated);
  };

  const addTask = () => {
    if (!newTask.trim()) return;
    const task: ProjectTask = {
      id: `T${Date.now()}`,
      title: newTask,
      description: '',
      assignedTo: project.assignedBuilder,
      status: 'todo',
      priority: 'medium',
      photos: [],
      createdAt: new Date().toISOString(),
      createdBy,
      source: 'manual',
    };
    persist({ tasks: [...project.tasks, task] });
    setNewTask('');
  };

  const toggleTask = (taskId: string) => {
    const tasks = project.tasks.map((t) => {
      if (t.id !== taskId) return t;
      const done = t.status !== 'completed';
      return {
        ...t,
        status: done ? 'completed' as const : 'todo' as const,
        completedAt: done ? new Date().toISOString() : undefined,
      };
    });
    persist({ tasks });
  };

  const toggleMilestone = (milestoneId: string) => {
    const milestones = project.milestones.map((m) =>
      m.id === milestoneId ? { ...m, completed: !m.completed } : m,
    );
    persist({ milestones });
  };

  const addOffDay = () => {
    if (!offDay.trim()) return;
    const days = [...project.workingDaysOff, offDay.trim()];
    persist({ workingDaysOff: days });
    setOffDay('');
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4 space-y-2">
          <Label>Working days off (no site access)</Label>
          <div className="flex gap-2">
            <Input
              placeholder="e.g. Friday, Bank holidays"
              value={offDay}
              onChange={(e) => setOffDay(e.target.value)}
            />
            <Button size="sm" onClick={addOffDay}>Add</Button>
          </div>
          {project.workingDaysOff.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {project.workingDaysOff.map((d, i) => (
                <span key={i} className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded">{d}</span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Input
          placeholder="Add task..."
          value={newTask}
          onChange={(e) => setNewTask(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addTask()}
        />
        <Button onClick={addTask}><Plus className="w-4 h-4" /></Button>
      </div>

      {project.milestones.length > 0 && (
        <div>
          <Label className="mb-2 block">Milestones</Label>
          {project.milestones.map((m) => (
            <button
              key={m.id}
              type="button"
              className="text-sm py-1 flex justify-between w-full text-left hover:bg-slate-50 rounded px-1"
              onClick={() => toggleMilestone(m.id)}
            >
              <span className="flex items-center gap-2">
                {m.completed ? (
                  <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                ) : (
                  <Circle className="w-4 h-4 text-slate-400 shrink-0" />
                )}
                <span className={m.completed ? 'line-through text-slate-500' : ''}>{m.title}</span>
              </span>
              <span className="text-slate-500">{m.targetDate || 'TBC'}</span>
            </button>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {project.tasks.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-4">No tasks yet. Add manually or use Project AI.</p>
        ) : (
          project.tasks.map((task) => (
            <div
              key={task.id}
              className="flex items-start gap-2 p-3 border rounded-lg cursor-pointer hover:bg-slate-50"
              onClick={() => toggleTask(task.id)}
            >
              {task.status === 'completed' ? (
                <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
              ) : (
                <Circle className="w-5 h-5 text-slate-400 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className={`font-medium text-sm ${task.status === 'completed' ? 'line-through text-slate-500' : ''}`}>
                  {task.title}
                </p>
                <p className="text-xs text-slate-500">
                  {task.assignedTo}
                  {task.targetDate ? ` · ${task.targetDate}` : ''}
                  {task.source === 'ai' ? ' · AI' : ''}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
