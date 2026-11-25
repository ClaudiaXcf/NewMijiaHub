'use strict';
/** 内联 SVG 图标集（stroke 风格，currentColor 上色）。 */
(function () {
  const svg = (inner, opts = {}) => {
    const size = opts.size || 24;
    const fill = opts.fill || 'none';
    const stroke = opts.stroke || 'currentColor';
    const w = opts.sw || 2;
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="${fill}" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
  };

  const I = {
    house: (o) => svg('<path d="M4 11l8-7 8 7"/><path d="M6 10v10h12V10"/><path d="M10 20v-6h4v6"/>', o),

    power: (o) => svg('<path d="M12 3v8"/><path d="M7.2 6.2a7 7 0 1 0 9.6 0"/>', o),
    refresh: (o) => svg('<path d="M4 10a8 8 0 0 1 13.7-3.5L20 8.5"/><path d="M20 4v4.5h-4.5"/><path d="M20 14a8 8 0 0 1-13.7 3.5L4 15.5"/><path d="M4 20v-4.5h4.5"/>', o),
    chevron: (o) => svg('<path d="M9 6l6 6-6 6"/>', o),
    x: (o) => svg('<path d="M6 6l12 12M18 6L6 18"/>', o),
    plus: (o) => svg('<path d="M12 5v14M5 12h14"/>', o),
    minus: (o) => svg('<path d="M5 12h14"/>', o),
    maximize: (o) => svg('<rect x="5" y="5" width="14" height="14" rx="1.5"/>', o),
    close: (o) => svg('<path d="M6 6l12 12M18 6L6 18"/>', o),
    search: (o) => svg('<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>', o),

    play: (o) => svg('<path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none"/>', { sw: 0, ...o }),
    pause: (o) => svg('<rect x="7" y="5" width="3.6" height="14" rx="1" fill="currentColor" stroke="none"/><rect x="13.4" y="5" width="3.6" height="14" rx="1" fill="currentColor" stroke="none"/>', { sw: 0, ...o }),
    prev: (o) => svg('<path d="M18 5.5v13L9 12z" fill="currentColor" stroke="none"/><rect x="5" y="5.5" width="2.4" height="13" rx="1" fill="currentColor" stroke="none"/>', { sw: 0, ...o }),
    next: (o) => svg('<path d="M6 5.5v13l9-6.5z" fill="currentColor" stroke="none"/><rect x="16.6" y="5.5" width="2.4" height="13" rx="1" fill="currentColor" stroke="none"/>', { sw: 0, ...o }),
    heart: (o) => svg('<path d="M12 20s-7-4.6-9-9c-1.2-2.8.8-6 4-6 1.8 0 3.2 1 5 3.2C13.8 6 15.2 5 17 5c3.2 0 5.2 3.2 4 6-2 4.4-9 9-9 9z"/>', o),
    heartFill: (o) => svg('<path d="M12 20s-7-4.6-9-9c-1.2-2.8.8-6 4-6 1.8 0 3.2 1 5 3.2C13.8 6 15.2 5 17 5c3.2 0 5.2 3.2 4 6-2 4.4-9 9-9 9z" fill="currentColor" stroke="currentColor"/>', o),
    shuffle: (o) => svg('<path d="M3 7h3.5c1.6 0 2.6.8 3.7 2.2"/><path d="M3 17h3.5c1.6 0 2.6-.8 3.7-2.2"/><path d="M13.5 9.2c1-1.4 2-2.2 3.8-2.2H20"/><path d="M13.5 14.8c1 1.4 2 2.2 3.8 2.2H20"/><path d="M18 4.5L20.5 7 18 9.5"/><path d="M18 14.5L20.5 17 18 19.5"/>', o),
    queue: (o) => svg('<path d="M4 7h11M4 12h11M4 17h7"/><circle cx="18" cy="15" r="3"/><path d="M21 15V6l1.5 1"/>', o),
    volume: (o) => svg('<path d="M4 9.5h3L11 6v12l-4-3.5H4z"/><path d="M14.5 9.5a4 4 0 0 1 0 5"/><path d="M17 7a7.5 7.5 0 0 1 0 10"/>', o),
    volumeMute: (o) => svg('<path d="M4 9.5h3L11 6v12l-4-3.5H4z"/><path d="M15 9.5l5 5M20 9.5l-5 5"/>', o),
    music: (o) => svg('<path d="M9 17V5.5l10-2V15"/><circle cx="6.5" cy="17" r="2.5"/><circle cx="16.5" cy="15" r="2.5"/>', o),
    note: (o) => svg('<path d="M9 17V5.5l10-2V15"/><circle cx="6.5" cy="17" r="2.5"/><circle cx="16.5" cy="15" r="2.5"/>', o),

    moon: (o) => svg('<path d="M20 13.5A8 8 0 0 1 10.5 4 8 8 0 1 0 20 13.5z"/>', o),
    sun: (o) => svg('<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3L7 7M17 17l1.7 1.7M18.7 5.3L17 7M7 17l-1.7 1.7"/>', o),

    person: (o) => svg('<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c1.2-3.5 4-5.5 7.5-5.5s6.3 2 7.5 5.5"/>', o),
    bolt: (o) => svg('<path d="M13 2L4.5 14H10l-1 8 9.5-12H13l1-8z"/>', o),
    phone: (o) => svg('<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M10.5 18.5h3"/>', o),
    cast: (o) => svg('<path d="M4 17a3 3 0 0 1 3 3"/><path d="M4 13a7 7 0 0 1 7 7"/><path d="M4 9a11 11 0 0 1 11 11"/><path d="M3 5h18v14h-8"/>', o),
    speaker: (o) => svg('<rect x="5" y="2.5" width="14" height="19" rx="3"/><circle cx="12" cy="14" r="3.4"/><circle cx="12" cy="7" r="1.4" fill="currentColor" stroke="none"/>', o),
    devicesGrid: (o) => svg('<rect x="3.5" y="3.5" width="7" height="7" rx="1.8"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.8"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.8"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.8"/>', o),

    lamp: (o) => svg('<rect x="3" y="7" width="18" height="4.5" rx="2.2"/><path d="M12 11.5V19"/><path d="M8 19h8"/><path d="M7 3.5c1-.8 2.5-1.3 5-1.3s4 .5 5 1.3"/>', o),
    monitor: (o) => svg('<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M12 16v4M8 20h8"/>', o),
    sensor: (o) => svg('<path d="M10 4a2 2 0 0 1 4 0v9.2a4.3 4.3 0 1 1-4 0z"/><path d="M12 8v6"/><path d="M17 5.5c.6.8 1 1.6 1 2.5M20 4c1 1.4 1.6 2.7 1.6 4"/>', o),
    washer: (o) => svg('<rect x="4" y="3" width="16" height="18" rx="2.5"/><path d="M6.5 6.5h4"/><circle cx="12" cy="13.5" r="4.8"/><path d="M8.5 11.5c.8 1 2.2 1.6 3.5 1.6s2.7-.6 3.5-1.6"/>', o),
    heater: (o) => svg('<rect x="5" y="2.5" width="14" height="19" rx="2.5"/><path d="M12 8.5c-2.2 2.3-3.2 3.4-3.2 5.2a3.2 3.2 0 0 0 6.4 0c0-1.8-1-2.9-3.2-5.2z"/><path d="M7 5.5h3"/>', o),
    humidifier: (o) => svg('<rect x="7" y="9" width="10" height="11.5" rx="2.5"/><path d="M9.2 9c0-2.8 1.2-3.6 2.8-6 1.6 2.4 2.8 3.2 2.8 6"/><path d="M12 13.5v4"/>', o),
    footbath: (o) => svg('<path d="M6 8h12l-1.6 11.2a2 2 0 0 1-2 1.8H9.6a2 2 0 0 1-2-1.8z"/><path d="M8.5 8c0-2.2 1.3-3.5 3.5-3.5S15.5 5.8 15.5 8"/><path d="M9.5 13c.8.7 1.7.7 2.5 0s1.7-.7 2.5 0"/>', o),
    plug: (o) => svg('<path d="M9 3v5M15 3v5"/><path d="M6.5 8h11v3a5.5 5.5 0 0 1-11 0z"/><path d="M12 16.5V21"/>', o),
    ac: (o) => svg('<rect x="3" y="4.5" width="18" height="8" rx="2"/><path d="M6 8.5h9"/><path d="M7 16c.6 1.2 1.4 1.2 2 2.5M11 16c.6 1.2 1.4 1.2 2 2.5M15 16c.6 1.2 1.4 1.2 2 2.5"/>', o),
    airpurifier: (o) => svg('<rect x="5" y="3" width="14" height="18" rx="2.5"/><circle cx="12" cy="12" r="4"/><path d="M8 6.5h8"/>', o),
    tv: (o) => svg('<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 20.5h8M12 17v3.5"/>', o),
    fan: (o) => svg('<circle cx="12" cy="12" r="2"/><path d="M12 10c0-4 1.5-6 3.5-6S18 7 14 9.5"/><path d="M14 12c4 0 6 1.5 6 3.5s-3 2.5-5.5-1.5"/><path d="M10 14c0 4-1.5 6-3.5 6S6 17 10 14.5"/><path d="M10 12c-4 0-6-1.5-6-3.5S7 6 9.5 10"/>', o),
    curtain: (o) => svg('<path d="M4 4h16"/><path d="M6 4c0 7 1.5 12 2.5 16M18 4c0 7-1.5 12-2.5 16"/><path d="M6 4c3 3 9 3 12 0"/>', o),
    bathheater: (o) => svg('<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 7.5c-2 2.2-3 3.2-3 4.8a3 3 0 0 0 6 0c0-1.6-1-2.6-3-4.8z"/><path d="M9 18h6"/>', o),
    fridge: (o) => svg('<rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M6 9.5h12"/><path d="M9 5.5v2M9 12.5v3"/>', o),
    cooker: (o) => svg('<rect x="4" y="7" width="16" height="13" rx="2.5"/><path d="M4 7c1-2.5 3-4 8-4s7 1.5 8 4"/><circle cx="12" cy="13.5" r="3.5"/>', o),
    kettle: (o) => svg('<path d="M7 8h10l-1 12H8z"/><path d="M9 8V5.5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2V8"/><path d="M17 9.5l3-2v7l-3-1.5"/>', o),
    airer: (o) => svg('<path d="M4 4h16"/><path d="M7 4v14M17 4v14"/><path d="M7 8h10M7 13h10"/><path d="M9 18v2.5M15 18v2.5M12 18v2.5"/>', o),
    router: (o) => svg('<rect x="3" y="14" width="18" height="7" rx="2"/><path d="M8 14v-2.5"/><circle cx="7" cy="17.5" r="1" fill="currentColor" stroke="none"/><path d="M8 4.5a6 6 0 0 1 8 0M10 7a3.5 3.5 0 0 1 4 0"/>', o),
    door: (o) => svg('<rect x="6" y="3" width="12" height="18" rx="1.5"/><circle cx="15" cy="12" r="1" fill="currentColor" stroke="none"/>', o),
    camera: (o) => svg('<rect x="3" y="7" width="13" height="10" rx="2.5"/><path d="M16 10.5l5-2.5v8l-5-2.5"/><circle cx="9.5" cy="12" r="2"/>', o),
    vacuum: (o) => svg('<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.5"/><path d="M12 5V3M12 21v-2M5 12H3M21 12h-2"/>', o),
    clock: (o) => svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3.5 2"/>', o),
    scale: (o) => svg('<rect x="4" y="3" width="16" height="18" rx="3"/><path d="M12 8v6M9.5 13.5L12 16l2.5-2.5"/>', o),

    // ---- 灯具细分 ----
    ceilingLamp: (o) => svg('<path d="M12 2v4"/><path d="M5 13l3-7h8l3 7z"/><path d="M5 13h14"/><path d="M9 20h6"/>', o),
    deskLamp: (o) => svg('<path d="M5 20h8"/><path d="M9 20v-6"/><path d="M9 14l4-9h5l-4 9z"/><path d="M18 5l2 1"/>', o),
    floorLamp: (o) => svg('<path d="M9 3h6l-1.5 9h-3z"/><path d="M12 12v7"/><path d="M8 21h8"/>', o),
    stripLight: (o) => svg('<path d="M3 16c6 0 6-6 12-6 3 0 4.5 1.5 6 3"/><path d="M3 19c6 0 6-6 12-6"/>', o),
    spotlight: (o) => svg('<path d="M8 4h8l-2 6H10z"/><path d="M12 10v3"/><path d="M9 18a3 3 0 0 0 6 0z"/>', o),
    mirrorLight: (o) => svg('<ellipse cx="12" cy="10" rx="6" ry="7"/><path d="M12 17v4M9 21h6"/>', o),

    // ---- 开关 / 插座 / 网关 ----
    switchPanel: (o) => svg('<rect x="5" y="3" width="14" height="18" rx="2"/><rect x="8" y="6" width="3" height="5" rx="1"/><rect x="13" y="6" width="3" height="5" rx="1"/><rect x="8" y="13" width="3" height="5" rx="1"/>', o),
    gateway: (o) => svg('<rect x="4" y="10" width="16" height="10" rx="2.5"/><path d="M8 10V7"/><circle cx="8" cy="15" r="1" fill="currentColor" stroke="none"/><path d="M12 15h5"/><path d="M9 7a5 5 0 0 1 6 0"/>', o),
    doorLock: (o) => svg('<rect x="5" y="3" width="14" height="18" rx="2"/><circle cx="12" cy="9" r="2.5"/><path d="M12 11.5V15"/>', o),
    doorbell: (o) => svg('<rect x="7" y="3" width="10" height="18" rx="3"/><circle cx="12" cy="9" r="2.5"/><path d="M10 16h4"/>', o),

    // ---- 家电 ----
    bed: (o) => svg('<path d="M3 18V7"/><path d="M3 12h18v6"/><path d="M7 12V9.5h5V12"/><path d="M3 18h18"/>', o),
    projector: (o) => svg('<rect x="3" y="8" width="18" height="10" rx="2"/><circle cx="16" cy="13" r="1.6"/><path d="M7 18v2M17 18v2"/>', o),
    waterPurifier: (o) => svg('<rect x="6" y="3" width="12" height="18" rx="2.5"/><path d="M9 3v4h6V3"/><path d="M12 11c-1.5 1.8-2.2 2.6-2.2 3.8a2.2 2.2 0 1 0 4.4 0c0-1.2-.7-2-2.2-3.8z"/>', o),
    dishwasher: (o) => svg('<rect x="4" y="3" width="16" height="18" rx="2.5"/><path d="M4 8h16"/><circle cx="12" cy="14" r="3.5"/><path d="M7 5.5h3"/>', o),
    rangeHood: (o) => svg('<path d="M4 10h16l-2-5H6z"/><path d="M6 10v4h12v-4"/><path d="M10 14v3M14 14v3"/>', o),
    oven: (o) => svg('<rect x="4" y="3" width="16" height="18" rx="2.5"/><path d="M4 8h16"/><rect x="7" y="11" width="10" height="7" rx="1.5"/><path d="M8 5.5h2M13 5.5h3"/>', o),
    microwave: (o) => svg('<rect x="3" y="6" width="18" height="12" rx="2"/><rect x="6" y="9" width="8" height="6" rx="1"/><circle cx="17.5" cy="12" r="1"/>', o),
    induction: (o) => svg('<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="9" cy="12" r="3"/><path d="M16 10v4M19 10v4"/>', o),
    dehumidifier: (o) => svg('<rect x="6" y="4" width="12" height="17" rx="2.5"/><path d="M9 8h6"/><path d="M12 11c-1.2 1.5-1.8 2.2-1.8 3.3a1.8 1.8 0 1 0 3.6 0c0-1.1-.6-1.8-1.8-3.3z"/>', o),
    coffee: (o) => svg('<path d="M5 8h12v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z"/><path d="M17 9h2.5a2 2 0 0 1 0 4H17"/><path d="M8 5c0-1 .8-1.5.8-2.5"/>', o),

    // ---- 传感器 ----
    motion: (o) => svg('<path d="M6 6a8 8 0 0 0 0 12"/><path d="M10 8a5 5 0 0 0 0 8"/><circle cx="15" cy="12" r="1.6"/>', o),
    smoke: (o) => svg('<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 5V3M12 21v-2M5 12H3M21 12h-2"/>', o),
    waterLeak: (o) => svg('<path d="M12 3c-4 5-6 7-6 10a6 6 0 0 0 12 0c0-3-2-5-6-10z"/><path d="M9 14h6"/>', o),
    gas: (o) => svg('<rect x="6" y="10" width="12" height="8" rx="2"/><path d="M10 10V6h4v4"/><circle cx="12" cy="14" r="2"/>', o),
    blind: (o) => svg('<path d="M4 4h16"/><path d="M6 4v16M18 4v16"/><path d="M6 8h12M6 12h12M6 16h12"/>', o),

    // ---- 数码 / 个护 ----
    printer: (o) => svg('<rect x="6" y="3" width="12" height="5" rx="1"/><rect x="3" y="8" width="18" height="8" rx="2"/><rect x="7" y="13" width="10" height="7" rx="1"/>', o),
    laptop: (o) => svg('<rect x="4" y="5" width="16" height="10" rx="2"/><path d="M2.5 18.5h19"/>', o),
    tablet: (o) => svg('<rect x="5" y="2.5" width="14" height="19" rx="2.5"/><path d="M10.5 18.5h3"/>', o),
    watch: (o) => svg('<rect x="7" y="6" width="10" height="12" rx="3"/><path d="M9 6V3h6v3M9 18v3h6v-3"/><path d="M12 10v2.5l1.5 1"/>', o),
    toothbrush: (o) => svg('<rect x="9" y="2.5" width="6" height="8" rx="2"/><path d="M11 10.5V20M13 10.5V20"/><path d="M9 20h6"/>', o),
    treadmill: (o) => svg('<path d="M3 18h18"/><path d="M6 18l3-8h6l3 8"/><path d="M9 10l-2-5h4"/>', o),

    // ---- 界面 ----
    grip: (o) => svg('<circle cx="9" cy="6" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="6" r="1.3" fill="currentColor" stroke="none"/><circle cx="9" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="9" cy="18" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="18" r="1.3" fill="currentColor" stroke="none"/>', o),
    chevronDown: (o) => svg('<path d="M6 9l6 6 6-6"/>', o),
    chevronUp: (o) => svg('<path d="M6 15l6-6 6 6"/>', o),
    dragMove: (o) => svg('<path d="M12 3v18M3 12h18"/><path d="M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3"/>', o),
    palette: (o) => svg('<path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 1.4-2-.7-1.2.2-2.5 1.6-2.5H17a4 4 0 0 0 4-4c0-5-4-9.5-9-9.5z"/><circle cx="8.5" cy="10" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="7.5" r="1" fill="currentColor" stroke="none"/><circle cx="15.5" cy="10" r="1" fill="currentColor" stroke="none"/>', o),
    resize: (o) => svg('<path d="M4 9V4h5M20 15v5h-5"/><path d="M4 4l6 6M20 20l-6-6"/>', o),
    globe: (o) => svg('<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17"/><path d="M12 3.5c2.5 2.4 3.8 5.3 3.8 8.5s-1.3 6.1-3.8 8.5c-2.5-2.4-3.8-5.3-3.8-8.5S9.5 5.9 12 3.5z"/>', o),

    generic: (o) => svg('<circle cx="12" cy="12" r="8.5"/><path d="M8 12h8M12 8v8"/>', o),

    qr: (o) => svg('<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2.5v2.5H14zM18.5 14H21M14 18v3M18 17.5h3M17.5 21h3.5"/>', o),
    check: (o) => svg('<path d="M5 12.5l4.5 4.5L19 7"/>', o),
    warn: (o) => svg('<path d="M12 3L2.5 20h19z"/><path d="M12 9.5v5M12 17.5v.5"/>', o),
    gear: (o) => svg('<circle cx="12" cy="12" r="3"/><path d="M12 2.8l1.2 2.6 2.8-.6.5 2.8 2.6 1.2-1.7 2.3 1.7 2.3-2.6 1.2-.5 2.8-2.8-.6L12 21.2l-1.2-2.6-2.8.6-.5-2.8-2.6-1.2 1.7-2.3-1.7-2.3 2.6-1.2.5-2.8 2.8.6z"/>', o),
    pencil: (o) => svg('<path d="M4 20l.8-3.2L16.5 5.1a2 2 0 0 1 2.8 0l-.4-.4a2 2 0 0 1 0 2.8L7.2 19.2 4 20z"/>', o),
    sparkle: (o) => svg('<path d="M12 4l1.7 4.3L18 10l-4.3 1.7L12 16l-1.7-4.3L6 10l4.3-1.7z"/><path d="M18.5 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>', o),
    wind: (o) => svg('<path d="M3 8h9.5a2.5 2.5 0 1 0-2.4-3.2"/><path d="M3 12h13.5a2.5 2.5 0 1 1-2.4 3.2"/><path d="M3 16h7.5"/>', o),
    feather: (o) => svg('<path d="M20 4c-1 3-5 7-8 8l-4 4"/><path d="M8 16l-2 4"/><path d="M9 15l6-6M12 18l6-6M15 20l5-5"/>', o),
    timer: (o) => svg('<circle cx="12" cy="13" r="7.5"/><path d="M12 9.5V13l2.5 1.5"/><path d="M9.5 3h5"/>', o),
    bluetooth: (o) => svg('<path d="M6.5 8.5L17 16l-5 4V4l5 4L6.5 15.5"/>', o),
    castScreen: (o) => svg('<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 20.5h8"/>', o),
    mic: (o) => svg('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0"/><path d="M12 17.5V21"/>', o),
    chat: (o) => svg('<path d="M4 5.5h16v11H10l-4.5 3.5v-3.5H4z"/>', o),
    sleep: (o) => svg('<path d="M20 13.5A8 8 0 0 1 10.5 4 8 8 0 1 0 20 13.5z"/><path d="M14.5 4.5l1 2 2 1-2 1-1 2-1-2-2-1 2-1z"/>', o),
    alarm: (o) => svg('<circle cx="12" cy="13" r="7.5"/><path d="M12 9.5V13l2.5 1.5"/><path d="M5.5 3.5L3 5.5M18.5 3.5L21 5.5"/>', o),
    info: (o) => svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5"/><path d="M12 8v.5"/>', o),
    deviceInfo: (o) => svg('<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M10.5 5h3"/><path d="M12 9.5v5"/><path d="M12 17v.5"/>', o),
  };

  window.Icons = I;
  window.icon = (name, o) => (I[name] || I.generic)(o);
})();
