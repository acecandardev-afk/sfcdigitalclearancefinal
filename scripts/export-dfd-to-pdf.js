/**
 * Exports all DFDs to a single PDF file.
 * Run: node scripts/export-dfd-to-pdf.js
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

async function exportToPdf() {
  const puppeteer = require('puppeteer');
  const path = await import('path');
  const { fileURLToPath } = await import('url');
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const viewAllPath = path.join(__dirname, '..', '@docs', 'DFD_View_All.html');
  const pdfPath = path.join(__dirname, '..', '@docs', 'DFD_All_Diagrams.pdf');

  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.goto(`file://${viewAllPath.replace(/\\/g, '/')}`, { waitUntil: 'networkidle0' });
  await page.pdf({ path: pdfPath, format: 'A4', printBackground: true });
  await browser.close();
  console.log('Saved:', pdfPath);
}

exportToPdf().catch(console.error);
