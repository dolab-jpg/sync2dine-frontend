const { chromium } = require("C:/Users/dolab/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright-core");
const fs = require("fs");
const path = require("path");
(async () => {
  const out = path.resolve("C:/Users/dolab/Downloads/sync2dine-frontend/.cursor/local/nav-audit");
  fs.mkdirSync(out, { recursive: true });
  const envText = fs.readFileSync("C:/Users/dolab/Downloads/sync2dine-frontend/.env.production.local", "utf8");
  const env = Object.fromEntries(envText.split(/\r?\n/).filter(l => l && !l.startsWith("#") && l.includes("=")).map(l => {
    const i = l.indexOf("="); return [l.slice(0,i), l.slice(i+1)];
  }));
  const password = JSON.parse(fs.readFileSync("C:/Users/dolab/Downloads/sync2dine-frontend/.cursor/local/login-diag-real.json", "utf8")).password;
  const authRes = await fetch(`${env.VITE_SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email: "owner@sync2dine.io", password }),
  });
  const auth = await authRes.json();
  if (!auth.access_token) throw new Error("login failed " + JSON.stringify(auth).slice(0,200));
  const browser = await chromium.launch({
    executablePath: "C:/Users/dolab/AppData/Local/ms-playwright/chromium-1187/chrome-win/chrome.exe",
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  await page.goto("https://app.sync2dine.io/login", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.evaluate(({ session, supabaseUrl }) => {
    const storageKey = `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;
    localStorage.setItem(storageKey, JSON.stringify(session));
    localStorage.setItem("tradepro_session_user", JSON.stringify({ id: session.user?.id, name: "Platform Owner", email: session.user?.email, role: session.user?.user_metadata?.role || "platform_owner" }));
    localStorage.setItem("authUser", JSON.stringify({ id: session.user?.id, name: "Platform Owner", email: session.user?.email, role: session.user?.user_metadata?.role || "platform_owner" }));
  }, { session: auth, supabaseUrl: env.VITE_SUPABASE_URL });
  await page.goto("https://app.sync2dine.io/calls", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: path.join(out, "calls-live-dialling.png") });
  console.log("saved calls-live-dialling.png");
  await page.goto("https://app.sync2dine.io/crm", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(4000);
  try { await page.getByRole("tab", { name: /call queue|queue/i }).first().click({ timeout: 3000 }); } catch {}
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(out, "crm-call-queue-after-dial.png") });
  console.log("saved crm-call-queue-after-dial.png");
  const body = await page.locator("body").innerText();
  console.log(body.split(/\n/).map(s=>s.trim()).filter(s=>/dial|queue|running|called|on call|needs/i.test(s)).slice(0,25).join(" | "));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
