/* ============================================================
   界面层测试 —— index.html + assets/app.js（jsdom）
   分区：
     D 基线（Sprint 0 固化）
     E P0 交互回归（Sprint 1 追加）
     F v1 验收补齐（Sprint 2 追加）
     G 投产可用性（Sprint 3 追加）
   ============================================================ */
'use strict';

var boot = require('./helpers/dom.js').boot;

var MODULES = ['dashboard', 'products', 'pos', 'sales', 'purchase', 'inventory', 'reports', 'finance', 'settings', 'data'];

function run() {

  /* ========================================================
     D 基线
     ======================================================== */
  section('D1 应用启动');
  var t = boot();
  check('DB 已挂载', !!t.DB);
  check('App 已挂载', !!t.App);
  check('启动无 JS 错误', t.errors.length === 0, t.errors.join(' | '));
  check('店铺名写入侧边栏', t.text('#brandName') === t.DB.settings().shopName, t.text('#brandName'));
  check('默认渲染工作台', t.text('#viewTitle') === '工作台', t.text('#viewTitle'));
  check('工作台渲染出 4 张 KPI 卡', t.$$('#view .kpi').length === 4, t.$$('#view .kpi').length);
  check('工作台渲染出趋势图', !!t.$('#view svg.chart'));

  section('D2 导航结构');
  check('侧边栏导航项 = 10', t.$$('#nav .nav__item').length === 10, t.$$('#nav .nav__item').length);
  check('侧边栏含 2 个分组标题', t.$$('#nav .nav__group').length === 2);
  check('手机底部导航 4 项', t.$$('#bottomNav .nav__item').length === 4, t.$$('#bottomNav .nav__item').length);
  check('手机底部含"我的"入口', t.$$('#bottomNav [data-id="more"]').length === 1);
  check('Sheet 内含全部模块导航', t.$$('#sheetNav .nav__item').length === 10);

  section('D3 十个模块视图均可渲染');
  MODULES.forEach(function (id) {
    var inst = boot({ hash: '#' + id });
    var ok = inst.errors.length === 0 && inst.$('#view').innerHTML.length > 50;
    check('视图 ' + id + ' 渲染正常', ok, inst.errors.join(' | ') || ('长度=' + inst.$('#view').innerHTML.length));
  });

  section('D4 路由切换');
  var t2 = boot();
  t2.go('products');
  check('切换到商品管理标题正确', t2.text('#viewTitle') === '商品管理', t2.text('#viewTitle'));
  check('当前导航高亮', t2.$('#nav .nav__item.active').getAttribute('data-id') === 'products');
  t2.go('nonexistent-view');
  check('未知路由回落工作台', t2.text('#viewTitle') === '工作台');

  section('D5 商品管理含品牌/型号/类型');
  var t3 = boot({ hash: '#products' });
  var ths = t3.$$('#view table th').map(function (e) { return e.textContent; });
  check('表头含品牌', ths.indexOf('品牌') >= 0, ths.join(','));
  check('表头含型号', ths.indexOf('型号') >= 0);
  check('表头含类型', ths.indexOf('类型') >= 0);
  check('列出 8 行商品', t3.$$('#prodBody tr').length === 8, t3.$$('#prodBody tr').length);
  check('渲染出品牌值（海尔）', t3.$('#view').textContent.indexOf('海尔') >= 0);
  // 搜索过滤
  var kw = t3.$('#prodKw');
  kw.value = '海尔'; t3.fire(kw, 'input');
  check('搜索"海尔"后行数减少', t3.$$('#prodBody tr').length < 8, t3.$$('#prodBody tr').length);
  kw.value = 'BCD-216STPT'; t3.fire(kw, 'input');
  check('可按型号搜索', t3.$$('#prodBody tr').length === 1, t3.$$('#prodBody tr').length);

  section('D6 新增商品弹窗');
  var t4 = boot({ hash: '#products' });
  t4.App.editProduct();
  check('弹窗已打开', t4.$('#modalMask').classList.contains('show'));
  check('弹窗含品牌输入框', !!t4.$('#f_brand'));
  check('弹窗含型号输入框', !!t4.$('#f_model'));
  check('弹窗含类型输入框', !!t4.$('#f_type'));
  t4.$('#f_name').value = '测试新商品';
  t4.$('#f_brand').value = '测试品牌';
  t4.$('#f_model').value = 'TM-1';
  t4.$('#f_type').value = '测试类型';
  t4.$('#f_stock').value = '9';
  t4.App.saveProduct('');
  check('保存后弹窗关闭', !t4.$('#modalMask').classList.contains('show'));
  check('商品数变为 9', t4.DB.all('products').length === 9, t4.DB.all('products').length);
  check('新商品字段已落库', (function () {
    var np = t4.DB.all('products').filter(function (x) { return x.name === '测试新商品'; })[0];
    return np && np.brand === '测试品牌' && np.model === 'TM-1' && np.type === '测试类型' && np.stock === 9;
  })());

  section('D7 销售开单交互');
  var t5 = boot({ hash: '#pos' });
  check('渲染商品网格', t5.$$('#posGrid .prod-card').length === 8, t5.$$('#posGrid .prod-card').length);
  check('购物车初始为空态', t5.$('#posCart').textContent.indexOf('点击左侧商品') >= 0);
  t5.click(t5.$('#posGrid .prod-card'));
  check('点击商品后进入购物车', t5.$$('#posCart .cart-item').length === 1);
  t5.click(t5.$('#posCart [data-act="inc"]'));
  check('加号后件数为 2', t5.$('#posCart').textContent.indexOf('2 件') >= 0, t5.$('#posCart').textContent.slice(0, 200));
  t5.click(t5.$('#posCart [data-act="del"]'));
  check('删除后回到空态', t5.$$('#posCart .cart-item').length === 0);

  section('D8 开单结算落库');
  var t6 = boot({ hash: '#pos' });
  var salesBefore = t6.DB.all('sales').length;
  t6.click(t6.$('#posGrid .prod-card'));
  t6.App.settlePos();
  check('销售单 +1', t6.DB.all('sales').length === salesBefore + 1, t6.DB.all('sales').length);
  check('结算后购物车清空', t6.$$('#posCart .cart-item').length === 0);
  check('空车结算不产生单据', (function () {
    var n = t6.DB.all('sales').length;
    t6.App.settlePos();
    return t6.DB.all('sales').length === n;
  })());

  section('D9 采购 / 库存 / 财务基础交互');
  var t7 = boot({ hash: '#purchase' });
  check('采购列表渲染 3 行', t7.$$('#view tbody tr').length === 3, t7.$$('#view tbody tr').length);
  t7.App.openPurchase(t7.DB.all('purchases')[0].id);
  check('进货单详情弹窗可打开', t7.$('#modalMask').classList.contains('show'));
  t7.App.closeModal();

  var t8 = boot({ hash: '#inventory' });
  check('库存页渲染两张卡', t8.$$('#view .card').length >= 2);
  t8.App.adjustStock(t8.DB.all('products')[0].id);
  check('库存调整弹窗可打开', !!t8.$('#adjQty'));
  t8.$('#adjQty').value = '5';
  t8.App.doAdjust(t8.DB.all('products')[0].id);
  check('调整后产生 adjust 流水', t8.DB.all('stockLogs').slice(-1)[0].type === 'adjust');

  var t9 = boot({ hash: '#finance' });
  check('财务页渲染应收/应付/流水 3 张卡', t9.$$('#view .card').length === 3, t9.$$('#view .card').length);

  section('D10 数据管理 / 设置');
  var t10 = boot({ hash: '#data' });
  check('数据管理页有导出按钮', t10.$('#view').textContent.indexOf('导出备份') >= 0);
  check('数据管理页有导入按钮', t10.$('#view').textContent.indexOf('导入备份') >= 0);
  check('导出不抛异常', (function () { try { t10.App.exportData(); return true; } catch (e) { return false; } })());

  var t11 = boot({ hash: '#settings' });
  t11.$('#setShop').value = '测试店铺';
  t11.$('#setLow').value = '20';
  t11.App.saveSettings();
  check('设置保存后落库', t11.DB.settings().shopName === '测试店铺' && t11.DB.settings().lowStock === 20);
  check('侧边栏店名同步更新', t11.text('#brandName') === '测试店铺');

  section('D11 XSS 防护');
  var t12 = boot({ hash: '#products' });
  t12.DB.insert('products', { name: '<img src=x onerror=alert(1)>', brand: '<b>x</b>', model: 'M', type: 'T', category: 'C', unit: '台', priceWholesale: 1, priceRetail: 2, stock: 1, lowStock: 1 });
  t12.go('products');
  check('恶意商品名被转义（无注入的 img 标签）', t12.$$('#prodBody img').length === 0);
  check('恶意品牌被转义（无注入的 b 标签）', t12.$$('#prodBody b > b').length === 0);

  /* ========================================================
     E P0 交互回归（Sprint 1）
     ======================================================== */
  section('E1 手机 Sheet 点击后自动关闭（BUG-06）');
  var e1 = boot({ width: 390, height: 844 });
  e1.App.openSheet();
  check('Sheet 已打开', e1.$('#sheetMask').classList.contains('show'));
  e1.click(e1.$('#sheetNav .nav__item'));
  check('点击菜单项后 Sheet 自动关闭', !e1.$('#sheetMask').classList.contains('show'));
  e1.App.openSheet();
  e1.go('reports');
  check('路由切换兜底关闭 Sheet', !e1.$('#sheetMask').classList.contains('show'));
  check('底部"我的"可再次唤出 Sheet', (function () {
    e1.click(e1.$('#bottomNav [data-id="more"]'));
    return e1.$('#sheetMask').classList.contains('show');
  })());

  section('E1b 弹窗遮罩点击 / ESC 关闭（MNR-05）');
  var e1b = boot({ hash: '#products' });
  e1b.App.editProduct();
  check('弹窗已打开', e1b.$('#modalMask').classList.contains('show'));
  e1b.click(e1b.$('#modalMask'));
  check('点击遮罩空白处关闭弹窗', !e1b.$('#modalMask').classList.contains('show'));
  e1b.App.editProduct();
  e1b.document.dispatchEvent(new e1b.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  check('按 ESC 关闭弹窗', !e1b.$('#modalMask').classList.contains('show'));
  e1b.App.editProduct();
  e1b.click(e1b.$('#modal'));
  check('点击弹窗内部不会关闭', e1b.$('#modalMask').classList.contains('show'));

  section('E2 超卖在界面被拦截并提示（BUG-02 UI 侧）');
  var e2 = boot({ hash: '#pos' });
  var lowProd = e2.DB.all('products').slice().sort(function (a, b) { return a.stock - b.stock; })[0];
  var salesN = e2.DB.all('sales').length;
  var cardEl = e2.$$('#posGrid .prod-card').filter(function (c) { return c.getAttribute('data-pid') === lowProd.id; })[0];
  e2.click(cardEl);
  // 把数量改到超过库存
  var setInput = e2.$('#posCart [data-act="set"]');
  setInput.value = String(lowProd.stock + 10);
  e2.fire(setInput, 'change');
  check('数量改动后合计同步刷新（GAP-01 前置）',
    e2.$('#posCart').textContent.indexOf((lowProd.stock + 10) + ' 件') >= 0,
    e2.$('#posCart').textContent.slice(0, 260));
  check('超库存行有醒目提示', e2.$('#posCart').textContent.indexOf('超库存') >= 0, e2.$('#posCart').textContent.slice(0, 300));
  e2.App.settlePos();
  check('结算被拦截，未生成销售单', e2.DB.all('sales').length === salesN, e2.DB.all('sales').length);
  check('弹出库存不足提示', e2.$('#toastWrap').textContent.indexOf('库存不足') >= 0, e2.$('#toastWrap').textContent);
  check('购物车内容保留（便于用户修改）', e2.$$('#posCart .cart-item').length === 1);
  check('拦截后无 JS 错误', e2.errors.length === 0, e2.errors.join(' | '));

  section('E3 散客单收款走正确通道（BUG-07 UI 侧）');
  var e3 = boot({ hash: '#pos' });
  var pe3 = e3.DB.all('products').slice().sort(function (a, b) { return b.stock - a.stock; })[0];
  var oe3 = e3.DB.recordSale({ customerId: null, customerName: '散客', items: [{ productId: pe3.id, qty: 1, price: 600 }], paid: 0, method: '欠款' });
  e3.go('sales');
  e3.App.receiveSale(oe3.id);
  check('收款弹窗打开', !!e3.$('#rcvAmt'));
  var finN = e3.DB.all('finance').length;
  e3.$('#rcvAmt').value = '250';
  e3.App.doReceive('', oe3.id);
  check('散客部分收款按输入金额记账（不再强制全额）',
    Math.abs(e3.DB.get('sales', oe3.id).paid - 250) < 0.005, e3.DB.get('sales', oe3.id).paid);
  check('散客收款写入财务流水', e3.DB.all('finance').length === finN + 1);
  check('流水金额 = 250', Math.abs(e3.DB.all('finance').slice(-1)[0].amount - 250) < 0.005);
  check('状态变为部分收', e3.DB.orderStatus(e3.DB.get('sales', oe3.id)) === 'partial');

  section('E4 财务页散客应收可见并可收款（BUG-01 UI 侧）');
  var e4 = boot();
  var pe4 = e4.DB.all('products').slice().sort(function (a, b) { return b.stock - a.stock; })[0];
  e4.DB.recordSale({ customerId: null, customerName: '散客', items: [{ productId: pe4.id, qty: 1, price: 700 }], paid: 0, method: '欠款' });
  e4.go('finance');
  check('应收表格出现散客行', e4.$('#view').textContent.indexOf('散客') >= 0);
  e4.go('dashboard');
  check('工作台应收金额已包含散客欠款',
    Math.abs(e4.DB.dashboard().receivables - e4.DB.receivables().reduce(function (a, r) { return a + r.debt; }, 0)) < 0.005);
  e4.go('finance');
  e4.App.payDebt('customer', '__walkin__');
  check('散客收款弹窗可打开', !!e4.$('#pdAmt'), e4.$('#modalBody') ? e4.$('#modalBody').textContent.slice(0, 120) : 'no modal');
  e4.$('#pdAmt').value = '700';
  e4.App.doPayDebt('customer', '__walkin__');
  check('散客收款后应收清零', !e4.DB.receivables().some(function (r) { return r.walkin; }));
  check('操作全程无 JS 错误', e4.errors.length === 0, e4.errors.join(' | '));

  section('E5 库存页排序不污染商品档案（BUG-08 UI 侧）');
  var e5 = boot();
  var order0 = e5.DB.all('products').map(function (p) { return p.id; }).join(',');
  e5.go('inventory');
  e5.go('reports');
  e5.go('products');
  check('浏览库存/报表后商品档案顺序不变',
    e5.DB.all('products').map(function (p) { return p.id; }).join(',') === order0);

  section('E6 写入失败出现常驻横幅（BUG-05 UI 侧）');
  var e6 = boot({ hash: '#products' });
  check('正常状态下横幅不可见', !e6.$('#persistBanner').classList.contains('show'));
  e6.withQuotaExceeded(function () {
    e6.DB.insert('products', { name: '触发配额', stock: 1, unit: '台', priceWholesale: 1, priceRetail: 1 });
  });
  var banner = e6.$('#persistBanner');
  check('出现持久化错误横幅', !!banner, '未找到 #persistBanner');
  check('横幅可见（非 toast 一闪而过）', banner && banner.classList.contains('show'));
  check('横幅文案提示导出备份', banner && /备份|导出/.test(banner.textContent), banner ? banner.textContent : '');
  check('横幅带立即导出按钮', !!e6.$('#persistBanner button'));
}

module.exports = { run: run };
