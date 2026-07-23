import assert from 'node:assert/strict';
import {
  extractRecordingUrls,
  preferredRecordingUrl,
  enrichCallListRow,
  lineDidForDirection,
} from '../../sync2dine-backend/server/call-recording-artifacts.ts';

assert.deepEqual(
  extractRecordingUrls({
    artifact: {
      recordingUrl: 'https://cdn.example/mono.wav',
      stereoRecordingUrl: 'https://cdn.example/stereo.wav',
    },
  }),
  {
    recordingUrl: 'https://cdn.example/mono.wav',
    stereoRecordingUrl: 'https://cdn.example/stereo.wav',
  },
);

assert.equal(
  preferredRecordingUrl({
    recordingUrl: 'https://cdn.example/mono.wav',
    stereoRecordingUrl: 'https://cdn.example/stereo.wav',
  }),
  'https://cdn.example/stereo.wav',
);

assert.equal(
  lineDidForDirection('inbound', { to: '+442037453233' }, '+4499'),
  '+442037453233',
);

const enriched = enrichCallListRow({
  id: 'c1',
  direction: 'inbound',
  from: '',
  to: '+442037453233',
  metadata: { partyPhone: '+447700900123' },
  recordingStoragePath: 'org/c1/mono.wav',
});
assert.equal(enriched.displayPhone, '+447700900123');
assert.equal(enriched.lineDid, '+442037453233');
assert.equal(enriched.hasRecording, true);
assert.equal(enriched.recordingPlaybackPath, '/api/calls/c1/recording');

console.log('call-recording-artifacts ok');
