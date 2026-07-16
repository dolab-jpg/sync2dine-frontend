import { uploadBase64File, resolveFileUrl } from '../storage/storageService';
import type { DocumentAttachment } from './types';

/**
 * Persist a generated PDF when a project exists (Supabase project-files or local dataUrl).
 * Always returns a data: URL on `url` for in-app preview / re-open in the same session.
 * `pdfPath` callers should prefer `storagePath` when present, else filename.
 */
export async function persistGeneratedPdf(
  attachment: DocumentAttachment,
  opts?: { projectId?: string; uploadedBy?: string }
): Promise<DocumentAttachment> {
  const dataUrl = `data:${attachment.mimeType};base64,${attachment.content}`;
  let storagePath = attachment.storagePath;
  let url = attachment.url ?? dataUrl;
  let persistWarning: string | undefined;

  if (opts?.projectId) {
    try {
      const file = await uploadBase64File(
        opts.projectId,
        attachment.filename,
        attachment.mimeType,
        attachment.content,
        'document',
        opts.uploadedBy ?? 'system'
      );
      storagePath = file.storagePath;
      const resolved = await resolveFileUrl(file);
      if (resolved) url = resolved;
      else url = file.dataUrl || dataUrl;
    } catch (err) {
      persistWarning = err instanceof Error ? err.message : 'Could not save PDF to project files';
      url = dataUrl;
    }
  } else {
    persistWarning = 'No projectId — PDF generated in-session only (not saved to Project Documents)';
  }

  return {
    ...attachment,
    url,
    storagePath,
    logoWarning: [attachment.logoWarning, persistWarning].filter(Boolean).join(' · ') || attachment.logoWarning,
  };
}

export function pdfPathFromAttachment(attachment: DocumentAttachment): string {
  return attachment.storagePath || attachment.filename;
}
