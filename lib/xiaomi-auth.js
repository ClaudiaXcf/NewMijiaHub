'use strict';
/**
 * 小米账号扫码登录（Node 零依赖）。
 *
 * 协议事实来自 mihome-pc-unofficial（mihome_pc/xiaomi/auth.py）：
 *
 *  - 账号端点的 JSON 体会带 "&&&START&&&" 前缀，真正内容在其后。
 *  - QR 起始：GET https://account.xiaomi.com/longPolling/loginUrl?sid=xiaomiio
 *    返回 {code, lp, loginUrl, qr}；qr 是小米托管的二维码图片 URL，
 *    无需本地二维码编码器。
 *  - 轮询：GET lp（长轮询，网关会 hold 数十秒）；返回 code 0 即确认，
 *    70016~70021 表示"尚未确认"，继续等。
 *  - 确认后 payload 带 location / ssecurity / passToken / cUserId / userId；
 *    ssecurity 兜底在 Extension-Pragma 响应头里。
 *  - GET location 由 Set-Cookie 里读出 serviceToken。
 *  - sid 必须是 xiaomiio：api.io.mi.com 只认这个 sid 铸的 serviceToken。
 *  - 凭据续期：GET /pass/serviceLogin?_json=true&sid=xiaomiio
 *    （带 passToken cookie）→ code 0 + location → 兑换新 serviceToken。
 */

const ACCOUNT_HOST = 'https://account.xiaomi.com';
const SAFE_PREFIX = '&&&START&&&';
const SID_MIHOME = 'xiaomiio';
const UA = 'Android-7.1.1-1.0.0-ONEPLUS A3010-136-APP-xiaomi-smart-home';

class LoginError extends Error {}
class LoginTimeout extends LoginError {}
class NotAuthorized extends LoginError {}

function newDeviceId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < 16; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function stripSafePrefix(text) {
  const t = String(text || '').trim();
  return t.startsWith(SAFE_PREFIX) ? t.slice(SAFE_PREFIX.length) : t;
}

function jsonFromBody(text) {
  const body = stripSafePrefix(text);
  try {
    return JSON.parse(body);
  } catch (err) {
    throw new LoginError(`account response is not JSON: ${err.message}`);
  }
}

/** 手动跟随重定向并收集每一跳的 Set-Cookie（undici 不跨跳保留 cookie）。 */
async function getCollectingCookies(url, cookie, { maxHops = 10, timeoutMs = 20000 } = {}) {
  const jar = {};
  let current = url;
  for (let hop = 0; hop < maxHops; hop++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    let res;
    try {
      res = await fetch(current, {
        method: 'GET',
        redirect: 'manual',
        signal: ctrl.signal,
        headers: { 'User-Agent': UA, Cookie: cookie },
      });
    } finally {
      clearTimeout(timer);
    }
    const setCookies = typeof res.headers.getSetCookie === 'function'
      ? res.headers.getSetCookie()
      : [];
    for (const line of setCookies) {
      const m = /^([^=;]+)=([^;]*)/.exec(String(line).trim());
      if (m) jar[m[1].trim()] = m[2];
    }
    const status = res.status;
    if (status >= 300 && status < 400) {
      const loc = res.headers.get('location');
      if (loc) {
        current = new URL(loc, current).href;
        try { await res.text(); } catch (_) { /* body 不重要 */ }
        continue;
      }
    }
    const text = await res.text();
    return { url: current, text, headers: res.headers, jar, status };
  }
  throw new LoginError('too many redirects');
}

function deviceCookie(deviceId, locale = 'zh_CN') {
  return `deviceId=${deviceId}; uLocale=${locale}`;
}

/** 第一步：申请二维码。返回 { qr, lp, loginUrl }。 */
async function requestQr(deviceId, { qrSize = 240 } = {}) {
  const dc = Date.now();
  const url = `${ACCOUNT_HOST}/longPolling/loginUrl?sid=${SID_MIHOME}&_qrsize=${qrSize}&_dc=${dc}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  let res;
  try {
    res = await fetch(url, {
      headers: { 'User-Agent': UA, Cookie: deviceCookie(deviceId) },
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  const payload = jsonFromBody(await res.text());
  if (payload.code !== 0) throw new LoginError(`QR request failed: code=${payload.code}`);
  if (!payload.qr || !payload.lp) throw new LoginError('QR response missing qr/lp');
  return { qr: payload.qr, lp: payload.lp, loginUrl: payload.loginUrl || '' };
}

/** 第二步：单次长轮询（服务端 hold ~55s）。返回原始 payload + headers。 */
async function pollOnce(lpUrl, deviceId, timeoutMs = 55000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(lpUrl, {
      headers: { 'User-Agent': UA, Cookie: deviceCookie(deviceId) },
      signal: ctrl.signal,
    });
  } catch (err) {
    if (err && (err.name === 'AbortError' || err.code === 'ABORT_ERR')) {
      throw new LoginTimeout('long poll timed out');
    }
    throw new LoginError(`network error: ${err.message}`);
  } finally {
    clearTimeout(timer);
  }
  const text = await res.text();
  return { payload: jsonFromBody(text), headers: res.headers };
}

const NOT_CONFIRMED_CODES = new Set([70016, 70017, 70018, 70019, 70020, 70021]);

function extractCredentials(payload, headers) {
  const location = payload.location;
  if (!location) throw new LoginError('login response has no location');
  let ssecurity = payload.ssecurity;
  if (!ssecurity) {
    const pragma = headers.get('Extension-Pragma') || headers.get('extension-pragma');
    if (pragma) {
      try { ssecurity = JSON.parse(pragma).ssecurity; } catch (_) { /* ignore */ }
    }
  }
  if (!ssecurity) throw new LoginError('login response has no ssecurity');
  return {
    user_id: String(payload.userId || ''),
    c_user_id: String(payload.cUserId || headers.get('cUserId') || ''),
    ssecurity,
    pass_token: payload.passToken || headers.get('passToken') || '',
  };
}

/** 第三步：location → Set-Cookie: serviceToken。 */
async function exchangeServiceToken(location, deviceId) {
  const target = location.includes('://') ? location : ACCOUNT_HOST + location;
  const { jar, text } = await getCollectingCookies(target, deviceCookie(deviceId));
  let token = jar['serviceToken'];
  if (!token) {
    try { token = jsonFromBody(text).serviceToken; } catch (_) { /* ignore */ }
  }
  if (!token) throw new LoginError('login response carried no serviceToken');
  return token;
}

/** 由一次 code=0 的轮询结果直接铸出完整凭据（server 的 /wait 单轮询用）。 */
async function resolveCredentials(login, pollResult) {
  const partial = extractCredentials(pollResult.payload, pollResult.headers);
  const serviceToken = await exchangeServiceToken(
    pollResult.payload.location, login.deviceId);
  return { device_id: login.deviceId, ...partial, service_token: serviceToken };
}

/**
 * 完整扫码登录（服务端调用）：
 *   const login = await startQrLogin();      // login.qr → 二维码图片
 *   const creds = await waitQrConfirm(login); // 阻塞到用户扫码确认
 */
async function startQrLogin() {
  const deviceId = newDeviceId();
  const qr = await requestQr(deviceId);
  return { deviceId, ...qr };
}

async function waitQrConfirm(login, { overallTimeoutMs = 180000 } = {}) {
  const deadline = Date.now() + overallTimeoutMs;
  while (Date.now() < deadline) {
    let polled;
    try {
      polled = await pollOnce(login.lp, login.deviceId, 55000);
    } catch (err) {
      if (err instanceof LoginTimeout) continue; // 长轮询超时是常态，重试
      throw err;
    }
    const code = polled.payload.code;
    if (code === 0) return resolveCredentials(login, polled);
    if (NOT_CONFIRMED_CODES.has(code)) continue;
    if (code == null) continue;
    throw new LoginError(`QR poll failed: code=${code}`);
  }
  throw new LoginTimeout('QR code was not confirmed in time');
}

/** passToken 续期 serviceToken（服务端启动时用）。 */
async function refreshServiceToken(credentials) {
  const parts = [`deviceId=${credentials.device_id}`, 'pass_o=', 'uLocale=zh_CN'];
  if (credentials.user_id) parts.push(`userId=${credentials.user_id}`);
  if (credentials.c_user_id) parts.push(`cUserId=${credentials.c_user_id}`);
  if (credentials.pass_token) parts.push(`passToken=${credentials.pass_token}`);
  const cookie = parts.join('; ');
  const url = `${ACCOUNT_HOST}/pass/serviceLogin?_json=true&sid=${SID_MIHOME}&_locale=zh_CN`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  let res;
  try {
    res = await fetch(url, {
      headers: { 'User-Agent': UA, Cookie: cookie },
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  const payload = jsonFromBody(await res.text());
  if (payload.code !== 0) {
    throw new NotAuthorized(`passToken rejected (code=${payload.code}); scan a new QR code`);
  }
  if (!payload.location) throw new NotAuthorized('no location in serviceLogin response');
  const target = payload.location.includes('://')
    ? payload.location
    : ACCOUNT_HOST + payload.location;
  const { jar } = await getCollectingCookies(target, cookie);
  const token = jar['serviceToken'];
  if (!token) throw new NotAuthorized('no serviceToken issued for the stored passToken');
  const refreshed = { ...credentials, service_token: token };
  if (payload.ssecurity) refreshed.ssecurity = payload.ssecurity;
  return refreshed;
}

module.exports = {
  LoginError,
  LoginTimeout,
  NotAuthorized,
  newDeviceId,
  requestQr,
  pollOnce,
  resolveCredentials,
  startQrLogin,
  waitQrConfirm,
  exchangeServiceToken,
  refreshServiceToken,
  stripSafePrefix,
};
