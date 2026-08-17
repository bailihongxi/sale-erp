/* ============================================================
   数据层 — 纯前端 localStorage 持久化
   所有业务数据存于浏览器本地，刷新/关闭/重启不丢失。
   同一设备同源共享；跨设备用「导出/导入备份」手动迁移。
   兼容 Node(测试用 localStorage shim)。
   ============================================================ */
(function (root) {
  'use strict';

  var KEY = 'sale_erp_v1_state';
  var STORE = (typeof localStorage !== 'undefined') ? localStorage : (root.__ls || (root.__ls = makeShim()));

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

  function load() {
    try { state = JSON.parse(STORE.getItem(KEY)); } catch (e) { state = null; }
    if (!state || !state.products) state = null;
  }
  function persist() { STORE.setItem(KEY, JSON.stringify(state)); }

  /* ---------------- 种子数据 ---------------- */
  function seed() {
    var products = [
      { name: '海尔 冰箱 BCD-216', brand: '海尔', model: 'BCD-216STPT', type: '冰箱', category: '大家电', unit: '台', priceWholesale: 1899, priceRetail: 2199, stock: 42, lowStock: 10 },
      { name: '美的 空调 KFR-35', brand: '美的', model: 'KFR-35GW', type: '空调', category: '大家电', unit: '台', priceWholesale: 2299, priceRetail: 2599, stock: 8, lowStock: 10 },
      { name: '小米 电视 65" Pro', brand: '小米', model: 'L65M7', type: '电视', category: '黑电', unit: '台', priceWholesale: 2799, priceRetail: 2999, stock: 58, lowStock: 8 },
      { name: '格力 电风扇 FS-40', brand: '格力', model: 'FS-40', type: '风扇', category: '小家电', unit: '台', priceWholesale: 129, priceRetail: 159, stock: 120, lowStock: 20 },
      { name: '九阳 豆浆机 DJ13B', brand: '九阳', model: 'DJ13B', type: '豆浆机', category: '厨房电器', unit: '台', priceWholesale: 299, priceRetail: 359, stock: 5, lowStock: 12 },
      { name: '飞利浦 剃须刀 S5000', brand: '飞利浦', model: 'S5000', type: '剃须刀', category: '个护电器', unit: '个', priceWholesale: 399, priceRetail: 499, stock: 36, lowStock: 10 },
      { name: '西门子 洗衣机 WM12P', brand: '西门子', model: 'WM12P', type: '洗衣机', category: '大家电', unit: '台', priceWholesale: 3199, priceRetail: 3599, stock: 15, lowStock: 5 },
      { name: 'TCL 电视 55"', brand: 'TCL', model: 'L55C', type: '电视', category: '黑电', unit: '台', priceWholesale: 1799, priceRetail: 1999, stock: 30, lowStock: 8 }
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
  }

  /* ---------------- 通用 CRUD ---------------- */
  function all(col) { ensure(); return state[col] || []; }
  function get(col, id) { ensure(); return (state[col] || []).filter(function (x) { return x.id === id; })[0]; }
  function insert(col, obj) { ensure(); obj.id = obj.id || uid(); state[col] = state[col] || []; state[col].push(obj); persist(); return obj; }
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
    if (o.paid >= o.total) return 'paid';
    if (o.paid <= 0) return 'unpaid';
    return 'partial';
  }

  function recordSale(p) {
    ensure();
    var items = p.items.map(function (it) {
      var prod = get('products', it.productId);
      return { productId: prod.id, name: prod.name, unit: prod.unit, qty: it.qty, price: it.price, subtotal: it.qty * it.price };
    });
    var rawTotal = items.reduce(function (a, b) { return a + b.subtotal; }, 0);
    var discount = p.discount || 0;
    var total = Math.max(0, rawTotal - discount);
    var paid = Math.min(p.paid || 0, total);
    var no = 'S' + todayStr().replace(/-/g, '') + Math.floor(Math.random() * 9000 + 1000);
    var order = { id: uid(), no: no, date: todayStr(), ts: Date.now(), customerId: p.customerId || null, customerName: p.customerName || '散客', items: items, discount: discount, total: total, paid: paid, method: p.method || '现金' };
    state.sales.push(order);
    // 出库
    items.forEach(function (it) {
      var prod = get('products', it.productId);
      if (prod) { prod.stock = Math.max(0, prod.stock - it.qty); }
      state.stockLogs.push({ id: uid(), date: todayStr(), type: 'out', productId: it.productId, productName: it.name, qty: it.qty, remark: '销售出库 ' + no });
    });
    if (paid > 0) state.finance.push({ id: uid(), date: todayStr(), type: 'receive', party: order.customerName, amount: paid, remark: '销售收款 ' + no });
    persist();
    return order;
  }

  function recordPurchase(p) {
    ensure();
    var items = p.items.map(function (it) {
      var prod = get('products', it.productId);
      return { productId: prod.id, name: prod.name, unit: prod.unit, qty: it.qty, price: it.price, subtotal: it.qty * it.price };
    });
    var rawTotal = items.reduce(function (a, b) { return a + b.subtotal; }, 0);
    var discount = p.discount || 0;
    var total = Math.max(0, rawTotal - discount);
    var paid = Math.min(p.paid || 0, total);
    var no = 'P' + todayStr().replace(/-/g, '') + Math.floor(Math.random() * 9000 + 1000);
    var order = { id: uid(), no: no, date: todayStr(), ts: Date.now(), supplierId: p.supplierId || null, supplierName: p.supplierName || '', items: items, discount: discount, total: total, paid: paid, method: p.method || '银行' };
    state.purchases.push(order);
    // 入库
    items.forEach(function (it) {
      var prod = get('products', it.productId);
      if (prod) { prod.stock += it.qty; }
      state.stockLogs.push({ id: uid(), date: todayStr(), type: 'in', productId: it.productId, productName: it.name, qty: it.qty, remark: '采购入库 ' + no });
    });
    if (paid > 0) state.finance.push({ id: uid(), date: todayStr(), type: 'pay', party: order.supplierName, amount: paid, remark: '采购付款 ' + no });
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

  // 收款/付款：按时间顺序冲抵未结清单据
  function applyPayment(kind, partyId, amount) {
    ensure();
    var col = kind === 'customer' ? 'sales' : 'purchases';
    var partyKey = kind === 'customer' ? 'customerId' : 'supplierId';
    var list = (state[col] || []).filter(function (o) { return o[partyKey] === partyId && o.paid < o.total; })
      .sort(function (a, b) { return a.ts - b.ts; });
    var remain = amount;
    list.forEach(function (o) {
      if (remain <= 0) return;
      var need = o.total - o.paid;
      var pay = Math.min(need, remain);
      o.paid += pay; remain -= pay;
    });
    var partyName = kind === 'customer'
      ? (get('customers', partyId) || {}).name
      : (get('suppliers', partyId) || {}).name;
    state.finance.push({ id: uid(), date: todayStr(), type: kind === 'customer' ? 'receive' : 'pay', party: partyName, amount: amount, remark: (kind === 'customer' ? '客户收款' : '供应商付款') });
    persist();
  }

  /* ---------------- 聚合查询 ---------------- */
  function dashboard() {
    ensure();
    var t = todayStr();
    var todaySales = state.sales.filter(function (s) { return s.date === t; });
    var revenue = todaySales.reduce(function (a, s) { return a + s.total; }, 0);
    var warnings = state.products.filter(function (p) { return p.stock <= (p.lowStock || state.settings.lowStock); });
    var receivables = state.customers.reduce(function (a, c) {
      var d = state.sales.filter(function (s) { return s.customerId === c.id; }).reduce(function (x, s) { return x + (s.total - s.paid); }, 0);
      return a + d;
    }, 0);
    return {
      revenue: revenue, orderCount: todaySales.length, stockWarnings: warnings.length,
      receivables: receivables, warningList: warnings.slice(0, 5),
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

  function receivables() {
    ensure();
    return state.customers.map(function (c) {
      var debt = state.sales.filter(function (s) { return s.customerId === c.id; }).reduce(function (a, s) { return a + (s.total - s.paid); }, 0);
      return { id: c.id, name: c.name, phone: c.phone, debt: debt };
    }).filter(function (x) { return x.debt > 0; }).sort(function (a, b) { return b.debt - a.debt; });
  }

  function payables() {
    ensure();
    return state.suppliers.map(function (s) {
      var unp = state.purchases.filter(function (p) { return p.supplierId === s.id; }).reduce(function (a, p) { return a + (p.total - p.paid); }, 0);
      return { id: s.id, name: s.name, phone: s.phone, unpaid: unp };
    }).filter(function (x) { return x.unpaid > 0; }).sort(function (a, b) { return b.unpaid - a.unpaid; });
  }

  function settings() { ensure(); return state.settings; }
  function saveSettings(patch) { ensure(); for (var k in patch) state.settings[k] = patch[k]; persist(); return state.settings; }

  function exportData() { ensure(); return JSON.stringify(state, null, 2); }
  function importData(json) {
    var data = JSON.parse(json);
    if (!data.products) throw new Error('数据格式不正确');
    state = data; persist(); return state;
  }
  function reset() { STORE.removeItem(KEY); state = null; seed(); }

  root.DB = {
    init: ensure, all: all, get: get, insert: insert, update: update, remove: remove,
    recordSale: recordSale, recordPurchase: recordPurchase, adjustStock: adjustStock, applyPayment: applyPayment,
    orderStatus: orderStatus, dashboard: dashboard, salesTrend: salesTrend, stockWarnings: stockWarnings,
    topProducts: topProducts, receivables: receivables, payables: payables,
    settings: settings, saveSettings: saveSettings,
    exportData: exportData, importData: importData, reset: reset, uid: uid, todayStr: todayStr
  };
})(typeof window !== 'undefined' ? window : globalThis);
