import('./server/data-store.ts')
  .then((m) => {
    console.log('ok', typeof m.getAgentCapacitySnapshot, Object.keys(m).filter((k) => k.includes('Agent')).join(','));
  })
  .catch((e) => {
    console.error('fail', e);
    process.exit(1);
  });
