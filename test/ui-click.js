'use strict';
/**
 * 真实浏览器交互测试（Edge headless + CDP）：
 * 验证点击事件、设置弹窗、图标选择、卡片尺寸、语言切换等
 * 仅靠 dump-dom 无法覆盖的行为。
 * 运行：node test/ui-click.js
 */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PORT = 9333;
const BASE = process.env.MIJIA_URL || 'http://127.0.0.1:8899/';

function findEdge() {
  const cands = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ];
  return cands.find((p) => fs.existsSync(p));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const edge = findEdge();
  if (!edge) {
    console.error('未找到 Edge/Chrome');
    process.exit(2);
  }
  const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mijia-edge-'));
  const child = spawn(edge, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${userDir}`,
    '--window-size=1440,900', 'about:blank',
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
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  };
  const send = (method, params = {}) => new Promise((res) => {
    const id = ++seq;
    pending.set(id, res);
    ws.send(JSON.stringify({ id, method, params }));
  });
  const evalJs = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    return r.result && r.result.result ? r.result.result.value : undefined;
  };

  await send('Page.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: 'window.__errCount = 0; window.addEventListener("error", () => { window.__errCount++; });',
  });
  await send('Page.navigate', { url: BASE });
  await sleep(2600);

  let failed = 0;
  const check = (cond, name, extra) => {
    console.log(`${cond ? '✓' : '✗'} ${name}${extra != null ? '  → ' + JSON.stringify(extra) : ''}`);
    if (!cond) failed++;
  };

  // 1) 房间管理按钮
  const roomAction = await evalJs("document.querySelector('#btnRoomManage').dataset.action");
  check(roomAction === 'room-manage', '房间管理按钮已绑定事件', roomAction);
  const roomTitle = await evalJs(`(async () => {
    document.querySelector('#btnRoomManage').click();
    await new Promise(r => setTimeout(r, 350));
    return document.querySelector('#modalRoot .modal-title')?.textContent.trim() || '';
  })()`);
  check(/房间管理/.test(roomTitle), '点击后打开房间管理弹窗', roomTitle);
  await evalJs("document.querySelector('#modalRoot [data-action=\\\"modal-close\\\"]')?.click(); 1");

  // 2) 刷新按钮
  const refreshAction = await evalJs("document.querySelector('#btnRefresh').dataset.action");
  check(refreshAction === 'refresh', '刷新设备按钮已绑定事件', refreshAction);

  // 3) 更多设置与信息
  const devTitle = await evalJs(`(async () => {
    document.querySelector('.dev-card').click();
    await new Promise(r => setTimeout(r, 250));
    return document.querySelector('#modalRoot .modal-title')?.textContent.trim() || '';
  })()`);
  check(!!devTitle, '打开设备详情弹窗', devTitle);
  const settingsTitle = await evalJs(`(async () => {
    document.querySelector('.more-link').click();
    await new Promise(r => setTimeout(r, 300));
    return document.querySelector('#modalRoot .modal-title')?.textContent.trim() || '';
  })()`);
  check(/设备设置/.test(settingsTitle), '「更多设置与信息」打开设置弹窗', settingsTitle);

  // 4) 图标选择器
  const iconCount = await evalJs("document.querySelectorAll('.icon-choice').length");
  check(iconCount >= 40, '图标选择器数量充足', iconCount);
  const iconChange = await evalJs(`(async () => {
    const btn = document.querySelectorAll('.icon-choice')[6];
    const name = btn.dataset.icon;
    btn.click();
    await new Promise(r => setTimeout(r, 300));
    const active = document.querySelector('.icon-choice.active')?.dataset.icon;
    return { name, active };
  })()`);
  check(iconChange && iconChange.active === iconChange.name, '点击图标后选中态更新', iconChange);

  // 5) 卡片尺寸
  const sizeResult = await evalJs(`(async () => {
    const b = [...document.querySelectorAll('[data-action="settings-size"]')].find(x => x.dataset.size === 'wide');
    b.click();
    await new Promise(r => setTimeout(r, 300));
    return document.querySelectorAll('.dev-card.size-wide').length;
  })()`);
  check(sizeResult >= 1, '设置卡片尺寸后网格生效', sizeResult);

  // 6) 颜色
  const colorResult = await evalJs(`(async () => {
    const b = document.querySelectorAll('[data-action="settings-color"]')[4];
    b.click();
    await new Promise(r => setTimeout(r, 250));
    return document.querySelectorAll('[data-action="settings-color"]').length;
  })()`);
  check(colorResult >= 10, '颜色选择器可用', colorResult);

  // 7) 关闭弹窗，检查拖拽属性
  await evalJs("document.querySelector('#modalRoot [data-action=\\\"modal-close\\\"]')?.click(); 1");
  const dragCount = await evalJs("document.querySelectorAll('[data-drag-card][draggable=\\\"true\\\"]').length");
  const roomDrag = await evalJs("document.querySelectorAll('[data-drag-room][draggable=\\\"true\\\"]').length");
  check(dragCount > 0, '设备卡片可拖拽', dragCount);
  check(roomDrag > 0, '房间区块可拖拽', roomDrag);

  // 7.1) 真实拖动：把第一张卡片拖到第三张之后
  const dragResult = await evalJs(`(async () => {
    const q = () => [...document.querySelectorAll('.dev-card[data-drag-card]')];
    const cards = q();
    const first = cards[0], target = cards[2];
    const before = cards.map(c => c.dataset.dragCard);
    const dt = new DataTransfer();
    first.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }));
    const r = target.getBoundingClientRect();
    const opts = { bubbles: true, cancelable: true, dataTransfer: dt, clientX: r.right - 2, clientY: r.top + 8 };
    target.dispatchEvent(new DragEvent('dragover', opts));
    target.dispatchEvent(new DragEvent('drop', opts));
    await new Promise(res => setTimeout(res, 350));
    const after = q().map(c => c.dataset.dragCard);
    return { moved: before[0] !== after[0], idx: after.indexOf(before[0]), before: before.slice(0, 4), after: after.slice(0, 4) };
  })()`);
  check(dragResult && dragResult.moved, '拖动后卡片顺序改变', dragResult);

  // 8) 房间折叠
  const collapse = await evalJs(`(async () => {
    const before = document.querySelectorAll('[data-room-section]').length;
    document.querySelector('[data-action="room-collapse"]').click();
    await new Promise(r => setTimeout(r, 250));
    const grids = document.querySelectorAll('[data-room-drop]').length;
    return { before, grids };
  })()`);
  check(collapse && collapse.grids < collapse.before, '房间折叠生效', collapse);

  // 9) 语言切换
  const en = await evalJs(`(async () => {
    document.querySelector('#btnLang').click();
    await new Promise(r => setTimeout(r, 400));
    return {
      lang: document.documentElement.dataset.lang,
      nav: document.querySelector('.nav-label')?.textContent.trim(),
      brand: document.querySelector('.brand-name')?.textContent.trim(),
      roomBtn: document.querySelector('#btnRoomManage')?.textContent.trim(),
      chineseLeft: (document.querySelector('#content').innerText.match(/[\\u4e00-\\u9fff]/g) || []).length,
    };
  })()`);
  check(en && en.lang === 'en', '语言切换为英文', en && en.lang);
  check(en && en.nav === 'Xiaoai Speaker', '侧栏导航已英文化', en && en.nav);
  check(en && en.brand === 'Mijia & Xiaoai', '标题栏已英文化', en && en.brand);
  check(en && en.roomBtn === 'Rooms', '顶部按钮已英文化', en && en.roomBtn);

  // 10) 切回中文
  const zh = await evalJs(`(async () => {
    document.querySelector('#btnLang').click();
    await new Promise(r => setTimeout(r, 350));
    return {
      lang: document.documentElement.dataset.lang,
      nav: document.querySelector('.nav-label')?.textContent.trim(),
      brand: document.querySelector('.brand-name')?.textContent.trim(),
      roomBtn: document.querySelector('#btnRoomManage')?.textContent.trim(),
    };
  })()`);
  check(zh && zh.lang === 'zh' && zh.nav === '小爱音箱', '切回中文正常', zh);
  check(zh && zh.brand === '米家与小爱' && zh.roomBtn === '房间管理', '静态文案切回中文还原', zh);

  // 10.1) 英文设置弹窗
  const enSettings = await evalJs(`(async () => {
    document.querySelector('#btnLang').click();
    await new Promise(r => setTimeout(r, 300));
    document.querySelector('.dev-card').click();
    await new Promise(r => setTimeout(r, 250));
    document.querySelector('.more-link').click();
    await new Promise(r => setTimeout(r, 300));
    const title = document.querySelector('#modalRoot .modal-title')?.textContent.trim();
    const iconLabel = document.querySelector('#modalRoot .icon-choice span')?.textContent.trim();
    document.querySelector('#modalRoot [data-action="modal-close"]')?.click();
    document.querySelector('#btnLang').click();
    await new Promise(r => setTimeout(r, 250));
    return { title, iconLabel };
  })()`);
  check(enSettings && enSettings.title === 'Device settings', '设置弹窗标题英文', enSettings && enSettings.title);
  check(enSettings && enSettings.iconLabel === 'Ceiling light', '图标名称英文', enSettings && enSettings.iconLabel);

  // 11) 控制台错误
  const errs = await evalJs('window.__errCount || 0');
  check(!errs, '无未捕获脚本错误', errs);

  console.log(failed ? `\n${failed} 项失败` : '\n全部通过 ✓');
  ws.close();
  child.kill();
  try { fs.rmSync(userDir, { recursive: true, force: true }); } catch (_) { /* ignore */ }
  process.exit(failed ? 1 : 0);
})().catch((err) => {
  console.error('测试异常：', err);
  process.exit(2);
});
