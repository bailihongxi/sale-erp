/* ============================================================
   界面层测试 —— index.html + assets/app.js（jsdom）
   分区：
     D 基线（Sprint 0 固化）
     E P0 交互回归（Sprint 1 追加）
     F v1 验收补齐（Sprint 2 追加）
     G 投产可用性（Sprint 3 追加）
   ============================================================ */
'use strict';

var helpers = require('./helpers/dom.js');
var boot = helpers.boot;

/* Sprint 2 起模块由 10 → 12（新增 客户管理 / 供应商，GAP-02） */
var MODULES = ['dashboard', 'products', 'pos', 'sales', 'purchase', 'customers', 'suppliers',
  'inventory', 'reports', 'finance', 'settings', 'data'];
var NAV_COUNT = MODULES.length;

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
  check('侧边栏导航项 = ' + NAV_COUNT, t.$$('#nav .nav__item').length === NAV_COUNT, t.$$('#nav .nav__item').length);
  check('侧边栏含 2 个分组标题', t.$$('#nav .nav__group').length === 2);
  check('手机底部导航 4 项', t.$$('#bottomNav .nav__item').length === 4, t.$$('#bottomNav .nav__item').length);
  check('手机底部含"我的"入口', t.$$('#bottomNav [data-id="more"]').length === 1);
  check('Sheet 内含全部模块导航', t.$$('#sheetNav .nav__item').length === NAV_COUNT, t.$$('#sheetNav .nav__item').length);

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

  /* ========================================================
     F v1 验收补齐（Sprint 2）
     ======================================================== */
  section('F1 购物车改单价 + 多价格档位（GAP-01）');
  var f1 = boot({ hash: '#pos' });
  f1.click(f1.$('#posGrid .prod-card'));
  var f1pid = f1.$('#posCart .cart-item').getAttribute('data-pid');
  var f1p = f1.DB.get('products', f1pid);
  check('购物车行含单价输入框', !!f1.$('#posCart .cart-item [data-act="price"]'));
  check('购物车行含价格档位选择', !!f1.$('#posCart .cart-item [data-act="tier"]'));
  check('默认档位=批发价', Number(f1.$('#posCart .cart-item [data-act="price"]').value) === f1p.priceWholesale,
    f1.$('#posCart .cart-item [data-act="price"]').value + ' vs ' + f1p.priceWholesale);
  var f1price = f1.$('#posCart .cart-item [data-act="price"]');
  f1price.value = '888'; f1.fire(f1price, 'change');
  check('改单价后合计立即更新', f1.$('#posCart').textContent.indexOf(fmt(888)) >= 0, f1.$('#posCart').textContent.slice(0, 300));
  check('手改价后档位切换为自定义', f1.$('#posCart .cart-item [data-act="tier"]').value === 'c',
    f1.$('#posCart .cart-item [data-act="tier"]').value);
  var f1tier = f1.$('#posCart .cart-item [data-act="tier"]');
  f1tier.value = 'r'; f1.fire(f1tier, 'change');
  check('切「零售」单价跳到零售价', Number(f1.$('#posCart .cart-item [data-act="price"]').value) === f1p.priceRetail,
    f1.$('#posCart .cart-item [data-act="price"]').value + ' vs ' + f1p.priceRetail);
  check('切档位后合计按零售价重算', f1.$('#posCart').textContent.indexOf(fmt(f1p.priceRetail)) >= 0);
  var f1qty = f1.$('#posCart [data-act="set"]');
  f1qty.value = '5'; f1.fire(f1qty, 'change');
  check('数量 × 单价 合计正确', f1.$('#posCart').textContent.indexOf(fmt(5 * f1p.priceRetail)) >= 0,
    f1.$('#posCart').textContent.slice(0, 400));
  f1.App.settlePos();
  var f1order = f1.DB.all('sales').slice(-1)[0];
  check('结算写入手改后的单价', Math.abs(f1order.items[0].price - f1p.priceRetail) < 0.005, f1order.items[0].price);
  check('结算总额 = 数量 × 改后单价', Math.abs(f1order.total - 5 * f1p.priceRetail) < 0.005, f1order.total);
  check('改价流程无 JS 错误', f1.errors.length === 0, f1.errors.join(' | '));

  section('F2 客户档案管理 + 删除保护（GAP-02）');
  var f2 = boot();
  check('侧边栏出现客户管理入口', f2.$$('#nav [data-id="customers"]').length === 1);
  check('侧边栏出现供应商入口', f2.$$('#nav [data-id="suppliers"]').length === 1);
  f2.go('customers');
  check('客户管理标题正确', f2.text('#viewTitle') === '客户管理', f2.text('#viewTitle'));
  check('客户表格渲染 3 行种子数据', f2.$$('#custBody tr[data-id]').length === 3, f2.$$('#custBody tr[data-id]').length);
  check('客户表含累计交易额列', f2.$('#view').textContent.indexOf('累计交易额') >= 0);
  check('客户表含当前欠款列', f2.$('#view').textContent.indexOf('当前欠款') >= 0);
  var f2kw = f2.$('#custKw');
  f2kw.value = '星辰'; f2.fire(f2kw, 'input');
  check('客户搜索可过滤', f2.$$('#custBody tr[data-id]').length === 1, f2.$$('#custBody tr[data-id]').length);
  f2kw.value = ''; f2.fire(f2kw, 'input');
  f2.App.editCustomer();
  check('新增客户弹窗打开', !!f2.$('#c_name'));
  f2.$('#c_name').value = '测试批发部';
  f2.$('#c_phone').value = '13512345678';
  f2.App.saveCustomer('');
  check('客户数变为 4', f2.DB.all('customers').length === 4, f2.DB.all('customers').length);
  check('新客户字段落库', (function () {
    var c = f2.DB.all('customers').filter(function (x) { return x.name === '测试批发部'; })[0];
    return c && c.phone === '13512345678';
  })());
  var f2row = f2.DB.receivables().filter(function (r) { return !r.walkin; })[0];
  var f2used = f2.DB.get('customers', f2row.id);
  f2.App.delCustomer(f2used.id);
  check('有交易记录的客户不能被硬删', f2.DB.all('customers').length === 4, f2.DB.all('customers').length);
  check('被引用客户改为停用（archived）', f2.DB.get('customers', f2used.id).archived === true);
  check('提示文案说明改为停用', f2.$('#toastWrap').textContent.indexOf('停用') >= 0, f2.$('#toastWrap').textContent);
  check('停用后历史应收保持完整', (function () {
    var r = f2.DB.receivables().filter(function (x) { return x.id === f2used.id; })[0];
    return !!r && Math.abs(r.debt - f2row.debt) < 0.005;
  })());
  f2.go('customers');
  check('客户列表标出停用状态', f2.$('#custBody').textContent.indexOf('停用') >= 0, f2.$('#custBody').textContent.slice(0, 300));
  f2.go('pos');
  check('停用客户不出现在开单下拉框', f2.$('#posCust').innerHTML.indexOf('value="' + f2used.id + '"') < 0);
  f2.go('customers');
  var f2fresh = f2.DB.all('customers').filter(function (c) { return c.name === '测试批发部'; })[0];
  f2.App.delCustomer(f2fresh.id);
  check('无交易客户可正常删除', f2.DB.all('customers').length === 3, f2.DB.all('customers').length);
  check('客户管理全程无 JS 错误', f2.errors.length === 0, f2.errors.join(' | '));

  section('F3 供应商档案管理（GAP-02）');
  var f3 = boot({ hash: '#suppliers' });
  check('供应商标题正确', f3.text('#viewTitle') === '供应商', f3.text('#viewTitle'));
  check('供应商表格渲染 3 行', f3.$$('#supBody tr[data-id]').length === 3, f3.$$('#supBody tr[data-id]').length);
  check('供应商表含当前应付列', f3.$('#view').textContent.indexOf('当前应付') >= 0);
  f3.App.editSupplier();
  check('新增供应商弹窗打开', !!f3.$('#s_name'));
  f3.$('#s_name').value = '测试供货商';
  f3.App.saveSupplier('');
  check('供应商数变为 4', f3.DB.all('suppliers').length === 4, f3.DB.all('suppliers').length);
  var f3used = f3.DB.all('suppliers').filter(function (s) {
    return f3.DB.all('purchases').some(function (p) { return p.supplierId === s.id; });
  })[0];
  f3.App.delSupplier(f3used.id);
  check('有进货记录的供应商不能被硬删', f3.DB.all('suppliers').length === 4, f3.DB.all('suppliers').length);
  check('被引用供应商改为停用', f3.DB.get('suppliers', f3used.id).archived === true);
  f3.App.openPurchaseForm();
  check('停用供应商不出现在进货单下拉', f3.$('#puSup').innerHTML.indexOf('value="' + f3used.id + '"') < 0);
  f3.App.closeModal();
  check('供应商管理全程无 JS 错误', f3.errors.length === 0, f3.errors.join(' | '));

  section('F3b 开单页快速建档客户（GAP-02）');
  var f3b = boot({ hash: '#pos' });
  var f3sel = f3b.$('#posCust');
  check('开单下拉含「新增客户」入口', f3sel.textContent.indexOf('新增客户') >= 0, f3sel.textContent);
  f3sel.value = '__new__'; f3b.fire(f3sel, 'change');
  check('选中后弹出建档窗', !!f3b.$('#c_name'));
  f3b.$('#c_name').value = '现场新客户';
  f3b.App.saveCustomer('', true);
  var f3nc = f3b.DB.all('customers').filter(function (c) { return c.name === '现场新客户'; })[0];
  check('新客户已落库', !!f3nc);
  check('新客户自动选中到开单页', f3nc && f3b.$('#posCust').value === f3nc.id, f3b.$('#posCust').value);
  check('快速建档无 JS 错误', f3b.errors.length === 0, f3b.errors.join(' | '));

  section('F4 采购付款入口 + 状态文案（MNR-02 / MNR-06）');
  var f4 = boot({ hash: '#purchase' });
  var f4o = f4.DB.all('purchases').filter(function (p) { return p.total - p.paid > 0.005; })[0];
  var f4oid = f4o.id, f4paid0 = f4o.paid;
  var f4txt = f4.$('#view').textContent;
  check('采购列表用付款口径文案', /未付|部分付|已付清/.test(f4txt), f4txt.slice(0, 200));
  check('采购列表不再出现收款口径文案', f4txt.indexOf('已结清') < 0 && f4txt.indexOf('部分收') < 0, f4txt.slice(0, 200));
  f4.App.openPurchase(f4oid);
  check('未付进货单详情有付款按钮', f4.$('#modalFoot').textContent.indexOf('付款') >= 0, f4.$('#modalFoot').textContent);
  f4.App.payPurchase(f4oid);
  check('付款弹窗有金额输入框', !!f4.$('#ppAmt'));
  var f4payN = f4.DB.all('finance').filter(function (x) { return x.type === 'pay'; }).length;
  var f4payable0 = f4.DB.payables().reduce(function (a, x) { return a + x.unpaid; }, 0);
  f4.$('#ppAmt').value = '100';
  f4.App.doPayPurchase(f4oid);
  check('进货单已付 +100', Math.abs(f4.DB.get('purchases', f4oid).paid - (f4paid0 + 100)) < 0.005, f4.DB.get('purchases', f4oid).paid);
  check('财务新增 pay 流水', f4.DB.all('finance').filter(function (x) { return x.type === 'pay'; }).length === f4payN + 1);
  check('应付总额减少 100',
    Math.abs(f4payable0 - 100 - f4.DB.payables().reduce(function (a, x) { return a + x.unpaid; }, 0)) < 0.005,
    f4.DB.payables().reduce(function (a, x) { return a + x.unpaid; }, 0));
  f4.App.openPurchase(f4oid);
  check('状态标签显示部分付', f4.$('#modalBody').textContent.indexOf('部分付') >= 0, f4.$('#modalBody').textContent.slice(0, 140));
  check('超额付款只记实际未付部分', (function () {
    var left = f4.DB.round2(f4.DB.get('purchases', f4oid).total - f4.DB.get('purchases', f4oid).paid);
    f4.App.payPurchase(f4oid);
    f4.$('#ppAmt').value = String(left + 5000);
    f4.App.doPayPurchase(f4oid);
    var o = f4.DB.get('purchases', f4oid);
    return Math.abs(o.paid - o.total) < 0.005;
  })(), f4.DB.get('purchases', f4oid).paid);
  check('付清后状态为已付清', f4.DB.orderStatus(f4.DB.get('purchases', f4oid)) === 'paid');
  check('采购付款全程无 JS 错误', f4.errors.length === 0, f4.errors.join(' | '));

  section('F5 销售筛选 / 库存搜索 / POS 搜索对齐（MNR-03/07/08）');
  var f5 = boot({ hash: '#sales' });
  check('销售列表有状态筛选', !!f5.$('#saStatus'));
  check('销售列表有日期范围筛选', !!f5.$('#saRange'));
  check('销售列表有关键字搜索', !!f5.$('#saKw'));
  check('默认显示全部销售单', f5.$$('#saleBody tr[data-id]').length === f5.DB.all('sales').length,
    f5.$$('#saleBody tr[data-id]').length + ' vs ' + f5.DB.all('sales').length);
  f5.$('#saStatus').value = 'unpaid'; f5.fire(f5.$('#saStatus'), 'change');
  var f5unpaid = f5.DB.all('sales').filter(function (s) { return f5.DB.orderStatus(s) === 'unpaid'; }).length;
  check('选「欠款」只剩未收款单', f5.$$('#saleBody tr[data-id]').length === f5unpaid,
    f5.$$('#saleBody tr[data-id]').length + ' vs ' + f5unpaid);
  f5.$('#saStatus').value = 'open'; f5.fire(f5.$('#saStatus'), 'change');
  var f5open = f5.DB.receivables().reduce(function (a, r) { return a + r.orders; }, 0);
  check('选「未结清」条数 = 财务应收笔数', f5.$$('#saleBody tr[data-id]').length === f5open,
    f5.$$('#saleBody tr[data-id]').length + ' vs ' + f5open);
  f5.$('#saStatus').value = 'all'; f5.fire(f5.$('#saStatus'), 'change');
  f5.$('#saRange').value = 'today'; f5.fire(f5.$('#saRange'), 'change');
  var f5today = f5.DB.all('sales').filter(function (s) { return s.date === f5.DB.todayStr(); }).length;
  check('选「今日」只剩今天的单', f5.$$('#saleBody tr[data-id]').length === f5today,
    f5.$$('#saleBody tr[data-id]').length + ' vs ' + f5today);
  f5.$('#saRange').value = 'all'; f5.fire(f5.$('#saRange'), 'change');
  f5.$('#saKw').value = '利民'; f5.fire(f5.$('#saKw'), 'input');
  var f5kwN = f5.DB.all('sales').filter(function (s) { return (s.customerName || '').indexOf('利民') >= 0; }).length;
  check('客户关键字过滤生效', f5.$$('#saleBody tr[data-id]').length === f5kwN,
    f5.$$('#saleBody tr[data-id]').length + ' vs ' + f5kwN);
  check('筛选组合不产生 JS 错误', f5.errors.length === 0, f5.errors.join(' | '));

  var f5b = boot({ hash: '#inventory' });
  check('库存页有搜索框', !!f5b.$('#invKw'));
  check('库存页有「只看预警」开关', !!f5b.$('#invLowOnly'));
  check('库存默认显示全部商品', f5b.$$('#invBody tr[data-pid]').length === f5b.DB.all('products').length,
    f5b.$$('#invBody tr[data-pid]').length);
  f5b.$('#invKw').value = '海尔'; f5b.fire(f5b.$('#invKw'), 'input');
  var f5hair = f5b.DB.all('products').filter(function (p) {
    return (p.name + p.brand + p.model + p.type).indexOf('海尔') >= 0;
  }).length;
  check('库存搜索「海尔」只剩海尔商品', f5b.$$('#invBody tr[data-pid]').length === f5hair,
    f5b.$$('#invBody tr[data-pid]').length + ' vs ' + f5hair);
  f5b.$('#invKw').value = ''; f5b.fire(f5b.$('#invKw'), 'input');
  var f5low = f5b.$('#invLowOnly'); f5low.checked = true; f5b.fire(f5low, 'change');
  check('「只看预警」行数 = 预警商品数', f5b.$$('#invBody tr[data-pid]').length === f5b.DB.stockWarnings().length,
    f5b.$$('#invBody tr[data-pid]').length + ' vs ' + f5b.DB.stockWarnings().length);

  var f5c = boot({ hash: '#pos' });
  var f5vis = function () {
    return f5c.$$('#posGrid .prod-card').filter(function (c) { return c.style.display !== 'none'; });
  };
  f5c.$('#posKw').value = 'BCD-216STPT'; f5c.fire(f5c.$('#posKw'), 'input');
  check('POS 可按型号搜索', f5vis().length === 1, f5vis().length);
  f5c.$('#posKw').value = '洗衣机'; f5c.fire(f5c.$('#posKw'), 'input');
  check('POS 可按类型搜索', f5vis().length === 1, f5vis().length);

  section('F6 图表与代码整洁（MNR-01/04/09/10）');
  var f6 = boot({ hash: '#reports' });
  var f6svg = f6.$('#view svg.chart');
  check('图表等比缩放（不再拉伸变形）', f6svg.getAttribute('preserveAspectRatio') === 'xMidYMid meet',
    f6svg.getAttribute('preserveAspectRatio'));
  var f6cost = {};
  f6.DB.all('purchases').forEach(function (p) { p.items.forEach(function (it) { f6cost[it.productId] = it.price; }); });
  var f6miss = {};
  f6.DB.all('sales').forEach(function (s) {
    s.items.forEach(function (it) { if (!f6cost[it.productId]) f6miss[it.productId] = 1; });
  });
  var f6missN = Object.keys(f6miss).length;
  check('毛利卡片标注无成本商品数（' + f6missN + ' 种）',
    f6missN > 0 ? f6.$('#view').textContent.indexOf(f6missN + ' 种商品无采购成本') >= 0 : true,
    f6.$('#view').textContent.slice(0, 500));
  var appSrc = helpers.read('assets/app.js');
  check('app.js 不再挂临时全局 window.__*', appSrc.indexOf('window.__') < 0);
  check('app.js 已删除重复的 custOpts 死代码', (appSrc.match(/var custOpts/g) || []).length === 1,
    (appSrc.match(/var custOpts/g) || []).length);
  check('CSS 声明图表高度自适应', /\.chart\s*\{[^}]*height\s*:\s*auto/.test(helpers.read('assets/style.css')));
  check('报表页渲染无 JS 错误', f6.errors.length === 0, f6.errors.join(' | '));
}

/** 与 app.js money() 保持一致的金额格式，用于断言界面文本 */
function fmt(n) {
  return '¥' + Number(n || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

module.exports = { run: run };
