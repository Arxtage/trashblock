const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const SCREENSHOTS_DIR = path.join(__dirname, '..', 'screenshots');

const pages = [
  { file: 'screenshot-blocked.html',  output: 'screenshot-1-blocked.png',  width: 1280, height: 800 },
  { file: 'screenshot-popup.html',    output: 'screenshot-2-popup.png',    width: 1280, height: 800 },
  { file: 'screenshot-unlock.html',   output: 'screenshot-3-unlock.png',   width: 1280, height: 800 },
  { file: 'screenshot-schedule.html', output: 'screenshot-4-schedule.png', width: 1280, height: 800 },
  { file: 'promo-small.html',         output: 'promo-small.png',           width: 440,  height: 280 },
  { file: 'promo-large.html',         output: 'promo-large.png',           width: 920,  height: 680 },
  { file: 'promo-marquee.html',       output: 'promo-marquee.png',         width: 1400, height: 560 },
];

async function capture() {
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }

  const browser = await puppeteer.launch();

  for (const { file, output, width, height } of pages) {
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 1 });

    const filePath = `file://${path.join(__dirname, file)}`;
    await page.goto(filePath, { waitUntil: 'networkidle0' });

    const outputPath = path.join(SCREENSHOTS_DIR, output);
    await page.screenshot({ path: outputPath, clip: { x: 0, y: 0, width, height } });

    console.log(`Captured ${output} (${width}x${height})`);
    await page.close();
  }

  await browser.close();
  console.log(`\nAll screenshots saved to ${SCREENSHOTS_DIR}`);
}

capture().catch(err => {
  console.error('Capture failed:', err);
  process.exit(1);
});
