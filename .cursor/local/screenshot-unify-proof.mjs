#!/usr/bin/env node
/**
 * Screenshot live Sync2Dine pages on this laptop (Playwright).
 * Used when Cursor Simple Browser is open but browser MCP screenshot tools are absent.
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const outDir = path.join(__dirname, 'nav-audit');
fs.mkdirSync(outDir, { recursive: true });

const pages = [
  { url: 'https://app.sync2dine.io/crm?tab=queue', file: 'unify-crm-queue.png' },
  { url: 'https://app.sync2dine.io/calls', file: 'unify-calls.png' },
];

(async () => {
  const browser = await chromium.launch({
    headless: true,
    channel: 'msedge',
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  for (const p of pages) {
    await page.goto(p.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(4000);
    const dest = path.join(outDir, p.file);
    await page.screenshot({ path: dest, fullPage: false });
    console.log('WROTE', dest, 'title=', await page.title(), 'url=', page.url());
  }
  await browser.close();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
