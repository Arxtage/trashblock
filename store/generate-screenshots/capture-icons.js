const puppeteer = require('puppeteer');
const path = require('path');

const ICONS_DIR = path.join(__dirname, '..', '..', 'icons');

const sizes = [16, 48, 128];

async function capture() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  // Render at 128px (native size of the template)
  await page.setViewport({ width: 128, height: 128, deviceScaleFactor: 1 });
  const filePath = `file://${path.join(__dirname, 'icon-template.html')}`;
  await page.goto(filePath, { waitUntil: 'networkidle0' });

  for (const size of sizes) {
    // Set viewport + deviceScaleFactor to get crisp rendering at each size
    await page.setViewport({ width: 128, height: 128, deviceScaleFactor: size / 128 });
    await page.goto(filePath, { waitUntil: 'networkidle0' });

    const outputPath = path.join(ICONS_DIR, `icon${size}.png`);
    await page.screenshot({
      path: outputPath,
      clip: { x: 0, y: 0, width: 128, height: 128 },
      omitBackground: true,
    });

    console.log(`Captured icon${size}.png`);
  }

  await browser.close();
  console.log(`\nIcons saved to ${ICONS_DIR}`);
}

capture().catch(err => {
  console.error('Icon capture failed:', err);
  process.exit(1);
});
