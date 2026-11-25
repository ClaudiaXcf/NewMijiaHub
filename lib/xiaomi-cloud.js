'use strict';
/**
 * 小米云 RPC 客户端（Node 零依赖）。
 *
 * 事实与 mihome-pc-unofficial（mihome_pc/xiaomi/cloud.py）一致：
 *  - CN 基址 https://api.io.mi.com/app（真账号实测可用；
 *    api.mijia.tech 对 xiaomiio token 返回 auth error，保留为记录）。
 *  - 载荷是单个表单字段 data = JSON 字符串（对齐 APK DeviceCardApi）。
 *  - 端点：/v2/homeroom/gethome_merged、/v2/home/device_list_page、
 *    /miotspec/prop/get|set、/miotspec/action、
 *    /appgateway/gspec/Gspec/get_instances_by_dids、/device/rename 等。
 */

const sign = require('./xiaomi-sign');

const BASE_IO = 'https://api.io.mi.com/app';
const UA = 'Android-7.1.1-1.0.0-ONEPLUS A3010-136-APP-xiaomi-smart-home';
const TIMEOUT_MS = 25000;

class CloudError extends Error {
  constructor(message, code, payload) {
    super(message);
    this.code = code;
    this.payload = payload;
  }
}
class AuthError extends CloudError {}

class CloudClient {
  /**
   * @param {object} session { user_id, c_user_id, service_token, ssecurity,
   *   device_id, locale?, country_code?, timezone?, timezone_id?, channel? }
   */
  constructor(session) {
    this.session = session;
    this.base = BASE_IO;
    this.lastElapsedMs = 0;
  }

  cookieHeader() {
    const s = this.session;
    const parts = [];
    if (s.c_user_id) parts.push(`cUserId=${s.c_user_id}`);
    parts.push(`serviceToken=${s.service_token}`);
    parts.push(`yetAnotherServiceToken=${s.service_token}`);
    parts.push(`locale=${s.locale || 'zh_CN'}`);
    parts.push(`countryCode=${s.country_code || 'CN'}`);
    parts.push(`channel=${s.channel || 'MI_APP_STORE'}`);
    if (s.timezone_id) parts.push(`timezone_id=${s.timezone_id || 'Asia/Shanghai'}`);
    parts.push(`timezone=${String(s.timezone || 'GMT+08:00').replace(/\+/g, '%2B')}`);
    parts.push('is_daylight=0');
    parts.push('dst_offset=0');
    return parts.join('; ');
  }

  headers(algorithm) {
    const h = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': UA,
      'Cookie': this.cookieHeader(),
      'X-XIAOMI-PROTOCAL-FLAG-CLI': 'PROTOCAL-HTTP2',
      'MIOT-ACCEPT-ENCODING': 'GZIP',
      'MIOT-REQUEST-PAGE': 'none',
      'MIOT-ENCRYPT-ALGORITHM': algorithm,
    };
    if (algorithm === sign.ALGORITHM_RC4) h['Accept-Encoding'] = 'identity';
    else h['X-XIAOMI-PROTOCAL-FLAG'] = 'PROTOCAL-HTTPS';
    return h;
  }

  /** POST data(JSON) → 解码后的 JSON（取 result 字段）。 */
  async post(path, data) {
    const url = this.base + path;
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    const enc = sign.encodeRc4(url, 'POST', [['data', payload]], this.session.ssecurity);
    const body = new URLSearchParams(enc.pairs).toString();

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: this.headers(sign.ALGORITHM_RC4),
        body,
        signal: ctrl.signal,
      });
    } catch (err) {
      if (err && (err.name === 'AbortError' || err.code === 'ABORT_ERR')) {
        throw new CloudError(`timeout on ${path}`);
      }
      throw new CloudError(`network error on ${path}: ${err.message}`);
    } finally {
      clearTimeout(timer);
    }

    const text = await res.text();
    const encoding = res.headers.get('miot-content-encoding') || undefined;
    const result = sign.decodeResponse(enc.sessionSecurity, text, encoding);

    if (result && typeof result === 'object' && !Array.isArray(result)
      && !('code' in result) && 'error' in result) {
      throw new CloudError(`${path}: ${result.error}`);
    }
    if (result && typeof result === 'object' && !Array.isArray(result)
      && result.code != null && result.code !== 0) {
      const code = result.code;
      const message = result.message || result.desc || '';
      if ([2, 3, 401].includes(code)) {
        throw new AuthError(`auth error: ${message} (code ${code})`, code, result);
      }
      throw new CloudError(`${path}: ${message} (code ${code})`, code, result);
    }
    this.lastElapsedMs = Date.now() - 0;
    return (result && typeof result === 'object' && !Array.isArray(result)
      && 'result' in result) ? result.result : result;
  }

  // ------------------------------------------------------------ 端点封装

  /** 家庭 + 房间列表。 */
  async homes() {
    return this.post('/v2/homeroom/gethome_merged', {
      fg: true, fetch_share: true, fetch_share_dev: true,
      fetch_cariot: true, limit: 300, app_ver: 7, plat_form: 0,
    });
  }

  /** 全部设备（分页，limit=200；超出已知限制，够个人用）。 */
  async devices(homeId) {
    const body = { get_split_device: true, dids: [], limit: 200 };
    if (homeId) body.home_id = homeId;
    return this.post('/v2/home/device_list_page', body);
  }

  /** 读属性：items = [{did, siid, piid}]。 */
  async props(items) {
    return this.post('/miotspec/prop/get', {
      params: items.map(({ did, siid, piid }) => ({ did, siid, piid })),
      datasource: 1,
    });
  }

  /** 写属性：items = [{did, siid, piid, value}]。 */
  async setProps(items) {
    return this.post('/miotspec/prop/set', {
      params: items.map(({ did, siid, piid, value }) => ({ did, siid, piid, value })),
    });
  }

  /** 执行动作。注意：params 是对象（不是数组），in 缺省时也必须是 []。 */
  async callAction(did, siid, aiid, args) {
    return this.post('/miotspec/action', {
      params: { did, siid, aiid, in: Array.isArray(args) ? args : [] },
    });
  }

  /**
   * 按 did 批量取 MIoT spec 实例（服务端自补 urn）。
   *
   * 注意：该端点单次最多 50 个 did，54 台设备一次性传会返回
   * "Invalid param (code -8)"（真账号实测）。这里按 20 分片串行请求
   * 再合并 —— 留足余量，也不并发以免触发风控。
   */
  async specs(dids) {
    const CHUNK = 20;
    const unique = [...new Set(dids.map(String))];
    const merged = { code: 0, message: 'ok', instances: {} };
    for (let i = 0; i < unique.length; i += CHUNK) {
      const slice = unique.slice(i, i + CHUNK);
      const part = await this.post('/appgateway/gspec/Gspec/get_instances_by_dids', {
        dids: slice,
        urns: slice.map(() => ''),
        isGetFullInstance: true,
      });
      if (part && part.instances) Object.assign(merged.instances, part.instances);
    }
    return merged;
  }

  /** 设备改名。 */
  async renameDevice(did, name) {
    return this.post('/device/rename', {
      app_version: 1, newName: name, did: String(did), is_group: false,
    });
  }

  /** 设备搬房间。 */
  async moveDevices(roomId, dids, homeOwner) {
    return this.post('/homeroom/batch_device_to_room', {
      id: String(roomId), home_owner: homeOwner, dids: dids.map(String),
    });
  }

  /** 家庭首页状态弹窗数据（fault/working/security）。 */
  async homeStatus(homeId, ownerId) {
    return this.post('/smh/get_act_data', {
      home_id: homeId, ignore_existing: true,
      owner_id: ownerId, modules: ['fault', 'working', 'security'],
    });
  }
}

module.exports = { CloudClient, CloudError, AuthError, BASE_IO };
