import puppeteer from 'puppeteer';
import { mkdir, readdir } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';

const DIR = join(fileURLToPath(new URL('.', import.meta.url)), 'temporary screenshots');
const url   = process.argv[2] || 'http://localhost:3000';
const label = process.argv[3] ? `-${process.argv[3]}` : '';

await mkdir(DIR, { recursive: true });

const existing = await readdir(DIR).catch(() => []);
const nums = existing
  .map(f => parseInt(f.match(/^screenshot-(\d+)/)?.[1]))
  .filter(n => !isNaN(n));
const next = nums.length ? Math.max(...nums) + 1 : 1;

const outFile = join(DIR, `screenshot-${next}${label}.png`);

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });
await page.screenshot({ path: outFile, fullPage: true });
await browser.close();

console.log('Screenshot saved:', outFile);
