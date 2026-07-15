import type { FileSource, ProjectFile } from '../project/types';
import { getProject, updateProject } from '../project/projectStore';
import {
  isSupabaseConfigured,
  uploadFileToStorage,
  saveProjectFileMetadata,
  getSignedFileUrl,
  deleteFileFromStorage,
  deleteProjectFileMetadata,
} from '../data/supabaseStore';

const DEFAULT_BUCKET = 'project-files';

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
  const fileId = `F${Date.now()}`;
  let dataUrl: string | undefined;
  let uploadedToCloud = false;

  if (isSupabaseConfigured()) {
    const uploaded = await uploadFileToStorage(DEFAULT_BUCKET, storagePath, file, file.type);
    if (uploaded) {
      uploadedToCloud = true;
    } else {
      dataUrl = await readFileAsDataUrl(file);
    }
  } else {
    dataUrl = await readFileAsDataUrl(file);
    try {
      await fetch('/api/files/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          file: { id: fileId, storagePath, filename: file.name, mimeType: file.type, dataUrl },
        }),
      });
    } catch { /* local-only fallback */ }
  }

  const projectFile: ProjectFile = {
    id: fileId,
    storagePath,
    filename: file.name,
    mimeType: file.type || 'application/octet-stream',
    source,
    uploadedBy,
    caption: options?.caption,
    takenAt: new Date().toISOString(),
    messageId: options?.messageId,
    taskId: options?.taskId,
    ...(dataUrl ? { dataUrl } : {}),
  };

  if (uploadedToCloud) {
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
      bucket: DEFAULT_BUCKET,
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
  const fileId = `F${Date.now()}`;
  let dataUrl: string | undefined = `data:${mimeType};base64,${base64}`;
  let uploadedToCloud = false;

  if (isSupabaseConfigured()) {
    const blob = await fetch(dataUrl).then((r) => r.blob());
    const uploaded = await uploadFileToStorage(DEFAULT_BUCKET, storagePath, blob, mimeType);
    if (uploaded) {
      uploadedToCloud = true;
      dataUrl = undefined;
    }
  }

  const projectFile: ProjectFile = {
    id: fileId,
    storagePath,
    filename,
    mimeType,
    source,
    uploadedBy,
    takenAt: new Date().toISOString(),
    ...(dataUrl ? { dataUrl } : {}),
  };

  if (uploadedToCloud) {
    await saveProjectFileMetadata(projectId, {
      id: projectFile.id,
      storagePath,
      filename,
      mimeType,
      source,
      uploadedBy,
      takenAt: projectFile.takenAt,
      bucket: DEFAULT_BUCKET,
    });
  }

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

export async function deleteProjectFile(projectId: string, fileId: string): Promise<boolean> {
  const project = getProject(projectId);
  if (!project) return false;
  const file = project.files.find((f) => f.id === fileId);
  if (!file) return false;

  if (isSupabaseConfigured() && file.storagePath && !file.dataUrl?.startsWith('data:')) {
    await deleteFileFromStorage(DEFAULT_BUCKET, file.storagePath);
    await deleteProjectFileMetadata(projectId, fileId);
  }

  const next = project.files.filter((f) => f.id !== fileId);
  const photos = project.photos.filter((id) => id !== fileId);
  updateProject(projectId, { files: next, photos });
  return true;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Sync URL for legacy dataUrls / already-http. Prefer resolveFileUrl for Supabase objects. */
export function getFileUrl(file: ProjectFile): string | undefined {
  return file.dataUrl;
}

export async function resolveFileUrl(file: ProjectFile): Promise<string | undefined> {
  if (file.dataUrl?.startsWith('data:') || file.dataUrl?.startsWith('blob:')) {
    return file.dataUrl;
  }
  if (file.dataUrl?.startsWith('http')) return file.dataUrl;
  if (isSupabaseConfigured() && file.storagePath) {
    const signed = await getSignedFileUrl(DEFAULT_BUCKET, file.storagePath);
    if (signed) return signed;
  }
  return file.dataUrl;
}
