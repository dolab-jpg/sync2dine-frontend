/**
 * Probe call list + recording playback readiness on a Sync2Dine host.
 *
 * Usage:
 *   node scripts/probe-call-recordings.mjs
 *   node scripts/probe-call-recordings.mjs https://app.sync2dine.io
 */
const base = String(process.argv[2] || process.env.PLAYWRIGHT_BASE_URL || 'https://app.sync2dine.io')
  .replace(/\/$/, '');

async function main() {
  const listUrl = `${base}/api/calls?limit=20`;
  console.log(`GET ${listUrl}`);
  const res = await fetch(listUrl, { headers: { Accept: 'application/json' } });
  console.log(`status=${res.status}`);
  if (!res.ok) {
    console.error(await res.text());
    process.exit(1);
  }
  const data = await res.json();
  const calls = Array.isArray(data.calls) ? data.calls : [];
  console.log(`calls=${calls.length} withRecordingCount=${data.summary?.withRecordingCount ?? 'n/a'}`);

  let withPhone = 0;
  let withRecording = 0;
  let withPlaybackPath = 0;
  let withProviderId = 0;

  for (const c of calls) {
    const party = c.displayPhone || c.partyPhone || c.metadata?.partyPhone || c.from || c.to;
    if (party) withPhone += 1;
    if (c.hasRecording || c.recordingUrl || c.recordingStoragePath) withRecording += 1;
    if (c.recordingPlaybackPath) withPlaybackPath += 1;
    if (c.providerCallId || c.metadata?.vapiCallId) withProviderId += 1;

    console.log(
      [
        c.id,
        `party=${party || 'MISSING'}`,
        `line=${c.lineDid || c.metadata?.lineDid || c.to || ''}`,
        `outcome=${c.outcome || ''}`,
        `rec=${c.hasRecording ? 'yes' : 'no'}`,
        `playback=${c.recordingPlaybackPath || ''}`,
        `vapi=${c.providerCallId || c.metadata?.vapiCallId || ''}`,
      ].join(' | '),
    );
  }

  console.log('---');
  console.log(`withPhone=${withPhone}/${calls.length}`);
  console.log(`withRecording=${withRecording}/${calls.length}`);
  console.log(`withPlaybackPath=${withPlaybackPath}/${calls.length}`);
  console.log(`withProviderId=${withProviderId}/${calls.length}`);

  // Probe recording route for first call that claims a recording
  const candidate = calls.find((c) => c.hasRecording || c.recordingUrl || c.recordingStoragePath);
  if (candidate) {
    const playUrl = `${base}/api/calls/${encodeURIComponent(candidate.id)}/recording`;
    console.log(`GET ${playUrl} (expect 302 or 404)`);
    const play = await fetch(playUrl, { redirect: 'manual' });
    console.log(`recording status=${play.status} location=${play.headers.get('location') || ''}`);
  } else {
    console.log('No call with recording to probe playback route.');
  }

  // Refresh endpoint should exist (404/502/401 ok — not 404 route miss)
  const sample = calls[0];
  if (sample) {
    const refreshUrl = `${base}/api/calls/${encodeURIComponent(sample.id)}/refresh-from-provider`;
    console.log(`POST ${refreshUrl}`);
    const refresh = await fetch(refreshUrl, { method: 'POST' });
    console.log(`refresh status=${refresh.status}`);
    const body = await refresh.text();
    console.log(body.slice(0, 400));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
