/**
 * Minimal STT shim — WhatsApp/voice upload paths import this.
 * Full Whisper/Deepgram wiring lives with telephony ops; this keeps the API bootable.
 */
export async function transcribeAudioBuffer(
  _buffer: Buffer,
  _filename?: string,
  _mime?: string,
  _orgId?: string,
): Promise<string> {
  throw new Error('STT is not configured in this environment');
}
