const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const http = require("http");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "test-results");

let pw;
try {
  pw = require("playwright-core");
} catch {
  pw = null;
}

// FHD=PCの実寸、iPhone 17=CSSビューポート402x874・DPR3
const DEVICES = [
  { name: "pc-fhd-1920x1080", viewport: { width: 1920, height: 1080 } },
  {
    name: "iphone-17-402x874",
    viewport: { width: 402, height: 874 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1",
  },
];

const MIME = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript" };

// file://だとlocalStorageが使えないため、リポジトリ直下を配信する最小サーバ
function serve() {
  const server = http.createServer((req, res) => {
    const file = path.normalize(path.join(ROOT, new URL(req.url, "http://x").pathname));
    if (!file.startsWith(ROOT)) {
      res.writeHead(403);
      res.end();
      return;
    }
    fs.readFile(file === ROOT ? path.join(ROOT, "index.html") : file, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end();
        return;
      }
      res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
      res.end(data);
    });
  });
  return new Promise((resolve) => server.listen(0, () => resolve(server)));
}

describe("画面スクショ", { skip: !pw && "playwright-core未導入のためスキップ" }, () => {
  for (const d of DEVICES) {
    it(`${d.name} でindex.htmlを撮影しtest-results/に保存する`, async (t) => {
      const server = await serve();
      let browser;
      try {
        browser = await pw.chromium.launch();
      } catch (e) {
        server.close();
        t.skip(`Chromiumを起動できないためスキップ: ${String(e).split("\n")[0]}`);
        return;
      }
      try {
        const { name, ...contextOpts } = d;
        const page = await browser.newPage({ locale: "ja-JP", timezoneId: "Asia/Tokyo", ...contextOpts });
        await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
        await page.click("#btnAuto"); // 結果表まで描画された状態を撮る
        fs.mkdirSync(OUT, { recursive: true });
        const file = path.join(OUT, `${d.name}.png`);
        await page.screenshot({ path: file, fullPage: true });
        assert.ok(fs.statSync(file).size > 0);
      } finally {
        await browser.close();
        server.close();
      }
    });
  }
});
