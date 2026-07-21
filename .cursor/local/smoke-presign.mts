import { vapiFetch } from './server/vapi-client.ts';
import { extractRecordingUrls } from './server/call-recording-artifacts.ts';
import { ingestCallRecording, resolveCallPlaybackUrl } from './server/call-recording-store.ts';

const id = '019f8531-150c-7dd4-b88a-8678dfbedeb4';
const { json } = await vapiFetch('/call/' + id);
const urls = extractRecordingUrls(json);
console.log('extracted', {
  mono: urls.recordingUrl?.slice(0, 100),
  stereo: urls.stereoRecordingUrl?.slice(0, 100),
  monoPresigned: Boolean(urls.recordingUrl?.includes('X-Amz-') || urls.recordingUrl?.includes('Signature=')),
  stereoPresigned: Boolean(urls.stereoRecordingUrl?.includes('X-Amz-') || urls.stereoRecordingUrl?.includes('Signature=')),
});
const ingest = await ingestCallRecording({
  callId: 'out-1784646013205',
  urls,
  messageOrCall: json,
});
console.log('ingest paths', ingest.recordingStoragePath, ingest.stereoStoragePath);
const play = await resolveCallPlaybackUrl('out-1784646013205');
console.log('playback', play.source, Boolean(play.url), play.url?.slice(0, 90));
console.log('PRESIGN_SMOKE_DONE');
