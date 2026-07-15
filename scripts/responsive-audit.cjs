/**
 * Responsive QA audit — tests routes at mobile/tablet/desktop breakpoints.
 * Run: node scripts/responsive-audit.cjs [baseUrl]
 */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.argv[2] || 'http://localhost:5174';
const OUT_DIR = path.resolve(__dirname, '../docs/responsive-audit');
const SCREENSHOT_DIR = path.join(OUT_DIR, 'screenshots');

const BREAKPOINTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
];

const ROUTES = [
  { path: '/', label: 'Dashboard' },
  { path: '/crm', label: 'CRM' },
  { path: '/quotes', label: 'Quotes' },
  { path: '/quote', label: 'QuoteBuilder' },
  { path: '/price-job', label: 'PriceJob' },
  { path: '/contracts', label: 'Contracts' },
  { path: '/costing', label: 'Costing' },
  { path: '/accounts', label: 'Accounts' },
  { path: '/sales', label: 'Sales' },
  { path: '/communications', label: 'Communications' },
  { path: '/settings', label: 'Settings' },
];

const TABLE_ROUTES = [
  { path: '/costing', label: 'CostingDashboard' },
  { path: '/accounts', label: 'AccountsHub' },
  { path: '/sales', label: 'SalesManagement' },
];

async function login(page, role = 'super_admin') {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.waitForSelector('button', { timeout: 10000 });

  const roleLabels = {
    super_admin: 'Super Admin',
    manager: 'Manager',
    staff: 'Sales Representative',
  };

  // Select role card
  await page.evaluate((label) => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const roleBtn = buttons.find((b) => b.textContent?.includes(label));
    roleBtn?.click();
  }, roleLabels[role] || roleLabels.super_admin);
  await new Promise((r) => setTimeout(r, 400));

  // Sign in
  const signInHandle = await page.waitForFunction(
    () => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find((b) => /Sign In/i.test(b.textContent || ''));
    },
    { timeout: 10000 },
  );
  await signInHandle.asElement().click();
  await page.waitForSelector('header', { timeout: 15000 });
  await new Promise((r) => setTimeout(r, 1200));

  // Confirm we are past login
  const onLoginPage = await page.evaluate(() => !!document.querySelector('button')?.textContent?.includes('Sign In as'));
  if (onLoginPage) throw new Error('Login failed — still on login screen');
}

async function navigateInApp(page, routePath) {
  const current = await page.evaluate(() => window.location.pathname);
  if (current === routePath) return;

  // Prefer SPA navigation to preserve auth state
  const clicked = await page.evaluate((path) => {
    const links = Array.from(document.querySelectorAll('a[href]'));
    const match = links.find((a) => a.getAttribute('href') === path);
    if (match) {
      match.click();
      return true;
    }
    return false;
  }, routePath);

  if (!clicked) {
    await login(page);
    await page.evaluate((path) => {
      const links = Array.from(document.querySelectorAll('a[href]'));
      const match = links.find((a) => a.getAttribute('href') === path);
      match?.click();
    }, routePath);
  }

  await page.waitForFunction(
    (path) => window.location.pathname === path,
    { timeout: 10000 },
    routePath,
  );
  await new Promise((r) => setTimeout(r, 1000));
}

async function measureOverflow(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    const scrollWidth = Math.max(doc.scrollWidth, body.scrollWidth);
    const clientWidth = doc.clientWidth;
    const overflowPx = scrollWidth - clientWidth;
    const tables = Array.from(document.querySelectorAll('table'));
    const tableInfo = tables.map((t, i) => {
      const wrapper = t.closest('.overflow-x-auto') || t.parentElement;
      const tableOverflow = t.scrollWidth - (wrapper?.clientWidth || t.clientWidth);
      return {
        index: i,
        tableScrollWidth: t.scrollWidth,
        wrapperClientWidth: wrapper?.clientWidth || t.clientWidth,
        hasOverflowWrapper: !!t.closest('.overflow-x-auto'),
        tableOverflowPx: Math.max(0, tableOverflow),
      };
    });
    return {
      scrollWidth,
      clientWidth,
      overflowPx,
      hasHorizontalOverflow: overflowPx > 2,
      tableCount: tables.length,
      tables: tableInfo,
    };
  });
}

async function checkMobileNav(page, width) {
  if (width >= 768) {
    const desktopNav = await page.$('aside[aria-label="Navigation"]');
    const visible = desktopNav
      ? await page.evaluate((el) => {
          const rect = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);
          return rect.width > 0 && style.display !== 'none' && style.visibility !== 'hidden';
        }, desktopNav)
      : false;
    return { hamburgerVisible: false, desktopNavVisible: visible, mobileSheetWorks: null };
  }

  const hamburger = await page.$('button[aria-label="Open navigation menu"]');
  const hamburgerVisible = hamburger
    ? await page.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        return rect.width > 0 && rect.height > 0 && style.display !== 'none';
      }, hamburger)
    : false;

  let mobileSheetWorks = false;
  if (hamburger && hamburgerVisible) {
    await hamburger.click();
    await new Promise((r) => setTimeout(r, 600));
    const sheet = await page.$('[data-slot="sheet-content"]');
    mobileSheetWorks = !!sheet;
    await page.keyboard.press('Escape');
    await new Promise((r) => setTimeout(r, 400));
  }

  return { hamburgerVisible, desktopNavVisible: false, mobileSheetWorks };
}

async function checkAiPanel(page, width) {
  const sparklesBtn = await page.$('header button[aria-label*="AI assistant"], header button[title*="Ask AI"]');
  if (!sparklesBtn) {
    return { aiButtonFound: false, panelMode: 'none', dockedInline: false, bottomSheet: false };
  }

  async function readAiState() {
    return page.evaluate(() => {
      const panels = Array.from(document.querySelectorAll('[aria-label="Cynthia AI assistant"]'));
      const panel = panels.find((p) => {
        const rect = p.getBoundingClientRect();
        return rect.width > 10 && rect.height > 10;
      });
      if (!panel) return { found: false };

      let node = panel.parentElement;
      let inFixedWrapper = false;
      let inDockedWrapper = false;
      while (node) {
        const cls = typeof node.className === 'string' ? node.className : '';
        const style = window.getComputedStyle(node);
        if (cls.includes('fixed') && style.position === 'fixed' && style.display !== 'none') {
          inFixedWrapper = true;
        }
        if (cls.includes('lg:flex') && style.display === 'flex') {
          inDockedWrapper = true;
        }
        node = node.parentElement;
      }

      const panelRect = panel.getBoundingClientRect();
      return {
        found: true,
        panelWidth: Math.round(panelRect.width),
        panelHeight: Math.round(panelRect.height),
        panelTop: Math.round(panelRect.top),
        isFixedBottom: inFixedWrapper,
        isDockedInline: inDockedWrapper,
        viewportWidth: window.innerWidth,
      };
    });
  }

  let aiState = await readAiState();
  if (!aiState.found) {
    await page.evaluate(() => {
      const btn = document.querySelector('header button[aria-label*="AI assistant"], header button[title*="Ask AI"]');
      btn?.click();
    });
    await new Promise((r) => setTimeout(r, 1200));
    aiState = await readAiState();
  }

  // Close panel without breaking subsequent tests
  await page.evaluate(() => {
    const close = document.querySelector('[aria-label="Cynthia AI assistant"] [aria-label="Close assistant"]');
    close?.click();
  });
  await new Promise((r) => setTimeout(r, 300));

  const isWide = width >= 1024;
  const expectedDocked = isWide;
  const expectedBottomSheet = !isWide;

  return {
    aiButtonFound: true,
    panelMode: aiState.isDockedInline ? 'docked-inline' : aiState.isFixedBottom ? 'bottom-sheet' : 'unknown',
    dockedInline: aiState.isDockedInline,
    bottomSheet: aiState.isFixedBottom,
    expectedDocked,
    expectedBottomSheet,
    aiBehaviorCorrect:
      aiState.found &&
      ((expectedDocked && aiState.isDockedInline) ||
        (expectedBottomSheet && aiState.isFixedBottom)),
    panelWidth: aiState.panelWidth,
    viewportWidth: aiState.viewportWidth,
  };
}

function assessRoute(result) {
  const issues = [];
  if (result.overflow.hasHorizontalOverflow) {
    issues.push(`Page horizontal overflow: ${result.overflow.overflowPx}px`);
  }
  if (result.breakpoint.width < 768 && !result.nav.hamburgerVisible) {
    issues.push('Mobile hamburger menu not visible');
  }
  if (result.breakpoint.width < 768 && result.nav.hamburgerVisible && !result.nav.mobileSheetWorks) {
    issues.push('Mobile nav sheet did not open');
  }
  if (result.breakpoint.width >= 768 && !result.nav.desktopNavVisible) {
    issues.push('Desktop sidebar not visible at tablet/desktop');
  }
  result.overflow.tables.forEach((t) => {
    if (t.tableOverflowPx > 2 && !t.hasOverflowWrapper) {
      issues.push(`Table ${t.index} overflows without scroll wrapper (${t.tableOverflowPx}px)`);
    }
  });
  return { status: issues.length === 0 ? 'Pass' : 'Issue', issues };
}

async function run() {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  const page = await browser.newPage();
  const results = [];
  const aiResults = [];

  try {
    console.log(`Logging in at ${BASE_URL}...`);
    await login(page);
    console.log('Login successful.\n');

    for (const bp of BREAKPOINTS) {
      console.log(`\n=== ${bp.name.toUpperCase()} (${bp.width}x${bp.height}) ===`);
      await page.setViewport({ width: bp.width, height: bp.height, deviceScaleFactor: 1 });
      await login(page);

      for (const route of ROUTES) {
        process.stdout.write(`  ${route.label} (${route.path})... `);

        try {
          await navigateInApp(page, route.path);

          const overflow = await measureOverflow(page);
          const nav = await checkMobileNav(page, bp.width);
          const assessment = assessRoute({ overflow, nav, breakpoint: bp });

          const shotName = `${bp.name}-${route.label.replace(/\s+/g, '-')}.png`;
          const shotPath = path.join(SCREENSHOT_DIR, shotName);
          await page.screenshot({ path: shotPath, fullPage: false });

          const entry = {
            route: route.path,
            label: route.label,
            breakpoint: bp.name,
            width: bp.width,
            overflow,
            nav,
            assessment,
            screenshot: `screenshots/${shotName}`,
          };
          results.push(entry);

          console.log(assessment.status + (assessment.issues.length ? ` — ${assessment.issues.join('; ')}` : ''));
        } catch (err) {
          console.log(`ERROR — ${err.message}`);
          results.push({
            route: route.path,
            label: route.label,
            breakpoint: bp.name,
            width: bp.width,
            assessment: { status: 'Error', issues: [err.message] },
          });
        }
      }

      // AI panel check once per breakpoint on dashboard
      process.stdout.write(`  AI panel behavior... `);
      await navigateInApp(page, '/');
      await new Promise((r) => setTimeout(r, 800));
      const aiCheck = await checkAiPanel(page, bp.width);
      aiResults.push({ breakpoint: bp.name, width: bp.width, ...aiCheck });
      console.log(
        aiCheck.aiBehaviorCorrect ? 'Pass' : `Issue — mode: ${aiCheck.panelMode}, expected ${aiCheck.expectedDocked ? 'docked-inline' : 'bottom-sheet'}`,
      );
    }

    // Extra table-focused mobile checks
    console.log('\n=== TABLE SPOT-CHECKS (mobile 375px) ===');
    await page.setViewport({ width: 375, height: 812 });
    await login(page);
    const tableResults = [];

    for (const route of TABLE_ROUTES) {
      process.stdout.write(`  ${route.label}... `);
      await navigateInApp(page, route.path);
      const overflow = await measureOverflow(page);
      const issues = [];
      if (overflow.hasHorizontalOverflow) issues.push(`Page overflow ${overflow.overflowPx}px`);
      overflow.tables.forEach((t) => {
        if (t.tableOverflowPx > 2 && !t.hasOverflowWrapper) {
          issues.push(`Table ${t.index} unwrapped overflow ${t.tableOverflowPx}px`);
        }
      });
      const status = issues.length === 0 ? 'Pass' : 'Issue';
      tableResults.push({ route: route.path, label: route.label, overflow, status, issues });
      console.log(status + (issues.length ? ` — ${issues.join('; ')}` : ''));
    }

    const summary = {
      auditedAt: new Date().toISOString(),
      baseUrl: BASE_URL,
      totalChecks: results.length,
      passed: results.filter((r) => r.assessment?.status === 'Pass').length,
      issues: results.filter((r) => r.assessment?.status === 'Issue').length,
      errors: results.filter((r) => r.assessment?.status === 'Error').length,
      aiChecks: aiResults,
      tableChecks: tableResults,
      results,
    };

    fs.writeFileSync(path.join(OUT_DIR, 'audit-results.json'), JSON.stringify(summary, null, 2));

    // Markdown report
    let md = `# Responsive QA Audit Report\n\n`;
    md += `**Date:** ${summary.auditedAt}\n`;
    md += `**Base URL:** ${BASE_URL}\n\n`;
    md += `## Summary\n\n`;
    md += `| Metric | Count |\n|--------|-------|\n`;
    md += `| Total route checks | ${summary.totalChecks} |\n`;
    md += `| Passed | ${summary.passed} |\n`;
    md += `| Issues | ${summary.issues} |\n`;
    md += `| Errors | ${summary.errors} |\n\n`;

    md += `## AI Panel Behavior\n\n`;
    md += `| Breakpoint | Width | Mode | Expected | Status |\n`;
    md += `|------------|-------|------|----------|--------|\n`;
    for (const ai of aiResults) {
      md += `| ${ai.breakpoint} | ${ai.width}px | ${ai.panelMode} | ${ai.expectedDocked ? 'docked-inline' : 'bottom-sheet'} | ${ai.aiBehaviorCorrect ? 'Pass' : 'Issue'} |\n`;
    }

    md += `\n## Table Spot-Checks (Mobile 375px)\n\n`;
    md += `| Route | Status | Notes |\n|-------|--------|-------|\n`;
    for (const t of tableResults) {
      md += `| ${t.label} | ${t.status} | ${t.issues.length ? t.issues.join('; ') : 'OK'} |\n`;
    }

    md += `\n## Route × Breakpoint Matrix\n\n`;
    md += `| Route | Mobile (375) | Tablet (768) | Desktop (1440) |\n`;
    md += `|-------|--------------|--------------|----------------|\n`;
    for (const route of ROUTES) {
      const mobile = results.find((r) => r.route === route.path && r.breakpoint === 'mobile');
      const tablet = results.find((r) => r.route === route.path && r.breakpoint === 'tablet');
      const desktop = results.find((r) => r.route === route.path && r.breakpoint === 'desktop');
      md += `| ${route.label} | ${mobile?.assessment?.status || '—'} | ${tablet?.assessment?.status || '—'} | ${desktop?.assessment?.status || '—'} |\n`;
    }

    md += `\n## Issues Detail\n\n`;
    const issueEntries = results.filter((r) => r.assessment?.status === 'Issue');
    if (issueEntries.length === 0) {
      md += `No issues found.\n`;
    } else {
      for (const r of issueEntries) {
        md += `### ${r.label} — ${r.breakpoint} (${r.width}px)\n`;
        md += `- ${r.assessment.issues.join('\n- ')}\n`;
        if (r.screenshot) md += `- Screenshot: [${r.screenshot}](${r.screenshot})\n`;
        md += `\n`;
      }
    }

    fs.writeFileSync(path.join(OUT_DIR, 'REPORT.md'), md);

    console.log(`\n\nAudit complete.`);
    console.log(`  Passed: ${summary.passed}/${summary.totalChecks}`);
    console.log(`  Issues: ${summary.issues}`);
    console.log(`  Report: docs/responsive-audit/REPORT.md`);
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error('Audit failed:', err);
  process.exit(1);
});
