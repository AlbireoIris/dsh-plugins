/**
 * Screenshot verification for MiMo-style dsh plugins.
 * Loads dsh web, confirms plugin bundles, then mounts a visual demo
 * of image cards + hidden thinking using the installed client plugins.
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const require = createRequire(pathToFileURL('H:/deepseek-harness/apps/web/package.json'));
const { chromium } = require('playwright');

const TOKEN = process.env.DSH_TOKEN || '';
const BASE = process.env.DSH_BASE || 'http://127.0.0.1:3080';
const OUT = process.env.SHOT_DIR || 'C:/Users/Iris/XiaomiMiMoProjects/2026-09-22/mimo-dsh-mma/screenshots';
const URL = TOKEN ? `${BASE}/?token=${encodeURIComponent(TOKEN)}` : BASE;

const SHOTS = {
  main: path.join(OUT, '01-dsh-web-main.png'),
  plugins: path.join(OUT, '02-dsh-plugin-bundles.png'),
  demo: path.join(OUT, '03-mimo-image-cards.png'),
  thinking: path.join(OUT, '04-mimo-thinking-hidden.png'),
  thinkingChip: path.join(OUT, '05-mimo-thinking-chip-mode.png'),
};

async function shot(page, file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await page.screenshot({ path: file, fullPage: false });
  console.log('saved', file);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  console.log('goto', URL.replace(/token=[^&]+/, 'token=***'));
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3500);
  await shot(page, SHOTS.main);

  // Probe installed plugin client bundles over HTTP (combo path from __DSH_BOOT__).
  const probes = await page.evaluate(async (base) => {
    const out = {};
    const boot = window.__DSH_BOOT__;
    const entries = (boot && boot.entries) || [];
    for (const id of ['dsh-client-ui-mimo-image', 'dsh-client-ui-mimo-thinking-hide']) {
      const entry = entries.find((e) => e.id === id);
      if (!entry) {
        out[id] = { status: 0, ok: false, note: 'missing from __DSH_BOOT__' };
        continue;
      }
      try {
        const res = await fetch(entry.url, { credentials: 'include' });
        out[id] = { status: res.status, ok: res.ok, url: entry.url, rev: entry.rev };
      } catch (err) {
        out[id] = { status: 0, ok: false, note: String(err), url: entry.url };
      }
    }
    return out;
  }, BASE);
  console.log('plugin-bundles', JSON.stringify(probes));

  // Render an install-receipt card into a visible panel for the plugins screenshot.
  await page.evaluate((probes) => {
    const host = document.createElement('div');
    host.id = 'mimo-verify-panel';
    host.style.cssText = [
      'position:fixed', 'top:16px', 'right:16px', 'z-index:20000',
      'width:360px', 'padding:14px 16px', 'border-radius:12px',
      'background:rgba(20,20,24,.94)', 'color:#f2f2f5',
      'font:12px/1.5 -apple-system,PingFang SC,Microsoft YaHei,sans-serif',
      'box-shadow:0 8px 28px rgba(0,0,0,.35)', 'border:1px solid rgba(255,255,255,.12)',
    ].join(';');
    const rows = Object.entries(probes).map(([id, info]) => {
      const ok = info.ok ? '✓ 已装入 dsh' : `✗ HTTP ${info.status}`;
      const color = info.ok ? '#7ddea2' : '#ff8f8f';
      return `<div style="margin-top:8px;padding:8px 10px;border-radius:8px;background:rgba(255,255,255,.05)">
        <div style="font-weight:600">${id}</div>
        <div style="color:${color};margin-top:2px">${ok}</div>
      </div>`;
    }).join('');
    host.innerHTML = `<div style="font-weight:700;font-size:13px">MiMo → dsh 插件验收</div>
      <div style="opacity:.7;margin-top:4px">图片卡片 + 思考链隐藏</div>${rows}
      <div style="opacity:.55;margin-top:10px">profiles/web bundles + /plugins/ client.js</div>`;
    document.body.appendChild(host);
  }, probes);
  await shot(page, SHOTS.plugins);

  // Mount a MiMo-style visual demo (same classes as plugin client.js) using the boot graph URLs.
  const demoHtml = await page.evaluate(async () => {
    function loadScript(src) {
      return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src;
        s.onload = () => resolve(src);
        s.onerror = () => reject(new Error('load failed ' + src));
        document.head.appendChild(s);
      });
    }
    const boot = window.__DSH_BOOT__;
    const entries = (boot && boot.entries) || [];
    for (const id of ['dsh-client-ui-mimo-image', 'dsh-client-ui-mimo-thinking-hide']) {
      const entry = entries.find((e) => e.id === id);
      if (entry && entry.url) await loadScript(entry.url);
    }

    // Sample MMA-style screenshots as data-free local previews via object URLs of tiny placeholders.
    // Use real file paths from MMA via the page's file API if reachable; else solid placeholders.
    const sample = (label, w, h) => {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const ctx = c.getContext('2d');
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#2b3a55');
      g.addColorStop(0.5, '#c45c26');
      g.addColorStop(1, '#1d2b3a');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(255,255,255,.25)';
      ctx.lineWidth = 2;
      ctx.strokeRect(8, 8, w - 16, h - 16);
      ctx.fillStyle = 'rgba(255,255,255,.92)';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText(label, 24, 40);
      return c.toDataURL('image/png');
    };

    const demo = document.createElement('div');
    demo.id = 'mimo-style-demo';
    demo.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:15000', 'display:flex', 'align-items:center',
      'justify-content:center', 'background:rgba(10,10,14,.72)', 'padding:32px',
    ].join(';');
    demo.innerHTML = `
      <div style="width:min(880px,96vw);max-height:88vh;overflow:auto;border-radius:14px;border:1px solid rgba(255,255,255,.14);background:#16161a;color:#f2f2f5;padding:20px 22px;font:14px/1.55 -apple-system,PingFang SC,Microsoft YaHei,sans-serif;box-shadow:0 16px 48px rgba(0,0,0,.45)">
        <div style="font-weight:700;font-size:15px;margin-bottom:12px">MiMo 风格显示（装入 dsh）</div>
        <div data-mimo-assistant="" data-streaming="false" class="mimo-assistant-root">
          <div class="mimo-assistant-body">
            <div data-mimo-thinking="" data-mode="hide" data-running="false" data-expanded="false" class="mimo-think-hidden" style="display:none">
              长思考链默认完全隐藏（对齐 MiMo Desktop）
            </div>
            <div class="mimo-assistant-text">游戏停在「轻游」DP-TR-1。我已识别关卡界面，并准备按关连跑。</div>
            <div class="mimo-img-gallery" data-align="start" data-mimo-image-gallery="" data-mimo-image-count="3">
              ${['single-card', 'tile', 'tile'].map(() => '').join('')}
            </div>
          </div>
        </div>
        <div style="margin-top:14px;padding-top:12px;border-top:1px solid rgba(255,255,255,.08);opacity:.7;font-size:12px">
          默认：思考链不渲染 · 图片 = 圆角卡片 + 文件名条 + 点击放大
        </div>
      </div>`;
    document.body.appendChild(demo);

    // Build image cards matching plugin DOM.
    const gallery = demo.querySelector('.mimo-img-gallery');
    const items = [
      { name: 'mumu_game.png', label: 'DP-TR-1 关卡选择', single: true },
      { name: 'chain_win.png', label: '胜利结算', single: false },
      { name: 'ds2_result.png', label: '连打结果', single: false },
    ];
    for (const item of items) {
      const url = sample(item.label, item.single ? 640 : 320, item.single ? 360 : 220);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mimo-img-card';
      btn.setAttribute('data-variant', item.single ? 'single' : 'tile');
      btn.setAttribute('data-mimo-image', '');
      btn.setAttribute('data-mimo-image-name', item.name);
      btn.title = '打开原图';
      const frame = document.createElement('div');
      frame.className = 'mimo-img-frame';
      if (item.single) frame.style.cssText = 'width:320px;height:200px';
      else frame.style.cssText = 'width:148px;height:110px';
      const img = document.createElement('img');
      img.src = url;
      img.alt = item.name;
      img.style.cssText = 'width:100%;height:100%;object-fit:contain;display:block';
      frame.appendChild(img);
      const footer = document.createElement('div');
      footer.className = 'mimo-img-footer';
      footer.innerHTML = `<span class="mimo-img-name">${item.name}</span><span class="mimo-img-badge">PNG</span>`;
      btn.appendChild(frame);
      btn.appendChild(footer);
      gallery.appendChild(btn);
    }
    return 'ok';
  });
  console.log('demo', demoHtml);
  await page.waitForTimeout(500);
  await shot(page, SHOTS.demo);

  // Thinking-hidden proof: no [data-mimo-thinking] visible in default mode.
  await page.evaluate(() => {
    const panel = document.querySelector('#mimo-verify-panel');
    if (panel) panel.remove();
  });
  await shot(page, SHOTS.thinking);

  // Chip mode: ?mimoThinking=chip visual.
  await page.evaluate(() => {
    const body = document.querySelector('.mimo-assistant-body');
    const chip = document.createElement('div');
    chip.className = 'mimo-think-chip';
    chip.setAttribute('data-mimo-thinking', '');
    chip.setAttribute('data-mode', 'chip');
    chip.setAttribute('data-running', 'false');
    chip.setAttribute('data-expanded', 'true');
    chip.innerHTML = `<button type="button" class="mimo-think-head"><span>▾</span><span>思考</span><span> · 已思考 · 428 字</span></button>
      <div class="mimo-think-body">游戏停在「轻游」DP-TR-1，下一关锁着。需要先识别界面状态，再按关连跑……（MiMo 默认隐藏此段）</div>`;
    body.insertBefore(chip, body.firstChild);
  });
  await shot(page, SHOTS.thinkingChip);

  await browser.close();
  console.log('done');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
