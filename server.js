'use strict';
/**
 * 米家 Web 版本地服务器（Node 零依赖）。
 *
 *   node server.js            → http://127.0.0.1:8899
 *
 * 职责：
 *   1. 静态托管 public/（不登录时前端就是纯演示模式）
 *   2. 扫码登录：/api/login/qr/start|image|wait（二维码图片经本机代理）
 *   3. 云端控制（实验性）：/api/devices、/api/prop、/api/action、/api/rename
 *      凭据写入 data/credentials.json，重启后用 passToken 自动续期。
 *
 * 协议实现（RC4 签名、扫码流程）参考 mihome-pc-unofficial 的公开逆向文档，
 * 由本仓库独立用 Node 重写；凭据只保存在本机 data/ 目录，不外发。
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const auth = require('./lib/xiaomi-auth');
const { CloudClient, AuthError } = require('./lib/xiaomi-cloud');
const specUi = require('./lib/spec-ui');

const PORT = Number(process.env.PORT || 8899);
const HOST = process.env.HOST || '127.0.0.1';
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const CRED_PATH = path.join(DATA_DIR, 'credentials.json');

// ---------------------------------------------------------------- 凭据管理

let credentials = null;
let cloud = null;
let cloudReady = false;   // 登录后首拉设备是否成功
let loginSession = null;  // 进行中的扫码会话

function saveCredentials() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = CRED_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(credentials, null, 1));
  try { fs.chmodSync(tmp, 0o600); } catch (_) { /* Windows 无 mode 位 */ }
  fs.renameSync(tmp, CRED_PATH);
}

function loadCredentials() {
  try {
    if (fs.existsSync(CRED_PATH)) {
      const data = JSON.parse(fs.readFileSync(CRED_PATH, 'utf8'));
      if (data && data.service_token && data.ssecurity) return data;
    }
  } catch (err) {
    console.error('[credentials] 无法读取凭据文件：', err.message);
  }
  return null;
}

function sessionFromCreds(creds) {
  return {
    user_id: creds.user_id,
    c_user_id: creds.c_user_id,
    service_token: creds.service_token,
    ssecurity: creds.ssecurity,
    device_id: creds.device_id,
    locale: 'zh_CN',
    country_code: 'CN',
    timezone: 'GMT+08:00',
    timezone_id: 'Asia/Shanghai',
    channel: 'MI_APP_STORE',
    region: 'cn',
  };
}

function publicUser() {
  if (!credentials) return null;
  return { userId: credentials.user_id, deviceId: credentials.device_id };
}

function ensureCloud() {
  if (credentials && !cloud) cloud = new CloudClient(sessionFromCreds(credentials));
  return cloud;
}

// ---------------------------------------------------------------- 工具

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function readBody(req, limit = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function readJson(req) {
  const text = await readBody(req);
  if (!text) return {};
  try { return JSON.parse(text); } catch (_) { return {}; }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 比较读回值与目标值：兼容 bool↔1/0、数字字符串、浮点误差。 */
function valuesEqual(a, b) {
  if (a === b) return true;
  const toBool = (v) => v === true || v === 1 || v === '1' || v === 'true' || v === 'on';
  if (typeof a === 'boolean' || typeof b === 'boolean') return toBool(a) === toBool(b);
  const na = Number(a);
  const nb = Number(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return Math.abs(na - nb) < 1e-6;
  return String(a) === String(b);
}

/**
 * 写属性后轮询读回，确认设备真的执行了。
 *
 * 有些设备（如 linp.light.ld6bcw 人体存在筒射灯）的 prop/set 是**异步**的：
 * 接口 200ms 就返回 code=1（「已下发、未确认」），实测 673ms 后属性才真正变化。
 * 只看返回码会把成功当失败，所以这里读回验证。
 */
async function verifyProp(client, did, siid, piid, want, timeoutMs = 2600) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await sleep(420);
    try {
      const raw = await client.props([{ did, siid, piid }]);
      const items = Array.isArray(raw) ? raw : (raw && raw.result) || [];
      const it = (Array.isArray(items) ? items : []).find((x) => x
        && String(x.did) === String(did)
        && Number(x.siid) === Number(siid)
        && Number(x.piid) === Number(piid));
      if (it && (it.code == null || it.code === 0) && valuesEqual(it.value, want)) return true;
    } catch (_) { /* 单次读取失败继续轮询 */ }
  }
  return false;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === '/' || rel === '') rel = '/index.html';
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR + path.sep) && file !== PUBLIC_DIR) {
    sendJson(res, 403, { ok: false, error: 'forbidden' });
    return;
  }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      // 非 API 的未知路径回落到首页（前端深链接 /?view=… 由 JS 处理）
      if (!rel.includes('.')) {
        serveStatic(req, res, '/index.html');
      } else {
        sendJson(res, 404, { ok: false, error: 'not found' });
      }
      return;
    }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'Content-Length': st.size,
    });
    fs.createReadStream(file).pipe(res);
  });
}

// ---------------------------------------------------------------- 云端聚合

function normalizeHomes(raw) {
  const list = (raw && (raw.homelist || raw.home_list || raw.homeList
    || (Array.isArray(raw) ? raw : []))) || [];
  const homes = list.map((h) => ({
    id: h.id,
    name: h.name || '未命名家庭',
    ownerUid: h.uid || h.owner_uid || h.ownerUid || 0,
    rooms: ((h.roomlist || h.room_list || h.rooms) || []).map((r) => ({
      id: r.id,
      name: r.name || '未命名房间',
      dids: (r.didlist || r.dids || r.did_list || (r.devices || []).map((d) =>
        typeof d === 'object' ? d.did : d) || []).map(String),
    })),
  }));
  return homes.filter((h) => h.id != null);
}

function normalizeDevices(raw) {
  const list = (raw && (raw.list || raw.device_list || raw.deviceList
    || (Array.isArray(raw) ? raw : []))) || [];
  return (list.filter((d) => d && d.did != null)).map((d) => {
    const extra = d.extra || {};
    const online = d.isOnline != null ? d.isOnline
      : d.online != null ? d.online
        : extra.isOnline != null ? extra.isOnline : true;
    return {
      did: String(d.did),
      model: d.model || '',
      name: d.name || d.model || String(d.did),
      urn: d.spec_type || d.specType || d.urn || '',
      online: !!online,
      ip: d.localip || d.ip || '',
      mac: d.mac || '',
      roomid: d.roomid != null ? d.roomid : (extra.roomid != null ? extra.roomid : null),
      fw: d.fw_version || extra.fw_version || '',
      token: d.token || '',
    };
  });
}

function normalizeSpecs(raw) {
  const out = {};
  if (!raw) return out;
  let entries = [];
  if (Array.isArray(raw)) {
    entries = raw.map((x) => [x.did || x.device_id || x.didStr, x]);
  } else if (raw.instances) {
    const ins = raw.instances;
    if (Array.isArray(ins)) entries = ins.map((x) => [x.did || x.device_id, x]);
    else if (typeof ins === 'object') entries = Object.entries(ins);
  } else if (typeof raw === 'object') {
    entries = Object.entries(raw);
  }
  for (const [did, val] of entries) {
    if (did == null || !val) continue;
    // gspec 的 instance 常常是「字符串化的 JSON」（真账号取证），必须先 parse
    let spec = val.spec || val.instance || val;
    if (typeof spec === 'string') {
      try { spec = JSON.parse(spec); } catch (_) { continue; }
    }
    if (spec && Array.isArray(spec.services)) out[String(did)] = spec;
  }
  return out;
}

let lastDevicesSnapshot = null;

// spec 几乎不变，缓存 10 分钟：省 3 次 gspec 往返，也避开云 API 频率限制
const SPEC_TTL_MS = 10 * 60 * 1000;
let specCache = { key: '', at: 0, map: {} };

async function fetchCloudDevices() {
  const client = ensureCloud();
  if (!client) throw new AuthError('not logged in');

  const homesRaw = await client.homes();
  const homes = normalizeHomes(homesRaw);
  const devsRaw = await client.devices();
  const devices = normalizeDevices(devsRaw);

  // 房间归属：优先 homeroom 的 room dids，其次设备自带 roomid
  const roomByDid = new Map();
  for (const home of homes) {
    for (const room of home.rooms) {
      for (const did of room.dids) roomByDid.set(did, room.name);
    }
  }

  // spec → 控件（失败时降级：设备仍可见，只是没有具体控件，不再拖垮整个列表）
  const dids = devices.map((d) => d.did);
  const cacheKey = dids.slice().sort().join(',');
  let specs = {};
  let warning = '';
  if (dids.length && specCache.key === cacheKey && Date.now() - specCache.at < SPEC_TTL_MS) {
    specs = specCache.map;
  } else if (dids.length) {
    try {
      specs = normalizeSpecs(await client.specs(dids));
      specCache = { key: cacheKey, at: Date.now(), map: specs };
    } catch (err) {
      warning = `设备能力集加载失败，已降级为纯设备列表：${err.message}`;
      console.error('[cloud] spec 加载失败：', err.message);
    }
  }
  for (const dev of devices) {
    const [icon, color] = specUi.iconForUrn(dev.urn);
    dev.icon = icon;
    dev.color = color;
    dev.controls = specs[dev.did] ? specUi.specToControls(specs[dev.did]) : [];
  }

  // 批量读当前值：每批 100 个点，最多 3 并发（单次请求过大会被服务端拒绝，
  // 全部塞进一次也读不完几十台设备）
  const readItems = [];
  for (const dev of devices) {
    if (!dev.controls.length || dev.online === false) continue;
    for (const c of dev.controls) {
      if (c.type !== 'status' && c.type !== 'switch' && c.type !== 'select' && c.type !== 'slider') continue;
      readItems.push({ did: dev.did, siid: c.siid, piid: c.piid });
    }
  }
  const batches = [];
  for (let i = 0; i < readItems.length; i += 100) batches.push(readItems.slice(i, i + 100));
  let cursor = 0;
  const worker = async () => {
    while (cursor < batches.length) {
      const batch = batches[cursor++];
      try {
        const propsRaw = await client.props(batch);
        const result = (propsRaw && typeof propsRaw === 'object' && !Array.isArray(propsRaw))
          ? (propsRaw.result != null ? propsRaw.result : propsRaw) : propsRaw;
        for (const dev of devices) {
          specUi.mergePropValues(dev.controls, result, dev.did);
        }
      } catch (err) {
        console.error('[cloud] 读取属性失败（本批跳过）：', err.message);
      }
    }
  };
  await Promise.all([worker(), worker(), worker()]);

  for (const dev of devices) {
    dev.roomName = roomByDid.get(dev.did) || (dev.roomid != null ? `房间 ${dev.roomid}` : '未分区');
    const line = specUi.statusLine(dev);
    dev.status = line.text;
    dev.statusCls = line.cls;
    delete dev.token; // 不下发给页面
  }

  const snapshot = {
    families: homes.map((h) => ({
      id: h.id, name: h.name, ownerUid: h.ownerUid,
      rooms: h.rooms.map((r) => ({ id: r.id, name: r.name })),
    })),
    devices,
  };
  if (warning) snapshot.warning = warning;
  lastDevicesSnapshot = snapshot;
  cloudReady = true;
  return snapshot;
}

// ---------------------------------------------------------------- 登录路由

async function handleQrStart(res) {
  try {
    loginSession = await auth.startQrLogin();
    sendJson(res, 200, { ok: true, qr: '/api/login/qr/image' });
  } catch (err) {
    sendJson(res, 200, { ok: false, error: `获取二维码失败：${err.message}` });
  }
}

async function handleQrImage(req, res) {
  if (!loginSession || !loginSession.qr) {
    sendJson(res, 404, { ok: false, error: 'no active login' });
    return;
  }
  try {
    const imgRes = await fetch(loginSession.qr, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!imgRes.ok) throw new Error(`upstream ${imgRes.status}`);
    res.writeHead(200, {
      'Content-Type': imgRes.headers.get('content-type') || 'image/png',
      'Cache-Control': 'no-store',
    });
    res.end(Buffer.from(await imgRes.arrayBuffer()));
  } catch (err) {
    sendJson(res, 502, { ok: false, error: `二维码加载失败：${err.message}` });
  }
}

async function handleQrWait(res) {
  if (!loginSession) {
    sendJson(res, 200, { status: 'error', message: '请先获取二维码' });
    return;
  }
  if (loginSession.status === 'confirmed') {
    sendJson(res, 200, { status: 'confirmed', user: publicUser() });
    return;
  }
  if (loginSession.status === 'error') {
    sendJson(res, 200, { status: 'error', message: loginSession.message });
    return;
  }
  if (loginSession.busy) {
    sendJson(res, 200, { status: 'waiting' });
    return;
  }
  loginSession.busy = true;
  try {
    const polled = await auth.pollOnce(loginSession.lp, loginSession.deviceId, 48000);
    const code = polled.payload.code;
    if (code === 0) {
      const creds = await auth.resolveCredentials(loginSession, polled);
      credentials = creds;
      saveCredentials();
      cloud = new CloudClient(sessionFromCreds(creds));
      cloudReady = false;
      loginSession.status = 'confirmed';
      console.log('[login] 扫码登录成功，userId =', creds.user_id);
      sendJson(res, 200, { status: 'confirmed', user: publicUser() });
    } else if (code == null || (code >= 70016 && code <= 70021)) {
      sendJson(res, 200, { status: 'waiting' });
    } else {
      loginSession.status = 'error';
      loginSession.message = `登录被拒绝（code ${code}）`;
      sendJson(res, 200, { status: 'error', message: loginSession.message });
    }
  } catch (err) {
    if (err instanceof auth.LoginTimeout) {
      sendJson(res, 200, { status: 'waiting' });
    } else {
      loginSession.status = 'error';
      loginSession.message = err.message;
      sendJson(res, 200, { status: 'error', message: err.message });
    }
  } finally {
    loginSession.busy = false;
  }
}

function handleLogout(res) {
  credentials = null;
  cloud = null;
  cloudReady = false;
  loginSession = null;
  lastDevicesSnapshot = null;
  specCache = { key: '', at: 0, map: {} };
  try { if (fs.existsSync(CRED_PATH)) fs.unlinkSync(CRED_PATH); } catch (_) { /* ignore */ }
  console.log('[login] 已退出（仅删除本机凭据，不影响手机端）');
  sendJson(res, 200, { ok: true });
}

// ---------------------------------------------------------------- 云端路由

async function requireCloud(res) {
  const client = ensureCloud();
  if (!client) {
    sendJson(res, 200, { ok: false, error: '未登录，请先扫码' });
    return null;
  }
  return client;
}

async function handleDevices(res) {
  const client = await requireCloud(res);
  if (!client) return;
  try {
    const snapshot = await fetchCloudDevices();
    sendJson(res, 200, { ok: true, ...snapshot, user: publicUser() });
  } catch (err) {
    if (err instanceof AuthError) {
      sendJson(res, 200, { ok: false, auth: true, error: `登录已失效：${err.message}` });
    } else {
      sendJson(res, 200, { ok: false, error: `拉取设备失败：${err.message}` });
    }
  }
}

async function handleProp(req, res) {
  const client = await requireCloud(res);
  if (!client) return;
  const body = await readJson(req);
  const { did, siid, piid, value, verify } = body;
  if (!did || siid == null || piid == null) {
    sendJson(res, 200, { ok: false, error: 'missing did/siid/piid' });
    return;
  }
  const codeHint = (code) => ({
    1: '设备未确认（可能离线或固件不支持该写入）',
    '-704040002': '属性不存在，siid/piid 无效',
    '-704042011': '设备离线',
    '-70422006': '设备离线',
  }[code]);
  try {
    const raw = await client.setProps([{ did: String(did), siid, piid, value }]);
    const items = Array.isArray(raw) ? raw : (raw && (raw.result || raw.params)) || [];
    const bad = (Array.isArray(items) ? items : []).find((it) => it && it.code != null && it.code !== 0);
    if (!bad) {
      sendJson(res, 200, { ok: true });
      return;
    }
    // 只写属性（电动床"背部升起"这类瞬时命令）没有值可读，读回必然失败。
    // 前端传 verify:false：正数 code 视为"已受理"，负数才是明确错误。
    if (verify === false) {
      if (Number(bad.code) < 0) {
        const hint = codeHint(bad.code);
        sendJson(res, 200, { ok: false, error: `下发失败${hint ? `：${hint}` : ''}（code=${bad.code}）` });
      } else {
        sendJson(res, 200, { ok: true, accepted: true });
      }
      return;
    }
    // code≠0 不一定是失败：异步设备会先回「未确认」，稍后才真正执行。
    // 读回确认，避免把成功误报成失败（用户会以为灯没开）。
    const confirmed = await verifyProp(client, String(did), siid, piid, value);
    if (confirmed) {
      sendJson(res, 200, { ok: true, verified: true });
    } else {
      const hint = codeHint(bad.code);
      sendJson(res, 200, {
        ok: false,
        error: `下发未能确认${hint ? `：${hint}` : ''}（code=${bad.code}）`,
      });
    }
  } catch (err) {
    if (err instanceof AuthError) sendJson(res, 200, { ok: false, auth: true, error: err.message });
    else sendJson(res, 200, { ok: false, error: err.message });
  }
}

async function handleAction(req, res) {
  const client = await requireCloud(res);
  if (!client) return;
  const body = await readJson(req);
  const { did, siid, aiid, args } = body;
  if (!did || siid == null || aiid == null) {
    sendJson(res, 200, { ok: false, error: 'missing did/siid/aiid' });
    return;
  }
  try {
    await client.callAction(String(did), siid, aiid, Array.isArray(args) ? args : []);
    sendJson(res, 200, { ok: true });
  } catch (err) {
    if (err instanceof AuthError) sendJson(res, 200, { ok: false, auth: true, error: err.message });
    else sendJson(res, 200, { ok: false, error: err.message });
  }
}

async function handleRename(req, res) {
  const client = await requireCloud(res);
  if (!client) return;
  const body = await readJson(req);
  if (!body.did || !body.name) {
    sendJson(res, 200, { ok: false, error: 'missing did/name' });
    return;
  }
  try {
    await client.renameDevice(String(body.did), String(body.name).slice(0, 60));
    sendJson(res, 200, { ok: true });
  } catch (err) {
    if (err instanceof AuthError) sendJson(res, 200, { ok: false, auth: true, error: err.message });
    else sendJson(res, 200, { ok: false, error: err.message });
  }
}

// ---------------------------------------------------------------- 入口

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const p = u.pathname;
  try {
    if (p.startsWith('/api/')) {
      if (req.method === 'POST' && p === '/api/login/qr/start') return await handleQrStart(res);
      if (req.method === 'GET' && p === '/api/login/qr/image') return await handleQrImage(req, res);
      if (req.method === 'GET' && p === '/api/login/qr/wait') return await handleQrWait(res);
      if (req.method === 'POST' && p === '/api/logout') return handleLogout(res);
      if (req.method === 'GET' && p === '/api/state') {
        return sendJson(res, 200, {
          ok: true,
          mode: credentials ? 'cloud' : 'demo',
          cloudReady,
          user: publicUser(),
          server: 'mihome-web/0.1.0',
        });
      }
      if (req.method === 'GET' && p === '/api/devices') return await handleDevices(res);
      if (req.method === 'POST' && p === '/api/prop') return await handleProp(req, res);
      if (req.method === 'POST' && p === '/api/action') return await handleAction(req, res);
      if (req.method === 'POST' && p === '/api/rename') return await handleRename(req, res);
      return sendJson(res, 404, { ok: false, error: 'unknown api' });
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return sendJson(res, 405, { ok: false, error: 'method not allowed' });
    }
    return serveStatic(req, res, p);
  } catch (err) {
    console.error('[server]', req.method, p, err);
    sendJson(res, 500, { ok: false, error: err.message });
  }
});

server.listen(PORT, HOST, () => {
  console.log('米家 Web 版已启动：');
  console.log(`  本机访问   http://${HOST}:${PORT}/`);
  console.log(`  登录凭据   ${CRED_PATH}（仅本机保存，可随时删除）`);
  console.log('  演示模式开箱即用；扫码登录后可控制真实设备（实验性）。');
});

// 启动时尝试 passToken 续期
(async () => {
  credentials = loadCredentials();
  if (credentials && credentials.pass_token) {
    try {
      credentials = await auth.refreshServiceToken(credentials);
      saveCredentials();
      ensureCloud();
      console.log('[login] passToken 续期成功，自动登录 userId =', credentials.user_id);
    } catch (err) {
      console.log('[login] passToken 续期失败：', err.message);
    }
  } else if (credentials) {
    ensureCloud();
  }
})();
