const puppeteer = require('puppeteer-core');
const path = require('path');

async function run() {
  console.log('Starting browser test...');
  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
    });

    const page = await browser.newPage();

    page.on('console', msg => {
      console.log(`[BROWSER CONSOLE] ${msg.type().toUpperCase()}: ${msg.text()}`);
    });

    page.on('pageerror', err => {
      console.error(`[BROWSER ERROR]: ${err.toString()}`);
    });

    console.log('Navigating to http://localhost:5173/...');
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0', timeout: 15000 });

    console.log('Page loaded. Waiting 3 seconds for rendering...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    const screenshotPath = path.resolve(__dirname, 'screenshot.png');
    console.log(`Taking screenshot to: ${screenshotPath}`);
    await page.screenshot({ path: screenshotPath });
    console.log('Screenshot captured successfully!');

  } catch (error) {
    console.error('An error occurred during browser test:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
    console.log('Browser closed.');
  }
}

run();
