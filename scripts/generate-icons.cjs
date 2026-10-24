const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage();
  
  const svgPath = path.resolve(__dirname, '../public/themes/miku/miku-icon.svg');
  const svgContent = fs.readFileSync(svgPath, 'utf8');

  async function renderIcon(size, outRelPath) {
    const outPath = path.resolve(__dirname, '../', outRelPath);
    await page.setViewportSize({ width: size, height: size });
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: ${size}px; height: ${size}px; overflow: hidden; background: transparent; }
    svg { width: 100%; height: 100%; display: block; }
  </style>
</head>
<body>
  ${svgContent}
</body>
</html>`;
    await page.setContent(html);
    await page.waitForTimeout(100);
    const buf = await page.screenshot({ omitBackground: true, type: 'png' });
    fs.writeFileSync(outPath, buf);
    console.log('Rendered ' + outRelPath + ' size: ' + size + 'x' + size + ' (' + (buf.length / 1024).toFixed(1) + ' KB)');
  }

  await renderIcon(512, 'public/icon-512.png');
  await renderIcon(192, 'public/icon-192.png');
  await renderIcon(180, 'public/apple-touch-icon.png');
  
  fs.copyFileSync(svgPath, path.resolve(__dirname, '../public/favicon.svg'));
  console.log('Updated public/favicon.svg');

  await browser.close();
})().catch(e => {
  console.error(e);
  process.exit(1);
});
