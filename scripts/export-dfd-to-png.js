/**
 * Exports DFD Admin HTML to HD PNG.
 * Run: node scripts/export-dfd-to-png.js
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

async function exportDfd() {
  const puppeteer = require('puppeteer');
  const path = await import('path');
  const { fileURLToPath } = await import('url');
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const htmlPath = path.join(__dirname, '..', '@docs', 'DFD_Admin.html');
  const pngPath = path.join(__dirname, '..', '@docs', 'DFD_Admin.png');

  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 2 });
  await page.goto(`file://${htmlPath.replace(/\\/g, '/')}`, { waitUntil: 'networkidle0' });
  await page.screenshot({ path: pngPath, fullPage: true });
  await browser.close();
  console.log('Saved:', pngPath);
}

exportDfd().catch(console.error);
