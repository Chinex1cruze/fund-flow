const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async ()=>{
  const pages = [
    'dashboard.html',
    'deposit.html',
    'withdraw.html',
    'transactions.html',
    'vip.html',
    'referral.html',
    'profile.html',
    'login.html',
    'register.html',
    'admin.html'
  ];

  const widths = [320,360,375,390,414,430,768,1024];
  const outDir = path.resolve(__dirname, '../files/screenshots');
  if(!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const browser = await puppeteer.launch({ args: ['--no-sandbox','--disable-setuid-sandbox'] });
  try{
    for(const pageFile of pages){
      const pagePath = path.resolve(__dirname, '../', pageFile);
      if(!fs.existsSync(pagePath)){
        console.warn('Skipping, not found:', pageFile);
        continue;
      }
      for(const w of widths){
        const page = await browser.newPage();
        const height = Math.max(800, Math.floor(w * 1.8));
        await page.setViewport({ width: w, height, deviceScaleFactor: 2 });
        const url = 'file://' + pagePath.replace(/\\/g, '/');
        try{
          await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        }catch(e){
          // still try to continue
          console.warn('goto failed for', url, e.message);
        }
        // small wait for client-side scripts to render
        await page.waitForTimeout(800);
        const filename = `${path.basename(pageFile, '.html')}-${w}.png`;
        const outPath = path.join(outDir, filename);
        await page.screenshot({ path: outPath, fullPage: true });
        console.log('Saved', outPath);
        await page.close();
      }
    }
  }catch(err){
    console.error(err);
  }finally{
    await browser.close();
  }
  console.log('Done');
})();
