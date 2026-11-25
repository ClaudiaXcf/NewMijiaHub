'use strict';
/* 米家 Web 版 前端逻辑（无框架）：
 *  - 视图：设备列表 / 小爱音箱 / 音乐投送 / 手机投屏 / 自动化 / 账号
 *  - 演示模式：全本地模拟（电量/温湿度/洗衣倒计时/播放进度）+ localStorage
 *  - 云端模式：设备与控件来自 node server.js（扫码登录后） */
(function () {
  const API = window.MijiaAPI;
  const I = window.Icons;
  const i18n = window.MijiaI18n;
  const t = (s, v) => i18n.t(s, v);

  // ------------------------------------------------------------ 工具

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  const mmss = (sec) => {
    sec = Math.max(0, Math.floor(sec));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };
  const fmtVal = (v, unit) => {
    if (typeof v === 'number') {
      const s = Number.isInteger(v) ? String(v) : v.toFixed(1);
      return s + (unit || '');
    }
    return String(v) + (unit || '');
  };
  /** 控件显示值：有枚举就翻成标签，避免状态行出现裸数字（0 → 正常） */
  function ctrlText(c) {
    if (!c || c.value === undefined) return '—';
    if (c.options) {
      const o = c.options.find((x) => String(x.value) === String(c.value));
      if (o) return o.label + (c.unit || '');
    }
    return fmtVal(c.value, c.unit);
  }
  function paintRange(el) {
    const min = Number(el.min) || 0;
    const max = Number(el.max) || 100;
    const p = ((Number(el.value) - min) / (max - min || 1)) * 100;
    el.style.background = `linear-gradient(90deg, var(--blue) 0%, var(--blue) ${p}%, var(--track) ${p}%, var(--track) 100%)`;
  }
  function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

  // ------------------------------------------------------------ 状态

  const state = {
    view: 'devices',
    familyIndex: 0,
    families: [],
    devices: {},        // did → device
    stereoGroup: null,
    speakerExtras: {},
    playlist: [],
    scenes: [],
    castTargets: [],
    player: null,
    theme: 'light',
    selectedSpeakerDid: null,
    cloudBusy: false,
    modal: null,        // {type, did}
    toastId: 0,
    lang: 'zh',
    customNames: {},
    // 布局：拖动排序 / 卡片尺寸 / 自定义图标 / 房间覆盖 / 折叠状态
    layout: { order: [], sizes: {}, icons: {}, colors: {}, room: {}, collapsed: {}, rooms: {} },
  };

  const NAV = [
    { id: 'speaker', name: '小爱音箱', icon: 'speaker', color: '#ff5f52' },
    { id: 'devices', name: '米家设备', icon: 'devicesGrid', color: '#2fae71' },
    { id: 'castmusic', name: '音乐投送', icon: 'note', color: '#3d6de0' },
    { id: 'castscreen', name: '手机投屏', icon: 'phone', color: '#7b6cf6' },
    { id: 'automation', name: '自动化任务', icon: 'bolt', color: '#f0a028' },
  ];

  const STORE_KEY = 'mijia-web-state-v1';

  // 图标选择器：key 对应 icons.js，第三项是英文名（切到英文时直接用）
  const ICON_CHOICES = [
    ['lamp', '吸顶灯', 'Ceiling light'], ['ceilingLamp', '吊灯', 'Pendant'],
    ['deskLamp', '台灯', 'Desk lamp'], ['floorLamp', '落地灯', 'Floor lamp'],
    ['stripLight', '灯带', 'Light strip'], ['spotlight', '射灯', 'Spotlight'],
    ['mirrorLight', '镜前灯', 'Mirror light'], ['plug', '插座', 'Socket'],
    ['switchPanel', '开关面板', 'Switch panel'], ['gateway', '网关', 'Gateway'],
    ['router', '路由器', 'Router'], ['doorLock', '门锁', 'Door lock'],
    ['doorbell', '门铃', 'Doorbell'], ['door', '门', 'Door'], ['camera', '摄像头', 'Camera'],
    ['speaker', '音箱', 'Speaker'], ['ac', '空调', 'Air conditioner'], ['fan', '风扇', 'Fan'],
    ['airpurifier', '净化器', 'Purifier'], ['humidifier', '加湿器', 'Humidifier'],
    ['dehumidifier', '除湿机', 'Dehumidifier'], ['heater', '热水器', 'Water heater'],
    ['washer', '洗衣机', 'Washer'], ['dishwasher', '洗碗机', 'Dishwasher'],
    ['fridge', '冰箱', 'Fridge'], ['cooker', '电饭煲', 'Rice cooker'],
    ['oven', '烤箱', 'Oven'], ['microwave', '微波炉', 'Microwave'],
    ['induction', '电磁炉', 'Induction'], ['rangeHood', '油烟机', 'Range hood'],
    ['kettle', '水壶', 'Kettle'], ['coffee', '咖啡机', 'Coffee maker'],
    ['waterPurifier', '净水器', 'Water purifier'], ['airer', '晾衣架', 'Airer'],
    ['bed', '床', 'Bed'], ['tv', '电视', 'TV'], ['projector', '投影仪', 'Projector'],
    ['monitor', '显示器', 'Monitor'], ['laptop', '笔记本', 'Laptop'],
    ['tablet', '平板', 'Tablet'], ['printer', '打印机', 'Printer'],
    ['vacuum', '扫地机', 'Robot vacuum'], ['curtain', '窗帘', 'Curtain'],
    ['blind', '百叶帘', 'Blinds'], ['bathheater', '浴霸', 'Bath heater'],
    ['sensor', '传感器', 'Sensor'], ['motion', '人体感应', 'Motion'],
    ['smoke', '烟感', 'Smoke'], ['gas', '燃气', 'Gas'],
    ['waterLeak', '水浸', 'Water leak'], ['scale', '体重秤', 'Scale'],
    ['watch', '手表', 'Watch'], ['toothbrush', '牙刷', 'Toothbrush'],
    ['treadmill', '跑步机', 'Treadmill'], ['clock', '时钟', 'Clock'],
    ['music', '音乐', 'Music'], ['generic', '通用', 'Generic'],
  ];
  const ICON_COLORS = [
    '#e8960c', '#3a7bd5', '#35a7e0', '#f07830', '#2bb3a6', '#35b68f',
    '#7b6cf6', '#f06292', '#8a7bd6', '#5c9df0', '#d98f5c', '#6cb2eb',
    '#8f9bb3', '#2fae71', '#e05c5c', '#f0a028',
  ];

  function savePersist() {
    try {
      const deviceVals = {};
      const names = {};
      for (const [did, dev] of Object.entries(state.devices)) {
        // 改过的名字两种模式都要记住（云端设备名同理，否则刷新就还原）
        if (dev.customName) names[did] = dev.name;
        if (API.mode === 'cloud') continue;
        const vals = {};
        for (const c of dev.controls || []) vals[c.key] = c.value;
        deviceVals[did] = vals;
      }
      localStorage.setItem(STORE_KEY, JSON.stringify({
        deviceVals, names,
        player: state.player,
        theme: state.theme,
        familyIndex: state.familyIndex,
        roomsCustom: state.roomsCustom,
        lang: state.lang,
        layout: state.layout,
        lastView: state.view,
      }));
    } catch (_) { /* 隐私模式等场景忽略 */ }
  }
  const saveSoon = debounce(savePersist, 400);

  function loadPersist() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return {};
      return JSON.parse(raw) || {};
    } catch (_) { return {}; }
  }

  // ------------------------------------------------------------ 布局（拖动 / 尺寸 / 图标）

  function devRoom(dev) { return state.layout.room[dev.did] || dev.roomName || '未分区'; }
  function devIcon(dev) { return dev.customIcon || dev.icon || 'generic'; }
  function devColor(dev) { return dev.customColor || dev.color || '#8f9bb3'; }
  function cardSize(did) { return state.layout.sizes[did] || 'md'; }
  function sizeClass(did) {
    const s = cardSize(did);
    return s === 'md' ? '' : ` size-${s}`;
  }
  function orderIndexOf(did) {
    const i = (state.layout.order || []).indexOf(String(did));
    return i < 0 ? 1e9 : i;
  }
  function orderedDevices(list) {
    if (!(state.layout.order || []).length) return list.slice();
    return list.slice().sort((a, b) => orderIndexOf(a.did) - orderIndexOf(b.did));
  }
  function orderedRoomNames(names, famId) {
    const saved = state.layout.rooms[famId] || [];
    if (!saved.length) return names.slice();
    const idx = new Map(saved.map((n, i) => [n, i]));
    return names.slice().sort((a, b) => {
      const ia = idx.has(a) ? idx.get(a) : 1e9;
      const ib = idx.has(b) ? idx.get(b) : 1e9;
      return ia - ib;
    });
  }
  function applyLayoutToDevices() {
    for (const [did, icon] of Object.entries(state.layout.icons || {})) {
      if (state.devices[did]) state.devices[did].customIcon = icon;
    }
    for (const [did, color] of Object.entries(state.layout.colors || {})) {
      if (state.devices[did]) state.devices[did].customColor = color;
    }
    for (const [did, name] of Object.entries(state.customNames || {})) {
      if (state.devices[did] && name) {
        state.devices[did].name = name;
        state.devices[did].customName = true;
      }
    }
  }
  function roomCollapsed(famId, name) {
    return !!state.layout.collapsed[`${famId}::${name}`];
  }
  /** 拖动落点：把 dragDid 放到 targetDid 前/后，必要时改所属房间 */
  function dropCard(dragDid, targetDid, roomName, before) {
    const all = orderedDevices(Object.values(state.devices)).map((d) => String(d.did));
    const from = all.indexOf(String(dragDid));
    if (from >= 0) all.splice(from, 1);
    let at = targetDid ? all.indexOf(String(targetDid)) : -1;
    if (at < 0) {
      // 落到房间空白处：插到该房间最后一个设备之后
      const roomDids = all.filter((did) => devRoom(state.devices[did]) === roomName);
      const last = roomDids[roomDids.length - 1];
      at = last ? all.indexOf(last) + 1 : all.length;
    } else if (!before) {
      at += 1;
    }
    all.splice(Math.max(0, Math.min(at, all.length)), 0, String(dragDid));
    state.layout.order = all;
    const dev = state.devices[dragDid];
    if (dev && roomName && devRoom(dev) !== roomName) {
      state.layout.room[dragDid] = roomName;
      if (!isCloud()) dev.roomName = roomName;
    }
    saveSoon();
    renderContent();
  }

  // ------------------------------------------------------------ 设备取值

  function ctrl(dev, key) { return (dev.controls || []).find((c) => c.key === key); }
  function ctrlVal(dev, key, fallback) {
    const c = ctrl(dev, key);
    return c && c.value !== undefined ? c.value : fallback;
  }
  function setCtrlVal(dev, key, value, { silent = false, cloud = true } = {}) {
    const c = ctrl(dev, key);
    if (!c) return false;
    const prev = c.value;
    c.value = value;
    if (!silent) {
      if (API.mode === 'cloud' && cloud && c.siid != null && c.piid != null) {
        API.setProp(dev.did, c.siid, c.piid, value).then((r) => {
          if (!r.ok) {
            // 下发失败要回滚，否则界面显示的和设备实际状态不一致
            c.value = prev;
            updateDeviceCard(dev);
            if (state.modal && state.modal.did === dev.did) updateDetailModal(dev);
            toast(`下发失败：${r.error || '未知错误'}`, 'warn');
          }
        });
      }
    }
    updateDeviceCard(dev);
    if (state.modal && state.modal.type === 'device' && state.modal.did === dev.did) {
      updateDetailModal(dev);
    }
    saveSoon();
    return true;
  }

  // 主开关：main === false 的是指示灯/夜灯这类附属开关，不能当设备电源用。
  // 演示数据没有 main 字段，按主开关处理（向后兼容）。
  function mainSwitchOf(dev) {
    return (dev.controls || []).find((c) => c.type === 'switch' && c.main !== false) || null;
  }

  function isOn(dev) {
    const c = mainSwitchOf(dev);
    return !!(c && c.value);
  }

  function demoStatus(dev) {
    if (dev.online === false) return { text: '离线', cls: 'is-offline' };
    const sim = dev.sim || {};
    switch (dev.special) {
      case 'light': return { text: isOn(dev) ? '已开启' : '已关闭', cls: isOn(dev) ? 'is-on' : '' };
      case 'plug': {
        if (!isOn(dev)) return { text: '已关闭', cls: '' };
        const w = Math.round(sim.watts || 0);
        return { text: w > 0 ? `已开启 · ${w} W` : '已开启', cls: 'is-on' };
      }
      case 'speaker': {
        let t = '在线';
        if (state.player && state.player.output === dev.did) t += state.player.playing ? ' · 播放中' : ' · 已暂停';
        return { text: t, cls: 'is-on' };
      }
      case 'sensor': {
        const temp = (sim.temp != null ? sim.temp : ctrlVal(dev, '2.1', 0));
        const hum = (sim.humidity != null ? sim.humidity : ctrlVal(dev, '2.2', 0));
        return { text: `${fmtVal(temp)} °C · ${Math.round(hum)} %`, cls: '' };
      }
      case 'humidifier': {
        if (!isOn(dev)) return { text: '已关闭', cls: '' };
        return { text: `已开启 · 目标 ${ctrlVal(dev, '2.2', 60)}%`, cls: 'is-on' };
      }
      case 'washer': {
        if (!isOn(dev)) return { text: '已关机', cls: '' };
        return { text: `已开启 · 剩余 ${mmss(sim.remainSec || 0)}`, cls: 'is-on' };
      }
      case 'heater': {
        if (!isOn(dev)) return { text: '已关闭', cls: '' };
        return { text: `已开启 · ${ctrlVal(dev, '2.2', 45)}°C`, cls: 'is-on' };
      }
      default: break;
    }
    const sw = (dev.controls || []).find((c) => c.type === 'switch');
    if (sw) return { text: sw.value ? '已开启' : '已关闭', cls: sw.value ? 'is-on' : '' };
    const st = (dev.controls || []).find((c) => c.type === 'status' && c.value !== undefined);
    if (st) return { text: fmtVal(st.value, st.unit), cls: '' };
    if (dev.status) return { text: dev.status, cls: dev.statusCls || '' };
    return { text: '在线', cls: '' };
  }

  // 云端：服务端状态是"拉取那一刻"的快照，操作后必须本地重算，
  // 否则点了开关按钮变蓝了、状态文字还写着「已关闭」。
  function localStatus(dev) {
    const controls = dev.controls || [];
    if (!controls.length) return null;
    const mains = controls.filter((c) => c.type === 'switch' && c.prop === 'on' && c.main !== false);
    const gangs = mains.filter((c) => c.svc === 'switch');
    const counted = gangs.length > 1 ? gangs : mains;
    if (counted.length > 1) {
      const on = counted.filter((c) => c.value).length;
      return { text: `${on}/${counted.length} 开启`, cls: on ? 'is-on' : '' };
    }
    if (counted.length === 1 && counted[0].value !== undefined) {
      return { text: counted[0].value ? '已开启' : '已关闭', cls: counted[0].value ? 'is-on' : '' };
    }
    // 常开设备（网关）保留服务端的「运行中 · IP」，本地算不出更有用的信息
    if (dev.status && /运行中|在线/.test(dev.status)) return { text: dev.status, cls: dev.statusCls || '' };
    const mode = controls.find((c) => (c.prop === 'mode' || c.prop === 'work-mode') && c.value !== undefined);
    if (mode) {
      let t = mode.value;
      if (mode.options) {
        const o = mode.options.find((x) => String(x.value) === String(mode.value));
        if (o) t = o.label;
      }
      return { text: `${t}${mode.unit || ''}`, cls: '' };
    }
    const st = controls.find((c) => c.type === 'status' && c.value !== undefined
      && c.prop !== 'fault' && c.prop !== 'alarm');
    if (st) {
      let t = st.value;
      if (st.options) {
        const o = st.options.find((x) => String(x.value) === String(st.value));
        if (o) t = o.label;
      }
      return { text: `${t}${st.unit || ''}`, cls: '' };
    }
    return null;
  }

  function statusOf(dev) {
    if (API.mode === 'cloud') {
      const local = localStatus(dev);
      if (local) return local;
      if (dev.status != null) return { text: dev.status, cls: dev.statusCls || '' };
    }
    return demoStatus(dev);
  }

  function speakerDevices() {
    return Object.values(state.devices).filter((d) => d.icon === 'speaker' || d.special === 'speaker');
  }

  // ------------------------------------------------------------ 初始化

  async function boot() {
    const params = new URLSearchParams(location.search);
    const persisted = loadPersist();
    state.theme = params.get('theme') === 'dark' ? 'dark'
      : (persisted.theme === 'dark' ? 'dark' : 'light');
    applyTheme();
    state.lang = params.get('lang') === 'en' ? 'en'
      : params.get('lang') === 'zh' ? 'zh'
        : (persisted.lang === 'en' ? 'en' : 'zh');
    i18n.setLang(state.lang);
    state.layout = Object.assign(
      { order: [], sizes: {}, icons: {}, colors: {}, room: {}, collapsed: {}, rooms: {} },
      persisted.layout || {},
    );
    state.customNames = persisted.names || {};

    const demo = window.DemoData.build();
    Object.assign(state, {
      families: demo.families,
      stereoGroup: demo.stereoGroup,
      speakerExtras: demo.speakerExtras,
      playlist: demo.playlist,
      scenes: demo.scenes,
      castTargets: demo.castTargets,
      player: Object.assign(demo.player, persisted.player || {}),
      roomsCustom: persisted.roomsCustom || null,
    });
    state.devices = {};
    for (const dev of demo.devices) state.devices[dev.did] = dev;
    applyLayoutToDevices();
    if (persisted.deviceVals) {
      for (const [did, vals] of Object.entries(persisted.deviceVals)) {
        const dev = state.devices[did];
        if (!dev) continue;
        for (const c of dev.controls || []) {
          if (vals[c.key] !== undefined) c.value = vals[c.key];
        }
      }
    }
    if (persisted.names) {
      for (const [did, name] of Object.entries(persisted.names)) {
        if (state.devices[did]) {
          state.devices[did].name = name;
          state.devices[did].customName = true;
        }
      }
    }
    state.familyIndex = Math.min(persisted.familyIndex || 0, state.families.length - 1);
    state.selectedSpeakerDid = 'demo-speaker-art';

    await API.init();
    $('#brandMode').textContent = isCloud()
      ? t('已登录')
      : (API.server ? t('演示模式') : t('演示模式（本地）'));
    $('#brandMode').className = 'brand-mode' + (isCloud() ? ' cloud' : '');
    if (API.mode === 'cloud') {
      await loadCloudData();
    }

    renderChrome();
    renderAll();

    const view = params.get('view');
    if (view && NAV.some((n) => n.id === view)) state.view = view;
    else if (view === 'account') state.view = 'account';
    renderAll();
    const did = params.get('did');
    if (did && state.devices[did]) openDeviceModal(did);
    const settingsDid = params.get('settings');
    if (settingsDid && state.devices[settingsDid]) openSettingsModal(settingsDid);

    startSim();
  }

  function isCloud() { return API.mode === 'cloud'; }

  async function loadCloudData() {
    state.cloudBusy = true;
    renderContent();
    try {
      const data = await API.fetchDevices();
      if (data) {
        state.families = data.families.length ? data.families : [{ id: 0, name: '我的家', rooms: [] }];
        state.devices = {};
        for (const dev of data.devices) state.devices[dev.did] = dev;
        applyLayoutToDevices();
        state.familyIndex = Math.min(state.familyIndex, state.families.length - 1);
        if (data.warning) toast(data.warning, 'warn');
      }
    } catch (err) {
      toast(`${t('云端数据加载失败')}：${err.message}`, 'warn');
      API.mode = 'demo';
      $('#brandMode').textContent = t('演示模式（云端不可用）');
    }
    state.cloudBusy = false;
    renderChrome();
    renderContent();
  }

  // ------------------------------------------------------------ 渲染外壳

  function applyTheme() {
    document.documentElement.setAttribute('data-theme', state.theme);
    const btn = $('#btnTheme');
    btn.innerHTML = state.theme === 'light' ? I.moon({ size: 15 }) : I.sun({ size: 15 });
  }

  function renderChrome() {
    $('#brandLogo').innerHTML = I.house({ size: 18, stroke: '#fff' });
    $('#btnMin').innerHTML = I.minus({ size: 13 });
    $('#btnMax').innerHTML = I.maximize({ size: 12 });
    $('#btnClose').innerHTML = I.close({ size: 13 });
    $('#btnLang').textContent = state.lang === 'en' ? 'EN' : '中';
    $('#btnLang').title = state.lang === 'en' ? 'Switch to Chinese' : '切换语言 / Language';
    $('#btnTheme').title = t('切换深浅色');
    $('#btnMin').title = t('最小化（网页版由浏览器窗口管理）');
    $('#btnMax').title = t('最大化（网页版由浏览器窗口管理）');
    $('#btnClose').title = t('关闭（网页版由浏览器窗口管理）');
    // 静态文案：记住中文原文，切回中文时能还原（DOM 兜底翻译是不可逆的）
    $$('[data-zh]').forEach((el) => {
      el.textContent = state.lang === 'en' ? i18n.t(el.dataset.zh) : el.dataset.zh;
    });
    $('#brandMode').textContent = isCloud()
      ? t('已登录')
      : (API.server ? t('演示模式') : t('演示模式（本地）'));
    $('#brandMode').className = 'brand-mode' + (isCloud() ? ' cloud' : '');

    // 家庭标签
    const tabs = $('#familyTabs');
    tabs.innerHTML = state.families.map((f, i) =>
      `<button class="family-tab ${i === state.familyIndex ? 'active' : ''}" data-action="family" data-index="${i}">
        <span class="family-tab-dot">${I.house({ size: 12, stroke: 'currentColor' })}</span><span data-no-i18n>${esc(f.name)}</span></button>`).join('');

    // 侧栏
    const sb = $('#sidebar');
    sb.innerHTML = NAV.map((n) => `
      <button class="nav-item ${state.view === n.id ? 'active' : ''}" data-action="nav" data-view="${n.id}" title="${esc(t(n.name))}">
        <span class="nav-ico" style="background:${n.color}">${I[n.icon]({ size: 19, stroke: '#fff' })}</span>
        <span class="nav-label">${esc(t(n.name))}</span>
      </button>`).join('') + `
      <div class="sidebar-spacer"></div>
      <button class="nav-item account ${state.view === 'account' ? 'active' : ''}" data-action="nav" data-view="account" title="${esc(t('小米账号'))}">
        <span class="nav-ico account-ico">${I.person({ size: 19, stroke: '#fff' })}</span>
        <span class="nav-label">${esc(t('小米账号'))}</span>
      </button>`;
    // 标题栏/底部等静态文案走 DOM 兜底翻译
    i18n.apply($('#app'));
  }

  function renderAll() {
    renderChrome();
    renderContent();
    renderPlayer();
  }

  function renderContent() {
    const root = $('#content');
    if (state.cloudBusy) {
      root.innerHTML = '<div class="loading-box"><span class="spinner"></span>正在从云端加载设备…</div>';
      return;
    }
    switch (state.view) {
      case 'devices': root.innerHTML = viewDevices(); break;
      case 'speaker': root.innerHTML = viewSpeaker(); break;
      case 'castmusic': root.innerHTML = viewCastMusic(); break;
      case 'castscreen': root.innerHTML = viewCastScreen(); break;
      case 'automation': root.innerHTML = viewAutomation(); break;
      case 'account': root.innerHTML = viewAccount(); break;
      default: root.innerHTML = viewDevices();
    }
    $$('input[type=range]', root).forEach(paintRange);
    i18n.apply(root);
  }

  // ------------------------------------------------------------ 视图：设备

  function currentFamily() { return state.families[state.familyIndex] || state.families[0]; }

  function devicesOfFamily() {
    const fam = currentFamily();
    const list = Object.values(state.devices);
    if (isCloud()) {
      const dids = new Set();
      for (const r of fam.rooms || []) for (const did of r.dids || []) dids.add(String(did));
      if (dids.size) return list.filter((d) => dids.has(String(d.did)));
      return list; // 房间归属缺失时全量展示
    }
    return list.filter((d) => d.roomName && fam.rooms.some((r) => r.name === d.roomName));
  }

  function roomNamesOf(fam, devs) {
    const names = [];
    for (const r of fam.rooms || []) names.push(r.name);
    for (const d of devs) {
      const rn = devRoom(d);
      if (!names.includes(rn)) names.push(rn);
    }
    return names;
  }

  function viewDevices() {
    const fam = currentFamily();
    if (!fam) return '<div class="empty-box"></div>';
    const devs = orderedDevices(devicesOfFamily());
    if (!devs.length) {
      return `<div class="empty-box">
        <div class="empty-ico">${I.house({ size: 40, stroke: '#b9c3d8', sw: 1.6 })}</div>
        <div class="empty-title">${esc(t('「{n}」还没有设备', { n: fam.name }))}</div>
        <div class="empty-sub">${isCloud() ? t('在手机米家 App 中给这个家庭添加设备后，点右上角「刷新设备」') : t('演示数据只包含「我的家」；切换标签可查看空家庭的样子')}</div>
      </div>`;
    }
    // 房间顺序：家庭房间 → 用户拖动后的顺序 → 散设备补充
    const roomNames = orderedRoomNames(roomNamesOf(fam, devs), fam.id);
    const sections = roomNames.map((rn) => {
      const list = devs.filter((d) => devRoom(d) === rn);
      if (!list.length) return '';
      const collapsed = roomCollapsed(fam.id, rn);
      // 设备多的房间横跨两列，避免它一个人把整行撑高、旁边留一大片空白
      const wide = !collapsed && list.length >= 7;
      return `<section class="room-card${wide ? ' room-wide' : ''}" data-room-section="${esc(rn)}">
        <div class="room-head" draggable="true" data-drag-room="${esc(rn)}" title="${esc(t('拖动排序'))}">
          <span class="room-grip">${I.grip({ size: 14 })}</span>
          <span class="room-name" data-no-i18n>${esc(rn)}</span>
          <span class="room-count">${esc(t('{n} 台设备', { n: list.length }))}</span>
          <span class="room-actions">
            <button class="room-edit" data-action="room-rename" data-room="${esc(rn)}" title="${esc(t('重命名房间'))}">${I.pencil({ size: 13 })}</button>
            <button class="room-edit" data-action="room-collapse" data-room="${esc(rn)}" title="${esc(collapsed ? t('展开') : t('收起'))}">${collapsed ? I.chevronDown({ size: 13 }) : I.chevronUp({ size: 13 })}</button>
          </span>
        </div>
        ${collapsed ? '' : `<div class="dev-grid" data-room-drop="${esc(rn)}">${list.map(deviceCard).join('')}</div>`}
      </section>`;
    }).join('');
    return `<div class="drag-hint">${I.dragMove({ size: 13 })}<span>${esc(t('拖动卡片可调整顺序，拖到其他房间可移动设备'))}</span></div>
      <div class="rooms-grid">${sections}</div>`;
  }

  function deviceCard(dev) {
    const st = statusOf(dev);
    const on = isOn(dev);
    // 只有存在主开关的设备才在卡片上放电源按钮；
    // 网关/传感器这类常开设备只打开了指示灯，不该出现"关机"按钮
    const hasSwitch = !!mainSwitchOf(dev);
    const pending = !!dev._pending;
    const iconName = devIcon(dev);
    const iconFn = I[iconName] || I.generic;
    return `<div class="dev-card${dev.online === false ? ' offline' : ''}${sizeClass(dev.did)}" data-action="open-device" data-did="${esc(dev.did)}"
      title="${esc(t('打开设备详情'))}" draggable="true" data-drag-card="${esc(dev.did)}">
      <div class="dev-top">
        <span class="dev-thumb" style="color:${devColor(dev)}">${iconFn({ size: 30, sw: 1.7 })}</span>
        <span class="dev-tools">
          <button class="card-tool" data-action="device-settings" data-did="${esc(dev.did)}" title="${esc(t('更多设置与信息'))}">${I.gear({ size: 14 })}</button>
          ${hasSwitch ? `<button class="power-btn ${on ? 'on' : ''} ${pending ? 'pending' : ''}" data-action="power" data-did="${esc(dev.did)}" title="${pending ? esc(t('下发中…')) : `${esc(t(on ? '关闭' : '开启'))} ${esc(dev.name)}`}"
          ${dev.online === false || pending ? 'disabled' : ''}>${I.power({ size: 16, stroke: '#fff' })}</button>` : ''}
        </span>
      </div>
      <div class="dev-name" data-no-i18n>${esc(dev.name)}</div>
      <div class="dev-status ${st.cls || ''}" data-status="${esc(dev.did)}">${esc(st.text)}</div>
    </div>`;
  }

  function updateDeviceCard(dev) {
    const el = $(`[data-status="${CSS.escape(dev.did)}"]`);
    if (!el) return;
    const st = statusOf(dev);
    el.textContent = st.text;
    i18n.apply(el);
    el.className = `dev-status ${st.cls || ''}`;
    const card = el.closest('.dev-card');
    if (card) {
      const btn = $('.power-btn', card);
      if (btn) {
        const on = isOn(dev);
        const pending = !!dev._pending;
        btn.classList.toggle('on', on);
        btn.classList.toggle('pending', pending);
        btn.disabled = dev.online === false || pending;
        btn.title = pending ? '下发中…' : `${on ? '关闭' : '开启'} ${dev.name}`;
      }
    }
  }

  // ------------------------------------------------------------ 视图：音箱

  function viewSpeaker() {
    const speakers = speakerDevices();
    if (!speakers.length) {
      return `<div class="empty-box">
        <div class="empty-ico">${I.speaker({ size: 40, stroke: '#b9c3d8', sw: 1.6 })}</div>
        <div class="empty-title">没有找到小爱音箱</div>
        <div class="empty-sub">${isCloud() ? '账号下暂无音箱类设备' : '演示家庭里应当有 3 台小爱音箱'}</div>
      </div>`;
    }
    const sel = state.devices[state.selectedSpeakerDid] || speakers[0];
    state.selectedSpeakerDid = sel.did;
    const extras = state.speakerExtras[sel.did] || {};
    const volume = ctrlVal(sel, '2.2', 30);
    const isOutput = state.player && state.player.output === sel.did;
    const btMesh = extras.btMesh;
    const dts = extras.dts || null;
    const stereo = state.stereoGroup;

    return `
    <div class="view-head">
      <span class="view-title">设备</span>
      <button class="ghost-btn" data-action="refresh">${I.refresh({ size: 13 })}刷新设备</button>
    </div>
    <div class="speaker-cards">
      ${speakers.map((s) => `
        <button class="speaker-card ${s.did === sel.did ? 'active' : ''}" data-action="select-speaker" data-did="${esc(s.did)}">
          <span class="speaker-card-ico" style="background:${s.color || '#f06292'}">${I.speaker({ size: 22, stroke: '#fff' })}</span>
          <span class="speaker-card-name">${esc(s.name)}</span>
          <span class="speaker-card-meta">${esc(s.modelInfo || s.model || '')}</span>
          <span class="speaker-card-lan">${s.online === false ? '离线' : '局域网可用'}</span>
        </button>`).join('')}
    </div>

    <section class="panel-card speaker-panel">
      <div class="panel-head">
        <span class="panel-title">${esc(sel.name)}</span>
        <button class="ghost-btn" data-action="rename-speaker" data-did="${esc(sel.did)}">${I.pencil({ size: 12 })}重命名音箱</button>
      </div>
      <div class="speaker-panel-grid">
        <div class="speaker-play">
          <div class="vol-row">
            <span class="vol-label">音量</span>
            <input type="range" min="0" max="100" step="1" value="${volume}" data-range="speaker-volume" data-did="${esc(sel.did)}">
            <span class="vol-num" id="speakerVolNum">${volume}%</span>
            <button class="ghost-btn small" data-action="speaker-mute" data-did="${esc(sel.did)}">${extras.muted ? I.volumeMute({ size: 14 }) : I.volume({ size: 14 })}静音</button>
          </div>
          <div class="speaker-state">${isOutput
            ? (state.player.playing ? '正在播放 · ' + esc(trackTitle()) : '输出到此音箱 · 已暂停')
            : '自身播放 · 状态未知'}</div>
          <div class="speaker-btns">
            <button class="chip-btn" data-action="speaker-ctrl" data-cmd="prev" ${isOutput ? '' : 'disabled'}>${I.prev({ size: 14 })}上一首</button>
            <button class="chip-btn" data-action="speaker-ctrl" data-cmd="pause" ${isOutput && state.player.playing ? '' : 'disabled'}>暂停</button>
            <button class="chip-btn" data-action="speaker-ctrl" data-cmd="resume" ${isOutput && !state.player.playing ? '' : 'disabled'}>继续</button>
            <button class="chip-btn" data-action="speaker-ctrl" data-cmd="next" ${isOutput ? '' : 'disabled'}>${I.next({ size: 14 })}下一首</button>
          </div>
        </div>
        <div class="speaker-wireless">
          <div class="wireless-block">
            <div class="wireless-title">无线模式</div>
            <div class="wireless-row">
              <span>蓝牙 Mesh 网关</span>
              <span class="wireless-state ${btMesh ? 'on' : ''}">${btMesh ? '已开启' : '已关闭'}</span>
              <button class="ghost-btn small" data-action="speaker-bt" data-key="btMesh" data-did="${esc(sel.did)}">${btMesh ? '关闭网关' : '开启网关'}</button>
            </div>
            <div class="wireless-row">
              <span>蓝牙音频</span>
              <span class="wireless-state ${extras.btAudio ? 'on' : ''}">${extras.btAudio ? '已开启' : '已关闭'}</span>
              <button class="ghost-btn small" data-action="speaker-bt" data-key="btAudio" data-did="${esc(sel.did)}">蓝牙配对</button>
            </div>
          </div>
          ${dts ? `
          <div class="wireless-block">
            <div class="wireless-title">DTS 音效</div>
            <div class="seg-row">
              ${['澎湃', '温和', '人声'].map((m) => `<button class="seg-btn ${dts === m ? 'active' : ''}" data-action="speaker-dts" data-mode="${m}" data-did="${esc(sel.did)}">${m}</button>`).join('')}
            </div>
          </div>` : ''}
        </div>
      </div>
      ${(extras.functions || []).length ? `
      <div class="speaker-functions">
        ${(extras.functions || []).map((f) => `<button class="chip-btn" data-action="speaker-fn" data-fn="${esc(f)}">${esc(f)}</button>`).join('')}
      </div>` : ''}
    </section>

    ${stereo && !isCloud() ? `
    <section class="panel-card stereo-card">
      <div class="panel-head">
        <div>
          <span class="panel-title">组合立体声</span>
          <span class="panel-sub">${esc(stereo.name)}</span>
        </div>
        <div class="stereo-actions">
          <button class="ghost-btn small" data-action="toast" data-msg="重命名组合（演示）">${I.pencil({ size: 12 })}重命名</button>
          <button class="ghost-btn small" data-action="toast" data-msg="解除组合（演示）">解除组合</button>
        </div>
      </div>
      <div class="stereo-body">
        <div class="stereo-channel">
          <span class="stereo-role">${esc(stereo.left.label)}</span>
          <span class="stereo-name">${esc((state.devices[stereo.left.did] || {}).name || '')}</span>
          <span class="stereo-tag main">${esc(stereo.left.tag)}</span>
        </div>
        <div class="stereo-channel">
          <span class="stereo-role">${esc(stereo.right.label)}</span>
          <span class="stereo-name">${esc((state.devices[stereo.right.did] || {}).name || '')}</span>
          <span class="stereo-tag">${esc(stereo.right.tag)}</span>
        </div>
      </div>
    </section>` : ''}
    `;
  }

  // ------------------------------------------------------------ 视图：投送/投屏/自动化/账号

  function viewCastMusic() {
    const cur = state.player ? state.player.output : 'local';
    return `
    <div class="view-head"><span class="view-title">音乐投送</span></div>
    <div class="cast-grid">
      ${state.castTargets.map((t) => `
        <button class="cast-card ${cur === t.id ? 'active' : ''}" data-action="cast" data-target="${esc(t.id)}">
          <span class="cast-ico" style="background:${t.color}">${I[t.icon]({ size: 24, stroke: '#fff' })}</span>
          <span class="cast-name">${esc(t.name)}</span>
          <span class="cast-state">${cur === t.id ? (state.player.playing ? '正在播放' : '已连接 · 暂停') : '可投送'}</span>
        </button>`).join('')}
    </div>
    <div class="hint-card">${I.info({ size: 14 })}点击目标即可切换播放输出；播放条中的「输出设备」会同步更新。</div>`;
  }

  function viewCastScreen() {
    return `
    <div class="empty-box tall">
      <div class="empty-ico">${I.castScreen({ size: 44, stroke: '#b9c3d8', sw: 1.6 })}</div>
      <div class="empty-title">暂无投屏设备</div>
      <div class="empty-sub">支持 Miracast / DLNA 的电视、盒子会显示在这里（演示）</div>
    </div>`;
  }

  function viewAutomation() {
    if (isCloud()) {
      return `<div class="empty-box tall">
        <div class="empty-ico">${I.bolt({ size: 44, stroke: '#b9c3d8', sw: 1.6 })}</div>
        <div class="empty-title">云端场景执行建设中</div>
        <div class="empty-sub">真实账号下的场景列表与一键执行，对应云端 AppSceneService 接口，见 README 路线图。</div>
      </div>`;
    }
    return `
    <div class="view-head"><span class="view-title">自动化任务</span></div>
    <div class="scene-grid">
      ${state.scenes.map((s) => `
        <section class="scene-card">
          <span class="scene-ico" style="background:${s.color}">${I[s.icon] ? I[s.icon]({ size: 22, stroke: '#fff' }) : I.bolt({ size: 22, stroke: '#fff' })}</span>
          <div class="scene-body">
            <div class="scene-name">${esc(s.name)}</div>
            <div class="scene-desc">${esc(s.desc)}</div>
          </div>
          <button class="primary-btn" data-action="scene-run" data-scene="${esc(s.id)}">执行</button>
        </section>`).join('')}
    </div>
    <div class="hint-card">${I.info({ size: 14 })}演示模式的场景会真实改动上方设备状态；云端模式对应「手动场景一键执行」。</div>`;
  }

  function viewAccount() {
    if (isCloud()) {
      return `
      <section class="panel-card account-card">
        <div class="account-avatar">${I.person({ size: 34, stroke: '#fff' })}</div>
        <div class="account-info">
          <div class="account-name">小米账号 ${esc(API.user ? API.user.userId : '')}</div>
          <div class="account-sub">扫码登录 · 凭据仅保存在本机 data/credentials.json</div>
          <div class="account-stats">${Object.keys(state.devices).length} 台设备 · ${state.families.length} 个家庭</div>
        </div>
        <button class="danger-btn" data-action="logout" id="logoutBtn">退出登录</button>
      </section>
      <div class="hint-card">${I.info({ size: 14 })}退出只删除本机凭据，不影响手机上的米家 App。</div>`;
    }
    const local = !API.server;
    return `
    <section class="panel-card account-card">
      <div class="account-avatar demo">${I.person({ size: 34, stroke: '#fff' })}</div>
      <div class="account-info">
        <div class="account-name">演示模式</div>
        <div class="account-sub">当前数据全部为本地虚构，控制不会触达真实设备</div>
        <div class="account-stats">${Object.keys(state.devices).length} 台设备 · ${state.families.length} 个家庭 · ${state.playlist.length} 首演示曲目</div>
      </div>
      ${local ? '' : `<button class="primary-btn" data-action="login-open">${I.qr({ size: 14 })}扫码登录真实账号</button>`}
    </section>
    ${local ? `
    <div class="hint-card">${I.warn({ size: 14 })}当前是直接打开的静态页面（file://）。要扫码控制真实设备，请运行：
      <code>node server.js</code> 后访问 <code>http://127.0.0.1:8899</code></div>` : `
    <div class="hint-card">${I.info({ size: 14 })}扫码登录为实验性能力：登录后可拉取真实设备列表并按 MIoT spec 自动生成控件；
      设备分页、部分型号真机兼容性仍需验证。</div>`}`;
  }

  // ------------------------------------------------------------ 播放条

  function track() { return state.playlist[state.player.trackIndex] || state.playlist[0]; }
  function trackTitle() { return track().title; }

  function renderPlayer() {
    const p = state.player;
    const t = track();
    const pct = Math.min(100, (p.position / (t.dur || 1)) * 100);
    $('#playerProgress').innerHTML =
      `<div class="progress-track" data-action="seek"><div class="progress-fill" style="width:${pct}%"></div></div>`;

    const outputName = (state.castTargets.find((x) => x.id === p.output) || {}).name || '本机扬声器';
    const qualities = ['标准', '高品', '无损'];
    $('#playerInner').innerHTML = `
      <span class="cover" data-action="queue-open">${I.note({ size: 20, stroke: '#fff' })}</span>
      <div class="track-info">
        <div class="track-title ${p.playing ? 'playing' : ''}">${esc(t.title)}</div>
        <div class="track-artist">${esc(t.artist)}</div>
      </div>
      <div class="player-ctrls">
        <button class="pc-btn" data-action="player-prev" title="上一曲">${I.prev({ size: 15 })}</button>
        <button class="pc-play ${p.playing ? 'playing' : ''}" data-action="player-toggle" title="播放/暂停">${p.playing ? I.pause({ size: 16, fill: '#fff' }) : I.play({ size: 16, fill: '#fff' })}</button>
        <button class="pc-btn" data-action="player-next" title="下一曲">${I.next({ size: 15 })}</button>
        <button class="pc-btn like ${p.liked ? 'liked' : ''}" data-action="player-like" title="喜欢">${p.liked ? I.heartFill({ size: 15, stroke: '#ff5f5f', fill: '#ff5f5f' }) : I.heart({ size: 15 })}</button>
      </div>
      <button class="pc-btn ${p.shuffle ? 'active' : ''}" data-action="player-shuffle" title="随机播放">${I.shuffle({ size: 14 })}</button>
      <button class="queue-btn" data-action="queue-open">队列 ${p.queueLen} / ${state.playlist.length}</button>
      <select class="mini-select" data-action-change="player-quality" title="音质">
        ${qualities.map((q) => `<option ${q === p.quality ? 'selected' : ''}>${q}</option>`).join('')}
      </select>
      <select class="mini-select" data-action-change="player-output" title="输出设备">
        ${state.castTargets.map((c) => `<option value="${esc(c.id)}" ${c.id === p.output ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
      </select>
      <div class="vol-ctrl">
        <button class="pc-btn" data-action="player-mute" title="静音">${p.muted ? I.volumeMute({ size: 15 }) : I.volume({ size: 15 })}</button>
        <input type="range" min="0" max="100" step="1" value="${p.muted ? 0 : p.volume}" data-range="player-volume">
        <span class="vol-num">${p.muted ? '静音' : p.volume + '%'}</span>
      </div>
      <span class="player-time" id="playerTime">${mmss(p.position)} / ${mmss(t.dur)}</span>`;
    $$('input[type=range]', $('#playerInner')).forEach(paintRange);
    i18n.apply($('#playerInner'));
  }

  function updatePlayerTime() {
    const p = state.player;
    const t = track();
    const el = $('#playerTime');
    if (el) el.textContent = `${mmss(p.position)} / ${mmss(t.dur)}`;
    const fill = $('.progress-fill', $('#playerProgress'));
    if (fill) fill.style.width = `${Math.min(100, (p.position / (t.dur || 1)) * 100)}%`;
  }

  function nextTrack(dir) {
    const p = state.player;
    p.trackIndex = (p.trackIndex + dir + state.playlist.length) % state.playlist.length;
    p.position = 0;
    p.liked = false;
    renderPlayer();
    saveSoon();
    // 音箱页播放态提示同步
    if (state.view === 'speaker') renderContent();
  }

  // ------------------------------------------------------------ 模态

  function openModal(html, cls) {
    const root = $('#modalRoot');
    root.innerHTML = `<div class="modal-overlay" data-action="modal-overlay">
      <div class="modal ${cls || ''}">${html}</div>
    </div>`;
    $$('input[type=range]', root).forEach(paintRange);
    i18n.apply(root);
  }
  function closeModal() {
    $('#modalRoot').innerHTML = '';
    state.modal = null;
  }

  // ---------------- 设备详情 ----------------

  function openDeviceModal(did) {
    const dev = state.devices[did];
    if (!dev) return;
    if (dev.special === 'speaker') {
      state.selectedSpeakerDid = did;
      goView('speaker');
      return;
    }
    state.modal = { type: 'device', did };
    openModal(detailModalHtml(dev), 'device-modal');
  }

  // ---------------- 设备设置（图标 / 尺寸 / 房间 / 信息） ----------------

  function openSettingsModal(did) {
    const dev = state.devices[did];
    if (!dev) return;
    state.modal = { type: 'settings', did };
    openModal(settingsModalHtml(dev), 'settings-modal');
  }

  function settingsModalHtml(dev) {
    const curIcon = devIcon(dev);
    const curColor = devColor(dev);
    const sz = cardSize(dev.did);
    const fam = currentFamily();
    const rooms = roomNamesOf(fam, Object.values(state.devices));
    const iconLabel = (zh, en) => (state.lang === 'en' ? en : zh);
    return `
    <div class="modal-head">
      <span class="modal-title">${esc(t('设备设置'))}</span>
      <button class="modal-close" data-action="modal-close" title="${esc(t('关闭'))}">${esc(t('关闭'))} ${I.x({ size: 13 })}</button>
    </div>
    <div class="modal-sub">
      <span class="modal-ico" style="color:${curColor}">${(I[curIcon] || I.generic)({ size: 20 })}</span>
      <span data-no-i18n>${esc(dev.name)}</span>
      <span class="modal-room" data-no-i18n>${esc(devRoom(dev))}</span>
    </div>
    <div class="ctrl-block">
      <div class="ctrl-title">${esc(t('名称'))}</div>
      <div class="set-row">
        <input class="set-input" id="setName" maxlength="24" value="${esc(dev.name)}">
        <button class="primary-btn" data-action="settings-name" data-did="${esc(dev.did)}">${esc(t('保存'))}</button>
      </div>
    </div>
    <div class="ctrl-block">
      <div class="ctrl-title">${esc(t('图标'))}</div>
      <div class="icon-grid">
        ${ICON_CHOICES.map(([key, zh, en]) => `<button class="icon-choice ${curIcon === key ? 'active' : ''}"
          data-action="settings-icon" data-did="${esc(dev.did)}" data-icon="${key}" title="${esc(iconLabel(zh, en))}">
          ${(I[key] || I.generic)({ size: 20 })}<span>${esc(iconLabel(zh, en))}</span></button>`).join('')}
      </div>
    </div>
    <div class="ctrl-block">
      <div class="ctrl-title">${esc(t('颜色'))}</div>
      <div class="color-grid">
        ${ICON_COLORS.map((c) => `<button class="color-dot ${curColor === c ? 'active' : ''}"
          data-action="settings-color" data-did="${esc(dev.did)}" data-color="${c}" style="--dot:${c}" title="${c}"></button>`).join('')}
      </div>
    </div>
    <div class="ctrl-block">
      <div class="ctrl-title">${esc(t('卡片大小'))}</div>
      <div class="seg-row">
        ${[['sm', '小'], ['md', '标准'], ['wide', '宽'], ['lg', '大']].map(([k, label]) =>
    `<button class="seg-btn ${sz === k ? 'active' : ''}" data-action="settings-size" data-did="${esc(dev.did)}" data-size="${k}">${esc(t(label))}</button>`).join('')}
      </div>
    </div>
    <div class="ctrl-block">
      <div class="ctrl-title">${esc(t('所属房间'))}</div>
      <select class="set-input" data-change="settings-room" data-did="${esc(dev.did)}">
        ${rooms.map((r) => `<option value="${esc(r)}" ${devRoom(dev) === r ? 'selected' : ''}>${esc(r)}</option>`).join('')}
      </select>
    </div>
    <div class="ctrl-block status-list">
      <div class="ctrl-title">${esc(t('设备信息'))}</div>
      ${[['型号', dev.model], ['固件', dev.fw], ['状态', dev.online === false ? t('离线') : t('在线')], ['设备 ID', dev.did]]
    .filter(([, v]) => v).map(([k, v]) => `<div class="status-row"><span>${esc(t(k))}</span><span data-no-i18n>${esc(v)}</span></div>`).join('')}
    </div>`;
  }

  function detailModalHtml(dev) {
    const st = statusOf(dev);
    const on = isOn(dev);
    const isWasher = dev.special === 'washer';
    const modeSel = ctrl(dev, '2.2');
    const sliders = (dev.controls || []).filter((c) => c.type === 'slider');
    const selects = (dev.controls || []).filter((c) => c.type === 'select' && !isWasher);
    const commands = (dev.controls || []).filter((c) => c.type === 'command');
    const statuses = (dev.controls || []).filter((c) => c.type === 'status');
    const actions = (dev.controls || []).filter((c) => c.type === 'action');
    const mainSwitch = mainSwitchOf(dev);
    // 附属开关（指示灯/夜灯）：单独列出来，能单独控制，但不参与电源判定
    const auxSwitches = (dev.controls || [])
      .filter((c) => c.type === 'switch' && c !== mainSwitch);
    const hasSwitch = !!mainSwitch;
    // 没有主开关的设备（电动床、传感器）不存在"关机"，控件不能因此被禁用
    const gate = hasSwitch ? on : true;

    return `
    <div class="modal-head">
      <span class="modal-title">${esc(dev.name)}</span>
      <button class="modal-close" data-action="modal-close" title="关闭">关闭 ${I.x({ size: 13 })}</button>
    </div>
    <div class="modal-sub">
      <span class="modal-ico" style="color:${dev.color || '#8f9bb3'}">${I[dev.icon] ? I[dev.icon]({ size: 20 }) : I.generic({ size: 20 })}</span>
      <span class="modal-room">${esc(dev.roomName || '未分区')}</span>
      <span class="modal-sub-actions">
        <button class="ghost-btn small" data-action="device-refresh" data-did="${esc(dev.did)}">${I.refresh({ size: 12 })}刷新状态</button>
        <button class="ghost-btn small" data-action="device-rename" data-did="${esc(dev.did)}">${I.pencil({ size: 12 })}重命名</button>
      </span>
    </div>
    ${dev.online === false ? `<div class="offline-banner">${I.warn({ size: 14 })}设备离线：控制不可用，请检查设备电源与网络</div>` : ''}
    <div class="status-card">
      <div class="status-main" data-detail-status>${esc(st.text)}</div>
      <div class="status-sub">${isWasher ? esc(modeSel ? modeSel.value : '') : esc(subLine(dev))}</div>
      ${hasSwitch ? `<div class="status-power">
        <span>电源</span>
        <button class="switch ${on ? 'on' : ''}" data-action="power" data-did="${esc(dev.did)}" ${dev.online === false ? 'disabled' : ''}><span class="knob"></span></button>
      </div>` : ''}
    </div>
    ${auxSwitches.length ? `
      <div class="ctrl-block switch-list">
        ${auxSwitches.map((c) => `<div class="status-row switch-row">
          <span>${esc(c.name)}</span>
          <button class="switch ${c.value ? 'on' : ''}" data-action="ctrl-switch" data-did="${esc(dev.did)}" data-key="${esc(c.key)}" ${dev.online === false ? 'disabled' : ''}><span class="knob"></span></button>
        </div>`).join('')}
      </div>` : ''}
    ${isWasher ? washerModesHtml(dev) : ''}
    ${selects.map((c) => `
      <div class="ctrl-block">
        <div class="ctrl-title">${esc(c.name)}</div>
        <div class="seg-row wrap">
          ${c.options.map((o) => `<button class="seg-btn ${c.value === o.value ? 'active' : ''}" data-action="ctrl-select" data-did="${esc(dev.did)}" data-key="${esc(c.key)}" data-value="${esc(o.value)}" ${dev.online === false || !gate ? 'disabled' : ''}>${esc(o.label)}</button>`).join('')}
        </div>
      </div>`).join('')}
    ${commands.map((c) => `
      <div class="ctrl-block">
        <div class="ctrl-title">${esc(c.name)}</div>
        <div class="seg-row wrap">
          ${c.options.map((o) => `<button class="seg-btn cmd-btn" data-action="ctrl-command" data-did="${esc(dev.did)}" data-key="${esc(c.key)}" data-value="${esc(o.value)}" data-label="${esc(o.label)}" ${dev.online === false ? 'disabled' : ''}>${esc(o.label)}</button>`).join('')}
        </div>
      </div>`).join('')}
    ${sliders.map((c) => `
      <div class="ctrl-block">
        <div class="ctrl-title">${esc(c.name)}<span class="ctrl-value" data-ctrl-value="${esc(c.key)}">${fmtVal(c.value, c.unit)}</span></div>
        <input type="range" min="${c.min}" max="${c.max}" step="${c.step || 1}" value="${c.value}"
          data-range="ctrl-slider" data-did="${esc(dev.did)}" data-key="${esc(c.key)}" ${dev.online === false || (!gate && dev.special !== 'sensor') ? 'disabled' : ''}>
      </div>`).join('')}
    ${statuses.length ? `
      <div class="ctrl-block status-list">
        ${statuses.map((c) => `<div class="status-row"><span>${esc(c.name)}</span><span data-status-ctrl="${esc(c.key)}">${esc(ctrlText(c))}</span></div>`).join('')}
      </div>` : ''}
    ${actions.length ? `
      <div class="ctrl-block">
        <div class="ctrl-title">设备动作</div>
        <div class="speaker-btns">
          ${actions.map((c) => `<button class="chip-btn" data-action="ctrl-action" data-did="${esc(dev.did)}" data-key="${esc(c.key)}">${esc(c.name)}</button>`).join('')}
        </div>
      </div>` : ''}
    ${isWasher ? `
      <div class="link-rows">
        <button class="link-row" data-action="toast" data-msg="洗衣记录（演示）">洗衣记录 ${I.chevron({ size: 14 })}</button>
        <button class="link-row" data-action="toast" data-msg="简清洁（演示）">简清洁 ${I.chevron({ size: 14 })}</button>
      </div>` : ''}
    <button class="more-link" data-action="device-settings" data-did="${esc(dev.did)}">${I.chevron({ size: 13 })} ${esc(t('更多设置与信息'))}</button>
    ${isCloud() ? `<div class="modal-meta">${esc(t('型号'))} ${esc(dev.model || '—')}${dev.fw ? ' · ' + esc(t('固件')) + ' ' + esc(dev.fw) : ''}${dev.ip ? ' · IP ' + esc(dev.ip) : ''}</div>` : ''}`;
  }

  function subLine(dev) {
    const sim = dev.sim || {};
    switch (dev.special) {
      case 'washer': return '';
      case 'heater': return `水温 ${fmtVal(sim.waterTemp, '°C')}`;
      case 'humidifier': return `当前湿度 ${sim.humidity || ctrlVal(dev, '2.3', '--')}%`;
      case 'plug': return `今日 ${fmtVal(sim.kwh, ' kWh')}`;
      case 'sensor': return `电量 ${ctrlVal(dev, '3.1', '--')}%`;
      default: return dev.model || '';
    }
  }

  function washerModesHtml(dev) {
    const c = ctrl(dev, '2.2');
    if (!c) return '';
    const icons = { '智能洗': 'sparkle', '快速洗': 'bolt', '单烘干': 'wind', '轻干洗': 'feather', '随心洗': 'heart' };
    const on = isOn(dev);
    const tiles = c.options.map((o) => `
      <button class="mode-tile ${c.value === o.value ? 'active' : ''}" data-action="washer-mode" data-did="${esc(dev.did)}" data-value="${esc(o.value)}" ${dev.online === false ? 'disabled' : ''}>
        <span class="mode-ico">${I[icons[o.value] || 'gear']({ size: 22, sw: 1.8 })}</span>
        <span>${esc(o.label)}</span>
      </button>`).join('') + `
      <button class="mode-tile" data-action="toast" data-msg="更多模式（演示）" ${dev.online === false ? 'disabled' : ''}>
        <span class="mode-ico">${I.gear({ size: 22, sw: 1.8 })}</span><span>更多模式</span>
      </button>`;
    return `<div class="ctrl-block mode-grid">${tiles}</div>`;
  }

  function updateDetailModal(dev) {
    if (!state.modal || state.modal.did !== dev.did) return;
    const el = $('[data-detail-status]', $('#modalRoot'));
    if (!el) return;
    const st = statusOf(dev);
    el.textContent = st.text;
    // 开关态
    const powerEl = $('.status-power .switch', $('#modalRoot'));
    if (powerEl) powerEl.classList.toggle('on', isOn(dev));
    // 滑杆/状态值
    for (const c of dev.controls || []) {
      if (c.type === 'slider') {
        const v = $(`[data-ctrl-value="${CSS.escape(c.key)}"]`, $('#modalRoot'));
        if (v) v.textContent = fmtVal(c.value, c.unit);
        const r = $(`input[data-key="${CSS.escape(c.key)}"]`, $('#modalRoot'));
        if (r && document.activeElement !== r) { r.value = c.value; paintRange(r); }
      }
      if (c.type === 'status') {
        const v = $(`[data-status-ctrl="${CSS.escape(c.key)}"]`, $('#modalRoot'));
        if (v) { v.textContent = ctrlText(c); i18n.apply(v); }
      }
      if (c.type === 'select' && dev.special !== 'washer') {
        $$(`.seg-btn[data-key="${CSS.escape(c.key)}"]`, $('#modalRoot')).forEach((b) => {
          b.classList.toggle('active', b.dataset.value === String(c.value));
        });
      }
    }
  }

  // ---------------- 房间管理 ----------------

  function openRoomsModal() {
    const fam = currentFamily();
    if (isCloud()) {
      openModal(`
        <div class="modal-head">
          <span class="modal-title">房间管理</span>
          <button class="modal-close" data-action="modal-close">关闭 ${I.x({ size: 13 })}</button>
        </div>
        <div class="hint-card in-modal">${I.info({ size: 14 })}云端房间的新建/改名/搬设备对应 homeroom 接口，本版本未接入；
        请在手机米家 App 操作后点「刷新设备」。</div>`);
      return;
    }
    const rooms = fam.rooms || [];
    openModal(`
      <div class="modal-head">
        <span class="modal-title">房间管理 · ${esc(fam.name)}</span>
        <button class="modal-close" data-action="modal-close">关闭 ${I.x({ size: 13 })}</button>
      </div>
      <div class="room-list">
        ${rooms.map((r) => {
          const count = devicesOfFamily().filter((d) => d.roomName === r.name).length;
          return `<div class="room-row">
            <span class="room-row-name">${esc(r.name)}</span>
            <span class="room-row-count">${count} 台</span>
            <button class="ghost-btn small" data-action="room-rename-in" data-room="${esc(r.name)}">${I.pencil({ size: 12 })}改名</button>
            <button class="ghost-btn small" data-action="room-delete" data-room="${esc(r.name)}" ${count ? 'disabled title="房间里还有设备"' : ''}>删除</button>
          </div>`;
        }).join('')}
      </div>
      <div class="room-add">
        <input type="text" id="newRoomName" placeholder="新房间名称" maxlength="12">
        <button class="primary-btn" data-action="room-add">${I.plus({ size: 13 })}新建房间</button>
      </div>`);
  }

  function renameRoomInline(roomName) {
    const fam = currentFamily();
    const input = prompt(t('新的房间名称'), roomName); // eslint-disable-line no-alert
    if (!input || !input.trim() || input.trim() === roomName) return;
    const name = input.trim().slice(0, 12);
    const devs = Object.values(state.devices).filter((d) => d.roomName === roomName);
    const room = fam.rooms.find((r) => r.name === roomName);
    if (room) room.name = name;
    devs.forEach((d) => { d.roomName = name; });
    saveSoon();
    renderContent();
    toast(`房间已重命名为「${name}」`);
  }

  // ---------------- 登录 ----------------

  let qrLoop = false;

  async function openLoginModal() {
    qrLoop = true;
    openModal(`
      <div class="modal-head">
        <span class="modal-title">扫码登录</span>
        <button class="modal-close" data-action="modal-close">关闭 ${I.x({ size: 13 })}</button>
      </div>
      <div class="qr-box">
        <div class="qr-frame"><img id="qrImg" alt="登录二维码" src="${API.qrImageUrl()}"><span class="qr-mask" id="qrMask"><span class="spinner"></span></span></div>
        <div class="qr-status" id="qrStatus">正在获取二维码…</div>
        <div class="qr-hint">打开手机「米家 App」→ 我的 → 扫一扫，确认登录</div>
      </div>`, 'login-modal');

    const status = $('#qrStatus');
    const img = $('#qrImg');
    const mask = $('#qrMask');
    img.onload = () => { mask.style.display = 'none'; status.textContent = '等待手机确认…'; };
    img.onerror = () => { status.textContent = '二维码加载失败，点击下方重试'; };
    const r = await API.qrStart();
    if (!r.ok) { status.textContent = r.error || '获取二维码失败'; return; }
    img.src = API.qrImageUrl() + '?t=' + Date.now();

    while (qrLoop && $('#qrImg')) {
      const res = await API.qrWait();
      if (!qrLoop || !$('#qrImg')) break;
      if (res.status === 'confirmed') {
        status.textContent = '登录成功，正在加载设备…';
        API.mode = 'cloud';
        API.user = res.user;
        $('#brandMode').textContent = '已登录';
        await loadCloudData();
        closeModal();
        toast('扫码登录成功');
        qrLoop = false;
        return;
      }
      if (res.status === 'error') {
        status.textContent = res.message || '登录失败';
        mask.style.display = 'none';
        qrLoop = false;
        return;
      }
    }
  }

  function stopQrLoop() { qrLoop = false; }

  // ---------------- 队列 ----------------

  function openQueueModal() {
    const p = state.player;
    const idxs = [];
    for (let i = 0; i < p.queueLen; i++) idxs.push((p.trackIndex + i) % state.playlist.length);
    openModal(`
      <div class="modal-head">
        <span class="modal-title">播放队列 · ${p.queueLen} / ${state.playlist.length}</span>
        <button class="modal-close" data-action="modal-close">关闭 ${I.x({ size: 13 })}</button>
      </div>
      <div class="queue-list">
        ${idxs.map((i, n) => {
          const t = state.playlist[i];
          return `<button class="queue-row ${n === 0 ? 'current' : ''}" data-action="queue-play" data-index="${i}">
            <span class="queue-num">${n === 0 ? I.play({ size: 12, fill: 'currentColor' }) : n + 1}</span>
            <span class="queue-title">${esc(t.title)}</span>
            <span class="queue-artist">${esc(t.artist)}</span>
            <span class="queue-dur">${mmss(t.dur)}</span>
          </button>`;
        }).join('')}
      </div>`);
  }

  // ------------------------------------------------------------ Toast

  function toast(msg, kind) {
    const root = $('#toastRoot');
    const id = 't' + (++state.toastId);
    const div = document.createElement('div');
    div.className = 'toast ' + (kind || 'ok');
    div.id = id;
    div.innerHTML = (kind === 'warn' ? I.warn({ size: 14, stroke: '#e8960c' }) : I.check({ size: 14, stroke: '#2fae71' }))
      + `<span>${esc(t(msg))}</span>`;
    root.appendChild(div);
    i18n.apply(div);
    setTimeout(() => { div.classList.add('out'); }, 3000);
    setTimeout(() => { div.remove(); }, 3400);
  }

  // ------------------------------------------------------------ 模拟引擎

  let lastTick = Date.now();

  function startSim() {
    setInterval(tick, 1000);
  }

  function tick() {
    const now = Date.now();
    const dt = Math.min(3, (now - lastTick) / 1000);
    lastTick = now;
    let playerDirty = false;
    let speakerDirty = false;

    // 播放进度
    const p = state.player;
    if (p.playing && !p.muted) {
      p.position += dt;
      const t = track();
      if (p.position >= t.dur) {
        nextTrack(1);
        playerDirty = false; // renderPlayer 已在 nextTrack 里
      } else {
        updatePlayerTime();
      }
    }

    if (API.mode === 'cloud') return; // 云端模式不做本地模拟

    for (const dev of Object.values(state.devices)) {
      const sim = dev.sim;
      if (!sim) continue;
      switch (dev.special) {
        case 'plug': {
          if (isOn(dev)) {
            sim.watts = Math.max(180, Math.min(260, sim.watts + (Math.random() - 0.5) * 14));
            sim.kwh += sim.watts / 1000 / 3600 * dt;
            const pw = ctrl(dev, '2.2');
            if (pw) pw.value = Math.round(sim.watts);
            const ke = ctrl(dev, '2.3');
            if (ke) ke.value = Math.round(sim.kwh * 100) / 100;
            updateDeviceCard(dev);
            if (state.modal && state.modal.did === dev.did) updateDetailModal(dev);
          }
          break;
        }
        case 'sensor': {
          sim.temp = Math.round((sim.temp + (Math.random() - 0.5) * 0.04) * 10) / 10;
          sim.humidity = Math.max(30, Math.min(45, sim.humidity + (Math.random() - 0.5) * 0.5));
          const tc = ctrl(dev, '2.1');
          if (tc) tc.value = sim.temp;
          const hc = ctrl(dev, '2.2');
          if (hc) hc.value = Math.round(sim.humidity);
          updateDeviceCard(dev);
          if (state.modal && state.modal.did === dev.did) updateDetailModal(dev);
          break;
        }
        case 'heater': {
          const target = ctrlVal(dev, '2.2', 45);
          if (isOn(dev)) {
            const delta = (target - sim.waterTemp) * 0.02 * dt;
            sim.waterTemp = Math.round((sim.waterTemp + delta) * 10) / 10;
          } else {
            sim.waterTemp = Math.round((sim.waterTemp - 0.01 * dt) * 10) / 10;
          }
          const wc = ctrl(dev, '2.3');
          if (wc) wc.value = sim.waterTemp;
          if (state.modal && state.modal.did === dev.did) updateDetailModal(dev);
          break;
        }
        case 'washer': {
          if (isOn(dev) && sim.remainSec > 0) {
            sim.remainSec = Math.max(0, sim.remainSec - dt);
            const lc = ctrl(dev, '2.3');
            if (lc) lc.value = Math.ceil(sim.remainSec / 60);
            updateDeviceCard(dev);
            if (state.modal && state.modal.did === dev.did) {
              updateDetailModal(dev);
            }
            if (sim.remainSec === 0) {
              setCtrlVal(dev, '2.1', false, { silent: true });
              toast(`${dev.name} 洗衣完成`);
            }
          }
          break;
        }
        case 'humidifier': {
          if (isOn(dev)) {
            const target = ctrlVal(dev, '2.2', 60);
            sim.humidity = Math.round(Math.min(target, sim.humidity + 0.15 * dt));
            sim.water = Math.max(0, sim.water - 0.02 * dt);
            const hc = ctrl(dev, '2.3');
            if (hc) hc.value = sim.humidity;
            const wl = ctrl(dev, '2.4');
            if (wl) wl.value = Math.round(sim.water);
            updateDeviceCard(dev);
            if (state.modal && state.modal.did === dev.did) updateDetailModal(dev);
          }
          break;
        }
        case 'speaker': {
          if (p.output === dev.did) speakerDirty = true;
          break;
        }
        default: break;
      }
    }
    if (speakerDirty && state.view === 'speaker') {
      const stateEl = $('.speaker-state');
      if (stateEl) stateEl.textContent = p.playing ? `正在播放 · ${trackTitle()}` : '输出到此音箱 · 已暂停';
    }
    if (playerDirty) renderPlayer();
  }

  // ------------------------------------------------------------ 动作分发

  function toggleLang() {
    state.lang = state.lang === 'en' ? 'zh' : 'en';
    i18n.setLang(state.lang);
    closeModal();
    renderAll();
    savePersist();
  }

  function goView(view) {
    state.view = view;
    renderAll();
    $('#content').scrollTop = 0;
  }

  async function handlePower(did) {
    const dev = state.devices[did];
    if (!dev || dev.online === false || dev._pending) return;
    const c = mainSwitchOf(dev);
    if (!c) return;
    const next = !c.value;
    // 云端：先下发（异步设备要读回确认，可能等 1~3 秒），失败不置位
    if (isCloud()) {
      dev._pending = true;
      updateDeviceCard(dev);
      if (state.modal && state.modal.did === did) updateDetailModal(dev);
      try {
        const r = await API.setProp(did, c.siid, c.piid, next);
        if (!r.ok) {
          toast(`下发失败：${r.error || '未知错误'}`, 'warn');
          return;
        }
      } finally {
        dev._pending = false;
        updateDeviceCard(dev);
        if (state.modal && state.modal.did === did) updateDetailModal(dev);
      }
    }
    setCtrlVal(dev, c.key, next, { silent: true });
    // 副作用
    if (dev.special === 'washer' && next) {
      const mins = (dev.sim.modeMins || {})[ctrlVal(dev, '2.2', '智能洗')] || 40;
      dev.sim.remainSec = mins * 60;
    }
    if (dev.special === 'washer' && !next) dev.sim.remainSec = 0;
    if (dev.special === 'plug' && !next) dev.sim.watts = 0;
    if (dev.special === 'plug' && next) dev.sim.watts = 228;
    updateDeviceCard(dev);
    if (state.modal && state.modal.did === did) updateDetailModal(dev);
    toast(`${next ? '已开启' : '已关闭'} ${dev.name}`);
    saveSoon();
  }

  async function runScene(sceneId) {
    const scene = state.scenes.find((s) => s.id === sceneId);
    if (!scene) return;
    for (const a of scene.actions) {
      const dev = state.devices[a.did];
      if (!dev) continue;
      if (a.control === '2.1' && dev.special === 'washer' && a.value === true) {
        const mins = (dev.sim.modeMins || {})[ctrlVal(dev, '2.2', '智能洗')] || 40;
        dev.sim.remainSec = mins * 60;
      }
      setCtrlVal(dev, a.control, a.value, { silent: true });
    }
    renderContent();
    toast(`场景「${scene.name}」已执行`);
    saveSoon();
  }

  document.addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-action]');
    if (!btn) return;
    const act = btn.dataset.action;
    // 阻断禁用按钮
    if (btn.disabled) return;
    const stop = () => { ev.preventDefault(); ev.stopPropagation(); };
    stop();

    switch (act) {
      // ---- 外壳 ----
      case 'nav': goView(btn.dataset.view); break;
      case 'family': {
        state.familyIndex = Number(btn.dataset.index) || 0;
        renderChrome(); renderContent(); saveSoon();
        break;
      }
      case 'theme': {
        state.theme = state.theme === 'light' ? 'dark' : 'light';
        applyTheme(); saveSoon();
        break;
      }
      case 'refresh': {
        btn.innerHTML = `<span class="spinner"></span>${esc(t('刷新设备'))}`;
        setTimeout(() => {
          btn.innerHTML = `${I.refresh({ size: 13 })}${esc(t('刷新设备'))}`;
        }, 900);
        if (isCloud()) { loadCloudData(); }
        else {
          // 演示：传感器重新采样
          for (const dev of Object.values(state.devices)) {
            if (dev.special === 'sensor') {
              dev.sim.temp = Math.round((14 + Math.random() * 4) * 10) / 10;
              dev.sim.humidity = Math.round(32 + Math.random() * 8);
              const tc = ctrl(dev, '2.1'); if (tc) tc.value = dev.sim.temp;
              const hc = ctrl(dev, '2.2'); if (hc) hc.value = dev.sim.humidity;
              updateDeviceCard(dev);
            }
          }
          toast('设备状态已刷新');
        }
        break;
      }
      case 'room-manage': openRoomsModal(); break;
      case 'room-rename': renameRoomInline(btn.dataset.room); break;
      case 'room-rename-in': closeModal(); renameRoomInline(btn.dataset.room); break;
      case 'room-delete': {
        const fam = currentFamily();
        const name = btn.dataset.room;
        fam.rooms = fam.rooms.filter((r) => r.name !== name);
        renderContent(); saveSoon(); openRoomsModal();
        toast(`已删除房间「${name}」`);
        break;
      }
      case 'room-add': {
        const input = $('#newRoomName');
        const name = (input.value || '').trim().slice(0, 12);
        if (!name) { toast('请输入房间名称', 'warn'); return; }
        const fam = currentFamily();
        fam.rooms.push({ id: 'r-' + Date.now(), name });
        renderContent(); saveSoon(); openRoomsModal();
        toast(`已创建房间「${name}」`);
        break;
      }
      case 'toast': toast(btn.dataset.msg || '演示功能'); break;

      // ---- 设备 ----
      case 'power': handlePower(btn.dataset.did); break;
      case 'open-device': openDeviceModal(btn.dataset.did); break;
      case 'device-settings': openSettingsModal(btn.dataset.did); break;
      case 'settings-name': {
        const dev = state.devices[btn.dataset.did];
        const input = $('#setName');
        const name = input ? (input.value || '').trim().slice(0, 24) : '';
        if (!dev || !name) { if (!name) toast(t('请输入设备名称'), 'warn'); break; }
        dev.name = name; dev.customName = true;
        if (isCloud()) API.rename(dev.did, name);
        renderContent(); openSettingsModal(dev.did); savePersist();
        toast(t('已重命名'));
        break;
      }
      case 'settings-icon': {
        const dev = state.devices[btn.dataset.did];
        if (!dev) break;
        state.layout.icons[dev.did] = btn.dataset.icon;
        dev.customIcon = btn.dataset.icon;
        savePersist(); renderContent(); openSettingsModal(dev.did);
        toast(t('图标已更新'));
        break;
      }
      case 'settings-color': {
        const dev = state.devices[btn.dataset.did];
        if (!dev) break;
        state.layout.colors[dev.did] = btn.dataset.color;
        dev.customColor = btn.dataset.color;
        savePersist(); renderContent(); openSettingsModal(dev.did);
        break;
      }
      case 'settings-size': {
        const dev = state.devices[btn.dataset.did];
        if (!dev) break;
        state.layout.sizes[dev.did] = btn.dataset.size;
        savePersist(); renderContent(); openSettingsModal(dev.did);
        toast(t('尺寸已调整'));
        break;
      }
      case 'room-collapse': {
        const fam = currentFamily();
        const key = `${fam.id}::${btn.dataset.room}`;
        state.layout.collapsed[key] = !state.layout.collapsed[key];
        savePersist(); renderContent();
        break;
      }
      case 'lang-toggle': toggleLang(); break;
      case 'open-speaker': {
        state.selectedSpeakerDid = btn.dataset.did;
        goView('speaker');
        break;
      }
      case 'device-refresh': {
        if (isCloud()) { loadCloudData(); }
        else {
          const dev = state.devices[btn.dataset.did];
          if (dev && dev.special === 'sensor') {
            dev.sim.temp = Math.round((14 + Math.random() * 4) * 10) / 10;
            dev.sim.humidity = Math.round(32 + Math.random() * 8);
          }
          updateDeviceCard(dev);
          updateDetailModal(dev);
          toast('状态已刷新');
        }
        break;
      }
      case 'device-rename': {
        const dev = state.devices[btn.dataset.did];
        const name = prompt(t('新的设备名称'), dev.name); // eslint-disable-line no-alert
        if (!name || !name.trim() || name.trim() === dev.name) return;
        dev.name = name.trim().slice(0, 30);
        dev.customName = true;
        if (isCloud()) API.rename(dev.did, dev.name).then((r) => { if (!r.ok) toast(`改名失败：${r.error}`, 'warn'); });
        updateDeviceCard(dev);
        closeModal(); openDeviceModal(dev.did);
        toast('已重命名');
        saveSoon();
        break;
      }
      case 'washer-mode': {
        const dev = state.devices[btn.dataset.did];
        const value = btn.dataset.value;
        setCtrlVal(dev, '2.2', value, { silent: false });
        // 未开机时选模式 → 自动开机
        if (!isOn(dev)) {
          handlePower(dev.did);
        } else {
          const mins = (dev.sim.modeMins || {})[value] || 40;
          dev.sim.remainSec = mins * 60;
        }
        updateDetailModal(dev);
        toast(`已切换到「${value}」`);
        break;
      }
      case 'ctrl-select': {
        const dev = state.devices[btn.dataset.did];
        let value = btn.dataset.value;
        const c = ctrl(dev, btn.dataset.key);
        if (c && c.options && c.options.length) {
          const opt = c.options.find((o) => String(o.value) === String(value) || o.label === value);
          if (opt != null && typeof opt.value === 'number') value = opt.value;
        }
        setCtrlVal(dev, btn.dataset.key, value);
        toast(`${c ? c.name : '参数'}已调整为 ${typeof value === 'boolean' ? (value ? '开' : '关') : value}`);
        break;
      }
      case 'ctrl-command': {
        // 只写枚举：点一次下发一次，不保存"当前值"（设备没有这个状态）
        const dev = state.devices[btn.dataset.did];
        const c = (dev.controls || []).find((x) => x.key === btn.dataset.key);
        if (!c || !isCloud()) { if (c) toast(`已发送「${btn.dataset.label || c.name}」`); break; }
        let value = btn.dataset.value;
        if (c.options) {
          const opt = c.options.find((o) => String(o.value) === String(value));
          if (opt) value = opt.value;
        }
        btn.disabled = true;
        API.setProp(dev.did, c.siid, c.piid, value, { verify: false }).then((r) => {
          btn.disabled = false;
          if (r.ok) toast(`已发送「${btn.dataset.label || c.name}」`);
          else toast(`下发失败：${r.error || '未知错误'}`, 'warn');
        }).catch(() => { btn.disabled = false; });
        break;
      }
      case 'ctrl-switch': {
        // 附属开关（指示灯/夜灯）：独立控制，不影响卡片电源状态
        const dev = state.devices[btn.dataset.did];
        const c = ctrl(dev, btn.dataset.key);
        if (!c) break;
        const prev = c.value;
        const next = !prev;
        c.value = next;
        btn.classList.toggle('on', next);
        if (isCloud()) {
          btn.disabled = true;
          API.setProp(dev.did, c.siid, c.piid, next).then((r) => {
            btn.disabled = false;
            if (!r.ok) {
              c.value = prev;
              btn.classList.toggle('on', prev);
              toast(`下发失败：${r.error || '未知错误'}`, 'warn');
            }
            updateDeviceCard(dev);
          }).catch(() => { btn.disabled = false; });
        }
        saveSoon();
        break;
      }
      case 'ctrl-action': {
        const dev = state.devices[btn.dataset.did];
        const c = (dev.controls || []).find((x) => x.key === btn.dataset.key);
        if (c) {
          API.callAction(dev.did, c.siid, c.aiid, []).then((r) => {
            if (r.ok) toast(`已执行「${c.name}」`);
            else toast(`执行失败：${r.error}`, 'warn');
          });
        }
        break;
      }

      // ---- 音箱页 ----
      case 'select-speaker': {
        state.selectedSpeakerDid = btn.dataset.did;
        renderContent();
        break;
      }
      case 'rename-speaker': {
        const dev = state.devices[btn.dataset.did];
        const name = prompt(t('新的音箱名称'), dev.name); // eslint-disable-line no-alert
        if (!name || !name.trim()) return;
        dev.name = name.trim().slice(0, 30);
        dev.customName = true;
        if (isCloud()) API.rename(dev.did, dev.name);
        renderContent(); renderPlayer(); saveSoon();
        toast('已重命名');
        break;
      }
      case 'speaker-mute': {
        const dev = state.devices[btn.dataset.did];
        const ex = state.speakerExtras[dev.did] = state.speakerExtras[dev.did] || {};
        ex.muted = !ex.muted;
        renderContent();
        break;
      }
      case 'speaker-bt': {
        const dev = state.devices[btn.dataset.did];
        const ex = state.speakerExtras[dev.did] = state.speakerExtras[dev.did] || {};
        const key = btn.dataset.key;
        if (key === 'btMesh') ex.btMesh = !ex.btMesh;
        if (key === 'btAudio') ex.btAudio = !ex.btAudio;
        renderContent();
        toast(key === 'btMesh' ? (ex.btMesh ? '蓝牙 Mesh 网关已开启' : '蓝牙 Mesh 网关已关闭')
          : (ex.btAudio ? '蓝牙音频已开启' : '已发送蓝牙配对请求（演示）'));
        break;
      }
      case 'speaker-dts': {
        const dev = state.devices[btn.dataset.did];
        const ex = state.speakerExtras[dev.did] = state.speakerExtras[dev.did] || {};
        ex.dts = btn.dataset.mode;
        renderContent();
        toast(`DTS 音效：${ex.dts}`);
        break;
      }
      case 'speaker-fn': {
        const fn = btn.dataset.fn;
        if (fn === '文字播报') toast('小爱同学：正在为您播报（演示）');
        else toast(`${fn}（演示）`);
        break;
      }
      case 'speaker-ctrl': {
        const cmd = btn.dataset.cmd;
        if (cmd === 'prev') nextTrack(-1);
        if (cmd === 'next') nextTrack(1);
        if (cmd === 'pause') { state.player.playing = false; renderPlayer(); }
        if (cmd === 'resume') { state.player.playing = true; renderPlayer(); }
        if (state.view === 'speaker') renderContent();
        break;
      }

      // ---- 投送 ----
      case 'cast': {
        const id = btn.dataset.target;
        state.player.output = id;
        renderPlayer();
        if (state.view === 'castmusic' || state.view === 'speaker') renderContent();
        const name = (state.castTargets.find((c) => c.id === id) || {}).name;
        toast(`音乐已投送到「${name}」`);
        saveSoon();
        break;
      }

      // ---- 场景 ----
      case 'scene-run': runScene(btn.dataset.scene); break;

      // ---- 播放器 ----
      case 'player-toggle': {
        state.player.playing = !state.player.playing;
        renderPlayer();
        if (state.view === 'speaker' || state.view === 'castmusic') renderContent();
        saveSoon();
        break;
      }
      case 'player-prev': nextTrack(-1); break;
      case 'player-next': nextTrack(1); break;
      case 'player-like': {
        state.player.liked = !state.player.liked;
        renderPlayer(); saveSoon();
        break;
      }
      case 'player-shuffle': {
        state.player.shuffle = !state.player.shuffle;
        renderPlayer(); saveSoon();
        toast(state.player.shuffle ? '随机播放：开' : '随机播放：关');
        break;
      }
      case 'player-mute': {
        state.player.muted = !state.player.muted;
        renderPlayer(); saveSoon();
        break;
      }
      case 'seek': {
        const rect = btn.getBoundingClientRect();
        const pct = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
        state.player.position = Math.floor(pct * track().dur);
        updatePlayerTime(); saveSoon();
        break;
      }
      case 'queue-open': openQueueModal(); break;
      case 'queue-play': {
        state.player.trackIndex = Number(btn.dataset.index) || 0;
        state.player.position = 0;
        state.player.playing = true;
        closeModal(); renderPlayer();
        if (state.view === 'speaker') renderContent();
        saveSoon();
        break;
      }

      // ---- 登录 / 账号 ----
      case 'login-open': openLoginModal(); break;
      case 'logout': {
        const b = $('#logoutBtn');
        if (b.dataset.confirm) {
          API.logout();
          location.reload();
        } else {
          b.dataset.confirm = '1';
          b.textContent = '再点一次确认退出';
          setTimeout(() => { b.dataset.confirm = ''; b.textContent = '退出登录'; }, 2500);
        }
        break;
      }

      // ---- 模态 ----
      case 'modal-close': closeModal(); if (qrLoop) stopQrLoop(); break;
      case 'modal-overlay': {
        if (ev.target === btn) { closeModal(); if (qrLoop) stopQrLoop(); }
        break;
      }

      // ---- 窗口按钮（网页版说明）----
      case 'win': break;
      default: break;
    }
  });

  // 窗口控制按钮
  $('#btnMin').addEventListener('click', () => toast('浏览器窗口：按 Win+↓ 可最小化'));
  $('#btnMax').addEventListener('click', () => toast('浏览器窗口：按 F11 可切换全屏'));
  $('#btnClose').addEventListener('click', () => toast('网页版无需关闭窗口，直接关标签页即可'));
  $('#btnLang').addEventListener('click', () => toggleLang());
  $('#btnTheme').addEventListener('click', () => { /* 由 data-action=theme 处理不了，这里单独处理 */ });
  $('#btnTheme').addEventListener('click', () => {
    state.theme = state.theme === 'light' ? 'dark' : 'light';
    applyTheme(); saveSoon();
  });

  // 滑杆 & 下拉
  // ------------------------------------------------------------ 拖动排序

  let dragState = null;
  const clearDropMarks = () => {
    $$('.drag-over, .drop-before, .drop-after, .dragging').forEach((el) =>
      el.classList.remove('drag-over', 'drop-before', 'drop-after', 'dragging'));
  };

  document.addEventListener('dragstart', (ev) => {
    const card = ev.target.closest && ev.target.closest('[data-drag-card]');
    const room = ev.target.closest && ev.target.closest('[data-drag-room]');
    if (card) {
      dragState = { type: 'card', did: card.dataset.dragCard };
      card.classList.add('dragging');
    } else if (room) {
      dragState = { type: 'room', room: room.dataset.dragRoom };
      const sec = room.closest('.room-card');
      if (sec) sec.classList.add('dragging');
    }
    if (!dragState) return;
    try {
      ev.dataTransfer.effectAllowed = 'move';
      ev.dataTransfer.setData('text/plain', dragState.did || dragState.room || '');
    } catch (_) { /* 某些浏览器限制 */ }
  });

  document.addEventListener('dragover', (ev) => {
    if (!dragState) return;
    if (dragState.type === 'card') {
      const grid = ev.target.closest && ev.target.closest('[data-room-drop]');
      if (!grid) return;
      ev.preventDefault();
      if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move';
      const card = ev.target.closest('[data-drag-card]');
      $$('.drop-before, .drop-after').forEach((el) => el.classList.remove('drop-before', 'drop-after'));
      if (card && card.dataset.dragCard !== dragState.did) {
        const r = card.getBoundingClientRect();
        card.classList.add(ev.clientX < r.left + r.width / 2 ? 'drop-before' : 'drop-after');
      }
    } else {
      const section = ev.target.closest && ev.target.closest('[data-room-section]');
      if (!section) return;
      ev.preventDefault();
      $$('.drag-over').forEach((el) => el.classList.remove('drag-over'));
      section.classList.add('drag-over');
    }
  });

  document.addEventListener('drop', (ev) => {
    if (!dragState) return;
    if (dragState.type === 'card') {
      const grid = ev.target.closest && ev.target.closest('[data-room-drop]');
      if (!grid) { clearDropMarks(); dragState = null; return; }
      ev.preventDefault();
      const roomName = grid.dataset.roomDrop;
      const card = ev.target.closest('[data-drag-card]');
      if (card && card.dataset.dragCard !== dragState.did) {
        const r = card.getBoundingClientRect();
        dropCard(dragState.did, card.dataset.dragCard, roomName, ev.clientX < r.left + r.width / 2);
      } else {
        dropCard(dragState.did, null, roomName, false);
      }
    } else {
      const section = ev.target.closest && ev.target.closest('[data-room-section]');
      if (section && section.dataset.roomSection !== dragState.room) {
        ev.preventDefault();
        const fam = currentFamily();
        const names = orderedRoomNames(roomNamesOf(fam, orderedDevices(devicesOfFamily())), fam.id);
        const from = names.indexOf(dragState.room);
        const to = names.indexOf(section.dataset.roomSection);
        if (from >= 0 && to >= 0) {
          names.splice(from, 1);
          names.splice(to, 0, dragState.room);
          state.layout.rooms[fam.id] = names;
          savePersist();
          renderContent();
        }
      }
    }
    clearDropMarks();
    dragState = null;
  });

  document.addEventListener('dragend', () => { clearDropMarks(); dragState = null; });

  document.addEventListener('input', (ev) => {
    const el = ev.target;
    if (el.type !== 'range') return;
    paintRange(el);
    const role = el.dataset.range;

    if (role === 'player-volume') {
      state.player.volume = Number(el.value);
      state.player.muted = Number(el.value) === 0;
      const num = el.parentElement.querySelector('.vol-num');
      if (num) num.textContent = state.player.muted ? '静音' : `${state.player.volume}%`;
      saveSoon();
      return;
    }
    if (role === 'speaker-volume') {
      const dev = state.devices[el.dataset.did];
      const num = $('#speakerVolNum');
      if (num) num.textContent = `${el.value}%`;
      if (dev) { const c = ctrl(dev, '2.2'); if (c) c.value = Number(el.value); }
      saveSoon();
      return;
    }
    if (role === 'ctrl-slider') {
      const dev = state.devices[el.dataset.did];
      const c = dev && ctrl(dev, el.dataset.key);
      if (!c) return;
      c.value = Number(el.value);
      const v = el.closest('.ctrl-block').querySelector('[data-ctrl-value]');
      if (v) v.textContent = fmtVal(c.value, c.unit);
      if (dev.special === 'heater' && c.key === '2.2') {
        updateDeviceCard(dev);
      }
      saveSoon();
    }
  });
  document.addEventListener('change', (ev) => {
    const el = ev.target;
    if (el.dataset && el.dataset.change === 'settings-room') {
      const dev = state.devices[el.dataset.did];
      if (dev) {
        state.layout.room[dev.did] = el.value;
        if (!isCloud()) dev.roomName = el.value;
        savePersist();
        renderContent();
        if (state.modal && state.modal.type === 'settings') openSettingsModal(dev.did);
      }
    }
    if (el.dataset && el.dataset.actionChange === 'player-quality') {
      state.player.quality = el.value; saveSoon();
    }
    if (el.dataset && el.dataset.actionChange === 'player-output') {
      state.player.output = el.value;
      renderPlayer();
      if (state.view === 'speaker' || state.view === 'castmusic') renderContent();
      saveSoon();
    }
    if (el.type === 'range' && el.dataset.range === 'ctrl-slider') {
      const dev = state.devices[el.dataset.did];
      const c = dev && ctrl(dev, el.dataset.key);
      if (c && isCloud() && c.siid != null) {
        API.setProp(dev.did, c.siid, c.piid, c.value).then((r) => {
          if (!r.ok) toast(`下发失败：${r.error}`, 'warn');
        });
      }
    }
    if (el.type === 'range' && el.dataset.range === 'speaker-volume') {
      const dev = state.devices[el.dataset.did];
      if (dev && isCloud()) {
        const c = ctrl(dev, '2.2');
        if (c && c.siid != null) {
          API.setProp(dev.did, c.siid, c.piid, Number(el.value)).then((r) => {
            if (!r.ok) toast(`下发失败：${r.error}`, 'warn');
          });
        }
      }
    }
  });

  // Esc 关闭弹窗 / 返回列表（对齐参考项目的键盘习惯）
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') {
      if (qrLoop) stopQrLoop();
      closeModal();
    }
  });

  // ------------------------------------------------------------ 启动

  boot();
})();
