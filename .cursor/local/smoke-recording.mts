import { ingestCallRecording } from './server/call-recording-store.ts';
import { getCallById, getDataStore } from './server/data-store.ts';
import { refreshCallFromProvider } from './server/call-provider-refresh.ts';

const callId = 'out-1784646013205';
const before = getCallById(callId);
console.log('before', {
  providerCallId: before?.providerCallId,
  recordingStoragePath: before?.recordingStoragePath,
  stereoStoragePath: before?.stereoStoragePath,
  recordingUrl: Boolean(before?.recordingUrl),
});

const refreshed = await refreshCallFromProvider(callId);
console.log('refresh', refreshed);

const ingest = await ingestCallRecording({
  callId,
  urls: {
    recordingUrl: before?.recordingUrl ? String(before.recordingUrl) : undefined,
    stereoRecordingUrl: before?.stereoRecordingUrl ? String(before.stereoRecordingUrl) : undefined,
  },
});
console.log('ingest', ingest);

const after = getCallById(callId);
console.log('after', {
  recordingStoragePath: after?.recordingStoragePath,
  stereoStoragePath: after?.stereoStoragePath,
});
const { resolveCallPlaybackUrl } = await import('./server/call-recording-store.ts');
const play = await resolveCallPlaybackUrl(callId);
console.log('playback', play.source, Boolean(play.url));
console.log('REC_SMOKE_DONE');
