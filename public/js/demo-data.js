'use strict';
/** 演示数据：设备、家庭、房间、歌单、场景 —— 结构与云端模式完全同构
 *  （设备都带 controls 数组，渲染层只认这一套模型）。 */
(function () {
  const d = (did, name, model, icon, color, online, extra) => ({
    did, name, model, icon, color, online, roomName: '', controls: [], ...extra,
  });

  const sw = (name, value, siid = 2, piid = 1) => ({ type: 'switch', key: `${siid}.${piid}`, siid, piid, name, value });
  const slider = (name, value, min, max, step, unit, siid, piid) => ({ type: 'slider', key: `${siid}.${piid}`, siid, piid, name, value, min, max, step, unit });
  const status = (name, value, unit, siid, piid) => ({ type: 'status', key: `${siid}.${piid}`, siid, piid, name, value, unit });
  const select = (name, value, options, siid, piid) => ({ type: 'select', key: `${siid}.${piid}`, siid, piid, name, value, options });

  const devices = [
    // ---------------- 办公室 ----------------
    d('demo-lamp-1s', '小米屏幕挂灯1S', 'xiaomi.light.sbar1s', 'lamp', '#e8960c', true, {
      roomName: '办公室', special: 'light',
      controls: [
        sw('电源', true, 2, 1),
        slider('亮度', 85, 1, 100, 1, '%', 2, 2),
        slider('色温', 4000, 2700, 6500, 100, 'K', 2, 3),
      ],
    }),
    d('demo-computer', '电脑', 'chuangmi.plug.v3', 'plug', '#3a7bd5', true, {
      roomName: '办公室', special: 'plug',
      controls: [
        sw('电源', true, 2, 1),
        status('功率', 228, ' W', 2, 2),
        status('今日电量', 1.36, ' kWh', 2, 3),
      ],
      sim: { watts: 228, kwh: 1.36 },
    }),
    d('demo-speaker-right', '小爱音箱 右护法', 'xiaomi.wifispeaker.l06a', 'speaker', '#f06292', true, {
      roomName: '办公室', special: 'speaker',
      modelInfo: 'L06A · 尾号 4148 · 局域网可用',
      controls: [
        status('状态', '在线', '', 2, 1),
        slider('音量', 35, 0, 100, 1, '%', 2, 2),
      ],
    }),
    d('demo-footbath', '米家智能足浴器', 'miaomiao.footbath.v1', 'footbath', '#9aa3b5', false, {
      roomName: '办公室', special: 'footbath',
      controls: [
        sw('电源', false, 2, 1),
        slider('水温', 42, 30, 48, 1, '°C', 2, 2),
      ],
    }),
    // ---------------- 卧室 ----------------
    d('demo-sensor', '温湿度计', 'cleargrass.sensor.ht.dk2', 'sensor', '#35a7e0', true, {
      roomName: '卧室', special: 'sensor',
      controls: [
        status('温度', 15.7, '°C', 2, 1),
        status('湿度', 36, '%', 2, 2),
        status('电量', 87, '%', 3, 1),
      ],
      sim: { temp: 15.7, humidity: 36 },
    }),
    d('demo-humidifier', '米家无雾加湿器3 400mL/h', 'miaomiao.humidifier.df8', 'humidifier', '#2bb3a6', true, {
      roomName: '卧室', special: 'humidifier',
      controls: [
        sw('电源', false, 2, 1),
        slider('目标湿度', 60, 30, 80, 5, '%', 2, 2),
        status('当前湿度', 36, '%', 2, 3),
        status('水量', 82, '%', 2, 4),
      ],
      sim: { humidity: 36, water: 82 },
    }),
    d('demo-speaker-left', '小爱音箱 左护法', 'xiaomi.wifispeaker.l06a', 'speaker', '#f06292', true, {
      roomName: '卧室', special: 'speaker',
      modelInfo: 'L06A · 尾号 1422 · 局域网可用',
      controls: [
        status('状态', '在线', '', 2, 1),
        slider('音量', 30, 0, 100, 1, '%', 2, 2),
      ],
    }),
    d('demo-speaker-art', '小爱音箱 Art 电池版', 'xiaomi.wifispeaker.l09b', 'speaker', '#f06292', true, {
      roomName: '卧室', special: 'speaker',
      modelInfo: 'L09B · 尾号 4503 · 局域网可用',
      controls: [
        status('状态', '在线', '', 2, 1),
        slider('音量', 35, 0, 100, 1, '%', 2, 2),
        status('电量', 82, '%', 3, 1),
      ],
    }),
    // ---------------- 厨房 ----------------
    d('demo-washer', '米家洗衣机 洗烘12kg', 'minij.washer.v5', 'washer', '#4a90d9', true, {
      roomName: '厨房', special: 'washer',
      controls: [
        sw('电源', false, 2, 1),
        select('模式', '智能洗', [
          { value: '智能洗', label: '智能洗' },
          { value: '快速洗', label: '快速洗' },
          { value: '单烘干', label: '单烘干' },
          { value: '轻干洗', label: '轻干洗' },
          { value: '随心洗', label: '随心洗' },
        ], 2, 2),
        status('剩余时间', 0, ' 分', 2, 3),
      ],
      sim: { remainSec: 0, modeMins: { '智能洗': 46, '快速洗': 18, '单烘干': 80, '轻干洗': 40, '随心洗': 32 } },
    }),
    d('demo-heater', '云米AI燃气热水器 蓝调2', 'viomi.waterheater.v7', 'heater', '#f07830', true, {
      roomName: '厨房', special: 'heater',
      controls: [
        sw('电源', true, 2, 1),
        slider('目标温度', 45, 35, 65, 1, '°C', 2, 2),
        status('当前水温', 42.5, '°C', 2, 3),
        status('燃气状态', '正常', '', 3, 1),
      ],
      sim: { waterTemp: 42.5 },
    }),
  ];

  const families = [
    {
      id: 'demo-home-my',
      name: '我的家',
      ownerUid: 10001,
      rooms: [
        { id: 'r-office', name: '办公室' },
        { id: 'r-bedroom', name: '卧室' },
        { id: 'r-kitchen', name: '厨房' },
      ],
    },
    { id: 'demo-home-2', name: '10000000000的家', ownerUid: 10000000000, rooms: [] },
    { id: 'demo-home-none', name: '未入家庭', ownerUid: 0, rooms: [] },
  ];

  // 小爱音箱页：组合立体声
  const stereoGroup = {
    name: '小爱音箱 立体声',
    left: { did: 'demo-speaker-left', label: '左声道', tag: '主' },
    right: { did: 'demo-speaker-right', label: '右声道', tag: '副' },
  };

  // 音箱无线模式 / DTS（演示）
  const speakerExtras = {
    'demo-speaker-art': {
      playState: 'paused', // playing | paused
      btMesh: true, btAudio: false, dts: '澎湃',
      functions: ['文字播报', '对话记录', '睡眠模式', '闹钟', '播放设置', '设备信息'],
    },
  };

  // 歌单（28 首，演示）
  const playlist = [
    { title: '明天会更好', artist: '李建复、洪荣宏、王梦麟、费玉清…', dur: 324 },
    { title: '童年', artist: '罗大佑', dur: 206 },
    { title: '光阴的故事', artist: '罗大佑', dur: 232 },
    { title: '外面的世界', artist: '齐秦', dur: 271 },
    { title: '大约在冬季', artist: '齐秦', dur: 244 },
    { title: '恋曲1990', artist: '罗大佑', dur: 279 },
    { title: '海阔天空', artist: 'Beyond', dur: 322 },
    { title: '光辉岁月', artist: 'Beyond', dur: 318 },
    { title: '真的爱你', artist: 'Beyond', dur: 266 },
    { title: '喜欢你', artist: 'Beyond', dur: 248 },
    { title: '夜空中最亮的星', artist: '逃跑计划', dur: 252 },
    { title: '平凡之路', artist: '朴树', dur: 282 },
    { title: '那些花儿', artist: '朴树', dur: 262 },
    { title: '白桦林', artist: '朴树', dur: 217 },
    { title: '同桌的你', artist: '老狼', dur: 226 },
    { title: '睡在我上铺的兄弟', artist: '老狼', dur: 285 },
    { title: '一剪梅', artist: '费玉清', dur: 238 },
    { title: '千里之外', artist: '周杰伦、费玉清', dur: 255 },
    { title: '晴天', artist: '周杰伦', dur: 269 },
    { title: '七里香', artist: '周杰伦', dur: 299 },
    { title: '稻香', artist: '周杰伦', dur: 223 },
    { title: '听妈妈的话', artist: '周杰伦', dur: 272 },
    { title: '成都', artist: '赵雷', dur: 254 },
    { title: '理想', artist: '赵雷', dur: 246 },
    { title: '贝加尔湖畔', artist: '李健', dur: 255 },
    { title: '传奇', artist: '李健', dur: 268 },
    { title: '红豆', artist: '王菲', dur: 248 },
    { title: '我愿意', artist: '王菲', dur: 243 },
  ];

  // 场景（自动化任务演示）
  const scenes = [
    {
      id: 'scene-home', name: '回家模式', icon: 'house', color: '#e8960c',
      desc: '开挂灯 · 热水器 45°C · 加湿器',
      actions: [
        { did: 'demo-lamp-1s', control: '2.1', value: true },
        { did: 'demo-heater', control: '2.1', value: true },
        { did: 'demo-humidifier', control: '2.1', value: true },
      ],
    },
    {
      id: 'scene-night', name: '晚安模式', icon: 'moon', color: '#5c6bc0',
      desc: '关灯 · 关电脑 · 关热水器 · 暂停播放',
      actions: [
        { did: 'demo-lamp-1s', control: '2.1', value: false },
        { did: 'demo-computer', control: '2.1', value: false },
        { did: 'demo-heater', control: '2.1', value: false },
      ],
    },
    {
      id: 'scene-wash', name: '一键洗衣', icon: 'washer', color: '#4a90d9',
      desc: '洗衣机 · 智能洗',
      actions: [
        { did: 'demo-washer', control: '2.1', value: true },
        { did: 'demo-washer', control: '2.2', value: '智能洗' },
      ],
    },
  ];

  // 音乐投送目标
  const castTargets = [
    { id: 'local', name: '本机扬声器', icon: 'monitor', color: '#3a7bd5' },
    { id: 'demo-speaker-left', name: '小爱音箱 左护法', icon: 'speaker', color: '#f06292' },
    { id: 'demo-speaker-right', name: '小爱音箱 右护法', icon: 'speaker', color: '#f06292' },
    { id: 'demo-speaker-art', name: '小爱音箱 Art 电池版', icon: 'speaker', color: '#f06292' },
  ];

  const initialPlayer = {
    trackIndex: 0,
    position: 32,
    playing: true,
    volume: 30,
    muted: false,
    liked: false,
    shuffle: true,
    quality: '高品',
    output: 'local',
    queueLen: 6,
  };

  function build() {
    return {
      families: JSON.parse(JSON.stringify(families)),
      devices: JSON.parse(JSON.stringify(devices)),
      stereoGroup: JSON.parse(JSON.stringify(stereoGroup)),
      speakerExtras: JSON.parse(JSON.stringify(speakerExtras)),
      playlist: JSON.parse(JSON.stringify(playlist)),
      scenes: JSON.parse(JSON.stringify(scenes)),
      castTargets: JSON.parse(JSON.stringify(castTargets)),
      player: { ...initialPlayer },
    };
  }

  window.DemoData = { build, devices, families, playlist, scenes };
})();
