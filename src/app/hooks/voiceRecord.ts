/** Judie / Lizzie ù same ElevenLabs person as the phone (Cockney Character). */
export const JUDIE_VOICE_ID = 'EQx6HGDYjkDpcli6vorJ';

export type MediaSession = {
  stream: MediaStream;
  recorder: MediaRecorder;
  chunks: Blob[];
};

export function mediaRecorderAvailable(): boolean {
  return typeof navigator !== 'undefined'
    && !!navigator.mediaDevices?.getUserMedia
    && typeof MediaRecorder !== 'undefined';
}

export function pickRecorderMime(): string {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return '';
}

export function createMediaRecorder(stream: MediaStream): MediaRecorder {
  const mimeType = pickRecorderMime();
  return mimeType
    ? new MediaRecorder(stream, { mimeType })
    : new MediaRecorder(stream);
}

export async function transcribeBlob(blob: Blob): Promise<string> {
  const mime = blob.type || 'audio/webm';
  const ext = mime.includes('mp4') ? 'mp4' : mime.includes('ogg') ? 'ogg' : 'webm';
  const form = new FormData();
  form.append('file', new File([blob], `voice.${ext}`, { type: mime }));
  const res = await fetch('/api/ai/transcribe', { method: 'POST', body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error || `Transcription failed (${res.status})`);
  }
  const data = await res.json() as { text?: string };
  return data.text?.trim() ?? '';
}

export async function transcribeAudioDataUrl(
  dataUrl: string,
  mimeType?: string,
  fileName?: string,
): Promise<string> {
  const match = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl);
  if (match) {
    const res = await fetch('/api/ai/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audio: match[2],
        mimeType: mimeType || match[1] || 'audio/mp4',
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(err.error || `Transcription failed (${res.status})`);
    }
    const data = await res.json() as { text?: string };
    return data.text?.trim() ?? '';
  }

  const blobRes = await fetch(dataUrl);
  const blob = await blobRes.blob();
  return transcribeBlob(new File([blob], fileName || 'voice.m4a', {
    type: mimeType || blob.type || 'audio/mp4',
  }));
}

export function stopMediaSession(session: MediaSession | null) {
  if (!session) return;
  try {
    if (session.recorder.state !== 'inactive') session.recorder.stop();
  } catch { /* already stopped */ }
  session.stream.getTracks().forEach((track) => track.stop());
}

export function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

export function rmsFromAnalyser(analyser: AnalyserNode, buffer: Uint8Array<ArrayBuffer>): number {
  analyser.getByteTimeDomainData(buffer);
  let sum = 0;
  for (let i = 0; i < buffer.length; i += 1) {
    const v = (buffer[i] - 128) / 128;
    sum += v * v;
  }
  return Math.sqrt(sum / buffer.length);
}
