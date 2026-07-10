import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import type { UnifiedProject } from '../../engine/project/types';

interface Props {
  project: UnifiedProject;
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
}

export function DailyPlanCard({ project }: Props) {
  const todayKey = new Date().toISOString().slice(0, 10);
  const todaysTasks = project.tasks.filter((task) => (task.targetDate ?? '').slice(0, 10) === todayKey);
  const fallbackTasks = project.tasks.filter((task) => task.status !== 'completed').slice(0, 3);
  const visibleTasks = todaysTasks.length > 0 ? todaysTasks : fallbackTasks;
  const latestPlan = project.plans?.length ? project.plans[project.plans.length - 1] : null;
  const dueStage = project.paymentStages.find((stage) => stage.status === 'due')
    ?? project.paymentStages.find((stage) => stage.status === 'pending');
  const paidAmount = project.paymentStages
    .filter((stage) => stage.status === 'paid')
    .reduce((sum, stage) => sum + stage.amount, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <span>Daily plan snapshot</span>
          {latestPlan && <Badge variant="outline">{latestPlan.cadence}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div>
          <p className="text-xs text-slate-500 mb-1">Today&apos;s tasks</p>
          {visibleTasks.length === 0 ? (
            <p className="text-xs text-slate-500">No tasks scheduled yet.</p>
          ) : (
            <div className="space-y-1">
              {visibleTasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate">{task.title}</span>
                  <Badge variant={task.status === 'completed' ? 'default' : 'secondary'} className="capitalize">
                    {task.status.replace('_', ' ')}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2 bg-slate-50 rounded border">
            <p className="text-slate-500">Latest plan</p>
            <p className="font-medium truncate">{latestPlan?.title ?? 'No plan yet'}</p>
          </div>
          <div className="p-2 bg-slate-50 rounded border">
            <p className="text-slate-500">Payment stage</p>
            <p className="font-medium truncate">
              {dueStage ? `${dueStage.name} (${dueStage.status})` : 'No stage due'}
            </p>
          </div>
        </div>

        <div className="text-xs text-slate-600 border-t pt-2">
          <span className="font-medium">Paid so far:</span> £{paidAmount.toLocaleString()}
          {dueStage?.dueDate ? ` · Next due ${formatDate(dueStage.dueDate)}` : ''}
        </div>
      </CardContent>
    </Card>
  );
}
