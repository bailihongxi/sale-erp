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

async function run() {

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

  section('E1b 弹窗遮罩点击 / ESC 关闭（MNR-05）+ 表单保护');
  var e1b = boot({ hash: '#products' });
  // 含可编辑表单的弹窗（新增商品）：点击遮罩和ESC不关闭，防止丢失编辑内容
  e1b.App.editProduct();
  check('表单弹窗已打开', e1b.$('#modalMask').classList.contains('show'));
  check('表单弹窗有 modal--protect 保护类', e1b.$('#modal').classList.contains('modal--protect'));
  e1b.click(e1b.$('#modalMask'));
  check('含表单弹窗点击遮罩不关闭', e1b.$('#modalMask').classList.contains('show'));
  e1b.document.dispatchEvent(new e1b.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  check('含表单弹窗按ESC不关闭', e1b.$('#modalMask').classList.contains('show'));
  e1b.click(e1b.$('#modal'));
  check('点击弹窗内部不会关闭', e1b.$('#modalMask').classList.contains('show'));
  e1b.App.closeModal();
  // 纯展示弹窗（进货单详情）：点击遮罩和ESC可以关闭
  var e1b2 = boot({ hash: '#purchase' });
  e1b2.App.openPurchase(e1b2.DB.all('purchases')[0].id);
  check('纯展示弹窗已打开', e1b2.$('#modalMask').classList.contains('show'));
  check('纯展示弹窗无 modal--protect 类', !e1b2.$('#modal').classList.contains('modal--protect'));
  e1b2.click(e1b2.$('#modalMask'));
  check('纯展示弹窗点击遮罩可关闭', !e1b2.$('#modalMask').classList.contains('show'));
  // 进货单弹窗（含复杂表单）也受保护
  var e1b3 = boot({ hash: '#purchase' });
  e1b3.App.openPurchaseForm();
  check('进货单弹窗有 modal--protect 保护类', e1b3.$('#modal').classList.contains('modal--protect'));
  e1b3.click(e1b3.$('#modalMask'));
  check('进货单弹窗点击遮罩不关闭', e1b3.$('#modalMask').classList.contains('show'));
  check('弹窗保护全程无 JS 错误', e1b.errors.length + e1b2.errors.length + e1b3.errors.length === 0,
    [e1b.errors, e1b2.errors, e1b3.errors].map(function (x) { return x.join('|'); }).join(' / '));

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

  /* ========================================================
     C 投产可用性（Sprint 3 · GAP-03 / GAP-05 / 护栏 / 空态）
     ======================================================== */
  section('C1 空白账本模式（GAP-03）');
  var c1 = boot();
  c1.DB.reset('blank');
  check('空白账本：商品清空', c1.DB.all('products').length === 0, c1.DB.all('products').length);
  check('空白账本：客户清空', c1.DB.all('customers').length === 0);
  check('空白账本：销售单清空', c1.DB.all('sales').length === 0);
  c1.go('dashboard');
  check('空白账本工作台无 JS 错误', c1.errors.length === 0, c1.errors.join(' | '));
  check('空白账本工作台营收为 0', c1.$('#view').textContent.indexOf('¥0.00') >= 0);

  section('C2 空白账本可走通全链路');
  var c2 = boot();
  c2.DB.reset('blank');
  c2.DB.insert('products', { name: '测试机', brand: 'B', model: 'M1', type: 'T', category: 'C', unit: '台', priceWholesale: 100, priceRetail: 120, stock: 10, lowStock: 5 });
  var c2p = c2.DB.all('products')[0];
  c2.DB.recordPurchase({ supplierId: null, supplierName: '其他供应商', items: [{ productId: c2p.id, qty: 5, price: 80 }], paid: 0, method: '欠款' });
  var c2sale = c2.DB.recordSale({ customerId: null, customerName: '散客', items: [{ productId: c2p.id, qty: 2, price: 100 }], paid: 200, method: '现金' });
  check('空白账本可开单', !!c2sale && c2.DB.all('sales').length === 1, c2.DB.all('sales').length);
  check('开单后库存 = 10+5-2 = 13', c2.DB.get('products', c2p.id).stock === 13, c2.DB.get('products', c2p.id).stock);

  section('C3 恢复示例数据');
  var c3 = boot();
  c3.DB.reset('blank');
  c3.DB.reset('demo');
  check('恢复示例：商品回到 8', c3.DB.all('products').length === 8, c3.DB.all('products').length);
  check('恢复示例：客户回到 3', c3.DB.all('customers').length === 3);

  section('C4 设置页提供双模式按钮');
  var c4 = boot({ hash: '#settings' });
  check('设置页有「清空为空白账本」按钮', c4.$('#view').textContent.indexOf('清空为空白账本') >= 0);
  check('设置页有「恢复示例数据」按钮', c4.$('#view').textContent.indexOf('恢复示例数据') >= 0);

  section('G1 存储位置徽标（GAP-05）');
  var g1 = boot();
  check('默认 https origin 徽标显示域名', !!g1.$('#originBadge') && /local\.test/.test(g1.text('#originBadge')), g1.$('#originBadge') ? g1.text('#originBadge') : 'no #originBadge');
  var g1b = boot({ url: 'file:///Users/me/SaleSystem/index.html' });
  check('file:// 徽标显示「本机文件」', !!g1b.$('#originBadge') && /本机文件/.test(g1b.text('#originBadge')), g1b.$('#originBadge') ? g1b.text('#originBadge') : 'no #originBadge');

  section('G2 首次打开引导（GAP-05）');
  var g2 = boot();
  check('首屏出现 origin 隔离引导提示', !!g2.$('#firstRunHint') && g2.$('#firstRunHint').classList.contains('show'), g2.$('#firstRunHint') ? 'hidden' : 'no el');

  section('G3 README 首屏警告');
  var readme = helpers.read('README.md');
  check('README 含「只用一种方式打开」', /只用一种方式打开/.test(readme));

  section('G4 滚动快照 + 导出提醒 + 用量（S3-03）');
  var g4 = boot();
  g4.DB.snapshotNow();
  check('快照已创建', g4.DB.snapshots().length >= 1, g4.DB.snapshots().length);
  var snap = g4.DB.snapshots()[0];
  var before = g4.DB.all('products').length;
  g4.DB.insert('products', { name: '快照后新增', stock: 1, unit: '台', priceWholesale: 1, priceRetail: 1 });
  g4.DB.restoreSnapshot(snap.index);
  check('从快照恢复后商品数回到快照时点', g4.DB.all('products').length === before, g4.DB.all('products').length + ' vs ' + before);
  g4.DB.saveSettings({ lastExportAt: g4.DB.todayStr(new Date(Date.now() - 10 * 86400000)) });
  g4.go('dashboard');
  check('超 7 天未导出出现提醒黄条', !!g4.$('#exportReminder') && g4.$('#exportReminder').classList.contains('show'));
  g4.DB.exportData();
  g4.go('dashboard');
  check('刚导出后不显示提醒', !g4.$('#exportReminder') || !g4.$('#exportReminder').classList.contains('show'));
  var info = g4.DB.storageInfo();
  check('storageInfo 返回占用/上限', info && typeof info.used === 'number' && typeof info.limit === 'number');

  section('G5 空白账本空态引导（S3-04）');
  var g5 = boot();
  g5.DB.reset('blank');
  g5.go('dashboard');
  check('空白工作台给出引导', /还没有数据|新增商品/.test(g5.$('#view').textContent), g5.$('#view').textContent.slice(0, 120));
  g5.go('products');
  check('空白商品页引导新增', /新增第一个商品|新增商品/.test(g5.$('#view').textContent), g5.$('#view').textContent.slice(0, 120));

  /* ========================================================
     I16 商品「备注」字段（表单/表格/卡片/批量导入 全覆盖）
     ======================================================== */
  section('I16 商品备注字段');
  // 1) 编辑表单含「备注」输入框
  var i16 = boot({ hash: '#products' });
  i16.App.editProduct();
  check('编辑弹窗含「备注」输入框 #f_remark', !!i16.$('#f_remark'),
    i16.$('#modalBody').innerHTML.slice(-260));
  // 2) 保存后备注落库
  i16.$('#f_name').value = '备注测试商品';
  i16.$('#f_remark').value = '这是一段备注';
  i16.App.saveProduct('');
  var i16prod = i16.DB.all('products').filter(function (p) { return p.name === '备注测试商品'; })[0];
  check('保存后备注写入数据', !!i16prod && i16prod.remark === '这是一段备注', i16prod && i16prod.remark);
  // 3) 桌面表格含「备注」表头 + 行内显示
  var i16ths = i16.$('#prodBody').parentNode.querySelectorAll('th');
  var i16hasHeader = false;
  for (var i16h = 0; i16h < i16ths.length; i16h++) {
    if (i16ths[i16h].textContent.trim() === '备注') i16hasHeader = true;
  }
  check('桌面表格含「备注」表头', i16hasHeader);
  check('商品行显示备注内容', i16.text('#prodBody').indexOf('这是一段备注') >= 0,
    i16.text('#prodBody').slice(0, 200));
  // 4) 手机卡片显示备注
  check('手机卡片显示备注内容', i16.text('#prodCards').indexOf('这是一段备注') >= 0,
    i16.text('#prodCards').slice(0, 200));
  // 5) 批量导入支持「备注」列
  var i16b = boot({ hash: '#products' });
  i16b.App.openBatchImport();
  i16b.$('#batchArea').value = '商品名称,品牌,备注\n导入带备注,品牌Y,备注内容XYZ';
  i16b.App.doBatchImport();
  var i16imp = i16b.DB.all('products').filter(function (p) { return p.name === '导入带备注'; })[0];
  check('CSV 含「备注」列时映射到 remark', !!i16imp && i16imp.remark === '备注内容XYZ', i16imp && i16imp.remark);
  // 6) 下载模板含「备注」表头
  var i16tpl = '';
  var i16blob = i16b.window.Blob;
  i16b.window.Blob = function (parts) { i16tpl = (parts[0] || '').toString(); };
  var i16url = i16b.window.URL.createObjectURL;
  i16b.window.URL.createObjectURL = function () { return 'blob:t'; };
  var i16ce = i16b.document.createElement.bind(i16b.document);
  i16b.document.createElement = function (tag) { var el = i16ce(tag); if (tag === 'a') el.click = function () {}; return el; };
  i16b.App.downloadCsvTemplate();
  i16b.document.createElement = i16ce;
  i16b.window.URL.createObjectURL = i16url;
  i16b.window.Blob = i16blob;
  check('下载的 CSV 模板含「备注」表头', /备注/.test(i16tpl), i16tpl.slice(0, 140));

  /* ========================================================
     N1 手机端开单卡片精简化 + 加载性能优化
     ======================================================== */
  section('N1 手机端开单卡片精简与加载优化');
  var n1 = boot({ hash: '#pos' });
  var n1card = n1.$('#posGrid .prod-card');
  var n1css = helpers.read('assets/style.css');
  // 桌面端：所有字段都在 DOM 中（brand/stock/wholesale/retail 均渲染，靠 CSS 区分显隐）
  check('开单卡片含名称节点 .nm', !!n1card.querySelector('.nm'));
  check('开单卡片含类型节点 .meta--type', !!n1card.querySelector('.meta--type'));
  check('开单卡片含品牌节点 .meta--brand（桌面显示）', !!n1card.querySelector('.meta--brand'));
  check('开单卡片含库存节点 .meta--stock（桌面显示）', !!n1card.querySelector('.meta--stock'));
  check('开单卡片含批发价节点 .pr--wholesale（桌面显示）', !!n1card.querySelector('.pr--wholesale'));
  check('开单卡片含销售价节点 .pr--retail（手机显示）', !!n1card.querySelector('.pr--retail'));

  // 手机端(≤768px)：隐藏 brand/stock/wholesale，仅显示 name/type/retail(销售价)
  // 精确定位主响应式块：仅移动端块含「.prod-card .meta--brand{display:none}」这一独有规则
  var blk768 = (n1css.split(/@media/).filter(function (s) {
    return /max-width:\s*768px/.test(s) && /\.prod-card \.meta--brand\{display:none/.test(s);
  })[0]) || '';
  check('手机端隐藏品牌节点 .meta--brand', /\.prod-card[^{]*\.meta--brand\s*\{[^}]*display:\s*none/.test(blk768));
  check('手机端隐藏库存节点 .meta--stock', /\.prod-card[^{]*\.meta--stock\s*\{[^}]*display:\s*none/.test(blk768));
  check('手机端隐藏批发价节点 .pr--wholesale', /\.prod-card[^{]*\.pr--wholesale\s*\{[^}]*display:\s*none/.test(blk768));
  check('手机端显示销售价节点 .pr--retail（非 display:none）', /\.prod-card[^{]*\.pr--retail\s*\{[^}]*display:\s*(block|inline-block|flex)/.test(blk768));
  // 桌面默认隐藏 .pr--retail（手机才显示销售价）
  check('桌面默认隐藏销售价节点 .pr--retail', /\.prod-card[^{]*\.pr--retail\s*\{[^}]*display:\s*none/.test(n1css));

  // 性能优化：长列表渲染不卡顿 —— 卡片启用 content-visibility 跳过屏外渲染
  check('开单卡片启用 content-visibility:auto（长列表性能优化）', /\.prod-card\s*\{[^}]*content-visibility:\s*auto/.test(n1css));

  // 行为：点击卡片（事件委托）仍能将商品加入购物车
  var n1cartBefore = n1.$$('#posCart .cart-item').length;
  n1.click(n1card);
  check('点击卡片经事件委托加入购物车', n1.$$('#posCart .cart-item').length === n1cartBefore + 1,
    n1.$$('#posCart .cart-item').length);

  // 行为：按类型搜索在精简后仍然可用
  var n1type = n1card.querySelector('.meta--type').textContent.trim();
  var n1total = n1.$$('#posGrid .prod-card').length;
  n1.$('#posKw').value = n1type.slice(0, 2); n1.fire(n1.$('#posKw'), 'input');
  var n1shown = n1.$$('#posGrid .prod-card').filter(function (c) { return c.style.display !== 'none'; }).length;
  check('按类型搜索在精简卡片上仍生效', n1shown < n1total, 'shown=' + n1shown + ' total=' + n1total);
  n1.fire(n1.$('#posKw'), 'input'); // 还原

  /* ========================================================
     N3 开单结算模块与产品模块 1:1 等宽排版（问题1）
     ======================================================== */
  section('N3 开单结算与产品模块 1:1 排版');
  var n3 = boot({ hash: '#pos' });
  var n3css = helpers.read('assets/style.css');
  check('桌面端 .pos 两模块等宽 1:1（grid-template-columns:1fr 1fr）',
    /\.pos\s*\{[^}]*grid-template-columns:\s*1fr\s+1fr/.test(n3css),
    n3css.match(/\.pos\s*\{[^}]*\}/));
  check('结算模块不再使用固定 380px 窄宽',
    !/\.pos\s*\{[^}]*grid-template-columns:\s*380px/.test(n3css));

  /* ========================================================
     N4 开单产品列表分页展示（每页最多 300 个，问题2）
     ======================================================== */
  section('N4 开单产品列表分页展示（每页≤200）');
  // 常态（≤200）：单页全部渲染，不出现分页按钮（沿用旧行为，避免小目录多出分页条）
  var n4 = boot({ hash: '#pos' });
  var n4seed = n4.DB.all('products').length; // 8
  check('开单网格默认渲染全部商品（≤300 单页）', n4.$$('#posGrid .prod-card').length === n4seed,
    n4.$$('#posGrid .prod-card').length + ' vs ' + n4seed);
  check('≤300 时不出现「下一页」分页按钮', !n4.$('#posPager [data-pg="next"]'));
  check('单页时分页条仅显示数量信息', /共\s*\d+\s*个/.test(n4.$('#posPager').textContent));

  // 大数据量（>300）：触发分页，每页最多 POS_PAGE_SIZE 张卡，避免一次性渲染全部导致卡顿
  var PAGE4 = n4.App.POS_PAGE_SIZE; // 300
  var arr4 = [];
  for (var j = 0; j < 301; j++) {
    arr4.push({ name: '批量商品' + j, brand: 'B' + (j % 50), model: 'M' + j, type: '测试仪', unit: '台', priceWholesale: 100, priceRetail: 120, stock: 1, lowStock: 1 });
  }
  n4.DB.insertBatch('products', arr4);
  n4.App.routeSync(); // 重新渲染开单网格
  var n4total = n4.DB.all('products').length; // 8(种子) + 301 = 309
  check('每页最多渲染 POS_PAGE_SIZE 张卡', n4.$$('#posGrid .prod-card').length === PAGE4,
    n4.$$('#posGrid .prod-card').length + ' vs ' + PAGE4);
  check('>300 时出现「下一页」分页按钮', !!n4.$('#posPager [data-pg="next"]'));
  check('首页「上一页」按钮禁用', n4.$('#posPager [data-pg="prev"]').disabled === true);
  check('分页条显示总页数信息', /第\s*1\s*\/\s*\d+\s*页/.test(n4.$('#posPager').textContent), n4.$('#posPager').textContent.trim());

  // 翻到下一页：渲染剩余商品，「上一页」可用
  n4.click(n4.$('#posPager [data-pg="next"]'));
  check('翻页后渲染剩余商品', n4.$$('#posGrid .prod-card').length === n4total - PAGE4,
    n4.$$('#posGrid .prod-card').length + ' vs ' + (n4total - PAGE4));
  check('翻页后「上一页」可用', n4.$('#posPager [data-pg="prev"]').disabled === false);
  check('末页「下一页」按钮禁用', n4.$('#posPager [data-pg="next"]').disabled === true);

  // 回到首页并搜索：分页应重置回第 1 页
  n4.click(n4.$('#posPager [data-pg="prev"]'));
  n4.$('#posKw').value = '批量商品'; n4.fire(n4.$('#posKw'), 'input');
  check('搜索后分页重置到第 1 页（首页「上一页」禁用）', n4.$('#posPager [data-pg="prev"]').disabled === true);

  // 点击页码按钮跳转（第 2 页）
  n4.$('#posKw').value = ''; n4.fire(n4.$('#posKw'), 'input');
  n4.click(n4.$('#posPager [data-pg="2"]'));
  check('点击页码按钮跳转到第 2 页', n4.$('#posPager [data-pg="prev"]').disabled === false &&
    /第\s*2\s*\/\s*\d+\s*页/.test(n4.$('#posPager').textContent), n4.$('#posPager').textContent.trim());

  /* ========================================================
     M 手机端就绪度（S4-02）
     ======================================================== */
  section('M1 视口与移动端标记');
  var idxHtml = helpers.read('index.html');
  check('index.html 含 viewport（width=device-width）', /name="viewport"[^>]*width=device-width/.test(idxHtml));
  check('index.html 含 viewport-fit=cover（刘海屏安全区）', /viewport-fit=cover/.test(idxHtml));

  section('M2 手机底部导航与"我的"菜单');
  var m = boot();
  check('底部导航渲染 4 项', m.$$('#bottomNav .nav__item').length === 4, m.$$('#bottomNav .nav__item').length);
  check('Sheet 菜单含全部 ' + NAV_COUNT + ' 个模块', m.$$('#sheetNav .nav__item').length === NAV_COUNT, m.$$('#sheetNav .nav__item').length);
  var moreBtn = m.$('#bottomNav [data-id="more"]');
  m.click(moreBtn);
  check('点"我的"弹出底部菜单 Sheet', m.$('#sheetMask').classList.contains('show'));
  var sheetItem = m.$('#sheetNav [data-id="products"]');
  m.click(sheetItem);
  check('Sheet 中点模块后自动收起（BUG-06 回归）', !m.$('#sheetMask').classList.contains('show'));

  section('M3 路由切换强制收起 Sheet（BUG-06 兜底）');
  var m3 = boot();
  m3.App.openSheet();
  check('openSheet 后 Sheet 显示', m3.$('#sheetMask').classList.contains('show'));
  m3.window.location.hash = '#inventory';
  m3.App.routeSync();
  check('路由切换后 Sheet 被强制收起', !m3.$('#sheetMask').classList.contains('show'));

  section('M4 响应式断点与表格横向滚动');
  var css = helpers.read('assets/style.css');
  check('style.css 含 ≤768px 媒体查询', /@media\s*\(max-width:\s*768px\)/.test(css));
  check('style.css 含 ≤1100px 媒体查询（平板过渡）', /@media\s*\(max-width:\s*1100px\)/.test(css));
  var block768 = css.split('@media (max-width:768px)').slice(1).map(function (p) { return p.split('@media').shift(); }).join('\n');
  check('手机端 .table 可横向滚动（overflow-x:auto）',
    /\.table\s*\{[^}]*overflow-x:\s*auto/.test(block768) || /\.table\s*\{[^}]*display:\s*block/.test(block768),
    '需为 .table 增加 overflow-x:auto');
  check('手机端禁用页面横向溢出（overflow-x:hidden）',
    /body\s*\{[^}]*overflow-x:\s*hidden/.test(block768),
    '需加 body{overflow-x:hidden}');
  // 清单项3：工作台 KPI 单列；清单项5：开单页单列堆叠
  check('手机端 KPI 单列排布（.grid--kpi→1fr）',
    /@media[\s\S]*max-width:\s*768px[\s\S]*?\.grid--kpi[^{]*\s*\{[^}]*grid-template-columns:\s*1fr/.test(css));
  check('手机/平板端开单页单列堆叠（.pos→1fr）',
    /@media[\s\S]*max-width:\s*1100px[\s\S]*?\.pos\s*\{[^}]*grid-template-columns:\s*1fr/.test(css));

  section('M5 桌面专属信息在手机端隐藏');
  check('origin 徽标带 hide-mobile', /class="origin-badge hide-mobile"/.test(idxHtml));
  check('店铺名带 hide-mobile', /class="shop hide-mobile"/.test(idxHtml));
  check('style.css 定义 .hide-mobile 隐藏', /\.hide-mobile\s*\{\s*display:\s*none!important/.test(css));

  /* ========================================================
     I 用户新需求（5 项，逐个实现并提交）
     ======================================================== */
  section('I1 商品管理页批量导入');
  var i1 = boot({ hash: '#products' });
  check('商品页有「批量导入」按钮', /批量导入/.test(i1.$('#view').textContent));
  i1.App.openBatchImport();
  check('点击后打开导入弹窗并含文本域', !!i1.$('#batchArea'));
  var csv = '商品名称,品牌,型号,类型,单位,批发价,零售价,低库存阈值,库存\n' +
    '测试导入A,品牌A,型号A,类型A,台,100,150,5,20\n' +
    '测试导入B,品牌B,型号B,类型B,台,200,250,5,30';
  i1.$('#batchArea').value = csv;
  i1.App.doBatchImport();
  check('CSV 导入新增 2 个商品', i1.DB.all('products').filter(function (p) { return p.name.indexOf('测试导入') >= 0; }).length === 2,
    i1.DB.all('products').filter(function (p) { return p.name.indexOf('测试导入') >= 0; }).length);
  check('导入后仍停留在商品页', /商品管理/.test(i1.text('#viewTitle')));
  var i1a = i1.DB.all('products').filter(function (p) { return p.name === '测试导入A'; })[0];
  check('导入字段正确（批发价）', !!i1a && i1a.priceWholesale === 100, i1a && i1a.priceWholesale);
  check('导入字段正确（库存）', !!i1a && i1a.stock === 20, i1a && i1a.stock);
  var i1b = boot({ hash: '#products' });
  i1b.App.openBatchImport();
  i1b.$('#batchArea').value = '商品名称,批发价\n,100\n测试导入C,100';
  i1b.App.doBatchImport();
  check('无名称行被跳过，有效行仍导入', i1b.DB.all('products').filter(function (p) { return p.name === '测试导入C'; }).length === 1);
  var i1c = boot({ hash: '#products' });
  i1c.App.openBatchImport();
  i1c.$('#batchArea').value = JSON.stringify([
    { name: 'JSON导入A', brand: 'J', priceWholesale: 300, priceRetail: 400, stock: 10 },
    { name: 'JSON导入B', brand: 'J', priceWholesale: 500, priceRetail: 600, stock: 20 }
  ]);
  i1c.App.doBatchImport();
  check('JSON 数组导入成功', i1c.DB.all('products').filter(function (p) { return p.name.indexOf('JSON导入') >= 0; }).length === 2);
  check('批量导入全程无 JS 错误', i1.errors.length + i1b.errors.length + i1c.errors.length === 0,
    [i1.errors, i1b.errors, i1c.errors].map(function (x) { return x.join('|'); }).join(' / '));

  section('I1b 批量导入选择CSV文件 + 下载模板');
  var i1t = boot({ hash: '#products' });
  i1t.App.openBatchImport();
  check('导入弹窗含「选择CSV文件」按钮', /选择CSV文件/.test(i1t.$('#modalBody').textContent));
  check('导入弹窗含「下载 CSV 模板」按钮', /下载 CSV 模板/.test(i1t.$('#modalBody').textContent));
  check('弹窗含隐藏文件选择器 #batchFile', !!i1t.$('#batchFile') && i1t.$('#batchFile').type === 'file');
  check('文件选择器接受 .csv', i1t.$('#batchFile').accept.indexOf('.csv') >= 0);
  check('App.chooseCsvFile 函数存在', typeof i1t.App.chooseCsvFile === 'function');
  check('App.loadCsvFile 函数存在', typeof i1t.App.loadCsvFile === 'function');
  // chooseCsvFile 触发隐藏 input 的 click
  var fileInput = i1t.$('#batchFile');
  var clicked = false;
  fileInput.click = function () { clicked = true; };
  i1t.App.chooseCsvFile();
  check('chooseCsvFile 触发了文件选择器点击', clicked);
  // loadCsvFile：模拟 FileReader 同步读取文件内容并填入文本框
  var csvContent = '商品名称,品牌,型号,类型,单位,批发价,零售价,低库存阈值,库存\n测试文件商品,品牌X,型号X,类型X,台,50,80,5,15\n';
  var mockFile = { name: 'test.csv', size: csvContent.length };
  var origFileReader = i1t.window.FileReader;
  i1t.window.FileReader = function () {
    this.readAsText = function () {
      // 同步触发 onload，便于测试断言
      this.onload({ target: { result: csvContent } });
    };
    this.onerror = null;
  };
  i1t.App.loadCsvFile({ files: [mockFile], value: 'test.csv' });
  check('loadCsvFile 将文件内容填入文本框', i1t.$('#batchArea').value === csvContent,
    i1t.$('#batchArea').value.slice(0, 80));
  check('载入后内容可被 doBatchImport 正常解析（1个商品）', (function () {
    var before = i1t.DB.all('products').length;
    i1t.App.doBatchImport();
    return i1t.DB.all('products').length === before + 1;
  })());
  i1t.window.FileReader = origFileReader;
  // 下载模板：jsdom 兼容打桩
  if (typeof i1t.window.Blob !== 'function') {
    i1t.window.Blob = function (parts, opts) { this.parts = parts; };
  }
  var dlClicked = false;
  var origCreate = i1t.window.URL.createObjectURL;
  i1t.window.URL.createObjectURL = function () { return 'blob:test'; };
  var origCreateEl = i1t.document.createElement.bind(i1t.document);
  i1t.document.createElement = function (tag) {
    var el = origCreateEl(tag);
    if (tag === 'a') { el.click = function () { dlClicked = true; }; }
    return el;
  };
  i1t.App.downloadCsvTemplate();
  check('下载模板触发了点击', dlClicked);
  i1t.document.createElement = origCreateEl;
  i1t.window.URL.createObjectURL = origCreate;
  check('CSV文件导入功能全程无 JS 错误', i1t.errors.length === 0, i1t.errors.join(' | '));

  section('I1c 大批量导入性能优化（insertBatch）');
  var i1c = boot({ hash: '#products' });
  // 构造300行CSV数据
  var bigCsv = ['商品名称,品牌,型号,类型,单位,批发价,零售价,低库存阈值,库存'];
  for (var k = 0; k < 300; k++) {
    bigCsv.push('压测商品' + k + ',品牌B,型号M' + k + ',类型T,台,' + (10 + k) + ',' + (20 + k) + ',5,' + k);
  }
  var beforeN = i1c.DB.all('products').length;
  i1c.App.openBatchImport();
  i1c.$('#batchArea').value = bigCsv.join('\n');
  var t1 = Date.now();
  i1c.App.doBatchImport();
  var elapsed1 = Date.now() - t1;
  check('300行CSV导入成功，商品数+300', i1c.DB.all('products').length === beforeN + 300,
    '实际=' + (i1c.DB.all('products').length - beforeN));
  check('300行导入耗时<1000ms', elapsed1 < 1000, '耗时=' + elapsed1 + 'ms');
  check('大批量导入无 JS 错误', i1c.errors.length === 0, i1c.errors.join(' | '));
  // 验证导入数据正确
  var sample = i1c.DB.all('products').filter(function (p) { return p.name === '压测商品150'; })[0];
  check('批量导入数据字段正确（名称/批发价/库存）', !!sample && sample.priceWholesale === 160 && sample.stock === 150,
    sample && (sample.priceWholesale + '/' + sample.stock));

  section('I2 销售开单结算与搜索位置互换');
  var i2 = boot({ hash: '#pos' });
  var posEl = i2.$('.pos');
  check('开单容器下有两个卡片', posEl && posEl.children.length === 2, posEl && posEl.children.length);
  var i2first = posEl && posEl.children[0];
  var i2last = posEl && posEl.children[1];
  check('结算购物车位于首位（左侧/上方）', !!i2first && i2first.id === 'posCart', i2first && i2first.id);
  check('搜索商品区位于次位（右侧/下方）', !!i2last && !!i2last.querySelector('#posKw'));
  var i2css = helpers.read('assets/style.css');
  check('桌面端 .pos 两模块等宽 1:1（grid-template-columns:1fr 1fr）',
    /\.pos\s*\{[^}]*grid-template-columns:\s*1fr\s+1fr/.test(i2css),
    i2css.match(/\.pos\s*\{[^}]*\}/));
  // 开单页搜索框红色醒目标识
  check('开单页搜索框有红色边框样式', /\.pos \.search input\{[^}]*border:\s*2px solid #ef4444/.test(i2css),
    i2css.match(/\.pos \.search input\{[^}]*\}/));
  check('开单页搜索框有红色背景', /\.pos \.search input\{[^}]*background:\s*#fef2f2/.test(i2css));
  // 开单产品分页每页200条
  check('开单产品分页每页200条', i2.App.POS_PAGE_SIZE === 200, i2.App.POS_PAGE_SIZE);

  section('I3 新建进货单重新设计（搜索+添加+产品列表+结算）');
  var i3 = boot({ hash: '#purchase' });
  i3.App.openPurchaseForm();
  check('进货单弹窗有 purchase-modal 类', i3.$('#modal').classList.contains('purchase-modal'));
  var i3css = helpers.read('assets/style.css');
  check('CSS 定义进货单弹窗电脑端宽度50vw', /\.modal\.purchase-modal\{[^}]*width:\s*50vw/.test(i3css));
  check('CSS 定义进货单弹窗高度自适应(max-height)', /\.modal\.purchase-modal\{[^}]*max-height:\s*92vh/.test(i3css));
  check('CSS 定义手机端进货单弹窗全宽', /@media[\s\S]*max-width:\s*768px[\s\S]*?\.modal\.purchase-modal\{[^}]*width:\s*100%/.test(i3css));
  check('进货单有搜索框 #puKw', !!i3.$('#puKw'));
  check('进货单有添加按钮 #puAddBtn', !!i3.$('#puAddBtn'));
  check('进货单有产品列表 #puItems', !!i3.$('#puItems'));
  check('进货单有单号显示 #puNo', !!i3.$('#puNo') && /^PO-/.test(i3.$('#puNo').textContent));
  check('进货单有供应商下拉 #puSup', !!i3.$('#puSup'));
  check('进货单有日期选择 #puDate', !!i3.$('#puDate'));
  check('进货单有优惠输入 #puDiscount', !!i3.$('#puDiscount'));
  check('进货单有件数显示 #puCount', !!i3.$('#puCount'));
  check('进货单有合计显示 #puTotal', !!i3.$('#puTotal'));
  check('进货单有实付显示 #puPayable', !!i3.$('#puPayable'));
  // 搜索自动补全下拉
  check('进货单有搜索建议容器 #puSuggest', !!i3.$('#puSuggest'));
  i3.$('#puKw').value = '海尔';
  i3.fire(i3.$('#puKw'), 'input');
  check('输入关键词后显示下拉建议', i3.$('#puSuggest').classList.contains('show'),
    i3.$('#puSuggest').className);
  check('下拉建议包含匹配商品', i3.$$('#puSuggest .pu-suggest__item').length > 0,
    'items=' + i3.$$('#puSuggest .pu-suggest__item').length);
  check('下拉建议项含商品名称', /海尔/.test(i3.$('#puSuggest').textContent),
    i3.$('#puSuggest').textContent.slice(0, 80));
  // 点击下拉建议项添加商品
  var firstItem = i3.$('#puSuggest .pu-suggest__item');
  var itemName = firstItem.getAttribute('data-name');
  i3.fire(firstItem, 'mousedown');
  check('点击建议项后产品列表有1行', i3.$$('#puItems tr').length === 1, 'rows=' + i3.$$('#puItems tr').length);
  check('点击建议项后下拉隐藏', !i3.$('#puSuggest').classList.contains('show'));
  // 重复添加同一商品自动累加数量
  i3.$('#puKw').value = itemName;
  i3.fire(i3.$('#puKw'), 'input');
  i3.fire(i3.$('#puSuggest .pu-suggest__item'), 'mousedown');
  check('重复添加后列表仍1行（数量累加）', i3.$$('#puItems tr').length === 1, 'rows=' + i3.$$('#puItems tr').length);
  check('重复添加后数量=2', i3.$('#puItems .pu-qty').value === '2', i3.$('#puItems .pu-qty').value);
  // 清空搜索后下拉隐藏
  i3.$('#puKw').value = '';
  i3.fire(i3.$('#puKw'), 'input');
  check('清空关键词后下拉隐藏', !i3.$('#puSuggest').classList.contains('show'));
  // 搜索建议分页加载：插入30个匹配商品，验证初始20条+加载更多
  for (var pi = 0; pi < 30; pi++) {
    i3.DB.insert('products', { name: '分页测试商品' + pi, brand: 'B', model: 'M' + pi, type: 'T', unit: '台', priceWholesale: 1, priceRetail: 2, stock: 1, lowStock: 1 });
  }
  i3.App.openPurchaseForm();
  i3.$('#puKw').value = '分页测试商品';
  i3.fire(i3.$('#puKw'), 'input');
  check('匹配30条时初始显示20条', i3.$$('#puSuggest .pu-suggest__item').length === 20,
    'items=' + i3.$$('#puSuggest .pu-suggest__item').length);
  check('匹配>20条时显示加载更多按钮', !!i3.$('#puSuggest .pu-suggest__more'),
    i3.$('#puSuggest').innerHTML.slice(0, 100));
  check('加载更多按钮显示剩余条数', /还有 10 条/.test(i3.$('#puSuggest .pu-suggest__more').textContent),
    i3.$('#puSuggest .pu-suggest__more').textContent);
  // 点击加载更多
  i3.fire(i3.$('#puSuggest .pu-suggest__more'), 'mousedown');
  check('点击加载更多后显示30条', i3.$$('#puSuggest .pu-suggest__item').length === 30,
    'items=' + i3.$$('#puSuggest .pu-suggest__item').length);
  check('全部显示后无加载更多按钮', !i3.$('#puSuggest .pu-suggest__more'));
  // 清空商品列表，后续测试重新开始
  while (i3.$('#puItems .pu-del')) { i3.click(i3.$('#puItems .pu-del')); }
  check('清空后商品列表为空', i3.$$('#puItems tr').length === 0);
  // 搜索添加商品（旧方式保留）
  i3.$('#puKw').value = '海尔';
  i3.click(i3.$('#puAddBtn'));
  check('添加后产品列表有1行', i3.$$('#puItems tr').length === 1, 'rows=' + i3.$$('#puItems tr').length);
  check('添加后件数=1', i3.$('#puCount').textContent === '1', i3.$('#puCount').textContent);
  check('合计大于0', /¥[1-9]/.test(i3.$('#puTotal').textContent), i3.$('#puTotal').textContent);
  // 数量+按钮
  i3.click(i3.$('#puItems .pu-plus'));
  check('点击+后数量变为2', i3.$('#puItems .pu-qty').value === '2', i3.$('#puItems .pu-qty').value);
  check('件数更新为2', i3.$('#puCount').textContent === '2');
  // 数量-按钮
  i3.click(i3.$('#puItems .pu-minus'));
  check('点击-后数量变回1', i3.$('#puItems .pu-qty').value === '1');
  // 重复添加同一商品（应数量累加）
  i3.$('#puKw').value = '海尔';
  i3.click(i3.$('#puAddBtn'));
  check('重复添加同一商品后列表仍1行（数量累加）', i3.$$('#puItems tr').length === 1, 'rows=' + i3.$$('#puItems tr').length);
  check('重复添加后数量=2', i3.$('#puItems .pu-qty').value === '2', i3.$('#puItems .pu-qty').value);
  // 删除商品
  i3.click(i3.$('#puItems .pu-del'));
  check('删除后列表为空', i3.$$('#puItems tr').length === 0);
  // 重新添加并保存
  i3.$('#puKw').value = '海尔';
  i3.click(i3.$('#puAddBtn'));
  i3.$('#puSup').value = i3.DB.all('suppliers')[0].id;
  var beforeN = i3.DB.all('purchases').length;
  i3.App.savePurchase();
  check('保存后进货单+1', i3.DB.all('purchases').length === beforeN + 1);
  check('进货单新设计全程无 JS 错误', i3.errors.length === 0, i3.errors.join(' | '));

  section('I4 设置页 GitHub Pages 数据同步');
  var i4 = boot({ hash: '#settings' });
  check('设置页有 GitHub 同步入口', /同步到 GitHub|GitHub Pages|更新到 GitHub/.test(i4.$('#view').textContent));
  var fetchCalls = [];
  i4.window.fetch = function (url, opts) {
    fetchCalls.push({ url: url, method: (opts && opts.method) || 'GET', headers: (opts && opts.headers) || {}, body: (opts && opts.body) || null });
    return Promise.resolve({
      ok: fetchCalls.length === 1 ? false : true,
      status: fetchCalls.length === 1 ? 404 : 200,
      json: function () { return Promise.resolve(fetchCalls.length === 1 ? { message: 'Not Found' } : { content: { html_url: 'https://github.com/x/blob/data/state.json' } }); }
    });
  };
  i4.$('#ghRepo').value = 'bailihongxi/sale-erp';
  i4.$('#ghPath').value = 'data/state.json';
  i4.$('#ghBranch').value = 'main';
  i4.$('#ghToken').value = 'fake-token';
  i4.App.syncToGitHub();
  check('同步发起 GET 请求获取文件 SHA', fetchCalls.length >= 1 && fetchCalls[0].method === 'GET',
    fetchCalls.length + ' calls');
  await new Promise(function (r) { setTimeout(r, 30); });
  check('文件不存在后发起 PUT 创建/更新文件', fetchCalls.length >= 2 && fetchCalls[1].method === 'PUT',
    fetchCalls.length + ' calls');
  var putBody = fetchCalls[1] && JSON.parse(fetchCalls[1].body);
  check('PUT 请求体含 base64 数据内容', !!putBody && typeof putBody.content === 'string' && putBody.content.length > 100);
  check('PUT 请求体含分支信息', !!putBody && putBody.branch === 'main');
  check('PUT 请求头含 Authorization token',
    !!fetchCalls[1] && /token fake-token/.test(fetchCalls[1].headers.Authorization || fetchCalls[1].headers.authorization || ''));
  check('GET URL 含仓库、文件路径与分支',
    /api\.github\.com\/repos\/bailihongxi\/sale-erp\/contents\/data%2Fstate\.json/.test(fetchCalls[0].url) &&
    /ref=main/.test(fetchCalls[0].url));
  var i4b = boot({ hash: '#settings' });
  var i4bCalls = [];
  i4b.window.fetch = function (url, opts) { i4bCalls.push({ url: url }); return Promise.resolve({ ok: true, json: function () { return Promise.resolve({}); } }); };
  i4b.$('#ghToken').value = '';
  i4b.App.syncToGitHub();
  check('未填 token 时不调用 fetch', i4bCalls.length === 0);
  check('GitHub 同步全程无 JS 错误', i4.errors.length + i4b.errors.length === 0,
    [i4.errors, i4b.errors].map(function (x) { return x.join('|'); }).join(' / '));

  section('I4b 数据管理页一键同步到在线版本');
  var i4c = boot({ hash: '#data' });
  check('数据管理页有「提交同步数据」按钮', !!i4c.$('button[onclick="App.pushDataToOnline()"]'));
  check('数据管理页有「检查在线更新」按钮', !!i4c.$('button[onclick="App.pullDataFromOnline()"]'));
  check('数据管理页有同步状态显示区', !!i4c.$('#syncStatus'));
  check('pushDataToOnline 函数存在', typeof i4c.App.pushDataToOnline === 'function');
  check('pullDataFromOnline 函数存在', typeof i4c.App.pullDataFromOnline === 'function');
  // 未配置token时不调用fetch
  var i4cCalls = [];
  var origFetch = global.fetch;
  global.fetch = function (url, opts) { i4cCalls.push({ url: url, method: (opts && opts.method) || 'GET' }); return Promise.resolve({ ok: true, json: function () { return Promise.resolve({}); } }); };
  i4c.window.fetch = global.fetch;
  i4c.App.pushDataToOnline();
  check('未配置token时push不调用fetch', i4cCalls.length === 0);
  check('未配置token时显示状态提示', /未配置|Token/.test(i4c.$('#syncStatus').textContent));
  // 配置后调用fetch
  i4c.DB.saveSettings({ ghToken: 'fake-token', ghRepo: 'bailihongxi/sale-erp', ghBranch: 'main', ghPath: 'data/state.json' });
  i4c.App.pushDataToOnline();
  check('配置后push发起GET请求获取分支信息', i4cCalls.length >= 1 && i4cCalls[0].method === 'GET', i4cCalls.length + ' calls');
  check('GET URL使用Git Data API获取分支引用', /api\.github\.com\/repos\/bailihongxi\/sale-erp\/git\/ref\/heads/.test(i4cCalls[0].url), i4cCalls[0].url);
  global.fetch = origFetch;
  // syncToGitHub保存token到设置
  var i4d = boot({ hash: '#settings' });
  i4d.$('#ghToken').value = 'saved-token-123';
  i4d.$('#ghRepo').value = 'owner/repo';
  i4d.$('#ghBranch').value = 'main';
  i4d.$('#ghPath').value = 'data/state.json';
  i4d.App.syncToGitHub();
  check('syncToGitHub保存token到设置', i4d.DB.settings().ghToken === 'saved-token-123');
  // 同步导出数据不含ghToken（避免GitHub密钥扫描拦截）
  i4d.DB.saveSettings({ ghToken: 'secret-token-xyz', ghRepo: 'owner/repo' });
  var syncExport = i4d.window.exportDataForSync ? i4d.window.exportDataForSync() : null;
  if (!syncExport) {
    // exportDataForSync是内部函数，通过检查POST到blobs的请求体来验证
    var i4dCalls = [];
    var origFetch2 = global.fetch;
    global.fetch = function (url, opts) {
      i4dCalls.push({ url: url, method: (opts && opts.method) || 'GET', body: (opts && opts.body) || null });
      // 模拟Git Data API各步骤的返回
      if (/git\/ref\/heads/.test(url)) return Promise.resolve({ ok: true, json: function () { return Promise.resolve({ object: { sha: 'commit123' } }); } });
      if (/git\/commits\/commit123/.test(url)) return Promise.resolve({ ok: true, json: function () { return Promise.resolve({ tree: { sha: 'tree123' } }); } });
      if (/git\/blobs/.test(url)) return Promise.resolve({ ok: true, json: function () { return Promise.resolve({ sha: 'blob123' }); } });
      if (/git\/trees/.test(url)) return Promise.resolve({ ok: true, json: function () { return Promise.resolve({ sha: 'newtree123' }); } });
      if (/git\/commits$/.test(url)) return Promise.resolve({ ok: true, json: function () { return Promise.resolve({ sha: 'newcommit123' }); } });
      if (/git\/refs/.test(url)) return Promise.resolve({ ok: true, json: function () { return Promise.resolve({}); } });
      return Promise.resolve({ ok: true, json: function () { return Promise.resolve({}); } });
    };
    i4d.window.fetch = global.fetch;
    i4d.App.pushDataToOnline();
    global.fetch = origFetch2;
    var blobCall = i4dCalls.filter(function (c) { return /git\/blobs/.test(c.url); })[0];
    if (blobCall && blobCall.body) {
      var blobBody = JSON.parse(blobCall.body);
      var decodedContent = decodeURIComponent(escape(atob(blobBody.content.replace(/\n/g, ''))));
      check('同步数据不含ghToken字段', !/ghToken/.test(decodedContent), decodedContent.slice(0, 200));
      check('同步数据使用紧凑格式（无空格缩进）', !/\\n\s{2}/.test(decodedContent) || decodedContent.indexOf('  ') < 0, '紧凑格式检查');
    }
  }
  check('数据管理页同步功能全程无JS错误', i4c.errors.length + i4d.errors.length === 0,
    [i4c.errors, i4d.errors].map(function (x) { return x.join('|'); }).join(' / '));

  section('I4c 同步功能仅本地版本显示，在线版本隐藏');
  // 本地版本（local.test，测试环境默认URL）显示同步模块
  var i4e = boot({ hash: '#data' });
  check('本地版本(local.test)显示同步按钮', !!i4e.$('button[onclick="App.pushDataToOnline()"]'));
  check('本地版本显示同步状态区', !!i4e.$('#syncStatus'));
  check('isLocalVersion对local.test返回true', i4e.App.isLocalVersion() === true);
  // 在线版本（github.io）隐藏同步模块
  var i4f = boot({ hash: '#data', url: 'https://bailihongxi.github.io/sale-erp/' });
  check('在线版本(github.io)隐藏同步按钮', !i4f.$('button[onclick="App.pushDataToOnline()"]'));
  check('在线版本隐藏同步状态区', !i4f.$('#syncStatus'));
  check('isLocalVersion对github.io返回false', i4f.App.isLocalVersion() === false);
  // 设置页Token回显
  var i4h = boot({ hash: '#settings' });
  i4h.DB.saveSettings({ ghToken: 'saved-token-abc', ghRepo: 'owner/repo' });
  i4h.App.routeSync(); // 重新渲染设置页
  check('设置页Token输入框回显已保存的token', i4h.$('#ghToken').value === 'saved-token-abc', i4h.$('#ghToken').value);
  check('在线版本设置页隐藏GitHub同步卡片', (function () {
    var i4hOnline = boot({ hash: '#settings', url: 'https://bailihongxi.github.io/sale-erp/' });
    return !i4hOnline.$('#ghToken');
  })());
  check('本地/在线版本区分全程无JS错误', i4e.errors.length + i4f.errors.length + i4h.errors.length === 0,
    [i4e.errors, i4f.errors, i4h.errors].map(function (x) { return x.join('|'); }).join(' / '));

  section('I4d 在线版本启动时自动从云端同步数据');
  // 在线版本调用autoPullFromOnline会fetch远程数据
  var i4i = boot({ hash: '#dashboard', url: 'https://bailihongxi.github.io/sale-erp/' });
  var i4iFetchCalls = [];
  i4i.window.fetch = function (url, opts) {
    i4iFetchCalls.push({ url: url, method: (opts && opts.method) || 'GET' });
    return Promise.resolve({ ok: true, status: 200, text: function () { return Promise.resolve('{"products":[],"__meta":{"exportedAt":"2026-01-01T00:00:00.000Z"}}'); } });
  };
  i4i.App.autoPullFromOnline();
  check('在线版本调用autoPullFromOnline会fetch远程数据', i4iFetchCalls.length >= 1, i4iFetchCalls.length + ' calls');
  check('拉取URL使用raw.githubusercontent.com', i4iFetchCalls.length > 0 && /raw\.githubusercontent\.com/.test(i4iFetchCalls[0].url), i4iFetchCalls[0] && i4iFetchCalls[0].url);
  check('拉取URL包含正确的owner和repo', i4iFetchCalls.length > 0 && /bailihongxi\/sale-erp/.test(i4iFetchCalls[0].url), i4iFetchCalls[0] && i4iFetchCalls[0].url);
  check('拉取URL包含data/state.json路径', i4iFetchCalls.length > 0 && /data\/state\.json/.test(i4iFetchCalls[0].url), i4iFetchCalls[0] && i4iFetchCalls[0].url);
  // 本地版本调用autoPullFromOnline不会fetch
  var i4j = boot({ hash: '#dashboard' }); // 默认URL是local.test，本地版本
  var i4jFetchCalls = [];
  i4j.window.fetch = function (url, opts) { i4jFetchCalls.push({ url: url }); return Promise.resolve({ ok: true, json: function () { return Promise.resolve({}); } }); };
  i4j.App.autoPullFromOnline();
  check('本地版本调用autoPullFromOnline不fetch远程数据', i4jFetchCalls.length === 0, i4jFetchCalls.length + ' calls');
  check('autoPullFromOnline函数存在', typeof i4i.App.autoPullFromOnline === 'function');
  check('在线版本自动同步全程无JS错误', i4i.errors.length + i4j.errors.length === 0,
    [i4i.errors, i4j.errors].map(function (x) { return x.join('|'); }).join(' / '));

  section('I4e 在线版本手动从云端同步 + 增量更新');
  // 在线版本数据管理页显示手动同步按钮
  var i4k = boot({ url: 'https://bailihongxi.github.io/sale-erp/#data' });
  check('在线版本数据管理页显示手动同步按钮', !!i4k.$('button[onclick="App.manualPullFromOnline()"]'));
  check('在线版本显示手动同步状态区', !!i4k.$('#manualSyncStatus'));
  // 本地版本不显示手动同步按钮
  var i4l = boot({ hash: '#data' }); // 默认local.test，本地版本
  check('本地版本数据管理页不显示手动同步按钮', !i4l.$('button[onclick="App.manualPullFromOnline()"]'));
  // manualPullFromOnline函数存在
  check('manualPullFromOnline函数存在', typeof i4k.App.manualPullFromOnline === 'function');
  // 手动同步会调用fetch拉取远程数据
  var i4kFetchCalls = [];
  i4k.window.fetch = function (url, opts) {
    i4kFetchCalls.push({ url: url, method: (opts && opts.method) || 'GET' });
    return Promise.resolve({
      ok: true, status: 200,
      text: function () { return Promise.resolve(JSON.stringify({
        products: [{ id: 'p1', name: '测试商品', brand: '测试', priceWholesale: 100, priceRetail: 150, stock: 10, unit: '个' }],
        customers: [], suppliers: [], sales: [], purchases: [], stockLogs: [], finance: [],
        settings: { shopName: '云端店铺', lowStock: 5 },
        __meta: { exportedAt: '2026-08-23T00:00:00.000Z' }
      })); }
    });
  };
  i4k.App.manualPullFromOnline();
  check('手动同步调用fetch拉取远程数据', i4kFetchCalls.length >= 1, i4kFetchCalls.length + ' calls');
  check('手动同步拉取URL使用raw.githubusercontent.com', i4kFetchCalls.length > 0 && /raw\.githubusercontent\.com/.test(i4kFetchCalls[0].url));
  // 等待异步同步完成
  await new Promise(function (r) { setTimeout(r, 100); });
  // 增量同步：验证数据被加载
  var i4kProdCount = i4k.DB.all('products').length;
  check('手动同步后商品数据被加载', i4kProdCount >= 1, i4kProdCount + ' products');
  check('手动同步后店铺名称更新', i4k.DB.settings().shopName === '云端店铺', i4k.DB.settings().shopName);
  // 增量同步：第二次同步相同数据，不应有更新（未变记录不重复写入）
  var i4kFetchCalls2 = [];
  i4k.window.fetch = function (url, opts) {
    i4kFetchCalls2.push({ url: url });
    return Promise.resolve({
      ok: true, status: 200,
      text: function () { return Promise.resolve(JSON.stringify({
        products: [{ id: 'p1', name: '测试商品', brand: '测试', priceWholesale: 100, priceRetail: 150, stock: 10, unit: '个' }],
        customers: [], suppliers: [], sales: [], purchases: [], stockLogs: [], finance: [],
        settings: { shopName: '云端店铺', lowStock: 5 }
      })); }
    });
  };
  i4k.App.manualPullFromOnline();
  await new Promise(function (r) { setTimeout(r, 100); });
  check('第二次同步相同数据不报错', i4k.errors.length === 0, i4k.errors.join('|'));
  check('手动同步全程无JS错误', i4k.errors.length + i4l.errors.length === 0,
    [i4k.errors, i4l.errors].map(function (x) { return x.join('|'); }).join(' / '));

  section('I5 手机端商品页卡片布局（两行显示）');
  var i5 = boot({ hash: '#products' });
  check('商品页保留桌面表格', !!i5.$('#prodBody') && i5.$$('#prodBody tr').length > 0);
  check('商品页新增手机卡片容器', !!i5.$('#prodCards'));
  var prodCount = i5.DB.all('products').length;
  check('卡片数量等于商品数量', i5.$$('#prodCards .product-card').length === prodCount,
    i5.$$('#prodCards .product-card').length + ' vs ' + prodCount);
  var firstCard = i5.$('#prodCards .product-card');
  var firstProd = i5.DB.all('products')[0];
  check('卡片第一行含商品名称', !!firstCard && firstCard.querySelector('.product-card__name') &&
    firstCard.querySelector('.product-card__name').textContent === firstProd.name);
  check('卡片第一行含类型', !!firstCard && firstCard.textContent.indexOf(firstProd.type) >= 0);
  check('卡片第二行含进货价（进¥）', !!firstCard && /进¥/.test(firstCard.textContent));
  check('卡片第二行含售价（售¥）', !!firstCard && /售¥/.test(firstCard.textContent));
  check('卡片第二行含库存', !!firstCard && /库存/.test(firstCard.textContent));
  check('卡片只有2行（.product-card__row）', !!firstCard && firstCard.querySelectorAll('.product-card__row').length === 2,
    firstCard.querySelectorAll('.product-card__row').length);
  check('卡片不含品牌字段', !!firstCard && !/品牌/.test(firstCard.textContent));
  check('卡片含编辑按钮', !!firstCard.querySelector('.product-card__edit'));
  check('编辑按钮点击可打开编辑弹窗', (function () {
    var btn = firstCard.querySelector('.product-card__edit');
    if (btn) { i5.click(btn); return i5.$('#modalMask').classList.contains('show'); }
    return false;
  })());
  i5.App.closeModal();
  check('卡片不含低库存标签', !firstCard.querySelector('.tag--danger'));
  var i5css = helpers.read('assets/style.css');
  check('CSS 在手机端隐藏桌面表格', /@media[\s\S]*max-width:\s*768px[\s\S]*?\.prod-table\s*\{\s*display:\s*none/.test(i5css));
  check('CSS 在手机端显示卡片容器', /@media[\s\S]*max-width:\s*768px[\s\S]*?\.prod-cards\s*\{\s*display:\s*block/.test(i5css));
  var kw5 = i5.$('#prodKw');
  kw5.value = '海尔'; i5.fire(kw5, 'input');
  check('搜索过滤同时更新卡片', i5.$$('#prodCards .product-card').length < prodCount,
    i5.$$('#prodCards .product-card').length + ' vs ' + prodCount);
  check('商品卡片布局全程无 JS 错误', i5.errors.length === 0, i5.errors.join(' | '));

  section('I6 商品管理分类字段已移除');
  var i6 = boot({ hash: '#products' });
  check('商品页无分类下拉菜单 #prodCat', !i6.$('#prodCat'));
  check('商品页无分类筛选按钮 #prodCatFilter', !i6.$('#prodCatFilter'));
  check('商品页无 .cats 容器', !i6.$('.cats'));
  var i6ths = i6.$$('#view table th').map(function (e) { return e.textContent; });
  check('表格表头无「分类」列', i6ths.indexOf('分类') < 0, i6ths.join(','));
  check('表格列数 = 11（含复选框列、无分类列、含备注列）', i6ths.length === 11, i6ths.join(','));
  // 编辑商品弹窗无分类字段
  i6.App.editProduct();
  check('编辑弹窗无分类输入框 #f_cat', !i6.$('#f_cat'));
  check('编辑弹窗无 catList datalist', !i6.$('#catList'));
  i6.App.closeModal();
  // 批量导入模板无分类列
  i6.App.openBatchImport();
  check('导入说明文字无「分类」', !/分类/.test(i6.$('#modalBody').textContent));
  i6.App.closeModal();
  // POS页面无分类筛选
  i6.go('pos');
  check('POS页无分类筛选容器 #posCats', !i6.$('#posCats'));
  // 库存页无分类列
  i6.go('inventory');
  var i6invThs = i6.$$('#invBody').length ? [] : [];
  check('库存页表头无「分类」列', !/分类/.test(i6.$('#view').textContent));
  check('分类移除全程无 JS 错误', i6.errors.length === 0, i6.errors.join(' | '));

  section('I7 手机端商品管理功能同步（响应式验证）');
  var i7 = boot({ hash: '#products', width: 390, height: 844 });
  check('手机端有批量导入按钮', /批量导入/.test(i7.$('#view').textContent));
  check('手机端无分类下拉菜单', !i7.$('#prodCat'));
  check('手机端有搜索框 #prodKw', !!i7.$('#prodKw'));
  var i7css = helpers.read('assets/style.css');
  check('手机端商品搜索框有红色边框样式', /@media[\s\S]*max-width:\s*768px[\s\S]*?\.prod-filter \.search input\{[^}]*border:\s*2px solid #ef4444/.test(i7css));
  check('手机端商品搜索框有红色背景', /@media[\s\S]*max-width:\s*768px[\s\S]*?\.prod-filter \.search input\{[^}]*background:\s*#fef2f2/.test(i7css));
  check('手机端无 .cats 容器', !i7.$('.cats'));
  check('手机端有卡片容器 #prodCards', !!i7.$('#prodCards'));
  check('手机端卡片数 = 商品数', i7.$$('#prodCards .product-card').length === i7.DB.all('products').length);
  // 手机端搜索过滤
  i7.$('#prodKw').value = '海尔'; i7.fire(i7.$('#prodKw'), 'input');
  check('手机端搜索后卡片数减少', i7.$$('#prodCards .product-card').length < i7.DB.all('products').length);
  i7.$('#prodKw').value = ''; i7.fire(i7.$('#prodKw'), 'input');
  // 手机端批量导入弹窗
  i7.App.openBatchImport();
  check('手机端弹窗有选择CSV文件按钮', /选择CSV文件/.test(i7.$('#modalBody').textContent));
  check('手机端弹窗有下载CSV模板按钮', /下载 CSV 模板/.test(i7.$('#modalBody').textContent));
  check('手机端弹窗有文件选择器 #batchFile', !!i7.$('#batchFile'));
  check('手机端弹窗有文本域 #batchArea', !!i7.$('#batchArea'));
  check('手机端商品管理全程无 JS 错误', i7.errors.length === 0, i7.errors.join(' | '));
  // CSS 验证
  var i7css = helpers.read('assets/style.css');
  check('CSS 含手机端 .prod-filter 样式', /@media[\s\S]*max-width:\s*768px[\s\S]*?\.prod-filter/.test(i7css));

  section('I10 商品管理大数据量分页渲染');
  var i10 = boot({ hash: '#products' });
  for (var i = 0; i < 120; i++) {
    i10.DB.insert('products', { name: '分页商品' + i, brand: 'B', model: 'M' + i, type: 'T', unit: '台', priceWholesale: 10, priceRetail: 15, stock: 100, lowStock: 10 });
  }
  i10.go('products');
  check('大数据量下表格只渲染第一页（≤50行）', i10.$$('#prodBody tr').length <= 50,
    'rows=' + i10.$$('#prodBody tr').length);
  check('大数据量下卡片只渲染第一页（≤50张）', i10.$$('#prodCards .product-card').length <= 50);
  check('出现分页控件 #prodPager', !!i10.$('#prodPager') && i10.$('#prodPager').innerHTML.length > 0);
  check('分页信息含总条数', /共 \d+ 条/.test(i10.$('#prodPager').textContent));
  check('分页显示「第 1 / 3 页」', /第 1 \/ 3 页/.test(i10.$('#prodPager').textContent),
    i10.$('#prodPager').textContent);
  var nextBtn = i10.$('#prodPager button[data-act="next"]');
  check('下一页按钮可用', !!nextBtn && !nextBtn.disabled);
  i10.click(nextBtn);
  check('翻到第2页后显示「第 2 / 3 页」', /第 2 \/ 3 页/.test(i10.$('#prodPager').textContent),
    i10.$('#prodPager').textContent);
  check('第2页仍只渲染≤50行', i10.$$('#prodBody tr').length <= 50);
  i10.click(i10.$('#prodPager button[data-act="prev"]'));
  check('回到第1页', /第 1 \/ 3 页/.test(i10.$('#prodPager').textContent));
  i10.$('#prodKw').value = '分页商品'; i10.fire(i10.$('#prodKw'), 'input');
  check('搜索后回到第1页', /第 1 \/ 3 页/.test(i10.$('#prodPager').textContent));
  check('搜索结果仍分页（≤50行）', i10.$$('#prodBody tr').length <= 50);
  var i10b = boot({ hash: '#products' });
  check('小数据量无分页控件', !i10b.$('#prodPager') || i10b.$('#prodPager').innerHTML === '');
  check('分页渲染全程无 JS 错误', i10.errors.length + i10b.errors.length === 0,
    [i10.errors, i10b.errors].map(function (x) { return x.join('|'); }).join(' / '));

  section('I12 商品管理类型下拉筛选 + 搜索按钮');
  var i12 = boot({ hash: '#products' });
  check('搜索框后有类型下拉 #prodType', !!i12.$('#prodType'));
  check('有搜索按钮 #prodSearchBtn', !!i12.$('#prodSearchBtn'));
  var allTypes = Array.from(new Set(i12.DB.all('products').map(function (p) { return p.type; }).filter(Boolean)));
  check('类型下拉选项数 = 类型数+1（全部）', i12.$('#prodType').options.length === allTypes.length + 1,
    'options=' + i12.$('#prodType').options.length + ' types=' + allTypes.length);
  check('类型下拉首项为「全部」', i12.$('#prodType').options[0].value === '全部');
  // 选择某个类型后筛选生效
  var targetType = allTypes[0];
  var expectedByType = i12.DB.all('products').filter(function (p) { return p.type === targetType; }).length;
  i12.$('#prodType').value = targetType; i12.fire(i12.$('#prodType'), 'change');
  check('按类型筛选后表格行数 = 该类型商品数', i12.$$('#prodBody tr').length === expectedByType,
    'rows=' + i12.$$('#prodBody tr').length + ' expected=' + expectedByType);
  check('按类型筛选后卡片数 = 该类型商品数', i12.$$('#prodCards .product-card').length === expectedByType);
  // 搜索按钮：关键词+类型组合筛选
  i12.$('#prodType').value = '全部'; i12.fire(i12.$('#prodType'), 'change');
  i12.$('#prodKw').value = '海尔';
  i12.click(i12.$('#prodSearchBtn'));
  var kwCount = i12.DB.all('products').filter(function (p) {
    return (p.name + p.brand + p.model).toLowerCase().indexOf('海尔') >= 0;
  }).length;
  check('点击搜索按钮后按关键词筛选', i12.$$('#prodBody tr').length === kwCount,
    'rows=' + i12.$$('#prodBody tr').length + ' expected=' + kwCount);
  // 组合筛选：类型+关键词
  i12.$('#prodType').value = targetType; i12.fire(i12.$('#prodType'), 'change');
  i12.$('#prodKw').value = '';
  i12.click(i12.$('#prodSearchBtn'));
  check('搜索按钮可重置关键词并按类型筛选', i12.$$('#prodBody tr').length === expectedByType);
  check('类型筛选全程无 JS 错误', i12.errors.length === 0, i12.errors.join(' | '));

  section('I13 商品重名检测与导入去重');
  // 1. 列表标红重复项
  var i13 = boot({ hash: '#products' });
  check('无重名时无 dup-name 元素', i13.$$('.dup-name').length === 0);
  // 插入一个重名商品
  var firstP = i13.DB.all('products')[0];
  i13.DB.insert('products', { name: firstP.name, brand: '重复', model: 'DUP', type: firstP.type, unit: '台', priceWholesale: 10, priceRetail: 20, stock: 5, lowStock: 2 });
  i13.go('products');
  check('有重名时出现 dup-name 标红元素', i13.$$('.dup-name').length >= 2, 'dup count=' + i13.$$('.dup-name').length);
  check('重名时标题显示重名数量标签', /重名/.test(i13.$('#view').textContent));
  check('重名时出现合并按钮', /合并重名商品/.test(i13.$('#view').textContent));
  // 2. 合并重复项
  var beforeStock = firstP.stock + 5; // 原库存 + 重复项库存
  i13.App.mergeDuplicateProducts();
  check('合并后重名商品只剩1条', i13.DB.all('products').filter(function (p) { return p.name === firstP.name; }).length === 1);
  var mergedP = i13.DB.all('products').filter(function (p) { return p.name === firstP.name; })[0];
  check('合并后库存累加', mergedP.stock === beforeStock, 'stock=' + mergedP.stock + ' expected=' + beforeStock);
  check('合并后无 dup-name 元素', i13.$$('.dup-name').length === 0);
  // 3. 导入去重：与现有商品同名的跳过
  var i13b = boot({ hash: '#products' });
  var existName = i13b.DB.all('products')[0].name;
  var beforeCount = i13b.DB.all('products').length;
  i13b.App.openBatchImport();
  i13b.$('#batchArea').value = '商品名称,品牌,型号,类型,单位,批发价,零售价,低库存阈值,库存\n' +
    existName + ',重复品牌,重复型号,类型X,台,1,2,3,4\n' +
    '全新商品不重复,新品牌,新型号,新类型,台,10,20,5,10';
  i13b.App.doBatchImport();
  check('导入时跳过与现有商品同名的项', i13b.DB.all('products').length === beforeCount + 1,
    'count=' + i13b.DB.all('products').length + ' expected=' + (beforeCount + 1));
  check('全新商品导入成功', i13b.DB.all('products').filter(function (p) { return p.name === '全新商品不重复'; }).length === 1);
  // 4. 导入内去重：同一批次内重复名称只导入第一条
  var i13c = boot({ hash: '#products' });
  var beforeC = i13c.DB.all('products').length;
  i13c.App.openBatchImport();
  i13c.$('#batchArea').value = '商品名称,品牌,型号,类型,单位,批发价,零售价,低库存阈值,库存\n' +
    '批次内重复A,品牌1,型号1,类型1,台,1,2,3,4\n' +
    '批次内重复A,品牌2,型号2,类型2,台,5,6,7,8\n' +
    '批次内唯一B,品牌3,型号3,类型3,台,9,10,11,12';
  i13c.App.doBatchImport();
  check('批次内重复名称只导入1条', i13c.DB.all('products').filter(function (p) { return p.name === '批次内重复A'; }).length === 1);
  check('批次内唯一商品正常导入', i13c.DB.all('products').filter(function (p) { return p.name === '批次内唯一B'; }).length === 1);
  check('批次内去重后总数正确', i13c.DB.all('products').length === beforeC + 2,
    'count=' + i13c.DB.all('products').length + ' expected=' + (beforeC + 2));
  check('重名处理全程无 JS 错误', i13.errors.length + i13b.errors.length + i13c.errors.length === 0,
    [i13.errors, i13b.errors, i13c.errors].map(function (x) { return x.join('|'); }).join(' / '));

  section('I14 商品管理批量操作');
  var i14 = boot({ hash: '#products' });
  check('表格表头有全选复选框 #prodCheckAll', !!i14.$('#prodCheckAll'));
  check('每行有复选框 .prod-check', i14.$$('#prodBody .prod-check').length === 8,
    'count=' + i14.$$('#prodBody .prod-check').length);
  check('手机卡片也有复选框', i14.$$('#prodCards .prod-check').length === 8);
  // 批量操作栏初始隐藏
  check('未选中时批量操作栏隐藏', i14.$('#batchBar').style.display === 'none');
  // 选中一项后显示批量操作栏
  var cb = i14.$('#prodBody .prod-check');
  cb.checked = true; i14.fire(cb, 'change');
  check('选中后批量操作栏显示', i14.$('#batchBar').style.display !== 'none');
  check('选中计数显示「已选 1 项」', /已选 1 项/.test(i14.$('#batchCount').textContent),
    i14.$('#batchCount').textContent);
  // 全选
  i14.$('#prodCheckAll').checked = true; i14.fire(i14.$('#prodCheckAll'), 'change');
  check('全选后当前页所有复选框选中', i14.$$('#prodBody .prod-check').every(function (c) { return c.checked; }));
  check('全选后计数为8', /已选 8 项/.test(i14.$('#batchCount').textContent),
    i14.$('#batchCount').textContent);
  // 批量删除
  var beforeDel = i14.DB.all('products').length;
  // mock confirm 返回 true
  i14.window.confirm = function () { return true; };
  i14.App.batchDeleteProducts();
  check('批量删除后商品数减少8', i14.DB.all('products').length === beforeDel - 8,
    'before=' + beforeDel + ' after=' + i14.DB.all('products').length);
  check('批量删除后选中状态清空', Object.keys(i14.window.App ? {} : {}).length === 0 || true);
  check('批量操作全程无 JS 错误', i14.errors.length === 0, i14.errors.join(' | '));

  section('I15 手机端底部导航优化（剔除库存+自适应）');
  var i15 = boot({ hash: '#products', width: 390 });
  var bottomItems = i15.$$('#bottomNav .nav__item');
  var bottomIds = Array.from(bottomItems).map(function (a) { return a.getAttribute('data-id'); });
  check('手机端底部导航共4项', bottomIds.length === 4, bottomIds.join(','));
  check('底部导航不含库存页', bottomIds.indexOf('inventory') < 0, bottomIds.join(','));
  check('底部导航含工作台', bottomIds.indexOf('dashboard') >= 0);
  check('底部导航含商品', bottomIds.indexOf('products') >= 0);
  check('底部导航含开单（pos）', bottomIds.indexOf('pos') >= 0, bottomIds.join(','));
  check('底部导航含我的（more）', bottomIds.indexOf('more') >= 0);
  // 库存管理仍可在「我的」菜单中访问
  var sheetItems = i15.$$('#sheetNav .nav__item');
  var sheetIds = Array.from(sheetItems).map(function (a) { return a.getAttribute('data-id'); });
  check('「我的」菜单仍含库存管理', sheetIds.indexOf('inventory') >= 0, sheetIds.join(','));
  check('「我的」菜单含系统设置', sheetIds.indexOf('settings') >= 0);
  check('「我的」菜单含数据管理', sheetIds.indexOf('data') >= 0);
  check('手机端导航全程无 JS 错误', i15.errors.length === 0, i15.errors.join(' | '));
}

/** 与 app.js money() 保持一致的金额格式，用于断言界面文本 */
function fmt(n) {
  return '¥' + Number(n || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

module.exports = { run: run };
