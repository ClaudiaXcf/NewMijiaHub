'use strict';
/**
 * MIoT spec 实例 → 前端通用控件描述。
 *
 * 思路与 mihome-pc-unofficial 一致：界面由 spec 驱动，新增一台设备
 * 不需要写任何 UI 代码。这里把 spec 里的可写属性归类为
 * switch / select / slider，只读属性归为 status，动作归为 action。
 * 云端响应的具体形状做了防御式解析（未登录无法逐字段取证）。
 */

const TYPE_TO_ICON = {
  'light': ['lamp', '#e8960c'], 'lamp': ['lamp', '#e8960c'],
  'ceiling-light': ['lamp', '#e8960c'], 'screen-bar-light': ['lamp', '#e8960c'],
  'outlet': ['plug', '#3a7bd5'], 'plug': ['plug', '#3a7bd5'],
  'power-strip': ['plug', '#3a7bd5'], 'charger': ['plug', '#3a7bd5'],
  'temperature-humidity-sensor': ['sensor', '#35a7e0'],
  'temperature-sensor': ['sensor', '#35a7e0'],
  'humidity-sensor': ['sensor', '#35a7e0'],
  'submersion-sensor': ['sensor', '#35a7e0'],
  'washer': ['washer', '#4a90d9'], 'washing-machine': ['washer', '#4a90d9'],
  'water-heater': ['heater', '#f07830'], 'gas-water-heater': ['heater', '#f07830'],
  'kettle': ['kettle', '#e8845c'],
  'humidifier': ['humidifier', '#2bb3a6'], 'dehumidifier': ['humidifier', '#2bb3a6'],
  'air-conditioner': ['ac', '#3a8bd6'], 'air-condition-outlet': ['ac', '#3a8bd6'],
  'air-purifier': ['airpurifier', '#35b68f'], 'fresh-air-system': ['airpurifier', '#35b68f'],
  'speaker': ['speaker', '#f06292'], 'tts-speaker': ['speaker', '#f06292'],
  'intelligent-speaker': ['speaker', '#f06292'],
  'television': ['tv', '#7b6cf6'], 'projector': ['tv', '#7b6cf6'],
  'fan': ['fan', '#59b3d9'], 'ceiling-fan': ['fan', '#59b3d9'],
  'curtain': ['curtain', '#8a7bd6'], 'window-opener': ['curtain', '#8a7bd6'],
  'bath-heater': ['bathheater', '#f08a5d'],
  'foot-bath': ['footbath', '#9aa3b5'], 'footbath': ['footbath', '#9aa3b5'],
  'rice-cooker': ['cooker', '#e8964c'], 'oven': ['cooker', '#e8964c'],
  'microwave-oven': ['cooker', '#e8964c'],
  'airer': ['airer', '#7ba8e0'], 'clothes-dryer': ['airer', '#7ba8e0'],
  'refrigerator': ['fridge', '#6cb2eb'], 'freezer': ['fridge', '#6cb2eb'],
  'router': ['router', '#6cb2eb'], 'wifi': ['router', '#6cb2eb'],
  'door': ['door', '#7f8c9b'], 'lock': ['door', '#7f8c9b'], 'door-lock': ['door', '#7f8c9b'],
  'camera': ['camera', '#5c9df0'], 'video-doorbell': ['camera', '#5c9df0'],
  'vacuum': ['vacuum', '#d98f5c'], 'robot-cleaner': ['vacuum', '#d98f5c'],
  'air-monitor': ['sensor', '#35a7e0'], 'smoke-sensor': ['sensor', '#35a7e0'],
  'gas-sensor': ['sensor', '#35a7e0'], 'occupancy-sensor': ['sensor', '#35a7e0'],
  'motion-sensor': ['sensor', '#35a7e0'], 'magnet-sensor': ['door', '#7f8c9b'],
  'bulb': ['lamp', '#e8960c'], 'night-light': ['lamp', '#e8960c'],
  'heater': ['heater', '#f07830'], 'electric-heater': ['heater', '#f07830'],
  'body-fat-scale': ['scale', '#8f9bb3'], 'scale': ['scale', '#8f9bb3'],
  'toothbrush': ['generic', '#8f9bb3'], 'clock': ['clock', '#8f9bb3'],
  'desk-lamp': ['lamp', '#e8960c'], 'pc-monitor': ['monitor', '#3a7bd5'],
  'computer': ['monitor', '#3a7bd5'], 'printer': ['generic', '#8f9bb3'],
};
const GENERIC_ICON = ['generic', '#8f9bb3'];

const PROP_NAMES = {
  'on': '电源', 'mode': '模式', 'fan-mode': '模式', 'wind-mode': '风感',
  'brightness': '亮度', 'color-temperature': '色温', 'color': '颜色',
  'target-temperature': '目标温度', 'temperature': '温度',
  'relative-humidity': '湿度', 'target-humidity': '目标湿度',
  'volume': '音量', 'mute': '静音', 'status': '状态', 'fault': '故障',
  'battery-level': '电量', 'water-level': '水量', 'speed-level': '档位',
  'fan-level': '风速', 'left-time': '剩余时间', 'progress': '进度',
  'power-consumption': '功耗', 'electric-power': '功率',
  'electric-current': '电流', 'voltage': '电压',
  'child-lock': '童锁', 'door-state': '门状态', 'wash-time': '洗涤时长',
  'dry-level': '烘干档位', 'target-water-level': '目标水位',
  'physical-controls-locked': '按键锁', 'alarm': '警报', 'ring-tone': '铃声',
  'work-mode': '工作模式', 'heat-level': '制热档位',
  // 常见但此前显示英文的属性
  'default-power-on-state': '上电状态',
  'target-position': '目标位置', 'current-position': '当前位置',
  'motor-control': '电机控制', 'horizontal-swing': '左右扫风',
  'vertical-swing': '上下扫风', 'wind-direction': '风向',
  'vertical-position': '上下摆风', 'horizontal-position': '左右摆风',
  'sleep-mode': '睡眠模式', 'eco': '节能模式', 'heater': '辅热',
  'dryer': '干燥', 'favorite-on': '收藏模式', 'favorite-type': '收藏类型',
  'screen-save': '息屏时间', 'screen-switch': '屏幕显示',
  'sensitivity': '灵敏度', 'speed': '速度', 'color-mode': '色彩模式',
  'filter-life-level': '滤芯寿命', 'indicator-light': '指示灯',
  'temperature-range': '温度范围', 'humidity-range': '湿度范围',
  'delay-time': '延时时间', 'off-delay-time': '关闭延时',
  'power-off-time': '断电时间', 'countdown-time': '倒计时',
  'ionizer': '负离子', 'uv': '紫外线杀菌', 'anion': '负离子',
  'air-quality': '空气质量', 'pm2-5-density': 'PM2.5',
  'co2-density': 'CO₂ 浓度', 'tvoc-density': 'TVOC',
  'illumination': '光照度', 'motion-detected': '有人移动',
  'open': '开合状态', 'position': '位置',
  'flex-switch': '灵动开关', 'night-light-switch': '夜灯开关',
  'open-close': '开合', 'stop': '停止',
  'motor-reverse': '电机反转', 'whole-journey-time': '全程用时',
  'remote-num': '遥控器数量', 'start-pairing': '开始配对',
  'wakeup-state': '唤醒状态', 'wake-up-end-position': '唤醒终点',
  'wake-up-duration': '唤醒时长', 'enable-manual-draw-curtain': '允许手动拉帘',
  'sleep-aid-mode': '助眠模式', 'wake-up-mode': '唤醒模式',
  'sleep-aid': '助眠', 'wake-up': '唤醒',
  'color-temperature-add': '色温 +', 'color-temperature-dec': '色温 -',
  'colortemperature-add': '色温 +', 'colortemperature-dec': '色温 -',
  'colortemperatre-dec': '色温 -', 'brightness-add': '亮度 +',
  'brightness-dec': '亮度 -',
  // 网关/路由（几乎全是只读信息，但仍要给人话名字）
  'access-mode': '接入方式', 'ip-address': 'IP 地址',
  'wifi-ssid': 'WiFi 名称', 'dhcp-server-mac-adress': '设备 MAC 地址',
  'dhcp-server-mac-address': '设备 MAC 地址', 'current-time': '当前时间',
  'mac-address': 'MAC 地址', 'connected-devices': '连接设备数',
  'router-name': '路由器名称', 'rom-version': '固件版本',
  // 电动床的 custom 服务：description 为空，只能靠短名映射
  'min-control': '姿势调节', 'light-conrtol': '灯光', 'light-control': '灯光',
  'light-bright': '灯光亮度', 'memory-mode-one': '记忆位置一',
  'memory-mode-two': '记忆位置二', 'memory-one-state': '记忆一状态',
  'memory-two-state': '记忆二状态',
};
const ACTION_NAMES = {
  'play': '播放', 'pause': '暂停', 'stop': '停止', 'toggle': '切换开关',
  'turn-on': '开启', 'turn-off': '关闭', 'identify': '识别设备',
  'start-wash': '开始洗涤', 'sweep': '开始清扫', 'reset-filter-life': '重置滤芯',
  'execute-text-directive': '执行指令', 'unmute': '取消静音', 'mute': '静音',
  'play-music': '播放音乐', 'set-alarm': '设置闹钟', 'cancel-all-alarm': '取消全部闹钟',
  'channel-up': '频道 +', 'channel-down': '频道 -',
  'volume-up': '音量 +', 'volume-down': '音量 -',
  'open': '打开', 'close': '关闭', 'toggle-on': '开启', 'toggle-off': '关闭',
};
const VALUE_NAMES = {
  'Idle': '待机', 'Busy': '工作中', 'Pause': '暂停', 'Error': '故障',
  'Off': '关闭', 'On': '开启', 'Shutdown': '关机', 'Standby': '待机',
  'Low': '低', 'Medium': '中', 'High': '高', 'Auto': '自动',
  'Sleep': '睡眠', 'Smart': '智能', 'None': '无', 'Normal': '标准',
  'Strong': '强劲', 'Eco': '节能', 'Cool': '制冷', 'Heat': '制热',
  'Fan': '送风', 'Dry': '除湿', 'Silent': '静音', 'Favorite': '收藏',
  'Wired And Wireless': '有线+无线', 'Wireless': '无线', 'Wired': '有线',
  'Direct Blowing Prevention': '防直吹', 'Cloud Recommendation': '云端推荐',
  'Custom': '自定义', 'Level1': '1 档', 'Level2': '2 档', 'Level3': '3 档',
  'Level4': '4 档', 'Level5': '5 档', 'Level6': '6 档', 'Level7': '7 档',
  'Level8': '8 档', 'Weak Cold': '弱冷', 'Small Cold': '小冷',
  'Comfort': '舒适', 'Big Cold': '大冷', 'Strong Cold': '强冷',
  'Weak Heat': '弱热', 'Small Heat': '小热', 'Big Heat': '大热',
  'Strong Heat': '强热', 'Top Rating': '最上', 'Freeze Top': '上定格',
  'Rating Left': '最左', 'Freeze Down': '下定格', 'Lower Rating': '最下',
  'Day': '白天', 'Night': '夜间', 'Warmth': '暖色', 'Tv': '观影',
  'Reading': '阅读', 'Default': '默认', 'Default-state': '默认状态',
  'Professional-set': '专业设置', 'Sky Curtain Wind': '天幕风',
  'Carpet Wind': '地毯风', 'Control': '启用', 'Decontrol': '停用',
  'Wired and wireless': '有线+无线', 'On/Off': '开/关',
  // 网关联网方式
  'LAN': '有线', 'Wireless 5 G': '无线 5GHz', 'Wireless 2 G': '无线 2.4GHz',
  'Wireless 5G': '无线 5GHz', 'Wireless 2.4G': '无线 2.4GHz',
  // 电动床：模式 / 姿势 / 灯光 / 记忆
  'Zero Gravity': '零重力', 'Anti-snoring': '防打鼾', 'Lie Flat': '平躺',
  'Back-up': '背部升起', 'Back-down': '背部放下',
  'Leg-up': '腿部升起', 'Leg-down': '腿部放下',
  'Memory': '保存', 'Run': '调用', 'Delete': '删除',
  'No-memory': '未记忆', 'No-memory ': '未记忆',
  'No Faults': '正常', 'No fault': '正常',
  'OnTenMinute': '亮 10 分钟', 'OnEightHour': '亮 8 小时', 'OnTenHour': '亮 10 小时',
  'Stop': '停止', 'Pause': '暂停',
};

/**
 * 同一个英文枚举在不同属性里含义不同：
 * 电动床的 Memory 在「记忆位置一」里是动作"保存"，在「记忆一状态」里是"已记忆"。
 * 这类冲突按属性短名精确覆盖。
 */
const VALUE_BY_PROP = {
  'memory-one-state': { Memory: '已记忆', 'No-memory': '未记忆' },
  'memory-two-state': { Memory: '已记忆', 'No-memory': '未记忆' },
  'memory-mode-one': { Memory: '保存', Run: '调用', Delete: '删除' },
  'memory-mode-two': { Memory: '保存', Run: '调用', Delete: '删除' },
};
const UNIT_NAMES = {
  C: '°C', celsius: '°C', '%': '%', 'percentage': '%',
  W: ' W', kWh: ' kWh', hours: '时', minutes: '分', seconds: '秒',
  none: '', c: '°C', w: ' W', h: '时', min: '分', s: '秒',
  lux: ' lx', ppb: ' ppb', 'μg/m³': ' μg/m³', 'mg/m³': ' mg/m³',
};

/**
 * MIoT 属性/服务的 URN → 短名。
 *   urn:miot-spec-v2:property:on:00000006:xiaomi-h39h00:1  →  on
 * 注意不能取最后一段（那是 spec 版本号），必须取类型关键字那一段。
 */
function tailOfUrn(urn) {
  const m = /:(?:property|service|device|event):([A-Za-z0-9-]+):/.exec(String(urn || ''));
  if (m) return m[1];
  const parts = String(urn || '').split(':');
  return parts[parts.length - 1] || '';
}
const EN_ORDINAL = {
  first: '第一路', second: '第二路', third: '第三路', fourth: '第四路',
  fifth: '第五路', sixth: '第六路', seventh: '第七路', eighth: '第八路',
  ninth: '第九路', tenth: '第十路',
};
const CN_ROUTE = ['第一路', '第二路', '第三路', '第四路', '第五路', '第六路',
  '第七路', '第八路', '第九路', '第十路', '第十一路', '第十二路'];
const routeName = (i) => CN_ROUTE[i - 1] || `第 ${i} 路`;
const SERVICE_ZH = {
  switch: '开关', 'indicator-light': '指示灯', 'air-conditioner': '空调',
  'fan-control': '风扇', environment: '环境', alarm: '警报', filter: '滤芯',
  'power-consumption': '功耗', curtain: '窗帘', light: '灯光', outlet: '插座',
  'physical-controls-locked': '按键锁', 'battery': '电池', 'temperature': '温度',
  screen: '屏显', display: '屏幕', 'night-light': '夜灯', backlight: '背光',
  fan: '风扇', 'ambient-light': '氛围灯', microphone: '麦克风', speaker: '扬声器',
  'intelligent-speaker': '音箱', 'air-fresh': '新风',
};

/** 服务的可读名：中文直接用；"First Switch Service" → "第一路"。 */
function serviceLabel(svc) {
  const d = String((svc && svc.description) || '').trim();
  if (!d) return '';
  if (/[\u4e00-\u9fff]/.test(d)) return d.replace(/\s*(service|服务)$/i, '').trim();
  const head = d.split(/\s+/)[0].toLowerCase();
  return EN_ORDINAL[head] || '';
}

function descKey(text) {
  return String(text || '').trim().toLowerCase().replace(/[\s_]+/g, '-').replace(/[^a-z0-9-]/g, '');
}
function propName(prop) {
  const key = tailOfUrn(prop.type);
  return PROP_NAMES[key] || PROP_NAMES[descKey(prop.description)]
    || prop.description || key || `属性 ${prop.iid}`;
}
function actionName(act) {
  const key = tailOfUrn(act.type);
  return ACTION_NAMES[key] || ACTION_NAMES[descKey(act.description)]
    || act.description || key || `动作 ${act.iid}`;
}
function valueZh(label, value, propKey) {
  const raw = String(label == null ? '' : label);
  const key = raw.trim();
  const byProp = propKey && VALUE_BY_PROP[propKey];
  if (byProp && byProp[key]) return byProp[key];
  if (/[\u4e00-\u9fff]/.test(raw)) return key;
  return VALUE_NAMES[key] || key || String(value);
}
function unitZh(unit) {
  return UNIT_NAMES[unit] != null ? UNIT_NAMES[unit] : (unit ? ` ${unit}` : '');
}

function iconForUrn(urn) {
  const m = /:device:([a-z0-9-]+):/i.exec(String(urn || ''));
  return (m && TYPE_TO_ICON[m[1]]) || GENERIC_ICON;
}

const NUMERIC = new Set(['uint8', 'uint16', 'uint32', 'int8', 'int16', 'int32', 'float']);

/** 不上界面的服务：设备信息、私有 config、虚拟服务、各种 dev-mode 调试服务。 */
const SERVICE_SKIP_RE = /:service:(device-information|config|virtual-service|.+dev-mode):/i;

/** 附属开关服务：指示灯、夜灯、背光。它们的 on/off 不代表设备开关机。 */
const ACCESSORY_SERVICES = new Set([
  'indicator-light', 'night-light', 'night-light-switch', 'backlight', 'led', 'ambient-light',
]);

/** 属性优先级（越小越靠前）：按"用户多久碰一次"排，而不是按 spec 顺序。 */
const PROP_PRIORITY = {
  on: 0, mode: 1, 'fan-level': 2, brightness: 2, volume: 2,
  'min-control': 2,
  'target-temperature': 3, 'color-temperature': 3, 'target-humidity': 3,
  'motor-control': 3, 'target-position': 3, 'speed-level': 3,
  'wind-direction': 3, 'default-power-on-state': 4,
  'vertical-swing': 4, 'horizontal-swing': 4, 'sleep-mode': 5, eco: 5,
  'light-conrtol': 4, 'light-control': 4, 'light-bright': 5,
  'memory-mode-one': 6, 'memory-mode-two': 6,
  'memory-one-state': 7, 'memory-two-state': 7,
  temperature: 6, 'relative-humidity': 6, 'battery-level': 6, 'water-level': 6,
  status: 7, 'left-time': 7, progress: 7, 'power-consumption': 7,
  'ip-address': 8, 'access-mode': 8, 'wifi-ssid': 8,
  fault: 9, alarm: 9,
};
const DEFAULT_PRIORITY = 20;

/** 厂商调试/内部字段，description 里也有值但放界面毫无意义。 */
const PROP_BLOCKLIST = new Set([
  'get', 'set', 'interactive', 'debug', 'test', 'mode-switch',
  'master-slave-switch', 'get-local-ctrl', 'key-param',
]);

/** spec 实例 → 控件列表（不含当前值，值由 prop/get 批量回填）。 */
function specToControls(spec) {
  const controls = [];
  const services = ((spec && spec.services) || [])
    .filter((s) => !SERVICE_SKIP_RE.test(String(s.type || '')));
  const switchServices = services.filter((s) => tailOfUrn(s.type) === 'switch');
  const multiSwitch = switchServices.length > 1;
  // 多键面板的 siid 不一定连续（中控屏是 14/15/16），按出现顺序编号才叫"第 1/2/3 路"
  const switchOrdinal = new Map(switchServices.map((s, i) => [s.iid, i + 1]));

  for (const svc of services) {
    const svcKey = tailOfUrn(svc.type);
    // vd-* 是面板里"虚拟子设备"的占位服务，实物在设备列表里另有条目，
    // 全展开会得到一堆同名的"电源"开关
    if (/^vd-/.test(svcKey)) continue;
    const label = serviceLabel(svc)
      || (multiSwitch && svcKey === 'switch' ? routeName(switchOrdinal.get(svc.iid) || 1) : '');
    const svcZh = label || SERVICE_ZH[svcKey] || '';
    for (const prop of svc.properties || []) {
      const access = prop.access || [];
      const canWrite = access.includes('write');
      const canRead = access.includes('read');
      if (!canRead && !canWrite) continue;
      const keyName = tailOfUrn(prop.type);
      const desc = String(prop.description || '').trim();
      // 私有无语义字段（description 和词表都查不到）不上界面，
      // 否则卡片里会出现 key-mode / brightnessw 这种厂商内部字段
      if (!desc && !PROP_NAMES[keyName]) continue;
      if (PROP_BLOCKLIST.has(keyName)) continue;
      // 「亮度+」「色温-」这类是增量属性，做成滑杆连续拖动会不停累加下发，
      // 灯会疯狂跳变 —— 直接不展示
      if (/(^|-)(add|dec|increase|decrease)(-|$)/.test(keyName)) continue;

      let name = propName(prop);
      // siid ≥ 5 基本都是厂商私有扩展；名字没中文映射的就不展示了
      if (svc.iid > 4 && !/[\u4e00-\u9fff]/.test(name)) continue;
      if (keyName === 'on' && prop.format === 'bool') {
        if (svcKey === 'switch') {
          name = multiSwitch ? (label || '电源') : '电源';
        } else if (SERVICE_ZH[svcKey]) {
          name = `${SERVICE_ZH[svcKey]}开关`;
        } else {
          name = label ? `${label}开关` : '电源';
        }
      } else if (multiSwitch && svcKey === 'switch' && label) {
        // 多键面板里每路都有自己的「模式」「上电状态」，不加前缀会全是同名列
        name = `${label}${name}`;
      }

      const base = {
        siid: svc.iid,
        piid: prop.iid,
        key: `${svc.iid}.${prop.iid}`,
        name,
        unit: unitZh(prop.unit),
        format: prop.format,
        prop: keyName,
        svc: svcKey,
        svcLabel: svcZh,
      };
      if (canWrite && prop.format === 'bool') {
        controls.push({
          ...base,
          type: 'switch',
          // 指示灯/夜灯/背光开关不是设备电源，卡片状态与电源按钮不能拿它当依据
          main: !ACCESSORY_SERVICES.has(svcKey),
          value: false,
        });
      } else if (canWrite && Array.isArray(prop['value-list']) && prop['value-list'].length > 1) {
        const options = prop['value-list'].map((v) => ({
          value: v.value,
          label: valueZh(v.description, v.value, keyName),
        }));
        // 只写枚举（电动床的「背部升起/腿部升起」、记忆的「保存/调用/删除」）是
        // 瞬时指令：没有状态可读，做成下拉会残留一个不存在的"当前值"，
        // 所以单独归类为 command，前端渲染成一次性按钮。
        controls.push({ ...base, type: canRead ? 'select' : 'command', options });
      } else if (canWrite && NUMERIC.has(prop.format)) {
        const range = prop['value-range'] || [0, 100];
        controls.push({
          ...base,
          type: 'slider',
          min: Number(range[0]) || 0,
          max: Number(range[1]) || 100,
          // value-range 第三位是官方步长（如空调 16~31 步长 0.5）
          step: Number(range[2]) || (prop.format === 'float' ? 0.5 : 1),
          value: Number(range[0]) || 0,
        });
      } else if (canRead) {
        // 只读枚举（如「状态」「故障」）也带 options，卡片才能显示文字而不是数字。
        // 注意单值枚举也要带上（故障只有 0:No Faults），否则界面只显示一个 0
        const opts = Array.isArray(prop['value-list']) && prop['value-list'].length >= 1
          ? prop['value-list'].map((v) => ({ value: v.value, label: valueZh(v.description, v.value, keyName) }))
          : null;
        controls.push(opts ? { ...base, type: 'status', options: opts } : { ...base, type: 'status' });
      }
    }
    for (const act of svc.actions || []) {
      const actKey = tailOfUrn(act.type);
      // get-*/set-*/enter-* 是厂商调试动作，不放界面上
      if (/^(get|set|enter|clear)-/.test(actKey)) continue;
      controls.push({
        siid: svc.iid,
        aiid: act.iid,
        piid: 0,
        key: `a${svc.iid}.${act.iid}`,
        type: 'action',
        name: actionName(act),
        prop: actKey,
        svc: svcKey,
        svcLabel: svcZh,
      });
    }
  }

  // 同名控件消歧：一台设备常有多个服务各带「模式」「电源」，
  // 直接列出来会有两个一模一样的名字。用服务中文名做前缀
  // （风扇电源 / 氛围灯电源 / 第一路切换开关），仍重名的补序号兜底。
  const nameCount = new Map();
  for (const c of controls) nameCount.set(c.name, (nameCount.get(c.name) || 0) + 1);
  for (const c of controls) {
    if ((nameCount.get(c.name) || 0) > 1 && c.svcLabel) {
      c.name = `${c.svcLabel}${c.name}`;
    }
  }
  const seen = new Map();
  for (const c of controls) {
    const n = (seen.get(c.name) || 0) + 1;
    seen.set(c.name, n);
    if (n > 1) c.name = `${c.name} ${n}`;
  }

  // 排序：先按"常用度"，再按类型分组。注意 rank.switch === 0，
  // 不能用 `|| 9` 兜底（0 是 falsy，会把开关全排到最后）。
  const rank = { switch: 0, select: 1, slider: 2, command: 2, status: 3, action: 4 };
  const rankOf = (t) => (rank[t] != null ? rank[t] : 9);
  const prioOf = (c) => {
    const base = PROP_PRIORITY[c.prop] != null ? PROP_PRIORITY[c.prop] : DEFAULT_PRIORITY;
    // 没能命名成中文的属性（厂商英文私有项）往后排，让核心控件先占位
    return /[\u4e00-\u9fff]/.test(c.name) ? base : base + 12;
  };
  controls.sort((a, b) => {
    const p = prioOf(a) - prioOf(b);
    if (p) return p;
    const r = rankOf(a.type) - rankOf(b.type);
    if (r) return r;
    return (a.siid - b.siid) || (a.piid - b.piid);
  });
  return controls.slice(0, 12);
}

/** prop/get 响应 → 回填控件 value（防御式，多种可能形状）。 */
function mergePropValues(controls, propResult, did) {
  const byKey = new Map(controls.map((c) => [c.key, c]));
  const items = [];
  if (Array.isArray(propResult)) {
    for (const it of propResult) {
      if (!it || it.did != null ? String(it.did) !== String(did) : false) continue;
      items.push(it);
    }
  } else if (propResult && typeof propResult === 'object') {
    for (const [k, v] of Object.entries(propResult)) {
      const m = /^(\d+)[.-](\d+)$/.exec(k);
      if (m) items.push({ siid: Number(m[1]), piid: Number(m[2]), value: v });
      else if (v && typeof v === 'object' && 'value' in v) items.push({ ...v, siid: v.siid, piid: v.piid });
    }
  }
  for (const it of items) {
    if (it == null || it.siid == null || it.piid == null) continue;
    const c = byKey.get(`${it.siid}.${it.piid}`);
    if (c && it.value !== undefined) c.value = it.value;
  }
  return controls;
}

/** 设备卡片的一行状态文字。 */
function statusLine(device) {
  if (device.online === false) return { text: '离线', cls: 'is-offline' };
  const controls = device.controls || [];
  const devType = deviceType(device.urn);

  // 网关/中枢是一直在线的设备，没有"开关机"概念。指示灯开关不是电源，
  // 用它的值判断会得出"已关闭"这种明显错误的结论。
  if (devType === 'gateway' || devType === 'central-hub' || /hub/.test(devType)) {
    const ip = controls.find((c) => c.prop === 'ip-address' && c.value);
    return { text: ip ? `运行中 · ${ip.value}` : '运行中', cls: 'is-on' };
  }

  const switches = controls.filter((c) => c.type === 'switch' && c.prop === 'on');
  // 多路开关面板（四键/三键）显示「1/3 开启」，比只报第一路更有信息量。
  // 只统计真正的 switch 服务路数：屏显、虚拟子设备的开关不属于"这几路"
  const mains = switches.filter((c) => c.main !== false);
  const gangs = mains.filter((c) => c.svc === 'switch');
  const counted = gangs.length > 1 ? gangs : mains;
  if (counted.length > 1) {
    const on = counted.filter((c) => c.value).length;
    return { text: `${on}/${counted.length} 开启`, cls: on ? 'is-on' : '' };
  }
  const sw = counted[0] || controls.find((c) => c.type === 'switch' && c.main !== false);
  if (sw && sw.value !== undefined) {
    return { text: sw.value ? '已开启' : '已关闭', cls: sw.value ? 'is-on' : '' };
  }

  // 无主开关的设备（传感器、电动床、路由器…）：优先用能表达"现在什么样"的属性，
  // 而不是列表里第一个只读字段（否则电动床会显示成故障码 0）
  for (const prop of ['mode', 'work-mode', 'status', 'temperature', 'relative-humidity',
    'battery-level', 'water-level', 'current-position', 'position', 'air-quality']) {
    const c = controls.find((x) => x.prop === prop && x.value !== undefined
      && (x.type === 'status' || x.type === 'select'));
    if (c) return { text: statusText(c), cls: '' };
  }
  const st = controls.find((c) => c.type === 'status' && c.value !== undefined
    && c.prop !== 'fault' && c.prop !== 'alarm');
  if (st) return { text: statusText(st), cls: '' };
  return { text: device.online ? '在线' : '—', cls: '' };
}

function deviceType(urn) {
  const m = /:device:([a-z0-9-]+):/i.exec(String(urn || ''));
  return m ? m[1] : '';
}

/** 状态控件的人类可读值：有枚举就翻成标签，别再显示数字。 */
function statusText(c) {
  let text = c.value;
  if (c.options) {
    const opt = c.options.find((o) => String(o.value) === String(c.value));
    if (opt) text = opt.label;
  }
  return `${text}${c.unit || ''}`;
}

module.exports = {
  TYPE_TO_ICON,
  GENERIC_ICON,
  specToControls,
  mergePropValues,
  statusLine,
  iconForUrn,
};
