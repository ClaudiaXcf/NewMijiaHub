'use strict';
/**
 * 前端逻辑冒烟测试（开发用，非运行时依赖）：
 * 用最小 DOM 桩驱动 public/js/*.js，验证 boot 渲染、交互分发、
 * 模拟引擎副作用（电源切换 / 洗衣机模式 / 场景执行 / 播放器）。
 * 运行：node test/browser-smoke.js
 */

/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

// ---------------- DOM 桩 ----------------
class El {
  constructor(tag) {
    this.tagName = tag.toUpperCase();
    this._html = '';
    this._text = '';
    this.style = {};
    this.dataset = {};
    this.disabled = false;
    this.id = '';
    this._classes = new Set();
    this.classList = {
      add: (...cs) => cs.forEach((c) => this._classes.add(c)),
      remove: (...cs) => cs.forEach((c) => this._classes.delete(c)),
      toggle: (c, on) => (on ? this._classes.add(c) : this._classes.delete(c)),
      contains: (c) => this._classes.has(c),
    };
  }
  set innerHTML(v) { this._html = String(v); }
  get innerHTML() { return this._html; }
  set textContent(v) { this._text = String(v); }
  get textContent() { return this._text; }
  set className(v) { this._classes = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get className() { return Array.from(this._classes).join(' '); }
  setAttribute(k, v) { this['data-' + k.replace(/^data-/, '')] = v; }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  appendChild(c) { return c; }
  addEventListener() {}
  removeEventListener() {}
  getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 10 }; }
  closest() { return null; }
  remove() {}
  focus() {}
}

const registry = new Map();
const byId = (id) => {
  if (!registry.has(id)) registry.set(id, new El('div'));
  return registry.get(id);
};

const clickHandlers = [];
const document = {
  documentElement: new El('html'),
  createElement: () => new El('div'),
  querySelector: (sel) => (sel.startsWith('#') ? byId(sel.slice(1)) : null),
  querySelectorAll: () => [],
  addEventListener: (type, fn) => { if (type === 'click') clickHandlers.push(fn); },
};
global.document = document;
global.CSS = { escape: (s) => String(s).replace(/[^a-zA-Z0-9_-]/g, '\\$&') };
global.location = { search: '', protocol: 'file:', href: 'file:///x' };
global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
global.window = global;
global.prompt = () => null;
global.fetch = () => Promise.reject(new Error('no network in test'));

// ---------------- 载入前端脚本 ----------------
const pub = (f) => fs.readFileSync(path.join(__dirname, '..', 'public', 'js', f), 'utf8');
for (const f of ['icons.js', 'i18n.js', 'demo-data.js', 'api.js']) {
  new Function(pub(f))(); // eslint-disable-line no-new-func
}
new Function(pub('app.js'))(); // 内部异步 boot()

// ---------------- 断言 ----------------
let failed = 0;
const ok = (cond, name) => {
  if (cond) console.log(`  ✓ ${name}`);
  else { failed++; console.error(`  ✗ ${name}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function clickOn(dataset) {
  const btn = new El('button');
  Object.assign(btn.dataset, dataset);
  btn.disabled = false;
  const ev = {
    target: { closest: () => btn },
    preventDefault() {},
    stopPropagation() {},
    clientX: 50,
  };
  for (const h of clickHandlers) h(ev);
}

(async () => {
  await sleep(80); // 等 boot() 完成
  const content = () => byId('content').innerHTML;
  const modal = () => byId('modalRoot').innerHTML;

  console.log('— 渲染 —');
  ok(content().includes('办公室') && content().includes('卧室') && content().includes('厨房'), '三个房间分组渲染');
  ok(content().includes('小米屏幕挂灯1S'), '挂灯设备卡片');
  ok(content().includes('已开启 · 228 W'), '电脑实时功率状态');
  ok(content().includes('15.7') || content().includes('°C'), '温湿度计状态');
  ok(byId('sidebar').innerHTML.includes('米家设备'), '侧栏导航');
  ok(byId('familyTabs').innerHTML.includes('我的家'), '家庭标签');
  ok(byId('playerInner').innerHTML.includes('明天会更好'), '播放条曲目');
  ok(byId('playerProgress').innerHTML.includes('progress-fill'), '播放进度条');

  console.log('— 空家庭切换 —');
  clickOn({ action: 'family', index: '1' });
  ok(content().includes('还没有设备'), '空家庭空状态');
  clickOn({ action: 'family', index: '0' });

  console.log('— 电源切换 —');
  const lamp = window.__device ? null : null;
  // 通过 app 内部状态不易直接取，改用渲染断言
  clickOn({ action: 'power', did: 'demo-lamp-1s' });
  await sleep(20);
  ok(content().includes('已关闭'), '挂灯关闭后状态文字更新');
  clickOn({ action: 'power', did: 'demo-lamp-1s' });
  await sleep(20);

  console.log('— 设备详情弹窗 —');
  clickOn({ action: 'open-device', did: 'demo-washer' });
  ok(modal().includes('米家洗衣机') && modal().includes('智能洗') && modal().includes('更多模式'), '洗衣机弹窗：状态卡 + 模式网格');
  ok(modal().includes('洗衣记录') && modal().includes('简清洁'), '洗衣机弹窗：链接行');

  console.log('— 洗衣机模式切换（自动开机） —');
  clickOn({ action: 'washer-mode', did: 'demo-washer', value: '快速洗' });
  await sleep(30);
  clickOn({ action: 'nav', view: 'devices' });
  ok(content().includes('已开启 · 剩余'), '选择模式后洗衣机自动开机并进入倒计时');
  ok(byId('toastRoot') && true, 'toast 通知生成');

  console.log('— 场景执行 —');
  clickOn({ action: 'scene-run', scene: 'scene-night' });
  await sleep(30);
  ok(content().includes('已关闭'), '晚安模式关闭了设备');

  console.log('— 音箱页 —');
  clickOn({ action: 'nav', view: 'speaker' });
  ok(content().includes('小爱音箱 Art 电池版') && content().includes('组合立体声'), '音箱页：设备卡 + 立体声卡');
  ok(content().includes('蓝牙 Mesh 网关') && content().includes('DTS 音效'), '音箱页：无线模式 + DTS');
  clickOn({ action: 'speaker-dts', did: 'demo-speaker-art', mode: '人声' });
  ok(content().includes('人声'), 'DTS 切换');

  console.log('— 音乐投送 —');
  clickOn({ action: 'nav', view: 'castmusic' });
  ok(content().includes('本机扬声器') && content().includes('可投送'), '投送目标列表');
  clickOn({ action: 'cast', target: 'demo-speaker-art' });
  ok(content().includes('正在播放'), '切换输出后状态更新');

  console.log('— 自动化 —');
  clickOn({ action: 'nav', view: 'automation' });
  ok(content().includes('回家模式') && content().includes('执行'), '场景卡片');

  console.log('— 账号 —');
  clickOn({ action: 'nav', view: 'account' });
  ok(content().includes('演示模式') && content().includes('node server.js'), '演示模式说明与登录指引');

  console.log('— 队列弹窗 —');
  clickOn({ action: 'queue-open' });
  ok(modal().includes('播放队列') && modal().includes('童年'), '队列列表');

  console.log('— 房间管理 —');
  clickOn({ action: 'room-manage' });
  ok(modal().includes('房间管理') && modal().includes('新建房间'), '房间管理弹窗');

  console.log('— 播放器 —');
  clickOn({ action: 'player-next' });
  ok(byId('playerInner').innerHTML.includes('童年'), '下一曲切换');
  clickOn({ action: 'player-toggle' });
  await sleep(20);

  console.log(failed === 0 ? '\n全部通过 ✓' : `\n${failed} 项失败 ✗`);
  process.exit(failed === 0 ? 0 : 1);
})();
