'use strict';
/**
 * 轻量 i18n：以中文原文为 key，英文为值。
 * - t('已开启')                     → 直接翻译（源码里主动调用）
 * - apply(root)                     → 渲染后兜底翻译 DOM 文本与 title/placeholder，
 *                                     覆盖模板字符串里的静态文案
 * - 带用户数据（设备名/房间名）的元素加 data-no-i18n，整棵子树跳过
 */
(function () {
  const EN = {
    // ---------- 外壳 ----------
    '米家与小爱': 'Mijia & Xiaoai',
    '小爱音箱': 'Xiaoai Speaker',
    '米家设备': 'Devices',
    '音乐投送': 'Music Cast',
    '手机投屏': 'Screen Cast',
    '自动化任务': 'Automations',
    '小米账号': 'Xiaomi Account',
    '房间管理': 'Rooms',
    '刷新设备': 'Refresh',
    '正在从云端加载设备…': 'Loading devices from cloud…',
    '已登录': 'Signed in',
    '演示模式': 'Demo mode',
    '演示模式（本地）': 'Demo (local)',
    '演示模式（云端不可用）': 'Demo (cloud unavailable)',
    '我的家': 'My Home',
    '切换深浅色': 'Toggle theme',
    '最小化（网页版由浏览器窗口管理）': 'Minimize (window is browser-managed)',
    '最大化（网页版由浏览器窗口管理）': 'Maximize (window is browser-managed)',
    '关闭（网页版由浏览器窗口管理）': 'Close tab (window is browser-managed)',

    // ---------- 设备列表 ----------
    '还没有设备': 'No devices yet',
    '展开': 'Expand',
    '收起': 'Collapse',
    '请输入设备名称': 'Enter a device name',
    '云端数据加载失败': 'Failed to load cloud data',
    '在手机米家 App 中给这个家庭添加设备后，点右上角「刷新设备」':
      'Add devices to this home in the Mi Home app, then tap Refresh.',
    '演示数据只包含「我的家」；切换标签可查看空家庭的样子':
      'Demo data only covers "My Home". Switch tabs to see an empty home.',
    '未分区': 'Unassigned',
    '打开设备详情': 'Open device details',
    '下发中…': 'Sending…',
    '关闭': 'Close',
    '开启': 'On',
    '电源': 'Power',
    '离线': 'Offline',
    '在线': 'Online',
    '已开启': 'On',
    '已关闭': 'Off',
    '运行中': 'Running',
    '设备状态已刷新': 'Device states refreshed',
    '状态已刷新': 'State refreshed',
    '下发失败': 'Command failed',
    '未知错误': 'Unknown error',
    '重命名房间': 'Rename room',

    // ---------- 设备详情 ----------
    '刷新状态': 'Refresh',
    '重命名': 'Rename',
    '设备动作': 'Device actions',
    '更多设置与信息': 'More settings',
    '更多模式': 'More modes',
    '洗衣记录': 'Wash history',
    '简清洁': 'Quick clean',
    '设备离线：控制不可用，请检查设备电源与网络':
      'Device offline: controls unavailable. Check its power and network.',
    '型号': 'Model',
    '固件': 'Firmware',
    '设备设置': 'Device settings',
    '名称': 'Name',
    '图标': 'Icon',
    '颜色': 'Color',
    '卡片大小': 'Card size',
    '标准': 'Standard',
    '宽': 'Wide',
    '大': 'Large',
    '小': 'Small',
    '所属房间': 'Room',
    '保存': 'Save',
    '设备信息': 'Device info',
    '设备 ID': 'Device ID',
    '状态': 'Status',
    '房间': 'Room',
    '拖动排序': 'Drag to reorder',
    '拖动卡片可调整顺序，拖到其他房间可移动设备':
      'Drag cards to reorder, or drop into another room to move the device.',
    '恢复默认布局': 'Reset layout',
    '已恢复默认布局': 'Layout reset',
    '已保存': 'Saved',
    '图标已更新': 'Icon updated',
    '尺寸已调整': 'Size updated',

    // ---------- 房间管理 ----------
    '新建房间': 'New room',
    '新房间名称': 'Room name',
    '请输入房间名称': 'Enter a room name',
    '房间里还有设备': 'Room still has devices',
    '删除': 'Delete',
    '云端房间的新建/改名/搬设备对应 homeroom 接口，本版本未接入；以下操作仅作用于本地视图。':
      'Cloud room create/rename/move uses the homeroom API, not wired yet. These actions only affect the local view.',

    // ---------- Toast / 登录 ----------
    '演示功能': 'Demo action',
    '已重命名': 'Renamed',
    '新的设备名称': 'New device name',
    '新的房间名称': 'New room name',
    '新的音箱名称': 'New speaker name',
    '扫码登录': 'Sign in with QR',
    '等待手机确认…': 'Waiting for phone confirmation…',
    '二维码加载失败，点击下方重试': 'Failed to load QR code. Tap below to retry.',
    '获取二维码失败': 'Failed to get QR code',
    '登录成功，正在加载设备…': 'Signed in. Loading devices…',
    '扫码登录成功': 'Signed in successfully',
    '登录失败': 'Sign-in failed',
    '请用米家 App 扫描二维码': 'Scan the QR code with the Mi Home app',
    '当前是直接打开的静态页面（file://）。要扫码控制真实设备，请运行：':
      'This page is opened as a static file (file://). To control real devices, run:',
    '退出登录': 'Sign out',
    '退出只删除本机凭据，不影响手机上的米家 App。':
      'Signing out only removes local credentials; your Mi Home app is unaffected.',
    '当前数据全部为本地虚构，控制不会触达真实设备':
      'All data is local and simulated; controls never reach real devices',
    '扫码登录真实账号': 'Sign in to your account',
    '扫码登录 · 凭据仅保存在本机 data/credentials.json':
      'QR sign-in · credentials stay in data/credentials.json locally',
    '扫码登录为实验性能力：登录后可拉取真实设备列表并按 MIoT spec 自动生成控件；设备分页、部分型号真机兼容性仍需验证。':
      'QR sign-in is experimental: it pulls your real devices and generates controls from the MIoT spec. Pagination and some models still need verification.',

    // ---------- 音箱 ----------
    '没有找到小爱音箱': 'No Xiaoai speakers found',
    '账号下暂无音箱类设备': 'No speaker devices in this account',
    '演示家庭里应当有 3 台小爱音箱': 'The demo home should have 3 Xiaoai speakers',
    '设备': 'Devices',
    '重命名音箱': 'Rename speaker',
    '音量': 'Volume',
    '静音': 'Mute',
    '正在播放': 'Playing',
    '输出到此音箱 · 已暂停': 'Output to this speaker · Paused',
    '自身播放 · 状态未知': 'Playing locally · Unknown state',
    '上一首': 'Previous',
    '暂停': 'Pause',
    '继续': 'Resume',
    '下一首': 'Next',
    '无线模式': 'Wireless',
    '蓝牙 Mesh 网关': 'Bluetooth Mesh gateway',
    '蓝牙音频': 'Bluetooth audio',
    '关闭网关': 'Turn gateway off',
    '开启网关': 'Turn gateway on',
    '蓝牙配对': 'Pair',
    'DTS 音效': 'DTS sound',
    '澎湃': 'Punchy',
    '温和': 'Warm',
    '人声': 'Vocal',
    '组合立体声': 'Stereo pair',
    '解除组合': 'Unpair',
    '局域网可用': 'LAN available',
    '蓝牙 Mesh 网关已开启': 'Bluetooth Mesh gateway on',
    '蓝牙 Mesh 网关已关闭': 'Bluetooth Mesh gateway off',
    '蓝牙音频已开启': 'Bluetooth audio on',
    '已发送蓝牙配对请求（演示）': 'Bluetooth pairing request sent (demo)',
    '文字播报': 'Text announcement',

    // ---------- 投送 / 投屏 / 自动化 ----------
    '已连接 · 暂停': 'Connected · Paused',
    '可投送': 'Available',
    '本机扬声器': 'This computer',
    '点击目标即可切换播放输出；播放条中的「输出设备」会同步更新。':
      'Pick a target to switch playback output; the player bar updates accordingly.',
    '暂无投屏设备': 'No casting devices',
    '支持 Miracast / DLNA 的电视、盒子会显示在这里（演示）':
      'Miracast / DLNA TVs and boxes would appear here (demo)',
    '云端场景执行建设中': 'Cloud scenes coming soon',
    '真实账号下的场景列表与一键执行，对应云端 AppSceneService 接口，见 README 路线图。':
      'Scene listing and one-tap execution map to the AppSceneService API; see the README roadmap.',
    '执行': 'Run',
    '演示模式的场景会真实改动上方设备状态；云端模式对应「手动场景一键执行」。':
      'Demo scenes really change device states above; cloud mode maps to manual scene execution.',

    // ---------- 播放条 ----------
    '队列': 'Queue',
    '音质': 'Quality',
    '输出设备': 'Output',
    '高品': 'High',
    '无损': 'Lossless',
    '喜欢': 'Like',
    '随机播放': 'Shuffle',
    '上一曲': 'Previous',
    '下一曲': 'Next',
    '播放队列': 'Play queue',
    '播放/暂停': 'Play/Pause',
    '播放中': 'Playing',
    '已暂停': 'Paused',
    '已关机': 'Powered off',
    '当前湿度': 'Humidity',
    '水温': 'Water temp',
    '今日': 'Today',
    '电量': 'Battery',
    '累计': 'Total',

    // ---------- 通用 ----------
    '台设备': 'devices',
    '个家庭': 'homes',
    '智能洗': 'Smart wash',
    '快速洗': 'Quick wash',
    '单烘干': 'Dry only',
    '轻干洗': 'Light dry-clean',
    '随心洗': 'Custom wash',
    '迷你洗': 'Mini wash',
    '大件洗': 'Bulky wash',
    '漂洗+脱水': 'Rinse & spin',

    // ---------- 控件名（云端 spec 生成的中文名） ----------
    '模式': 'Mode',
    '灯光': 'Light',
    '灯光亮度': 'Brightness',
    '姿势调节': 'Position',
    '记忆位置一': 'Memory 1',
    '记忆位置二': 'Memory 2',
    '记忆一状态': 'Memory 1',
    '记忆二状态': 'Memory 2',
    '故障': 'Fault',
    '正常': 'Normal',
    '停止': 'Stop',
    '背部升起': 'Back up',
    '背部放下': 'Back down',
    '腿部升起': 'Leg up',
    '腿部放下': 'Leg down',
    '调用': 'Recall',
    '未记忆': 'Not saved',
    '已记忆': 'Saved',
    '零重力': 'Zero gravity',
    '防打鼾': 'Anti-snore',
    '阅读': 'Reading',
    '平躺': 'Flat',
    '亮 10 分钟': 'On for 10 min',
    '亮 8 小时': 'On for 8 hours',
    '亮 10 小时': 'On for 10 hours',
    '接入方式': 'Access mode',
    'IP 地址': 'IP address',
    'WiFi 名称': 'WiFi name',
    '设备 MAC 地址': 'MAC address',
    '屏显开关': 'Display',
    '无线 5GHz': 'Wi-Fi 5GHz',
    '无线 2.4GHz': 'Wi-Fi 2.4GHz',
    '有线': 'Wired',
    '亮度': 'Brightness',
    '色温': 'Color temp',
    '风速': 'Fan speed',
    '风向': 'Wind direction',
    '左右扫风': 'Swing',
    '上下扫风': 'Swing',
    '目标温度': 'Target temp',
    '目标湿度': 'Target humidity',
    '上电状态': 'Power-on state',
    '童锁': 'Child lock',
    '指示灯开关': 'Indicator',
    '夜灯开关': 'Night light',
    '灵动开关': 'Flex switch',
    '灵敏度': 'Sensitivity',
    '息屏时间': 'Screen timeout',
    '屏幕显示': 'Screen',
    '当前温度': 'Temperature',
    '湿度': 'Humidity',
    '电量': 'Battery',
    '档位': 'Level',
    '剩余时间': 'Time left',
    '功耗': 'Power usage',
    '功率': 'Power',
    '第一路': 'Gang 1',
    '第二路': 'Gang 2',
    '第三路': 'Gang 3',
    '第四路': 'Gang 4',
    '第五路': 'Gang 5',
    '第六路': 'Gang 6',
    '播放': 'Play',
    '暂停': 'Pause',
    '切换开关': 'Toggle',
  };

  /** 英文单复数：1 device / 2 devices */
  const plural = (n, word, many) => `${n} ${String(n) === '1' ? word : many || word + 's'}`;

  /** 动态文案规则（数字/时长等），按顺序尝试 */
  const RULES = [
    [/^「(.+)」还没有设备$/, (m) => `"${m[1]}" has no devices yet`],
    [/^(\d+) 台设备$/, (m) => plural(m[1], 'device')],
    [/^(\d+) 台设备 · 已隐藏 (\d+) 台$/, (m) => `${plural(m[1], 'device')} · ${m[2]} hidden`],
    [/^(\d+) 台设备 · (\d+) 个家庭$/, (m) => `${plural(m[1], 'device')} · ${plural(m[2], 'home')}`],
    [/^(\d+) 台设备 · (\d+) 个家庭 · (\d+) 首演示曲目$/,
      (m) => `${plural(m[1], 'device')} · ${plural(m[2], 'home')} · ${plural(m[3], 'demo track')}`],
    [/^(\d+)\/(\d+) 开启$/, (m) => `${m[1]}/${m[2]} on`],
    // 纯数字 + 中文单位（剩余时间、倒计时等），只匹配全数字，不会误伤正文
    [/^(\d+)\s*分$/, (m) => `${m[1]} min`],
    [/^(\d+)\s*小时$/, (m) => `${m[1]} h`],
    [/^(\d+)\s*秒$/, (m) => `${m[1]} s`],
    [/^(\d+)\s*天$/, (m) => `${m[1]} d`],
    [/^已开启 · 剩余 (.+)$/, (m) => `On · ${m[1]} left`],
    [/^已开启 · 目标 (.+)$/, (m) => `On · target ${m[1]}`],
    [/^已开启 · (.+)$/, (m) => `On · ${m[1]}`],
    [/^运行中 · (.+)$/, (m) => `Running · ${m[1]}`],
    [/^队列 (\d+) \/ (\d+)$/, (m) => `Queue ${m[1]} / ${m[2]}`],
    [/^正在播放 · (.+)$/, (m) => `Playing · ${m[1]}`],
    [/^小米账号 (.+)$/, (m) => `Xiaomi Account ${m[1]}`],
    [/^剩余 (.+)$/, (m) => `${m[1]} left`],
    [/^电量 (.+)$/, (m) => `Battery ${m[1]}`],
    [/^水温 (.+)$/, (m) => `Water ${m[1]}`],
    [/^今日 (.+)$/, (m) => `Today ${m[1]}`],
    [/^当前湿度 (.+)$/, (m) => `Humidity ${m[1]}`],
    [/^已开启 (.+)$/, (m) => `On ${m[1]}`],
    [/^已关闭 (.+)$/, (m) => `Off ${m[1]}`],
    [/^房间管理 · (.+)$/, (m) => `Rooms · ${m[1]}`],
    [/^设备 ID[：:]\s*(.+)$/, (m) => `Device ID: ${m[1]}`],
    [/^型号 (.+)$/, (m) => `Model ${m[1]}`],
    [/^房间已重命名为「(.+)」$/, (m) => `Room renamed to "${m[1]}"`],
    [/^已删除房间「(.+)」$/, (m) => `Room "${m[1]}" deleted`],
    [/^已创建房间「(.+)」$/, (m) => `Room "${m[1]}" created`],
    [/^已切换到「(.+)」$/, (m) => `Switched to "${m[1]}"`],
    [/^已发送「(.+)」$/, (m) => `Sent "${m[1]}"`],
    [/^已执行「(.+)」$/, (m) => `Executed "${m[1]}"`],
    [/^场景「(.+)」已执行$/, (m) => `Scene "${m[1]}" executed`],
    [/^(.+) 洗衣完成$/, (m) => `${m[1]} wash finished`],
    [/^下发失败：(.+)$/, (m) => `Command failed: ${m[1]}`],
    [/^执行失败：(.+)$/, (m) => `Execution failed: ${m[1]}`],
    [/^改名失败：(.+)$/, (m) => `Rename failed: ${m[1]}`],
    [/^音乐已投送到「(.+)」$/, (m) => `Casting to "${m[1]}"`],
    [/^DTS 音效：(.+)$/, (m) => `DTS sound: ${m[1]}`],
    [/^(.+)（演示）$/, (m) => `${m[1]} (demo)`],
    [/^(.+)已调整为 (.+)$/, (m) => `${m[1]} set to ${m[2]}`],
  ];

  let lang = 'zh';
  const listeners = [];

  function translateText(text) {
    if (!text) return text;
    const hit = EN[text];
    if (hit) return hit;
    for (const [re, fn] of RULES) {
      const m = re.exec(text);
      if (m) return fn(m);
    }
    return text;
  }

  function t(text, vars) {
    // 先填占位符再翻译：中文模板代入后才会变成「1 台设备」「「我的家」还没有设备」，
    // 这样 RULES 才能按实际数字决定单复数（反过来查模板表只能拿到固定复数 "devices"）
    let src = text;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        src = src.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      }
    }
    return lang === 'en' ? translateText(src) : src;
  }

  function apply(root) {
    if (lang !== 'en' || !root) return;
    // 文本节点（仅在真实 DOM 中可用；测试桩直接跳过）
    if (typeof document !== 'undefined' && document.createTreeWalker && typeof NodeFilter !== 'undefined') {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
      const nodes = [];
      let n;
      while ((n = walker.nextNode())) nodes.push(n);
      for (const node of nodes) {
        const raw = node.nodeValue;
        if (!raw || !/[\u4e00-\u9fff]/.test(raw)) continue;
        const parent = node.parentElement;
        if (parent && parent.closest && parent.closest('[data-no-i18n]')) continue;
        const trimmed = raw.trim();
        const out = translateText(trimmed);
        if (out !== trimmed) node.nodeValue = raw.replace(trimmed, out);
      }
    }
    // 属性
    if (root.querySelectorAll) {
      for (const el of Array.from(root.querySelectorAll('[title],[placeholder],[aria-label]'))) {
        if (el.closest && el.closest('[data-no-i18n]')) continue;
        for (const attr of ['title', 'placeholder', 'aria-label']) {
          const v = el.getAttribute && el.getAttribute(attr);
          if (!v || !/[\u4e00-\u9fff]/.test(v)) continue;
          const out = translateText(v);
          if (out !== v) el.setAttribute(attr, out);
        }
      }
    }
  }

  function setLang(next) {
    lang = next === 'en' ? 'en' : 'zh';
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('lang', lang === 'en' ? 'en' : 'zh-CN');
      document.documentElement.setAttribute('data-lang', lang);
      document.title = lang === 'en' ? 'Mijia & Xiaoai · Web' : '米家与小爱 · Web';
    }
    for (const fn of listeners) fn(lang);
  }

  function onChange(fn) { listeners.push(fn); }

  window.MijiaI18n = { t, apply, setLang, onChange, get lang() { return lang; }, dict: EN, RULES };
  window.t = t;
})();
