import type { FileSource, ProjectFile } from '../project/types';
import { getProject, updateProject } from '../project/projectStore';
import { isSupabaseConfigured, uploadFileToStorage, saveProjectFileMetadata, getSignedFileUrl } from '../data/supabaseStore';

export interface UploadResult {
  file: ProjectFile;
}

export async function uploadProjectFile(
  projectId: string,
  file: File,
  source: FileSource,
  uploadedBy: string,
  options?: { messageId?: string; taskId?: string; caption?: string }
): Promise<UploadResult> {
  const storagePath = `projects/${projectId}/${Date.now()}_${file.name}`;
  let storageUrl: string | null = null;
  let dataUrl: string | undefined;

  if (isSupabaseConfigured()) {
    storageUrl = await uploadFileToStorage('project-files', storagePath, file, file.type);
  } else {
    dataUrl = await readFileAsDataUrl(file);
    try {
      await fetch('/api/files/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, file: { id: `F${Date.now()}`, storagePath, filename: file.name, mimeType: file.type, dataUrl } }),
      });
    } catch { /* local-only fallback */ }
  }

  const projectFile: ProjectFile = {
    id: `F${Date.now()}`,
    storagePath,
    filename: file.name,
    mimeType: file.type || 'application/octet-stream',
    source,
    uploadedBy,
    caption: options?.caption,
    takenAt: new Date().toISOString(),
    messageId: options?.messageId,
    taskId: options?.taskId,
    dataUrl: storageUrl ?? dataUrl,
  };

  if (isSupabaseConfigured()) {
    await saveProjectFileMetadata(projectId, {
      id: projectFile.id,
      storagePath,
      filename: file.name,
      mimeType: projectFile.mimeType,
      source,
      uploadedBy,
      caption: options?.caption,
      takenAt: projectFile.takenAt,
      messageId: options?.messageId,
      taskId: options?.taskId,
      bucket: 'project-files',
    });
  }

  const project = getProject(projectId);
  if (project) {
    const files = [...project.files, projectFile];
    const photos = file.type.startsWith('image/')
      ? [...project.photos, projectFile.id]
      : project.photos;
    updateProject(projectId, { files, photos });
  }

  return { file: projectFile };
}

export async function uploadBase64File(
  projectId: string,
  filename: string,
  mimeType: string,
  base64: string,
  source: FileSource,
  uploadedBy: string
): Promise<ProjectFile> {
  const storagePath = `projects/${projectId}/${Date.now()}_${filename}`;
  let dataUrl: string | undefined = `data:${mimeType};base64,${base64}`;

  if (isSupabaseConfigured()) {
    const blob = await fetch(dataUrl).then(r => r.blob());
    const url = await uploadFileToStorage('project-files', storagePath, blob, mimeType);
    if (url) dataUrl = url;
  }

  const projectFile: ProjectFile = {
    id: `F${Date.now()}`,
    storagePath,
    filename,
    mimeType,
    source,
    uploadedBy,
    takenAt: new Date().toISOString(),
    dataUrl,
  };

  const project = getProject(projectId);
  if (project) {
    const files = [...project.files, projectFile];
    const photos = mimeType.startsWith('image/')
      ? [...project.photos, projectFile.id]
      : project.photos;
    updateProject(projectId, { files, photos });
  }
  return projectFile;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function getFileUrl(file: ProjectFile): string | undefined {
  return file.dataUrl;
}

export async function resolveFileUrl(file: ProjectFile): Promise<string | undefined> {
  if (file.dataUrl?.startsWith('http')) return file.dataUrl;
  if (isSupabaseConfigured() && file.storagePath) {
    const signed = await getSignedFileUrl('project-files', file.storagePath);
    if (signed) return signed;
  }
  return file.dataUrl;
}
