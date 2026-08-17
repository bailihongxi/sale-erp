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
}

module.exports = { run: run };
