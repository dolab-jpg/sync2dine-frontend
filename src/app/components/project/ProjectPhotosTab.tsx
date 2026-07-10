import { useRef, useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Camera, Upload } from 'lucide-react';
import { toast } from 'sonner';
import type { UnifiedProject } from '../../engine/project/types';
import { uploadProjectFile, getFileUrl } from '../../engine/storage/storageService';
import { getProject } from '../../engine/project/projectStore';
import { saveProposedActions } from '../../engine/projectAi/projectAiService';
import { assessExtraFromPhotos, assessProgress } from '../../engine/ai/visionAssessment';

interface Props {
  project: UnifiedProject;
  uploadedBy: string;
  userRole?: string;
  onUpdate: (project: UnifiedProject) => void;
}

const EXTRA_KEYWORDS = /\b(extra|variation|change order|upgrade|add(?:ed)?|premium|underfloor|mirror|niche|lighting|brassware)\b/i;

export function ProjectPhotosTab({ project, uploadedBy, userRole, onUpdate }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [assessingExtra, setAssessingExtra] = useState(false);
  const [assessingProgress, setAssessingProgress] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [uploadCaption, setUploadCaption] = useState('');

  const files = project.files.filter(f =>
    filter === 'all' || f.source === filter
  );
  const imageFiles = project.files.filter((file) => file.mimeType.startsWith('image/') && Boolean(file.dataUrl));

  const refreshProject = () => {
    const latest = getProject(project.id);
    if (latest) onUpdate(latest);
  };

  const buildChangeOrderSuggestion = (assessment: Awaited<ReturnType<typeof assessExtraFromPhotos>>, photoIds: string[]) => ({
    title: assessment.title,
    description: assessment.description,
    amount: Math.round((assessment.amountMin + assessment.amountMax) / 2),
    amountMin: assessment.amountMin,
    amountMax: assessment.amountMax,
    reason: 'Builder vision assessment indicates extra scope.',
    photoIds,
    status: 'pending_customer',
  });

  const enqueueExtraAssessment = async (
    photoUrls: string[],
    builderNote: string,
    photoIds: string[]
  ) => {
    if (photoUrls.length === 0) {
      toast.error('Upload at least one photo first');
      return;
    }
    setAssessingExtra(true);
    try {
      const assessment = await assessExtraFromPhotos(
        project,
        photoUrls,
        builderNote || 'Assess if this is extra scope',
        project.tradeId
      );
      const changeOrder = buildChangeOrderSuggestion(assessment, photoIds);
      saveProposedActions(project.id, [
        {
          action: 'assessExtraFromPhotos',
          input: { photoIds, builderNote, tradeId: project.tradeId },
          output: {
            ...assessment,
            photoIds,
            proposeChangeOrder: changeOrder,
          },
        },
        {
          action: 'proposeChangeOrder',
          input: { source: 'assessExtraFromPhotos' },
          output: changeOrder,
        },
      ]);
      refreshProject();
      toast.success('Vision extra assessment queued for approval');
    } catch {
      toast.error('Could not assess extra from photos');
    }
    setAssessingExtra(false);
  };

  const enqueueProgressAssessment = async (photoUrls: string[], photoIds: string[]) => {
    if (photoUrls.length === 0) {
      toast.error('Upload at least one photo first');
      return;
    }
    setAssessingProgress(true);
    try {
      const progress = await assessProgress(project, photoUrls, project.tradeId);
      const actions: NonNullable<Parameters<typeof saveProposedActions>[1]> = [
        {
          action: 'assessProgress',
          input: { photoIds, tradeId: project.tradeId },
          output: {
            ...progress,
            photoIds,
          },
        },
      ];
      const firstUpdate = progress.suggestedTaskUpdates[0];
      if (firstUpdate) {
        actions.push({
          action: 'updateTaskStatus',
          input: { source: 'assessProgress' },
          output: {
            taskTitle: firstUpdate.taskTitle,
            status: firstUpdate.status,
          },
        });
      }
      saveProposedActions(project.id, actions);
      refreshProject();
      toast.success('Vision progress assessment queued for approval');
    } catch {
      toast.error('Could not assess progress from photos');
    }
    setAssessingProgress(false);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (!list?.length) return;
    setUploading(true);
    try {
      const uploadedImageUrls: string[] = [];
      const uploadedPhotoIds: string[] = [];
      const caption = uploadCaption.trim();
      for (let i = 0; i < list.length; i++) {
        const result = await uploadProjectFile(project.id, list[i], 'job_site', uploadedBy, {
          caption: caption || list[i].name,
        });
        if (result.file.mimeType.startsWith('image/') && result.file.dataUrl) {
          uploadedImageUrls.push(result.file.dataUrl);
          uploadedPhotoIds.push(result.file.id);
        }
      }
      refreshProject();
      toast.success(`${list.length} file(s) uploaded`);

      if (userRole === 'builder' && caption && EXTRA_KEYWORDS.test(caption) && uploadedImageUrls.length > 0) {
        await enqueueExtraAssessment(uploadedImageUrls, caption, uploadedPhotoIds);
      }
    } catch {
      toast.error('Upload failed');
    }
    setUploading(false);
    setUploadCaption('');
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-2">
          {['all', 'job_site', 'whatsapp', 'message'].map(src => (
            <Button
              key={src}
              size="sm"
              variant={filter === src ? 'default' : 'outline'}
              onClick={() => setFilter(src)}
            >
              {src === 'all' ? 'All' : src.replace('_', ' ')}
            </Button>
          ))}
        </div>
        <div className="flex w-full sm:w-auto gap-2">
          <Input
            value={uploadCaption}
            onChange={(event) => setUploadCaption(event.target.value)}
            placeholder="Caption (optional, e.g. add niche lighting)"
            className="min-w-[260px]"
          />
          <Button size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
            <Upload className="w-4 h-4 mr-1" />
            Upload photos
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={assessingExtra || imageFiles.length === 0}
          onClick={() => {
            const recentImages = imageFiles.slice(-4);
            void enqueueExtraAssessment(
              recentImages.map((file) => file.dataUrl as string),
              uploadCaption.trim() || 'Assess if latest photos show extra scope',
              recentImages.map((file) => file.id)
            );
          }}
        >
          Assess extra
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={assessingProgress || imageFiles.length === 0}
          onClick={() => {
            const recentImages = imageFiles.slice(-4);
            void enqueueProgressAssessment(
              recentImages.map((file) => file.dataUrl as string),
              recentImages.map((file) => file.id)
            );
          }}
        >
          Assess progress
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*,.pdf"
          multiple
          className="hidden"
          onChange={handleUpload}
        />
      </div>

      {files.length === 0 ? (
        <p className="text-center text-slate-500 py-8 text-sm">No photos yet. Upload from site or receive via WhatsApp.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {files.map(file => {
            const url = getFileUrl(file);
            return (
              <div key={file.id} className="rounded-lg border overflow-hidden bg-slate-50">
                {url && file.mimeType.startsWith('image/') ? (
                  <img src={url} alt={file.filename} className="w-full aspect-square object-cover" />
                ) : (
                  <div className="aspect-square flex flex-col items-center justify-center p-2">
                    <Camera className="w-8 h-8 text-slate-400" />
                  </div>
                )}
                <div className="p-2">
                  <p className="text-xs font-medium truncate">{file.filename}</p>
                  <Label className="text-[10px] text-slate-500">{file.source} · {file.uploadedBy}</Label>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
