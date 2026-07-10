import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { CheckCircle, AlertCircle } from 'lucide-react';
import type { UnifiedProject, SnagItem } from '../../engine/project/types';
import { updateProject } from '../../engine/project/projectStore';
import { applyDerivedStatus } from '../../engine/project/projectStatusService';

interface Props {
  project: UnifiedProject;
  onUpdate?: (project: UnifiedProject) => void;
}

export default function ProjectSnaggingTab({ project, onUpdate }: Props) {
  const snags = project.snags ?? [];

  const resolveSnag = (id: string) => {
    const next: SnagItem[] = snags.map((s) =>
      s.id === id ? { ...s, status: 'resolved' as const, resolvedAt: new Date().toISOString() } : s,
    );
    const merged = applyDerivedStatus({ ...project, snags: next });
    const updated = updateProject(project.id, merged);
    if (updated && onUpdate) onUpdate(updated);
  };

  const openCount = snags.filter((s) => s.status === 'open').length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            Snag list
            {openCount > 0 ? (
              <Badge variant="destructive">{openCount} open</Badge>
            ) : (
              <Badge className="bg-green-600">All clear</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {snags.length === 0 ? (
            <p className="text-sm text-slate-500">No snags recorded yet. AI site photos can add items here.</p>
          ) : (
            snags.map((snag) => (
              <div key={snag.id} className="flex items-start justify-between gap-3 p-3 rounded-lg border bg-white">
                <div className="flex items-start gap-2 min-w-0">
                  {snag.status === 'resolved' ? (
                    <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                  )}
                  <div>
                    <p className="font-medium text-sm">{snag.title}</p>
                    {snag.description && <p className="text-xs text-slate-500">{snag.description}</p>}
                    <p className="text-xs text-slate-400 capitalize">{snag.source}</p>
                  </div>
                </div>
                {snag.status === 'open' && (
                  <Button size="sm" variant="outline" onClick={() => resolveSnag(snag.id)}>
                    Resolve
                  </Button>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
