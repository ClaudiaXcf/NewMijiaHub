'use strict';
/** API 层：演示模式（纯本地 + localStorage）/ 云端模式（node server.js）。
 *  两套后端对前端暴露同一套设备-控件模型。 */
(function () {
  const MijiaAPI = {
    mode: 'demo',            // 'demo' | 'cloud'
    server: false,           // 是否有本地服务器
    user: null,

    async init() {
      if (location.protocol === 'file:') return;
      try {
        const r = await fetch('/api/state', { cache: 'no-store' });
        if (!r.ok) return;
        const j = await r.json();
        if (j && j.ok) {
          this.server = true;
          this.mode = j.mode || 'demo';
          this.user = j.user || null;
        }
      } catch (_) { /* 静态打开 / 无服务器 → 演示模式 */ }
    },

    // ------------------------------------------------------------ 设备列表
    async fetchDevices() {
      if (this.mode !== 'cloud') return null;
      const r = await fetch('/api/devices', { cache: 'no-store' });
      const j = await r.json();
      if (!j.ok) {
        if (j.auth) this.mode = 'demo';
        throw new Error(j.error || '拉取设备失败');
      }
      this.user = j.user || this.user;
      return {
        families: j.families || [],
        devices: j.devices || [],
        warning: j.warning || '',
      };
    },

    // ------------------------------------------------------------ 控制
    async setProp(did, siid, piid, value, opts = {}) {
      if (this.mode !== 'cloud') return { ok: true };
      const body = { did, siid, piid, value };
      // 只写属性读不回来，告诉服务端别做读回确认
      if (opts.verify === false) body.verify = false;
      const r = await fetch('/api/prop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      return r.json();
    },

    async callAction(did, siid, aiid, args) {
      if (this.mode !== 'cloud') return { ok: true };
      const r = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ did, siid, aiid, args }),
      });
      return r.json();
    },

    async rename(did, name) {
      if (this.mode !== 'cloud') return { ok: true };
      const r = await fetch('/api/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ did, name }),
      });
      return r.json();
    },

    // ------------------------------------------------------------ 登录
    async qrStart() {
      const r = await fetch('/api/login/qr/start', { method: 'POST' });
      return r.json();
    },
    qrImageUrl() { return '/api/login/qr/image'; },
    async qrWait() {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 55000);
      try {
        const r = await fetch('/api/login/qr/wait', { signal: ctrl.signal, cache: 'no-store' });
        return await r.json();
      } catch (_) {
        return { status: 'waiting' };
      } finally {
        clearTimeout(t);
      }
    },
    async logout() {
      const r = await fetch('/api/logout', { method: 'POST' });
      this.mode = 'demo';
      this.user = null;
      return r.json();
    },
  };

  window.MijiaAPI = MijiaAPI;
})();
