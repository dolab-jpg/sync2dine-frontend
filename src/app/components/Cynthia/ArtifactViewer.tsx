import { X } from 'lucide-react';
import { Button } from '../ui/button';

export type OpenArtifact =
  | { type: 'pdf'; title: string; dataUrl: string }
  | { type: 'report'; title: string; markdown: string };

interface ArtifactViewerProps {
  artifact: OpenArtifact;
  onClose: () => void;
}

export function ArtifactViewer({ artifact, onClose }: ArtifactViewerProps) {
  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-slate-950/70 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-2 bg-slate-900 text-white px-3 py-2.5 shrink-0">
        <p className="text-sm font-medium truncate">{artifact.title}</p>
        <Button type="button" size="sm" variant="ghost" className="text-white hover:bg-white/10" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex-1 min-h-0 bg-white">
        {artifact.type === 'pdf' ? (
          <iframe title={artifact.title} src={artifact.dataUrl} className="w-full h-full border-0" />
        ) : (
          <div className="h-full overflow-y-auto p-4 prose prose-sm max-w-none whitespace-pre-wrap text-slate-800">
            {artifact.markdown}
          </div>
        )}
      </div>
    </div>
  );
}
