'use strict';
/**
 * 页面截图工具（Edge headless + CDP）。
 * 用法：node test/shot.js [输出目录]
 * 默认截 4 张：中文首页、英文首页、中文设置弹窗、英文设备详情。
 */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PORT = 9334;
const BASE = process.env.MIJIA_URL || 'http://127.0.0.1:8899/';
const OUT = path.resolve(process.argv[2] || path.join(__dirname, '..', '.workbuddy', 'tmp'));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function findEdge() {
  return [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ].find((p) => fs.existsSync(p));
}

(async () => {
  const edge = findEdge();
  if (!edge) {
    console.error('未找到 Edge/Chrome');
    process.exit(2);
  }
  fs.mkdirSync(OUT, { recursive: true });
  const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mijia-shot-'));
  const child = spawn(edge, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${userDir}`,
    '--window-size=1440,1040', 'about:blank',
  ], { stdio: 'ignore' });

  let targets = null;
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      if (r.ok) { targets = await r.json(); if (targets.length) break; }
    } catch (_) { /* 还没起来 */ }
    await sleep(200);
  }
  if (!targets || !targets.length) {
    console.error('CDP 未就绪');
    child.kill();
    process.exit(2);
  }

  const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let seq = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg.result); pending.delete(msg.id); }
  };
  const send = (method, params = {}) => new Promise((res) => {
    const id = ++seq;
    pending.set(id, res);
    ws.send(JSON.stringify({ id, method, params }));
  });

  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1040, deviceScaleFactor: 1, mobile: false });

  // 只截演示模式：设备名/房间名都是虚构数据，截图可直接用于文档
  const shots = [
    ['zh-home.png', BASE + '?lang=zh'],
    ['en-home.png', BASE + '?lang=en'],
    ['zh-settings.png', BASE + '?lang=zh&settings=demo-washer'],
    ['en-detail.png', BASE + '?lang=en&did=demo-washer'],
  ];

  for (const [name, url] of shots) {
    await send('Page.navigate', { url });
    await sleep(4200);
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    const file = path.join(OUT, name);
    fs.writeFileSync(file, Buffer.from(data, 'base64'));
    console.log('✓', name, '→', file);
  }

  ws.close();
  child.kill();
  fs.rmSync(userDir, { recursive: true, force: true });
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
