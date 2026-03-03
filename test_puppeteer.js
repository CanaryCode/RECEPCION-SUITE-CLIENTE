const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.text().includes('DEBUG-GALLERY')) {
        console.log(`[BROWSER-${msg.type()}] ${msg.text()}`);
    }
  });

  await page.goto('http://localhost:3000');
  await page.waitForTimeout(3000); // 3 sec wait
  
  await page.evaluate(() => {
    document.querySelector('button[data-bs-target="#gallery-content"]').click();
  });
  
  await page.waitForTimeout(5000); // wait for gallery to start loading
  await browser.close();
})();
