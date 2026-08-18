/* ============================================================
   数据层 — 纯前端 localStorage 持久化
   所有业务数据存于浏览器本地，刷新/关闭/重启不丢失。
   同一设备同源共享；跨设备用「导出/导入备份」手动迁移。
   兼容 Node(测试用 localStorage shim)。
   ============================================================ */
(function (root) {
  'use strict';

  var KEY = 'sale_erp_v1_state';
  var SCHEMA = 1;
  /* localStorage 在隐私模式 / 部分 file:// 环境（如 jsdom 的 opaque origin）下访问会抛 SecurityError，
     此时退化为内存 shim，保证应用不崩溃（真实浏览器 file:// 仍可正常读写 localStorage）。 */
  var STORE;
  try {
    STORE = localStorage;
    if (!STORE || typeof STORE.getItem !== 'function') STORE = null;
  } catch (e) { STORE = null; }
  if (!STORE) STORE = root.__ls || (root.__ls = makeShim());

  /* 业务集合清单：导入补齐、载入自愈都以此为准 */
  var COLLECTIONS = ['products', 'customers', 'suppliers', 'sales', 'purchases', 'stockLogs', 'finance'];
  /* 虚拟往来主体：无客户的销售单归「散客」，无供应商的进货单归「其他供应商」 */
  var WALKIN_ID = '__walkin__';
  var NOSUP_ID = '__nosupplier__';
  var DEFAULT_SETTINGS = { shopName: '家电批发中心', lowStock: 10, currency: '¥', lastExportAt: '', firstRunDone: false, snapSeq: 0 };
  /* localStorage 通用上限约 5MB（各浏览器略有差异，仅用于占用比例展示） */
  var STORE_LIMIT = 5 * 1024 * 1024;

  function makeShim() {
    var m = {};
    return {
      getItem: function (k) { return k in m ? m[k] : null; },
      setItem: function (k, v) { m[k] = String(v); },
      removeItem: function (k) { delete m[k]; }
    };
  }

  var state = null;

  function todayStr(d) {
    d = d || new Date();
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  /* ---------------- 金额精度（S1-04） ----------------
     全部金额落库前一律 round2，避免浮点残留导致单据永远无法结清。 */
  function round2(n) {
    n = Number(n);
    if (!isFinite(n)) return 0;
    return Math.round(n * 100) / 100;
  }
  /** 是否已结清：容差 0.5 分 */
  function isPaidOff(o) { return Number(o.paid || 0) >= Number(o.total || 0) - 0.005; }
  function assign(target) {
    for (var i = 1; i < arguments.length; i++) {
      var src = arguments[i]; if (!src) continue;
      for (var k in src) if (Object.prototype.hasOwnProperty.call(src, k)) target[k] = src[k];
    }
    return target;
  }

  function load() {
    try { state = JSON.parse(STORE.getItem(KEY)); } catch (e) { state = null; }
    if (!state || !state.products) state = null;
  }

  /* ---------------- 持久化（S1-06 BUG-05） ----------------
     写入失败（配额耗尽 / 隐私模式）不再静默丢数据：
     - 不向业务层抛异常（避免开单流程中断）
     - 通过 onPersistError 回调让 UI 常驻提示用户导出备份 */
  var onPersistError = null;
  var lastPersistOk = true;

  function persist() {
    try {
      STORE.setItem(KEY, JSON.stringify(state));
      lastPersistOk = true;
      return true;
    } catch (e) {
      lastPersistOk = false;
      var quota = /quota|exceed/i.test((e && e.name || '') + (e && e.message || ''));
      var msg = quota
        ? '本地存储已满，数据未保存！请立即到「数据管理」导出备份，再清理历史流水。'
        : '数据保存失败，本次改动未保存：' + (e && e.message || e) + '（可能处于隐私模式）。请尽快导出备份。';
      if (typeof onPersistError === 'function') {
        try { onPersistError(msg, e); } catch (ignore) { /* UI 回调异常不应影响业务 */ }
      }
      return false;
    }
  }

  /** 探测本地存储是否可正常写入（立即重试一次持久化） */
  function persistOk() { return persist(); }

  /** 当前占用与估算上限，供数据管理页展示进度条 */
  function storageInfo() {
    ensure();
    var used = 0;
    try { used = JSON.stringify(state).length; } catch (e) { used = 0; }
    var stored = 0;
    try { stored = (STORE.getItem(KEY) || '').length; } catch (e) { stored = 0; }
    return {
      used: used,
      stored: stored,
      limit: STORE_LIMIT,
      percent: round2(used / STORE_LIMIT * 100),
      ok: lastPersistOk
    };
  }

  /* ---------------- 种子数据 ---------------- */
  function seed() {
    var products = [
      { name: '海尔 冰箱 BCD-216', brand: '海尔', model: 'BCD-216STPT', type: '冰箱', unit: '台', priceWholesale: 1899, priceRetail: 2199, stock: 42, lowStock: 10 },
      { name: '美的 空调 KFR-35', brand: '美的', model: 'KFR-35GW', type: '空调', unit: '台', priceWholesale: 2299, priceRetail: 2599, stock: 8, lowStock: 10 },
      { name: '小米 电视 65" Pro', brand: '小米', model: 'L65M7', type: '电视', unit: '台', priceWholesale: 2799, priceRetail: 2999, stock: 58, lowStock: 8 },
      { name: '格力 电风扇 FS-40', brand: '格力', model: 'FS-40', type: '风扇', unit: '台', priceWholesale: 129, priceRetail: 159, stock: 120, lowStock: 20 },
      { name: '九阳 豆浆机 DJ13B', brand: '九阳', model: 'DJ13B', type: '豆浆机', unit: '台', priceWholesale: 299, priceRetail: 359, stock: 5, lowStock: 12 },
      { name: '飞利浦 剃须刀 S5000', brand: '飞利浦', model: 'S5000', type: '剃须刀', unit: '个', priceWholesale: 399, priceRetail: 499, stock: 36, lowStock: 10 },
      { name: '西门子 洗衣机 WM12P', brand: '西门子', model: 'WM12P', type: '洗衣机', unit: '台', priceWholesale: 3199, priceRetail: 3599, stock: 15, lowStock: 5 },
      { name: 'TCL 电视 55"', brand: 'TCL', model: 'L55C', type: '电视', unit: '台', priceWholesale: 1799, priceRetail: 1999, stock: 30, lowStock: 8 }
    ].map(function (p) { p.id = uid(); return p; });

    var customers = [
      { name: '星辰家电批发部', phone: '13800001111', address: '本市高新区批发城 12 号' },
      { name: '利民连锁超市', phone: '13900002222', address: '和平路 88 号' },
      { name: '张伟（零售）', phone: '13700003333', address: '幸福小区 3 栋' }
    ].map(function (c) { c.id = uid(); return c; });

    var suppliers = [
      { name: '海尔华北总代', phone: '010-80001234', address: '北京亦庄经开区' },
      { name: '美的电器批发', phone: '0755-80005678', address: '佛山顺德工业园' },
      { name: '小米授权渠道', phone: '010-80009090', address: '北京清河' }
    ].map(function (s) { s.id = uid(); return s; });

    var sales = [], purchases = [], stockLogs = [], finance = [];

    // 近 7 天生成示例销售/采购，使看板有数据
    function dayOffset(n) { var d = new Date(); d.setDate(d.getDate() - n); return todayStr(d); }

    var sampleSales = [
      { ci: 0, day: 0, items: [[0, 2, 1899], [2, 1, 2799]], paid: 6597, method: '微信' },
      { ci: 1, day: 1, items: [[3, 10, 129], [5, 4, 399]], paid: 0, method: '欠款' },
      { ci: 2, day: 1, items: [[1, 1, 2299]], paid: 1500, method: '现金' },
      { ci: 0, day: 2, items: [[6, 1, 3199], [2, 2, 2799]], paid: 8797, method: '支付宝' },
      { ci: 1, day: 3, items: [[3, 6, 129]], paid: 774, method: '微信' },
      { ci: 2, day: 4, items: [[4, 3, 299], [5, 2, 399]], paid: 0, method: '欠款' },
      { ci: 0, day: 5, items: [[2, 3, 2799], [7, 2, 1799]], paid: 11995, method: '银行' }
    ];
    sampleSales.forEach(function (s) {
      var items = s.items.map(function (it) {
        var p = products[it[0]];
        return { productId: p.id, name: p.name, unit: p.unit, qty: it[1], price: it[2], subtotal: it[1] * it[2] };
      });
      var total = items.reduce(function (a, b) { return a + b.subtotal; }, 0);
      var id = uid();
      sales.push({ id: id, no: 'S' + dayOffset(s.day).replace(/-/g, '') + Math.floor(Math.random() * 900 + 100), date: dayOffset(s.day), ts: Date.now() - s.day * 86400000, customerId: customers[s.ci].id, customerName: customers[s.ci].name, items: items, discount: 0, total: total, paid: Math.min(s.paid, total), method: s.method });
      items.forEach(function (it) { stockLogs.push({ id: uid(), date: dayOffset(s.day), type: 'out', productId: it.productId, productName: it.name, qty: it.qty, remark: '销售出库 ' + sales[sales.length - 1].no }); });
      if (s.paid > 0) finance.push({ id: uid(), date: dayOffset(s.day), type: 'receive', party: customers[s.ci].name, amount: Math.min(s.paid, total), remark: '销售收款 ' + sales[sales.length - 1].no });
    });

    var samplePurch = [
      { si: 0, day: 2, items: [[0, 20, 1700], [6, 5, 3000]], paid: 49000, method: '银行' },
      { si: 1, day: 4, items: [[2, 30, 2600], [7, 15, 1700]], paid: 0, method: '欠款' },
      { si: 2, day: 6, items: [[3, 50, 110], [4, 10, 280]], paid: 8300, method: '微信' }
    ];
    samplePurch.forEach(function (pu) {
      var items = pu.items.map(function (it) {
        var p = products[it[0]];
        return { productId: p.id, name: p.name, unit: p.unit, qty: it[1], price: it[2], subtotal: it[1] * it[2] };
      });
      var total = items.reduce(function (a, b) { return a + b.subtotal; }, 0);
      var id = uid();
      purchases.push({ id: id, no: 'P' + dayOffset(pu.day).replace(/-/g, '') + Math.floor(Math.random() * 900 + 100), date: dayOffset(pu.day), ts: Date.now() - pu.day * 86400000, supplierId: suppliers[pu.si].id, supplierName: suppliers[pu.si].name, items: items, discount: 0, total: total, paid: Math.min(pu.paid, total), method: pu.method });
      items.forEach(function (it) {
        var pr = products.find(function (x) { return x.id === it.productId; });
        pr.stock += it.qty;
        stockLogs.push({ id: uid(), date: dayOffset(pu.day), type: 'in', productId: it.productId, productName: it.name, qty: it.qty, remark: '采购入库 ' + purchases[purchases.length - 1].no });
      });
      if (pu.paid > 0) finance.push({ id: uid(), date: dayOffset(pu.day), type: 'pay', party: suppliers[pu.si].name, amount: Math.min(pu.paid, total), remark: '采购付款 ' + purchases[purchases.length - 1].no });
    });

    state = {
      settings: { shopName: '家电批发中心', lowStock: 10, currency: '¥' },
      products: products,
      customers: customers,
      suppliers: suppliers,
      sales: sales,
      purchases: purchases,
      stockLogs: stockLogs,
      finance: finance
    };
    persist();
  }

  function ensure() {
    if (!state) { load(); if (!state) seed(); }
    normalize();
  }

  /** 自愈：老版本备份或残缺数据缺失集合时补空数组，避免 push 崩溃（BUG-04 连带） */
  function normalize() {
    if (!state) return;
    for (var i = 0; i < COLLECTIONS.length; i++) {
      if (!Array.isArray(state[COLLECTIONS[i]])) state[COLLECTIONS[i]] = [];
    }
    state.settings = assign({}, DEFAULT_SETTINGS, state.settings || {});
  }

  /* ---------------- 通用 CRUD ---------------- */
  function all(col) { ensure(); return state[col] || []; }
  function get(col, id) { ensure(); return (state[col] || []).filter(function (x) { return x.id === id; })[0]; }
  function insert(col, obj) { ensure(); obj.id = obj.id || uid(); state[col] = state[col] || []; state[col].push(obj); persist(); return obj; }
  /** 批量插入：只在全部完成后持久化一次，避免大数据量时反复写 localStorage 导致卡顿 */
  function insertBatch(col, objects) {
    ensure();
    state[col] = state[col] || [];
    var inserted = [];
    for (var i = 0; i < objects.length; i++) {
      var obj = objects[i];
      obj.id = obj.id || uid();
      state[col].push(obj);
      inserted.push(obj);
    }
    persist();
    return inserted;
  }
  function update(col, id, patch) {
    ensure(); var arr = state[col] || [];
    for (var i = 0; i < arr.length; i++) { if (arr[i].id === id) { for (var k in patch) arr[i][k] = patch[k]; persist(); return arr[i]; } }
    return null;
  }
  function remove(col, id) {
    ensure(); state[col] = (state[col] || []).filter(function (x) { return x.id !== id; }); persist();
  }

  /* ---------------- 业务操作 ---------------- */
  function orderStatus(o) {
    if (isPaidOff(o)) return 'paid';
    if (Number(o.paid || 0) <= 0.005) return 'unpaid';
    return 'partial';
  }

  /** 校验单据行，返回标准化后的行；不合法直接抛错（零写入） */
  function normalizeLines(rawItems) {
    var lines = (rawItems || []).filter(function (it) { return it && it.productId && Number(it.qty) > 0; });
    if (!lines.length) {
      var e0 = new Error('单据没有有效商品行');
      e0.code = 'EMPTY_ITEMS';
      throw e0;
    }
    return lines.map(function (it) {
      return { productId: it.productId, qty: Number(it.qty), price: round2(it.price) };
    });
  }

  /**
   * 销售开单 —— 事务式（S1-02 BUG-02）
   * 先按商品合并需求量做全量库存校验，任一行不足则整单拒绝、零写入；
   * 校验通过后才写单据 / 扣库存 / 记流水。
   */
  function recordSale(p) {
    ensure();
    var lines = normalizeLines(p.items);

    // 1) 预校验：同一商品拆成多行也要合并后判断
    var need = {};
    lines.forEach(function (it) { need[it.productId] = (need[it.productId] || 0) + it.qty; });
    var short = [];
    Object.keys(need).forEach(function (pid) {
      var prod = get('products', pid);
      if (!prod) { short.push({ productId: pid, name: '(商品不存在或已删除)', want: need[pid], have: 0 }); return; }
      if (Number(prod.stock || 0) < need[pid]) {
        short.push({ productId: pid, name: prod.name, want: need[pid], have: Number(prod.stock || 0) });
      }
    });
    if (short.length) {
      var err = new Error('库存不足：' + short.map(function (s) {
        return s.name + '（需 ' + s.want + '，存 ' + s.have + '）';
      }).join('、'));
      err.code = 'OUT_OF_STOCK';
      err.detail = short;
      throw err;                                  // 整单拒绝，不做任何写入
    }

    // 2) 落库
    var items = lines.map(function (it) {
      var prod = get('products', it.productId);
      return { productId: prod.id, name: prod.name, unit: prod.unit, qty: it.qty, price: it.price, subtotal: round2(it.qty * it.price) };
    });
    var rawTotal = items.reduce(function (a, b) { return a + b.subtotal; }, 0);
    var discount = round2(p.discount);
    var total = round2(Math.max(0, rawTotal - discount));
    var paid = round2(Math.min(round2(p.paid), total));
    var no = 'S' + todayStr().replace(/-/g, '') + Math.floor(Math.random() * 9000 + 1000);
    var cust = p.customerId ? get('customers', p.customerId) : null;
    var order = {
      id: uid(), no: no, date: todayStr(), ts: Date.now(),
      customerId: p.customerId || null,
      customerName: (cust && cust.name) || p.customerName || '散客',
      items: items, discount: discount, total: total, paid: paid, method: p.method || '现金'
    };
    state.sales.push(order);
    items.forEach(function (it) {
      var prod = get('products', it.productId);
      prod.stock = prod.stock - it.qty;            // 已确保充足，直减，不再静默截断
      state.stockLogs.push({ id: uid(), date: todayStr(), type: 'out', productId: it.productId, productName: it.name, qty: it.qty, remark: '销售出库 ' + no });
    });
    if (paid > 0) state.finance.push({ id: uid(), date: todayStr(), type: 'receive', party: order.customerName, amount: paid, remark: '销售收款 ' + no });
    persist();
    return order;
  }

  function recordPurchase(p) {
    ensure();
    var lines = normalizeLines(p.items);
    var missing = lines.filter(function (it) { return !get('products', it.productId); });
    if (missing.length) {
      var e2 = new Error('商品不存在或已删除，无法入库');
      e2.code = 'PRODUCT_NOT_FOUND';
      e2.detail = missing;
      throw e2;
    }
    var items = lines.map(function (it) {
      var prod = get('products', it.productId);
      return { productId: prod.id, name: prod.name, unit: prod.unit, qty: it.qty, price: it.price, subtotal: round2(it.qty * it.price) };
    });
    var rawTotal = items.reduce(function (a, b) { return a + b.subtotal; }, 0);
    var discount = round2(p.discount);
    var total = round2(Math.max(0, rawTotal - discount));
    var paid = round2(Math.min(round2(p.paid), total));
    var no = 'P' + todayStr().replace(/-/g, '') + Math.floor(Math.random() * 9000 + 1000);
    var sup = p.supplierId ? get('suppliers', p.supplierId) : null;
    var order = {
      id: uid(), no: no, date: todayStr(), ts: Date.now(),
      supplierId: p.supplierId || null,
      supplierName: (sup && sup.name) || p.supplierName || '',
      items: items, discount: discount, total: total, paid: paid, method: p.method || '银行'
    };
    state.purchases.push(order);
    items.forEach(function (it) {
      var prod = get('products', it.productId);
      prod.stock += it.qty;
      state.stockLogs.push({ id: uid(), date: todayStr(), type: 'in', productId: it.productId, productName: it.name, qty: it.qty, remark: '采购入库 ' + no });
    });
    if (paid > 0) state.finance.push({ id: uid(), date: todayStr(), type: 'pay', party: order.supplierName || '其他供应商', amount: paid, remark: '采购付款 ' + no });
    persist();
    return order;
  }

  function adjustStock(productId, delta, remark) {
    ensure();
    var prod = get('products', productId);
    if (!prod) return null;
    prod.stock = Math.max(0, prod.stock + delta);
    state.stockLogs.push({ id: uid(), date: todayStr(), type: 'adjust', productId: productId, productName: prod.name, qty: delta, remark: remark || '库存调整' });
    persist();
    return prod;
  }

  /**
   * 往来收付款 —— 按开单时间 FIFO 冲抵未结清单据（S1-03 BUG-03）
   * 只把**真正冲抵掉**的金额写入财务流水，超出部分原样返回给 UI 提示。
   * partyId 传 '__walkin__' / '__nosupplier__' 时冲抵所有无客户/无供应商的单据。
   * @returns {{applied:number, ignored:number, orders:number}}
   */
  function applyPayment(kind, partyId, amount) {
    ensure();
    var isCust = kind === 'customer';
    var col = isCust ? 'sales' : 'purchases';
    var partyKey = isCust ? 'customerId' : 'supplierId';
    var virtual = partyId === WALKIN_ID || partyId === NOSUP_ID;
    var list = (state[col] || []).filter(function (o) {
      var hit = virtual ? !o[partyKey] : o[partyKey] === partyId;
      return hit && !isPaidOff(o);
    }).sort(function (a, b) { return a.ts - b.ts; });

    var remain = round2(amount), applied = 0, touched = 0;
    list.forEach(function (o) {
      if (remain <= 0.005) return;
      var pay = Math.min(round2(o.total - o.paid), remain);
      if (pay <= 0) return;
      o.paid = round2(o.paid + pay);
      remain = round2(remain - pay);
      applied = round2(applied + pay);
      touched++;
    });

    if (applied <= 0) return { applied: 0, ignored: round2(amount), orders: 0 };

    var partyName = virtual
      ? (isCust ? '散客' : '其他供应商')
      : ((isCust ? get('customers', partyId) : get('suppliers', partyId)) || {}).name || (isCust ? '客户' : '供应商');
    state.finance.push({
      id: uid(), date: todayStr(),
      type: isCust ? 'receive' : 'pay',
      party: partyName, amount: applied,
      remark: (isCust ? '客户收款' : '供应商付款') + '（冲抵 ' + touched + ' 张单）'
    });
    persist();
    return { applied: applied, ignored: round2(round2(amount) - applied), orders: touched };
  }

  /**
   * 单据级收付款（S1-08 BUG-07）
   * 只影响指定单据，超额自动截断到欠款额，并同步写财务流水。
   * @param col 'sales' | 'purchases'
   */
  function receiveOnOrder(col, orderId, amount) {
    ensure();
    if (col !== 'sales' && col !== 'purchases') throw new Error('单据类型不合法');
    var o = get(col, orderId);
    if (!o) throw new Error('单据不存在');
    var pay = Math.min(round2(amount), round2(o.total - o.paid));
    if (pay <= 0) return { applied: 0, ignored: round2(amount) };
    o.paid = round2(o.paid + pay);
    var isSale = col === 'sales';
    state.finance.push({
      id: uid(), date: todayStr(),
      type: isSale ? 'receive' : 'pay',
      party: (isSale ? o.customerName : o.supplierName) || (isSale ? '散客' : '其他供应商'),
      amount: pay,
      remark: (isSale ? '销售收款 ' : '采购付款 ') + o.no
    });
    persist();
    return { applied: pay, ignored: round2(round2(amount) - pay) };
  }

  /* ---------------- 聚合查询 ---------------- */
  function dashboard() {
    ensure();
    var t = todayStr();
    var todaySales = state.sales.filter(function (s) { return s.date === t; });
    var revenue = todaySales.reduce(function (a, s) { return a + s.total; }, 0);
    var warnings = state.products.filter(function (p) { return p.stock <= (p.lowStock || state.settings.lowStock); })
      .slice().sort(function (a, b) { return a.stock - b.stock; });
    // 应收改为按单据聚合，散客欠款同样计入（S1-01 BUG-01）
    var recv = round2(receivables().reduce(function (a, r) { return a + r.debt; }, 0));
    return {
      revenue: round2(revenue), orderCount: todaySales.length, stockWarnings: warnings.length,
      receivables: recv,
      payables: round2(payables().reduce(function (a, r) { return a + r.unpaid; }, 0)),
      warningList: warnings.slice(0, 5),
      recentSales: state.sales.slice().sort(function (a, b) { return b.ts - a.ts; }).slice(0, 5),
      trend: salesTrend(7)
    };
  }

  function salesTrend(days) {
    ensure();
    var arr = [];
    for (var i = days - 1; i >= 0; i--) {
      var d = new Date(); d.setDate(d.getDate() - i);
      var ds = todayStr(d);
      var sum = state.sales.filter(function (s) { return s.date === ds; }).reduce(function (a, s) { return a + s.total; }, 0);
      arr.push({ date: ds.slice(5), total: sum });
    }
    return arr;
  }

  function stockWarnings() {
    ensure();
    var thr = state.settings.lowStock;
    return state.products.filter(function (p) { return p.stock <= (p.lowStock || thr); })
      .sort(function (a, b) { return a.stock - b.stock; });
  }

  function topProducts(n) {
    ensure();
    var map = {};
    state.sales.forEach(function (s) { s.items.forEach(function (it) { map[it.productId] = (map[it.productId] || 0) + it.qty; }); });
    return state.products.map(function (p) { return { name: p.name, qty: map[p.id] || 0, brand: p.brand }; })
      .filter(function (x) { return x.qty > 0; }).sort(function (a, b) { return b.qty - a.qty; }).slice(0, n || 5);
  }

  /**
   * 应收 —— 按**销售单**聚合（S1-01 BUG-01）
   * 原实现按客户表聚合，导致散客（customerId=null）赊账被整体漏算。
   */
  function receivables() {
    ensure();
    var map = {}, order = [];
    state.sales.forEach(function (s) {
      var debt = round2(s.total - s.paid);
      if (debt <= 0.005) return;
      var walkin = !s.customerId;
      var k = walkin ? WALKIN_ID : s.customerId;
      if (!map[k]) {
        var c = walkin ? null : get('customers', s.customerId);
        map[k] = {
          id: walkin ? WALKIN_ID : s.customerId,
          name: c ? c.name : (walkin ? '散客' : (s.customerName || '(已删除客户)')),
          phone: c ? c.phone : '',
          debt: 0, orders: 0, walkin: walkin
        };
        order.push(k);
      }
      map[k].debt = round2(map[k].debt + debt);
      map[k].orders++;
    });
    return order.map(function (k) { return map[k]; }).sort(function (a, b) { return b.debt - a.debt; });
  }

  /** 应付 —— 按**进货单**聚合，无供应商的单归「其他供应商」 */
  function payables() {
    ensure();
    var map = {}, order = [];
    state.purchases.forEach(function (p) {
      var unp = round2(p.total - p.paid);
      if (unp <= 0.005) return;
      var nosup = !p.supplierId;
      var k = nosup ? NOSUP_ID : p.supplierId;
      if (!map[k]) {
        var s = nosup ? null : get('suppliers', p.supplierId);
        map[k] = {
          id: nosup ? NOSUP_ID : p.supplierId,
          name: s ? s.name : (nosup ? '其他供应商' : (p.supplierName || '(已删除供应商)')),
          phone: s ? s.phone : '',
          unpaid: 0, orders: 0, walkin: nosup
        };
        order.push(k);
      }
      map[k].unpaid = round2(map[k].unpaid + unp);
      map[k].orders++;
    });
    return order.map(function (k) { return map[k]; }).sort(function (a, b) { return b.unpaid - a.unpaid; });
  }

  function settings() { ensure(); return state.settings; }
  function saveSettings(patch) { ensure(); for (var k in patch) state.settings[k] = patch[k]; persist(); return state.settings; }

  /* ---------------- 备份 / 恢复（S1-05 BUG-04） ---------------- */
  function exportData() {
    ensure();
    state.settings.lastExportAt = todayStr();   // 记录导出时间，供「N 天未备份」提醒（S3-03）
    var out = assign({}, state);
    out.__meta = assign({}, state.__meta || {}, {
      schema: SCHEMA, app: 'sale-erp', exportedAt: new Date().toISOString()
    });
    return JSON.stringify(out, null, 2);
  }

  /**
   * 导入备份：强校验 + 缺失集合补齐 + 失败回滚
   * 拒绝非法 JSON / 非本系统备份；导入前留快照，写入失败则原样还原。
   */
  function importData(json) {
    var data;
    try { data = JSON.parse(json); }
    catch (e) { throw new Error('文件不是合法 JSON，无法导入'); }
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('备份内容为空或格式不正确');
    if (!Array.isArray(data.products)) throw new Error('缺少商品数据，可能不是本系统的备份文件');

    var snapshot = null;
    try { snapshot = STORE.getItem(KEY); } catch (e) { snapshot = null; }

    COLLECTIONS.forEach(function (c) { if (!Array.isArray(data[c])) data[c] = []; });
    data.settings = assign({}, DEFAULT_SETTINGS, data.settings || {});
    data.__meta = assign({}, data.__meta || {}, { schema: SCHEMA, importedAt: new Date().toISOString() });

    var prev = state;
    state = data;
    if (!persist()) {                              // 写入失败 → 回滚到导入前
      try { if (snapshot != null) STORE.setItem(KEY, snapshot); } catch (e) { /* 已在 persist 提示 */ }
      state = prev;
      throw new Error('导入失败：本地存储写入不成功，已保留原有数据');
    }
    return {
      ok: true,
      counts: COLLECTIONS.map(function (c) { return c + ':' + state[c].length; })
    };
  }

  /* 清空数据：mode='blank' 清空为空白账本（正式使用）/ 其他=恢复示例数据（GAP-03） */
  function reset(mode) {
    try { STORE.removeItem(KEY); } catch (e) { /* ignore */ }
    state = null;
    if (mode === 'blank') {
      state = {
        settings: assign({}, DEFAULT_SETTINGS, { shopName: '我的家电店', firstRunDone: true }),
        products: [], customers: [], suppliers: [], sales: [], purchases: [], stockLogs: [], finance: [],
        __meta: { schema: SCHEMA, blank: true }
      };
      normalize();
      persist();
    } else {
      seed();
      normalize();
    }
  }

  /* 滚动快照（S3-03）：环形 3 份，防误删/误导入导致整个账本丢失 */
  var SNAP_KEYS = ['sale_erp_v1_snap_1', 'sale_erp_v1_snap_2', 'sale_erp_v1_snap_3'];
  function snapshotNow() {
    ensure();
    var seq = (state.settings.snapSeq || 0) + 1;
    var idx = (seq - 1) % SNAP_KEYS.length;
    state.settings.snapSeq = seq;
    var payload = JSON.stringify(state);
    try { STORE.setItem(SNAP_KEYS[idx], payload); } catch (e) { /* 快照写入失败不影响主流程 */ }
    persist();
    return idx + 1;                 // 对外 1-based
  }
  function snapshots() {
    return SNAP_KEYS.map(function (k, i) {
      var raw = STORE.getItem(k);
      if (!raw) return null;
      return { index: i + 1, key: k, size: raw.length };
    }).filter(Boolean);
  }
  function restoreSnapshot(i) {
    var raw = STORE.getItem(SNAP_KEYS[(i | 0) - 1]);
    if (!raw) throw new Error('快照不存在');
    state = JSON.parse(raw);
    normalize();
    persist();
    return { ok: true, counts: COLLECTIONS.map(function (c) { return c + ':' + state[c].length; }) };
  }

  root.DB = {
    init: ensure, all: all, get: get, insert: insert, insertBatch: insertBatch, update: update, remove: remove,
    recordSale: recordSale, recordPurchase: recordPurchase, adjustStock: adjustStock,
    applyPayment: applyPayment, receiveOnOrder: receiveOnOrder,
    orderStatus: orderStatus, dashboard: dashboard, salesTrend: salesTrend, stockWarnings: stockWarnings,
    topProducts: topProducts, receivables: receivables, payables: payables,
    settings: settings, saveSettings: saveSettings,
    exportData: exportData, importData: importData, reset: reset,
    snapshotNow: snapshotNow, snapshots: snapshots, restoreSnapshot: restoreSnapshot,
    uid: uid, todayStr: todayStr, round2: round2, isPaidOff: isPaidOff,
    onPersistError: function (fn) { onPersistError = fn; },
    persistOk: persistOk, storageInfo: storageInfo,
    WALKIN_ID: WALKIN_ID, NOSUP_ID: NOSUP_ID
  };
})(typeof window !== 'undefined' ? window : globalThis);
