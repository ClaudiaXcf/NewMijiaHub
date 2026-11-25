'use strict';
/**
 * 小米云 API 签名 / RC4 加密 / 响应解密（Node 零依赖）。
 *
 * 协议事实来自 mihome-pc-unofficial 逆向文档（docs/reverse/01-网络与签名.md），
 * 针对 Mi Home 11.9.705 APK 的取证结论：
 *
 *  - nonce            = base64( 8 随机字节 + 4 字节 BE int 分钟数 )
 *  - sessionSecurity  = base64( sha256( b64d(ssecurity) || b64d(nonce) ) )
 *  - signature        = base64( sha1( join("&", [METHOD, encoded_path,
 *                       "k=v"…按键字典序, sessionSecurity]) ) )
 *  - RC4 请求体：明文参数先算 rc4_hash__（对明文签名），所有值用同一条
 *    RC4 流（先烧 1024 字节密钥流）逐值加密并 base64；再对密文 map 算
 *    signature；body = 密文字段 + signature + _nonce + ssecurity。
 *  - 响应体：base64 → RC4 解密（新流，同样烧 1024）→ 按头
 *    MIOT-CONTENT-ENCODING: GZIP（或嗅探 1f 8b）gunzip → JSON。
 */

const crypto = require('crypto');

const ALGORITHM_RC4 = 'ENCRYPT-RC4';
const ALGORITHM_AES = 'ENCRYPT-AES';

// ---------------------------------------------------------------- nonce / ss

function genNonce(nowMs, serverOffsetMs = 0) {
  const now = nowMs == null ? Date.now() : nowMs;
  const minutes = Math.floor((now + serverOffsetMs) / 60000);
  const buf = Buffer.alloc(12);
  crypto.randomFillSync(buf, 0, 8);
  buf.writeUInt32BE(minutes >>> 0, 8);
  return buf.toString('base64');
}

function sessionSecurity(ssecurityB64, nonceB64) {
  const h = crypto.createHash('sha256');
  h.update(Buffer.from(ssecurityB64, 'base64'));
  h.update(Buffer.from(nonceB64, 'base64'));
  return h.digest('base64');
}

// ---------------------------------------------------------------- signature

function apiPath(urlOrPath) {
  let path;
  if (typeof urlOrPath === 'string' && urlOrPath.includes('://')) {
    path = new URL(urlOrPath).pathname;
  } else {
    path = urlOrPath;
  }
  if (path.startsWith('/app/')) path = path.slice(4);
  else if (path === '/app') path = '/';
  return encodeURI(path);
}

/** Java TreeMap 按 UTF-16 code unit 比较字符串；ASCII 键与普通排序一致。 */
function javaKeyCompare(a, b) {
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const x = a.charCodeAt(i);
    const y = b.charCodeAt(i);
    if (x !== y) return x - y;
  }
  return a.length - b.length;
}

function toPairs(params) {
  if (Array.isArray(params)) return params.map(([k, v]) => [k, v]);
  if (params && typeof params === 'object') return Object.entries(params);
  return [];
}

function signature(method, urlOrPath, params, sessionSecurityB64) {
  if (!sessionSecurityB64) throw new Error('sessionSecurity is null');
  const parts = [];
  if (method) parts.push(String(method).toUpperCase());
  if (urlOrPath) parts.push(apiPath(urlOrPath));
  const items = toPairs(params).slice().sort((a, b) => javaKeyCompare(a[0], b[0]));
  for (const [k, v] of items) parts.push(`${k}=${v}`);
  parts.push(sessionSecurityB64);
  const text = parts.join('&');
  return crypto.createHash('sha1').update(text, 'utf8').digest('base64');
}

// ---------------------------------------------------------------- RC4

class Rc4Stream {
  /** key: Buffer；构造后先烧 1024 字节密钥流（对齐 APK g7c.java:19-28）。 */
  constructor(key) {
    if (!Buffer.isBuffer(key)) key = Buffer.from(key);
    this.S = new Uint8Array(256);
    for (let i = 0; i < 256; i++) this.S[i] = i;
    let j = 0;
    for (let i = 0; i < 256; i++) {
      j = (j + this.S[i] + key[i % key.length]) & 255;
      const t = this.S[i]; this.S[i] = this.S[j]; this.S[j] = t;
    }
    this.i = 0; this.j = 0;
    this.crypt(Buffer.alloc(1024)); // burn
  }

  crypt(buf) {
    const S = this.S;
    let i = this.i, j = this.j;
    const out = Buffer.allocUnsafe(buf.length);
    for (let n = 0; n < buf.length; n++) {
      i = (i + 1) & 255;
      j = (j + S[i]) & 255;
      const t = S[i]; S[i] = S[j]; S[j] = t;
      out[n] = buf[n] ^ S[(S[i] + S[j]) & 255];
    }
    this.i = i; this.j = j;
    return out;
  }
}

function toBytes(value) {
  if (Buffer.isBuffer(value)) return value;
  if (typeof value !== 'string') value = String(value);
  return Buffer.from(value, 'utf8');
}

// ---------------------------------------------------------------- 请求编码

/**
 * 构造 ENCRYPT-RC4 表单体。
 * @param {string} url 完整 URL（签名取其去掉 /app 前缀的 path）
 * @param {string} method HTTP 方法
 * @param {Array|Object} params 明文参数（通常是 [['data', jsonStr]]）
 * @param {string} ssecurityB64 登录得到的 ssecurity
 * @returns {{pairs, sessionSecurity, nonce, algorithm}}
 */
function encodeRc4(url, method, params, ssecurityB64, opts = {}) {
  const nonce = opts.nonce || genNonce(null, opts.serverOffsetMs || 0);
  const ss = sessionSecurity(ssecurityB64, nonce);
  const plain = toPairs(params);
  const rc4Hash = signature(method, url, plain, ss);
  plain.push(['rc4_hash__', rc4Hash]);

  const plainSorted = plain.slice().sort((a, b) => javaKeyCompare(a[0], b[0]));
  const stream = new Rc4Stream(Buffer.from(ss, 'base64'));
  const encrypted = plainSorted.map(([k, v]) => [
    k,
    stream.crypt(toBytes(v)).toString('base64'),
  ]);

  const body = encrypted.slice();
  body.push(['signature', signature(method, url, encrypted, ss)]);
  body.push(['_nonce', nonce]);
  body.push(['ssecurity', ssecurityB64]);
  return { pairs: body, sessionSecurity: ss, nonce, algorithm: ALGORITHM_RC4 };
}

/** 构造 ENCRYPT-AES（AES-256-GCM）表单体；备用实现，默认仍走 RC4。 */
function encodeAes(url, method, params, ssecurityB64, opts = {}) {
  const nonce = opts.nonce || genNonce(null, opts.serverOffsetMs || 0);
  const ss = sessionSecurity(ssecurityB64, nonce);
  const key = Buffer.from(ss, 'base64');
  const iv = opts.iv || crypto.randomBytes(12);
  const pairs = toPairs(params)
    .slice()
    .sort((a, b) => javaKeyCompare(a[0], b[0]));
  const encrypted = pairs.map(([k, v]) => {
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const ct = Buffer.concat([cipher.update(toBytes(v)), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [k, Buffer.concat([ct, tag]).toString('base64')];
  });
  const ivB64 = iv.toString('base64');
  const signed = encrypted.slice();
  signed.push(['aes_hash__', ivB64]);
  const body = encrypted.slice();
  body.push(['aes_hash__', ivB64]);
  body.push(['signature', signature(method, url, signed, ss)]);
  body.push(['_nonce', nonce]);
  return { pairs: body, sessionSecurity: ss, nonce, iv, algorithm: ALGORITHM_AES };
}

// ---------------------------------------------------------------- 响应解码

function maybeGunzip(raw, contentEncoding) {
  const wantsGzip = String(contentEncoding || '').toUpperCase() === 'GZIP'
    || (raw.length >= 2 && raw[0] === 0x1f && raw[1] === 0x8b);
  if (!wantsGzip) return raw;
  return require('zlib').gunzipSync(raw);
}

function decodeResponse(sessionSecurityB64, text, contentEncoding) {
  if (text == null) throw new Error('empty response');
  const stripped = String(text).trim();
  if (stripped.startsWith('{') || stripped.startsWith('[')) {
    return JSON.parse(stripped);
  }
  const stream = new Rc4Stream(Buffer.from(sessionSecurityB64, 'base64'));
  let raw = stream.crypt(Buffer.from(stripped, 'base64'));
  raw = maybeGunzip(raw, contentEncoding);
  return JSON.parse(raw.toString('utf8'));
}

function decodeResponseAes(sessionSecurityB64, text, ivB64, contentEncoding) {
  const stripped = String(text || '').trim();
  if (stripped.startsWith('{') || stripped.startsWith('[')) return JSON.parse(stripped);
  const key = Buffer.from(sessionSecurityB64, 'base64');
  const iv = Buffer.from(ivB64, 'base64');
  const blob = Buffer.from(stripped, 'base64');
  if (blob.length < 16) throw new Error('AES response too short');
  const ct = blob.subarray(0, blob.length - 16);
  const tag = blob.subarray(blob.length - 16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  let raw = Buffer.concat([decipher.update(ct), decipher.final()]);
  raw = maybeGunzip(raw, contentEncoding);
  return JSON.parse(raw.toString('utf8'));
}

module.exports = {
  ALGORITHM_RC4,
  ALGORITHM_AES,
  genNonce,
  sessionSecurity,
  apiPath,
  signature,
  encodeRc4,
  encodeAes,
  decodeResponse,
  decodeResponseAes,
  Rc4Stream,
};
