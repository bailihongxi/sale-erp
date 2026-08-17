/* ============================================================
   数据层测试 —— assets/db.js
   分区：
     A 基线（Sprint 0 固化的当前正确行为，必须一直绿）
     B P0 缺陷回归（Sprint 1 追加）
     C 投产能力（Sprint 3 追加）
   ============================================================ */
'use strict';

var freshDB = require('./helpers/env.js').freshDB;

function sum(arr, f) { return arr.reduce(function (a, x) { return a + f(x); }, 0); }

function run() {
  var DB;

  /* ========================================================
     A 基线：种子数据与核心链路
     ======================================================== */
  section('A1 种子数据规模');
  DB = freshDB();
  check('商品 8 个', DB.all('products').length === 8, DB.all('products').length);
  check('客户 3 个', DB.all('customers').length === 3, DB.all('customers').length);
  check('供应商 3 个', DB.all('suppliers').length === 3, DB.all('suppliers').length);
  check('销售单 7 张', DB.all('sales').length === 7, DB.all('sales').length);
  check('采购单 3 张', DB.all('purchases').length === 3, DB.all('purchases').length);
  check('出入库流水非空', DB.all('stockLogs').length > 0, DB.all('stockLogs').length);
  check('收付款流水非空', DB.all('finance').length > 0, DB.all('finance').length);
  check('设置含店铺名与低库存阈值', !!DB.settings().shopName && DB.settings().lowStock > 0);
  check('商品含品牌/型号/类型三字段', DB.all('products').every(function (p) {
    return p.brand && p.model && p.type;
  }));

  section('A2 通用 CRUD');
  DB = freshDB();
  var created = DB.insert('products', { name: '测试商品', brand: 'T', model: 'M1', type: '测试', category: '测试类', unit: '台', priceWholesale: 100, priceRetail: 120, stock: 7, lowStock: 3 });
  check('insert 返回带 id', !!created.id);
  check('insert 后可 get 到', DB.get('products', created.id).name === '测试商品');
  DB.update('products', created.id, { stock: 99 });
  check('update 生效', DB.get('products', created.id).stock === 99);
  DB.remove('products', created.id);
  check('remove 生效', !DB.get('products', created.id));
  check('remove 后总数回到 8', DB.all('products').length === 8);

  section('A3 销售开单联动库存 / 流水 / 状态');
  DB = freshDB();
  var p = DB.all('products')[0];
  var before = p.stock;
  var logsBefore = DB.all('stockLogs').length;
  var ord = DB.recordSale({
    customerId: DB.all('customers')[0].id, customerName: DB.all('customers')[0].name,
    items: [{ productId: p.id, qty: 3, price: p.priceWholesale }], discount: 0, paid: 0, method: '欠款'
  });
  check('库存扣减 3', DB.get('products', p.id).stock === before - 3, before + '→' + DB.get('products', p.id).stock);
  check('新增 1 条出库流水', DB.all('stockLogs').length === logsBefore + 1);
  check('出库流水 type=out', DB.all('stockLogs').slice(-1)[0].type === 'out');
  check('单据总额 = 数量×单价', ord.total === 3 * p.priceWholesale, ord.total);
  check('未付款单状态 unpaid', DB.orderStatus(ord) === 'unpaid');
  check('单号以 S 开头', /^S\d{8}\d+$/.test(ord.no), ord.no);
  check('单据快照了商品名与单位', ord.items[0].name === p.name && ord.items[0].unit === p.unit);

  section('A4 采购入库联动');
  DB = freshDB();
  var p2 = DB.all('products')[2];
  var b2 = p2.stock;
  var pur = DB.recordPurchase({
    supplierId: DB.all('suppliers')[0].id, supplierName: DB.all('suppliers')[0].name,
    items: [{ productId: p2.id, qty: 5, price: 100 }], paid: 500, method: '银行'
  });
  check('库存增加 5', DB.get('products', p2.id).stock === b2 + 5, b2 + '→' + DB.get('products', p2.id).stock);
  check('新增入库流水 type=in', DB.all('stockLogs').slice(-1)[0].type === 'in');
  check('全额付款单状态 paid', DB.orderStatus(pur) === 'paid');
  check('财务新增 pay 流水', DB.all('finance').slice(-1)[0].type === 'pay');

  section('A5 客户收款冲抵');
  DB = freshDB();
  var c = DB.all('customers')[0];
  var pr = DB.all('products')[0];
  var o = DB.recordSale({ customerId: c.id, customerName: c.name, items: [{ productId: pr.id, qty: 2, price: 500 }], paid: 0, method: '欠款' });
  check('赊账单 paid=0', o.paid === 0);
  DB.applyPayment('customer', c.id, 1000);
  check('收款后该单 paid 增加', DB.get('sales', o.id).paid > 0, DB.get('sales', o.id).paid);
  check('财务新增 receive 流水', DB.all('finance').slice(-1)[0].type === 'receive');

  section('A6 库存调整');
  DB = freshDB();
  var p3 = DB.all('products')[3];
  var b3 = p3.stock;
  DB.adjustStock(p3.id, -4, '盘点损耗');
  check('调整后库存 -4', DB.get('products', p3.id).stock === b3 - 4);
  check('产生 adjust 流水', DB.all('stockLogs').slice(-1)[0].type === 'adjust');
  check('调整流水带备注', DB.all('stockLogs').slice(-1)[0].remark === '盘点损耗');

  section('A7 聚合查询');
  DB = freshDB();
  var d = DB.dashboard();
  check('salesTrend(7) 返回 7 条', DB.salesTrend(7).length === 7);
  check('dashboard.trend 为 7 条', d.trend.length === 7);
  check('dashboard 含今日订单数', typeof d.orderCount === 'number');
  check('dashboard.stockWarnings 与 stockWarnings() 一致', d.stockWarnings === DB.stockWarnings().length);
  check('库存预警按库存升序', (function () {
    var w = DB.stockWarnings();
    for (var i = 1; i < w.length; i++) if (w[i - 1].stock > w[i].stock) return false;
    return true;
  })());
  check('topProducts 返回不超过 5 条且降序', (function () {
    var t = DB.topProducts(5);
    if (t.length > 5) return false;
    for (var i = 1; i < t.length; i++) if (t[i - 1].qty < t[i].qty) return false;
    return true;
  })());
  check('receivables 每项含 name/debt', DB.receivables().every(function (r) { return r.name && r.debt > 0; }));
  check('payables 每项含 name/unpaid', DB.payables().every(function (r) { return r.name && r.unpaid > 0; }));
  check('recentSales 最多 5 条且按时间倒序', (function () {
    var rs = d.recentSales;
    if (rs.length > 5) return false;
    for (var i = 1; i < rs.length; i++) if (rs[i - 1].ts < rs[i].ts) return false;
    return true;
  })());

  section('A8 设置读写');
  DB = freshDB();
  DB.saveSettings({ shopName: '我的家电店', lowStock: 15 });
  check('店铺名已保存', DB.settings().shopName === '我的家电店');
  check('阈值已保存', DB.settings().lowStock === 15);

  section('A9 导出 / 导入往返');
  DB = freshDB();
  var n0 = DB.all('products').length, s0 = DB.all('sales').length;
  var json = DB.exportData();
  check('导出为合法 JSON', (function () { try { JSON.parse(json); return true; } catch (e) { return false; } })());
  DB.importData(json);
  check('往返后商品数不变', DB.all('products').length === n0);
  check('往返后销售单数不变', DB.all('sales').length === s0);

  section('A10 持久化（重新载入不丢数据）');
  DB = freshDB();
  var addP = DB.insert('products', { name: '持久化验证品', brand: 'X', model: 'X1', type: '测试', category: '测试类', unit: '台', priceWholesale: 1, priceRetail: 2, stock: 1, lowStock: 1 });
  var reloaded = (function () {
    var path = require('path');
    var DB_PATH = path.join(__dirname, '..', 'assets', 'db.js');
    delete require.cache[require.resolve(DB_PATH)];
    var savedStore = globalThis.__ls;      // 保留 store，仅重置模块内存 = 模拟刷新
    delete globalThis.DB;
    globalThis.__ls = savedStore;
    require(DB_PATH);
    globalThis.DB.init();
    return globalThis.DB;
  })();
  check('重新载入后新商品仍存在', !!reloaded.get('products', addP.id));
  check('重新载入后商品数为 9', reloaded.all('products').length === 9, reloaded.all('products').length);

  /* ========================================================
     B P0 缺陷回归（Sprint 1）
     ======================================================== */
  section('B1 散客欠款必须计入应收（BUG-01）');
  DB = freshDB();
  var pB = DB.all('products')[0];
  var recvBefore = DB.dashboard().receivables;
  DB.recordSale({ customerId: null, customerName: '散客', items: [{ productId: pB.id, qty: 1, price: 1000 }], paid: 0, method: '欠款' });
  check('看板应收增加 1000', Math.abs(DB.dashboard().receivables - recvBefore - 1000) < 0.005,
    '前=' + recvBefore + ' 后=' + DB.dashboard().receivables);
  check('应收列表含散客', DB.receivables().some(function (r) { return r.name === '散客'; }),
    JSON.stringify(DB.receivables().map(function (r) { return r.name; })));
  check('散客行标记 walkin=true 且欠款 1000', (DB.receivables().filter(function (r) { return r.walkin; })[0] || {}).debt === 1000);
  check('看板应收 = 应收列表求和', Math.abs(DB.dashboard().receivables - sum(DB.receivables(), function (r) { return r.debt; })) < 0.005);
  check('已结清的单不出现在应收', (function () {
    var d2 = freshDB();
    var pp = d2.all('products')[0];
    d2.recordSale({ customerId: null, customerName: '散客', items: [{ productId: pp.id, qty: 1, price: 100 }], paid: 100, method: '现金' });
    return !d2.receivables().some(function (r) { return r.walkin; });
  })());

  section('B1b 无供应商进货单必须计入应付');
  DB = freshDB();
  var pB2 = DB.all('products')[1];
  var payBefore = sum(DB.payables(), function (x) { return x.unpaid; });
  DB.recordPurchase({ supplierId: null, supplierName: '', items: [{ productId: pB2.id, qty: 1, price: 800 }], paid: 0, method: '欠款' });
  check('应付增加 800', Math.abs(sum(DB.payables(), function (x) { return x.unpaid; }) - payBefore - 800) < 0.005);
  check('应付列表含"其他供应商"', DB.payables().some(function (x) { return x.name === '其他供应商'; }),
    JSON.stringify(DB.payables().map(function (x) { return x.name; })));

  section('B1c 散客应收可跨单收款');
  DB = freshDB();
  var pB3 = DB.all('products')[0];
  DB.recordSale({ customerId: null, customerName: '散客', items: [{ productId: pB3.id, qty: 1, price: 300 }], paid: 0, method: '欠款' });
  DB.recordSale({ customerId: null, customerName: '散客', items: [{ productId: pB3.id, qty: 1, price: 200 }], paid: 0, method: '欠款' });
  check('散客合计欠 500', Math.abs((DB.receivables().filter(function (r) { return r.walkin; })[0] || {}).debt - 500) < 0.005);
  var rW = DB.applyPayment('customer', '__walkin__', 350);
  check('散客收款 applied=350', rW && Math.abs(rW.applied - 350) < 0.005, JSON.stringify(rW));
  check('散客剩余欠款 150', Math.abs((DB.receivables().filter(function (r) { return r.walkin; })[0] || {}).debt - 150) < 0.005);
  check('先开的单先冲抵（FIFO）', DB.all('sales').filter(function (s) { return !s.customerId; })[0].paid === 300);

  section('B2 禁止超卖（BUG-02）');
  DB = freshDB();
  var q = DB.all('products')[4];
  var qStock = q.stock, logCount = DB.all('stockLogs').length, salesCount = DB.all('sales').length;
  checkThrows('超量开单抛异常', function () {
    DB.recordSale({ customerId: null, customerName: '散客', items: [{ productId: q.id, qty: qStock + 50, price: 100 }], paid: 0, method: '现金' });
  }, function (e) { return e.code === 'OUT_OF_STOCK'; });
  check('库存未被改动', DB.get('products', q.id).stock === qStock, qStock + '→' + DB.get('products', q.id).stock);
  check('未产生任何流水（零写入）', DB.all('stockLogs').length === logCount);
  check('未产生销售单（零写入）', DB.all('sales').length === salesCount);
  check('异常带 detail 清单', (function () {
    try { DB.recordSale({ customerId: null, customerName: '散客', items: [{ productId: q.id, qty: qStock + 1, price: 1 }], paid: 0, method: '现金' }); }
    catch (e) { return Array.isArray(e.detail) && e.detail[0].have === qStock && e.detail[0].want === qStock + 1; }
    return false;
  })());
  check('同一商品拆多行会合并校验', (function () {
    try {
      DB.recordSale({
        customerId: null, customerName: '散客',
        items: [{ productId: q.id, qty: qStock, price: 1 }, { productId: q.id, qty: 1, price: 1 }],
        paid: 0, method: '现金'
      });
      return false;
    } catch (e) { return e.code === 'OUT_OF_STOCK'; }
  })());
  check('不存在的商品被拒绝', (function () {
    try { DB.recordSale({ customerId: null, customerName: '散客', items: [{ productId: 'no-such-id', qty: 1, price: 1 }], paid: 0, method: '现金' }); return false; }
    catch (e) { return e.code === 'OUT_OF_STOCK'; }
  })());
  check('空商品行被拒绝', (function () {
    try { DB.recordSale({ customerId: null, customerName: '散客', items: [], paid: 0, method: '现金' }); return false; }
    catch (e) { return true; }
  })());
  check('刚好卖光可以成功且库存归零', (function () {
    var o = DB.recordSale({ customerId: null, customerName: '散客', items: [{ productId: q.id, qty: qStock, price: 1 }], paid: 0, method: '现金' });
    return !!o && DB.get('products', q.id).stock === 0;
  })());
  check('流水数量与实际扣减一致', (function () {
    var lg = DB.all('stockLogs').slice(-1)[0];
    return lg.type === 'out' && lg.qty === qStock;
  })());

  section('B3 收付款不得超额记账（BUG-03）');
  DB = freshDB();
  var c3 = DB.all('customers')[1], p3b = DB.all('products')[0];
  DB.applyPayment('customer', c3.id, 999999);          // 先清历史欠款，便于精确断言
  var o3 = DB.recordSale({ customerId: c3.id, customerName: c3.name, items: [{ productId: p3b.id, qty: 1, price: 500 }], paid: 0, method: '欠款' });
  var finBefore = DB.all('finance').length;
  var r3 = DB.applyPayment('customer', c3.id, 99999);
  var f3 = DB.all('finance').slice(-1)[0];
  check('财务流水只记实际冲抵额 500', Math.abs(f3.amount - 500) < 0.005, f3.amount);
  check('返回 applied=500', Math.abs(r3.applied - 500) < 0.005, JSON.stringify(r3));
  check('返回 ignored=99499', Math.abs(r3.ignored - 99499) < 0.005, JSON.stringify(r3));
  check('只新增 1 条流水', DB.all('finance').length === finBefore + 1);
  check('单据结清', DB.orderStatus(DB.get('sales', o3.id)) === 'paid');
  check('单据 paid 不超过 total', DB.get('sales', o3.id).paid <= DB.get('sales', o3.id).total + 0.005);
  check('无欠款时收款不产生流水', (function () {
    var n = DB.all('finance').length;
    var r = DB.applyPayment('customer', c3.id, 100);
    return DB.all('finance').length === n && r.applied === 0;
  })());
  check('供应商付款同样不超额', (function () {
    var d2 = freshDB();
    var sp = d2.all('suppliers')[1];
    var owed = sum(d2.payables().filter(function (x) { return x.id === sp.id; }), function (x) { return x.unpaid; });
    var r = d2.applyPayment('supplier', sp.id, owed + 50000);
    return Math.abs(r.applied - owed) < 0.005 && Math.abs(d2.all('finance').slice(-1)[0].amount - owed) < 0.005;
  })());

  section('B4 金额精度（S1-04）');
  DB = freshDB();
  var c4 = DB.all('customers')[2], p4 = DB.all('products')[0];
  DB.applyPayment('customer', c4.id, 999999);
  var o4 = DB.recordSale({ customerId: c4.id, customerName: c4.name, items: [{ productId: p4.id, qty: 3, price: 33.33 }], paid: 0, method: '欠款' });
  check('总额 99.99', Math.abs(o4.total - 99.99) < 0.005, o4.total);
  DB.applyPayment('customer', c4.id, 33.33);
  DB.applyPayment('customer', c4.id, 33.33);
  DB.applyPayment('customer', c4.id, 33.33);
  check('三次 33.33 后结清（无浮点残留）', DB.orderStatus(DB.get('sales', o4.id)) === 'paid',
    'paid=' + DB.get('sales', o4.id).paid + ' total=' + DB.get('sales', o4.id).total);
  check('结清后不再出现于应收', !DB.receivables().some(function (r) { return r.id === c4.id; }));
  var o4b = DB.recordSale({ customerId: c4.id, customerName: c4.name, items: [{ productId: p4.id, qty: 3, price: 0.01 }], paid: 0, method: '欠款' });
  check('总额 0.03', Math.abs(o4b.total - 0.03) < 0.0005, o4b.total);
  DB.applyPayment('customer', c4.id, 0.01);
  DB.applyPayment('customer', c4.id, 0.01);
  DB.applyPayment('customer', c4.id, 0.01);
  check('三次 0.01 后结清', DB.orderStatus(DB.get('sales', o4b.id)) === 'paid', 'paid=' + DB.get('sales', o4b.id).paid);
  check('小计与总额小数位 ≤ 2', (function () {
    var o = DB.recordSale({ customerId: null, customerName: '散客', items: [{ productId: p4.id, qty: 3, price: 10.005 }], paid: 0, method: '欠款' });
    function dec(n) { var s = String(n).split('.'); return s[1] ? s[1].length : 0; }
    return dec(o.total) <= 2 && dec(o.items[0].subtotal) <= 2;
  })());
  check('paid 累加后小数位 ≤ 2', (function () {
    var d2 = freshDB(), cc = d2.all('customers')[0], pp = d2.all('products')[0];
    d2.applyPayment('customer', cc.id, 999999);
    var oo = d2.recordSale({ customerId: cc.id, customerName: cc.name, items: [{ productId: pp.id, qty: 1, price: 10 }], paid: 0, method: '欠款' });
    d2.applyPayment('customer', cc.id, 3.33);
    d2.applyPayment('customer', cc.id, 3.33);
    var s = String(d2.get('sales', oo.id).paid).split('.');
    return !s[1] || s[1].length <= 2;
  })());

  section('B5 导入强校验与容错（BUG-04）');
  DB = freshDB();
  var res = DB.importData(JSON.stringify({ products: [{ id: 'x', name: 't', stock: 5, unit: '台', priceWholesale: 1, priceRetail: 2 }] }));
  check('缺失集合被补为空数组', Array.isArray(DB.all('sales')) && DB.all('sales').length === 0);
  check('缺失 finance 也被补齐', Array.isArray(DB.all('finance')));
  check('settings 被补默认值', DB.settings().lowStock > 0 && !!DB.settings().currency);
  check('返回导入结果 ok', !!res && res.ok === true, JSON.stringify(res));
  check('导入不完整备份后仍能开单（不再崩溃）', (function () {
    try { DB.recordSale({ customerId: null, customerName: '散客', items: [{ productId: 'x', qty: 1, price: 1 }], paid: 1, method: '现金' }); return true; }
    catch (e) { return false; }
  })(), '不应抛错');
  checkThrows('非法 JSON 被拒绝', function () { DB.importData('{{{'); }, function (e) { return /JSON/.test(e.message); });
  checkThrows('无 products 的对象被拒绝', function () { DB.importData('{"a":1}'); }, function (e) { return /商品/.test(e.message); });
  checkThrows('products 非数组被拒绝', function () { DB.importData('{"products":"x"}'); });
  check('导入失败后原数据未被破坏', DB.all('products').length === 1 && !!DB.get('products', 'x'));
  check('exportData 带 __meta.schema', (function () { var dd = JSON.parse(DB.exportData()); return dd.__meta && dd.__meta.schema >= 1; })());
  check('导入后写入 __meta.importedAt', (function () {
    var d2 = freshDB(); d2.importData(d2.exportData());
    return !!JSON.parse(d2.exportData()).__meta.importedAt;
  })());

  section('B6 写入失败可感知（BUG-05）');
  DB = freshDB();
  var captured = [];
  DB.onPersistError(function (msg) { captured.push(msg); });
  var store = globalThis.__ls;
  var origSet = store.setItem;
  store.setItem = function () { var e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; };
  var threw = false;
  try { DB.insert('products', { name: '写入失败测试', stock: 1, unit: '台', priceWholesale: 1, priceRetail: 1 }); }
  catch (e) { threw = true; }
  store.setItem = origSet;
  check('配额异常不向外抛出（不打断业务）', threw === false);
  check('触发了持久化错误回调', captured.length > 0, JSON.stringify(captured));
  check('提示含"已满/未保存"语义', /已满|未保存/.test(captured.join('')), captured.join(''));
  check('storageInfo 返回占用与上限', (function () {
    var i = DB.storageInfo();
    return i && typeof i.used === 'number' && i.used > 0 && typeof i.limit === 'number' && i.limit > 0 && typeof i.percent === 'number';
  })(), JSON.stringify(DB.storageInfo()));
  check('persist 成功时返回 true', DB.persistOk() === true);

  section('B7 单据级收款 receiveOnOrder（BUG-07）');
  DB = freshDB();
  var p7 = DB.all('products')[0];
  var o7 = DB.recordSale({ customerId: null, customerName: '散客', items: [{ productId: p7.id, qty: 1, price: 400 }], paid: 0, method: '欠款' });
  var fin7 = DB.all('finance').length;
  var r7 = DB.receiveOnOrder('sales', o7.id, 200);
  check('收一半 applied=200', Math.abs(r7.applied - 200) < 0.005, JSON.stringify(r7));
  check('单据状态 partial', DB.orderStatus(DB.get('sales', o7.id)) === 'partial');
  check('新增 1 条 receive 流水且金额=200',
    DB.all('finance').length === fin7 + 1 && Math.abs(DB.all('finance').slice(-1)[0].amount - 200) < 0.005);
  check('流水备注含单号', DB.all('finance').slice(-1)[0].remark.indexOf(o7.no) >= 0);
  DB.receiveOnOrder('sales', o7.id, 200);
  check('再收余额后结清', DB.orderStatus(DB.get('sales', o7.id)) === 'paid');
  check('超额收款被截断至欠款额', (function () {
    var o = DB.recordSale({ customerId: null, customerName: '散客', items: [{ productId: p7.id, qty: 1, price: 100 }], paid: 0, method: '欠款' });
    var r = DB.receiveOnOrder('sales', o.id, 99999);
    return Math.abs(r.applied - 100) < 0.005 && Math.abs(DB.all('finance').slice(-1)[0].amount - 100) < 0.005;
  })());
  check('采购单付款走同一通道并记 pay 流水', (function () {
    var sp = DB.all('suppliers')[0], pp = DB.all('products')[0];
    var pu = DB.recordPurchase({ supplierId: sp.id, supplierName: sp.name, items: [{ productId: pp.id, qty: 1, price: 1000 }], paid: 0, method: '欠款' });
    var r = DB.receiveOnOrder('purchases', pu.id, 400);
    var f = DB.all('finance').slice(-1)[0];
    return r.applied === 400 && f.type === 'pay' && Math.abs(f.amount - 400) < 0.005;
  })());
  check('已结清单再收款不记流水', (function () {
    var n = DB.all('finance').length;
    var r = DB.receiveOnOrder('sales', o7.id, 50);
    return r.applied === 0 && DB.all('finance').length === n;
  })());
  checkThrows('不存在的单据被拒绝', function () { DB.receiveOnOrder('sales', 'nope', 1); });

  section('B8 聚合查询无副作用（BUG-08）');
  DB = freshDB();
  var order0 = DB.all('products').map(function (x) { return x.id; }).join(',');
  DB.stockWarnings(); DB.topProducts(5); DB.receivables(); DB.payables(); DB.dashboard(); DB.salesTrend(7);
  check('聚合调用后商品原始顺序未被污染', DB.all('products').map(function (x) { return x.id; }).join(',') === order0);
  check('销售/采购单顺序未被污染', (function () {
    var so = DB.all('sales').map(function (x) { return x.id; }).join(',');
    DB.dashboard();
    return DB.all('sales').map(function (x) { return x.id; }).join(',') === so;
  })());

  section('B9 库存不可为负（护栏）');
  DB = freshDB();
  var pN = DB.all('products')[0];
  DB.adjustStock(pN.id, -999999, '压测');
  check('库存调整不会变负数', DB.get('products', pN.id).stock >= 0, DB.get('products', pN.id).stock);
}

module.exports = { run: run };
