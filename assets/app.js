/* ============================================================
   家电批发进销存 ERP — 应用层（路由 + 全部模块视图）
   纯前端，无框架。哈希路由，数据来自 DB(localStorage)。
   ============================================================ */
(function () {
  'use strict';
  var DB = window.DB;
  var CUR = '¥';
  var app = document.getElementById('view');
  var navEl = document.getElementById('nav');
  var bottomNav = document.getElementById('bottomNav');

  /* ---------------- 工具 ---------------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function money(n) { return CUR + Number(n || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function num(n) { return Number(n || 0).toLocaleString('zh-CN'); }
  function short(n) { n = Number(n || 0); if (n >= 10000) return (n / 10000).toFixed(1) + '万'; if (n >= 1000) return (n / 1000).toFixed(1) + 'k'; return String(Math.round(n)); }
  function today() { return DB.todayStr(); }
  function statusTag(s) {
    if (s === 'paid') return '<span class="tag tag--success">已结清</span>';
    if (s === 'partial') return '<span class="tag tag--warning">部分收</span>';
    if (s === 'unpaid') return '<span class="tag tag--danger">欠款</span>';
    return '<span class="tag">' + esc(s) + '</span>';
  }

  function toast(msg, type) {
    var wrap = document.getElementById('toastWrap');
    var t = document.createElement('div');
    t.className = 'toast' + (type ? ' toast--' + type : '');
    t.textContent = msg;
    wrap.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('show'); });
    setTimeout(function () { t.classList.remove('show'); setTimeout(function () { wrap.removeChild(t); }, 300); }, 2200);
  }

  function openModal(title, bodyHtml, footHtml) {
    document.getElementById('modalTitle').innerHTML = title;
    document.getElementById('modalBody').innerHTML = bodyHtml;
    document.getElementById('modalFoot').innerHTML = footHtml || '';
    document.getElementById('modalMask').classList.add('show');
  }
  function closeModal() { document.getElementById('modalMask').classList.remove('show'); }

  function openSheet() { document.getElementById('sheetMask').classList.add('show'); }
  function closeSheet() { document.getElementById('sheetMask').classList.remove('show'); }

  /* ---------------- 导航 ---------------- */
  var NAV = [
    { group: '经营' },
    { id: 'dashboard', name: '工作台', ico: '📊' },
    { id: 'products', name: '商品管理', ico: '📦' },
    { id: 'pos', name: '销售开单', ico: '🧾' },
    { id: 'sales', name: '销售管理', ico: '💰' },
    { id: 'purchase', name: '采购管理', ico: '🚚' },
    { id: 'inventory', name: '库存管理', ico: '🏬' },
    { id: 'reports', name: '报表分析', ico: '📈' },
    { id: 'finance', name: '财务管理', ico: '🏦' },
    { group: '系统' },
    { id: 'settings', name: '系统设置', ico: '⚙️' },
    { id: 'data', name: '数据管理', ico: '💾' }
  ];
  var MOBILE_NAV = [
    { id: 'dashboard', name: '工作台', ico: '📊' },
    { id: 'products', name: '商品', ico: '📦' },
    { id: 'inventory', name: '库存', ico: '🏬' },
    { id: 'more', name: '我的', ico: '👤' }
  ];

  function navItemHtml(n) {
    if (n.group) return '<div class="nav__group">' + esc(n.group) + '</div>';
    return '<a class="nav__item" data-id="' + n.id + '" href="#' + n.id + '"><span class="ico">' + n.ico + '</span>' + esc(n.name) + '</a>';
  }
  function renderNav() {
    navEl.innerHTML = NAV.map(navItemHtml).join('');
    bottomNav.innerHTML = MOBILE_NAV.map(function (n) {
      if (n.id === 'more') return '<a class="nav__item" data-id="more" href="javascript:void(0)"><span class="ico">' + n.ico + '</span>' + esc(n.name) + '</a>';
      return '<a class="nav__item" data-id="' + n.id + '" href="#' + n.id + '"><span class="ico">' + n.ico + '</span>' + esc(n.name) + '</a>';
    }).join('');
    document.getElementById('sheetNav').innerHTML = NAV.map(navItemHtml).join('');
  }
  function highlight(id) {
    document.querySelectorAll('.nav__item').forEach(function (a) {
      a.classList.toggle('active', a.getAttribute('data-id') === id);
    });
  }

  /* ---------------- 简易柱状图 ---------------- */
  function barChart(labels, values, color) {
    var w = 600, h = 200, pad = 28, max = Math.max.apply(null, values.concat([1]));
    var gap = (w - pad * 2) / labels.length, bw = gap * 0.55;
    var bars = '';
    labels.forEach(function (l, i) {
      var v = values[i], bh = (v / max) * (h - pad * 2);
      var x = pad + gap * i + (gap - bw) / 2, y = h - pad - bh;
      bars += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + bh.toFixed(1) + '" rx="3" fill="' + color + '"/>';
      if (v > 0) bars += '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (y - 4).toFixed(1) + '" font-size="10" text-anchor="middle" fill="#6B7280">' + short(v) + '</text>';
      bars += '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (h - pad + 14) + '" font-size="10" text-anchor="middle" fill="#6B7280">' + esc(l) + '</text>';
    });
    return '<svg class="chart" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none">' + bars + '</svg>';
  }

  /* ============================================================
     视图注册
     ============================================================ */
  var views = {};

  /* ---------- 工作台 ---------- */
  views.dashboard = function () {
    var d = DB.dashboard();
    var s = DB.settings();
    document.getElementById('viewTitle').textContent = '工作台';
    var recent = d.recentSales.map(function (o) {
      return '<tr><td>' + esc(o.no) + '</td><td>' + esc(o.customerName) + '</td><td class="right mono">' + money(o.total) + '</td><td>' + statusTag(DB.orderStatus(o)) + '</td></tr>';
    }).join('') || '<tr><td colspan="4" class="empty">暂无销售</td></tr>';
    var warn = d.warningList.map(function (p) {
      return '<div class="row between" style="padding:7px 0;border-bottom:1px solid var(--c-border)"><span>' + esc(p.name) + ' <span class="muted">(' + esc(p.brand) + ')</span></span><span class="tag tag--danger">库存 ' + p.stock + '</span></div>';
    }).join('') || '<div class="empty">库存充足 🎉</div>';
    var top = DB.topProducts(5).map(function (p, i) {
      return '<div class="row between" style="padding:6px 0"><span>' + (i + 1) + '. ' + esc(p.name) + '</span><span class="mono">' + p.qty + ' 件</span></div>';
    }).join('') || '<div class="empty">暂无销量</div>';

    app.innerHTML =
      '<div class="grid grid--kpi">' +
      kpiCard('今日营收', money(d.revenue), '💰', '') +
      kpiCard('今日订单', d.orderCount + ' 单', '🧾', 'kpi--accent') +
      kpiCard('库存预警', d.stockWarnings + ' 项', '⚠️', 'kpi--danger') +
      kpiCard('应收欠款', money(d.receivables), '🏦', 'kpi--warning') +
      '</div>' +
      '<div class="grid grid--2 mt16">' +
      card('近 7 天销售趋势', barChart(d.trend.map(function (x) { return x.date; }), d.trend.map(function (x) { return x.total; }), '#2D5BE3')) +
      card('库存预警（' + d.stockWarnings + '）', warn) +
      '</div>' +
      '<div class="grid grid--2 mt16">' +
      card('最近销售', '<table class="table"><thead><tr><th>单号</th><th>客户</th><th class="right">金额</th><th>状态</th></tr></thead><tbody>' + recent + '</tbody></table>') +
      card('热销商品 TOP5', top) +
      '</div>';
  };
  function kpiCard(label, value, ico, cls) {
    return '<div class="kpi ' + (cls || '') + '"><div class="kpi__label">' + esc(label) + '</div><div class="kpi__value">' + value + '</div><div class="kpi__ico">' + ico + '</div></div>';
  }
  function card(title, body, extra) {
    return '<div class="card"><div class="card__head"><h3>' + esc(title) + '</h3>' + (extra || '') + '</div><div class="card__pad">' + body + '</div></div>';
  }

  /* ---------- 商品管理 ---------- */
  views.products = function () {
    document.getElementById('viewTitle').textContent = '商品管理';
    var list = DB.all('products');
    var cats = Array.from(new Set(list.map(function (p) { return p.category; }).filter(Boolean)));
    var filter = window.__prodFilter || { kw: '', cat: '全部' };
    window.__prodFilter = filter;

    var rows = list.filter(function (p) {
      if (filter.cat !== '全部' && p.category !== filter.cat) return false;
      if (filter.kw && (p.name + p.brand + p.model + p.type).toLowerCase().indexOf(filter.kw.toLowerCase()) < 0) return false;
      return true;
    }).map(function (p) {
      var low = p.stock <= (p.lowStock || DB.settings().lowStock);
      return '<tr>' +
        '<td><b>' + esc(p.name) + '</b></td>' +
        '<td>' + esc(p.brand) + '</td>' +
        '<td>' + esc(p.model) + '</td>' +
        '<td>' + esc(p.type) + '</td>' +
        '<td>' + esc(p.category) + '</td>' +
        '<td>' + esc(p.unit) + '</td>' +
        '<td class="mono">' + money(p.priceWholesale) + '</td>' +
        '<td class="mono">' + money(p.priceRetail) + '</td>' +
        '<td>' + (low ? '<span class="tag tag--danger">' + p.stock + '</span>' : p.stock) + '</td>' +
        '<td class="right"><button class="btn btn--sm" onclick="App.editProduct(\'' + p.id + '\')">编辑</button> <button class="btn btn--sm btn--danger" onclick="App.delProduct(\'' + p.id + '\')">删除</button></td>' +
        '</tr>';
    }).join('') || '<tr><td colspan="10" class="empty">没有匹配的商品</td></tr>';

    var chips = ['全部'].concat(cats).map(function (c) {
      return '<button class="chip ' + (filter.cat === c ? 'active' : '') + '" data-cat="' + esc(c) + '">' + esc(c) + '</button>';
    }).join('');

    app.innerHTML =
      '<div class="view-head"><h2>商品管理</h2><span class="sub">共 ' + list.length + ' 个商品</span>' +
      '<div class="spacer"></div>' +
      '<button class="btn btn--primary" onclick="App.editProduct()">＋ 新增商品</button></div>' +
      '<div class="row wrap" style="margin-bottom:12px">' +
      '<div class="search"><span>🔍</span><input id="prodKw" placeholder="搜索名称/品牌/型号/类型" value="' + esc(filter.kw) + '"/></div>' +
      '</div>' +
      '<div class="cats">' + chips + '</div>' +
      '<div class="card"><table class="table"><thead><tr>' +
      '<th>名称</th><th>品牌</th><th>型号</th><th>类型</th><th>分类</th><th>单位</th><th>批发价</th><th>零售价</th><th>库存</th><th class="right">操作</th>' +
      '</tr></thead><tbody id="prodBody">' + rows + '</tbody></table></div>';

    $('#prodKw').addEventListener('input', function (e) { filter.kw = e.target.value; renderProdRows(); });
    app.querySelectorAll('.chip').forEach(function (c) {
      c.addEventListener('click', function () { filter.cat = c.getAttribute('data-cat'); renderProdRows(); });
    });
    function renderProdRows() {
      var body = $('#prodBody');
      body.innerHTML = list.filter(function (p) {
        if (filter.cat !== '全部' && p.category !== filter.cat) return false;
        if (filter.kw && (p.name + p.brand + p.model + p.type).toLowerCase().indexOf(filter.kw.toLowerCase()) < 0) return false;
        return true;
      }).map(function (p) {
        var low = p.stock <= (p.lowStock || DB.settings().lowStock);
        return '<tr><td><b>' + esc(p.name) + '</b></td><td>' + esc(p.brand) + '</td><td>' + esc(p.model) + '</td><td>' + esc(p.type) + '</td><td>' + esc(p.category) + '</td><td>' + esc(p.unit) + '</td><td class="mono">' + money(p.priceWholesale) + '</td><td class="mono">' + money(p.priceRetail) + '</td><td>' + (low ? '<span class="tag tag--danger">' + p.stock + '</span>' : p.stock) + '</td><td class="right"><button class="btn btn--sm" onclick="App.editProduct(\'' + p.id + '\')">编辑</button> <button class="btn btn--sm btn--danger" onclick="App.delProduct(\'' + p.id + '\')">删除</button></td></tr>';
      }).join('') || '<tr><td colspan="10" class="empty">没有匹配的商品</td></tr>';
    }
  };

  window.App = window.App || {};
  window.App.editProduct = function (id) {
    var p = id ? DB.get('products', id) : null;
    var catList = Array.from(new Set(DB.all('products').map(function (x) { return x.category; }).filter(Boolean)));
    var dl = '<datalist id="catList">' + catList.map(function (c) { return '<option value="' + esc(c) + '">'; }).join('') + '</datalist>';
    var f = function (k, v) { return p ? p[k] : (v || ''); };
    var body =
      '<div class="field"><label>商品名称 *</label><input id="f_name" value="' + esc(f('name')) + '"/></div>' +
      '<div class="grid grid--2">' +
      '<div class="field"><label>品牌</label><input id="f_brand" value="' + esc(f('brand')) + '"/></div>' +
      '<div class="field"><label>型号</label><input id="f_model" value="' + esc(f('model')) + '"/></div>' +
      '</div>' +
      '<div class="grid grid--3">' +
      '<div class="field"><label>类型</label><input id="f_type" value="' + esc(f('type')) + '"/></div>' +
      '<div class="field"><label>分类</label><input id="f_cat" list="catList" value="' + esc(f('category')) + '"/></div>' +
      '<div class="field"><label>单位</label><input id="f_unit" value="' + esc(f('unit', '台')) + '"/></div>' +
      '</div>' +
      '<div class="grid grid--3">' +
      '<div class="field"><label>批发价</label><input id="f_pw" type="number" value="' + esc(f('priceWholesale', 0)) + '"/></div>' +
      '<div class="field"><label>零售价</label><input id="f_pr" type="number" value="' + esc(f('priceRetail', 0)) + '"/></div>' +
      '<div class="field"><label>低库存阈值</label><input id="f_low" type="number" value="' + esc(f('lowStock', 10)) + '"/></div>' +
      '</div>' +
      '<div class="field"><label>当前库存</label><input id="f_stock" type="number" value="' + esc(f('stock', 0)) + '"/></div>' + dl;
    openModal(p ? '编辑商品' : '新增商品', body,
      '<button class="btn" onclick="App.closeModal()">取消</button><button class="btn btn--primary" onclick="App.saveProduct(\'' + (id || '') + '\')">保存</button>');
  };
  window.App.saveProduct = function (id) {
    var data = {
      name: $('#f_name').value.trim(), brand: $('#f_brand').value.trim(), model: $('#f_model').value.trim(),
      type: $('#f_type').value.trim(), category: $('#f_cat').value.trim(), unit: $('#f_unit').value.trim() || '台',
      priceWholesale: parseFloat($('#f_pw').value) || 0, priceRetail: parseFloat($('#f_pr').value) || 0,
      lowStock: parseInt($('#f_low').value) || 0, stock: parseInt($('#f_stock').value) || 0
    };
    if (!data.name) { toast('请填写商品名称', 'err'); return; }
    if (id) DB.update('products', id, data); else DB.insert('products', data);
    closeModal(); toast('已保存', 'ok'); route();
  };
  window.App.delProduct = function (id) {
    if (!confirm('确定删除该商品？')) return;
    DB.remove('products', id); toast('已删除', 'ok'); route();
  };

  /* ---------- 销售开单（POS） ---------- */
  var pos = { items: {}, customerId: null, discount: 0, paid: 0, method: '现金', kw: '', cat: '全部' };
  views.pos = function () {
    document.getElementById('viewTitle').textContent = '销售开单';
    var prods = DB.all('products');
    var cats = ['全部'].concat(Array.from(new Set(prods.map(function (p) { return p.category; }).filter(Boolean))));
    var chips = cats.map(function (c) { return '<button class="chip ' + (pos.cat === c ? 'active' : '') + '" data-cat="' + esc(c) + '">' + esc(c) + '</button>'; }).join('');
    var custOpts = '<option value="">散客</option>' + DB.all('customers').map(function (c) { return '<option value="' + c.id + '">' + esc(c.name) + '</option>'; }).join('');

    app.innerHTML =
      '<div class="view-head"><h2>销售开单</h2><span class="sub">选商品 → 填数量 → 结算（支持欠款/多单位）</span></div>' +
      '<div class="pos">' +
      '<div class="card card__pad">' +
      '<div class="search" style="margin-bottom:10px"><span>🔍</span><input id="posKw" placeholder="搜索商品名称/品牌"/></div>' +
      '<div class="cats" id="posCats">' + chips + '</div>' +
      '<div class="prod-grid" id="posGrid"></div>' +
      '</div>' +
      '<div class="card cart" id="posCart"></div>' +
      '</div>';

    $('#posKw').addEventListener('input', function (e) { pos.kw = e.target.value; filterPos(); });
    $('#posCats').querySelectorAll('.chip').forEach(function (c) {
      c.addEventListener('click', function () { pos.cat = c.getAttribute('data-cat'); renderPosGrid(); });
    });
    renderPosGrid(); renderPosCart();
  };
  function filterPos() {
    var cards = $('#posGrid').children;
    Array.prototype.forEach.call(cards, function (card) {
      var t = (card.getAttribute('data-name') + card.getAttribute('data-brand')).toLowerCase();
      card.style.display = (!pos.kw || t.indexOf(pos.kw.toLowerCase()) >= 0) ? '' : 'none';
    });
  }
  function renderPosGrid() {
    var grid = $('#posGrid');
    if (!grid) return;
    var prods = DB.all('products').filter(function (p) {
      if (pos.cat !== '全部' && p.category !== pos.cat) return false;
      return true;
    });
    grid.innerHTML = prods.map(function (p) {
      return '<div class="prod-card" data-pid="' + p.id + '" data-name="' + esc(p.name.toLowerCase()) + '" data-brand="' + esc(p.brand.toLowerCase()) + '">' +
        '<div class="pic">📦</div><div class="nm">' + esc(p.name) + '</div>' +
        '<div class="meta">' + esc(p.brand) + ' · ' + esc(p.type) + '</div>' +
        '<div class="meta">库存 ' + p.stock + ' ' + esc(p.unit) + '</div>' +
        '<div class="pr">' + money(p.priceWholesale) + '<small>/' + esc(p.unit) + '</small></div></div>';
    }).join('');
    Array.prototype.forEach.call(grid.children, function (card) {
      card.addEventListener('click', function () { addPos(card.getAttribute('data-pid')); });
    });
    filterPos();
  }
  function addPos(pid) {
    var p = DB.get('products', pid); if (!p) return;
    if (!pos.items[pid]) pos.items[pid] = { qty: 1, price: p.priceWholesale };
    else pos.items[pid].qty += 1;
    renderPosCart();
  }
  function renderPosCart() {
    var c = $('#posCart'); if (!c) return;
    var ids = Object.keys(pos.items);
    var rows = ids.length ? ids.map(function (pid) {
      var it = pos.items[pid], p = DB.get('products', pid);
      return '<div class="cart-item" data-pid="' + pid + '">' +
        '<div class="nm">' + esc(p.name) + '<div class="meta muted">' + money(it.price) + '/' + esc(p.unit) + '</div></div>' +
        '<div class="qty"><button data-act="dec">−</button><input value="' + it.qty + '" data-act="set"/><button data-act="inc">＋</button></div>' +
        '<div class="mono" style="width:78px;text-align:right">' + money(it.qty * it.price) + '</div>' +
        '<button class="btn btn--sm btn--danger" data-act="del">✕</button></div>';
    }).join('') : '<div class="empty">点击左侧商品加入购物车</div>';

    var subtotal = ids.reduce(function (a, pid) { var it = pos.items[pid]; return a + it.qty * it.price; }, 0);
    var discount = pos.discount || 0;
    var total = Math.max(0, subtotal - discount);
    var paid = pos.paid || 0;
    var debt = Math.max(0, total - paid);
    var custOpts = '<option value="">散客</option>' + DB.all('customers').map(function (c) { return '<option value="' + c.id + '" ' + (pos.customerId === c.id ? 'selected' : '') + '>' + esc(c.name) + '</option>'; }).join('');

    c.innerHTML =
      '<div class="card__head"><h3>结算</h3><button class="btn btn--sm btn--ghost" onclick="App.clearPos()">清空</button></div>' +
      '<div class="card__pad">' +
      '<div class="field"><label>客户</label><select id="posCust">' + custOpts + '</select></div>' +
      rows +
      '<div style="border-top:1px solid var(--c-border);margin-top:8px;padding-top:8px">' +
      '<div class="settle-line"><span>商品件数</span><span class="v">' + ids.reduce(function (a, pid) { return a + pos.items[pid].qty; }, 0) + ' 件</span></div>' +
      '<div class="settle-line"><span>小计</span><span class="v">' + money(subtotal) + '</span></div>' +
      '<div class="field" style="margin:8px 0"><label>优惠金额</label><input id="posDisc" type="number" value="' + discount + '"/></div>' +
      '<div class="settle-line"><span>应收合计</span><span class="v">' + money(total) + '</span></div>' +
      '<div class="field" style="margin:8px 0"><label>实收金额</label><input id="posPaid" type="number" value="' + paid + '"/></div>' +
      '<div class="field"><label>收款方式</label><select id="posMethod"><option ' + (pos.method === '现金' ? 'selected' : '') + '>现金</option><option ' + (pos.method === '微信' ? 'selected' : '') + '>微信</option><option ' + (pos.method === '支付宝' ? 'selected' : '') + '>支付宝</option><option ' + (pos.method === '银行' ? 'selected' : '') + '>银行</option><option ' + (pos.method === '欠款' ? 'selected' : '') + '>欠款</option></select></div>' +
      '<div class="settle-line"><span>欠款</span><span class="v" style="color:var(--c-danger)">' + money(debt) + '</span></div>' +
      '<button class="btn btn--primary btn--block mt12" onclick="App.settlePos()">💰 确认结算</button>' +
      '</div></div>';

    $('#posCust').addEventListener('change', function (e) { pos.customerId = e.target.value || null; });
    $('#posDisc').addEventListener('input', function (e) { pos.discount = parseFloat(e.target.value) || 0; renderPosCart(); });
    $('#posPaid').addEventListener('input', function (e) { pos.paid = parseFloat(e.target.value) || 0; renderPosCart(); });
    $('#posMethod').addEventListener('change', function (e) { pos.method = e.target.value; });
    Array.prototype.forEach.call(c.querySelectorAll('.cart-item'), function (row) {
      var pid = row.getAttribute('data-pid');
      row.querySelector('[data-act="inc"]').addEventListener('click', function () { pos.items[pid].qty++; renderPosCart(); });
      row.querySelector('[data-act="dec"]').addEventListener('click', function () { if (pos.items[pid].qty > 1) pos.items[pid].qty--; else delete pos.items[pid]; renderPosCart(); });
      row.querySelector('[data-act="del"]').addEventListener('click', function () { delete pos.items[pid]; renderPosCart(); });
      row.querySelector('[data-act="set"]').addEventListener('input', function (e) { var v = parseInt(e.target.value) || 1; pos.items[pid].qty = v; });
    });
  }
  window.App.clearPos = function () { pos.items = {}; pos.discount = 0; pos.paid = 0; renderPosCart(); };
  window.App.settlePos = function () {
    var ids = Object.keys(pos.items);
    if (!ids.length) { toast('购物车为空', 'err'); return; }
    var items = ids.map(function (pid) { var it = pos.items[pid]; return { productId: pid, qty: it.qty, price: it.price }; });
    var custId = pos.customerId;
    var custName = custId ? (DB.get('customers', custId) || {}).name : '散客';
    var method = pos.method === '欠款' ? '欠款' : pos.method;
    var paid = pos.method === '欠款' ? 0 : (pos.paid || 0);
    var o = DB.recordSale({ customerId: custId, customerName: custName, items: items, discount: pos.discount || 0, paid: paid, method: method });
    pos.items = {}; pos.discount = 0; pos.paid = 0; pos.method = '现金';
    toast('开单成功：' + o.no, 'ok');
    renderPosCart();
  };

  /* ---------- 销售管理 ---------- */
  views.sales = function () {
    document.getElementById('viewTitle').textContent = '销售管理';
    var list = DB.all('sales').slice().sort(function (a, b) { return b.ts - a.ts; });
    var rows = list.map(function (o) {
      return '<tr data-id="' + o.id + '" class="clk">' +
        '<td>' + esc(o.no) + '</td><td>' + esc(o.date) + '</td><td>' + esc(o.customerName) + '</td>' +
        '<td class="mono">' + money(o.total) + '</td><td class="mono">' + money(o.paid) + '</td>' +
        '<td>' + statusTag(DB.orderStatus(o)) + '</td>' +
        '<td class="right"><button class="btn btn--sm" onclick="App.openSale(\'' + o.id + '\')">详情</button></td></tr>';
    }).join('') || '<tr><td colspan="7" class="empty">暂无销售单</td></tr>';
    app.innerHTML =
      '<div class="view-head"><h2>销售管理</h2><span class="sub">共 ' + list.length + ' 张销售单</span></div>' +
      '<div class="card"><table class="table"><thead><tr><th>单号</th><th>日期</th><th>客户</th><th>金额</th><th>已收</th><th>状态</th><th class="right">操作</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  };
  window.App.openSale = function (id) {
    var o = DB.get('sales', id); if (!o) return;
    var items = o.items.map(function (it) {
      return '<tr><td>' + esc(it.name) + '</td><td>' + esc(it.unit) + '</td><td class="mono">' + it.qty + '</td><td class="mono">' + money(it.price) + '</td><td class="mono">' + money(it.subtotal) + '</td></tr>';
    }).join('');
    var debt = o.total - o.paid;
    var foot = '<button class="btn" onclick="App.closeModal()">关闭</button>' +
      (debt > 0 ? '<button class="btn btn--primary" onclick="App.receiveSale(\'' + o.id + '\')">💰 收款 ' + money(debt) + '</button>' : '');
    openModal('销售单 ' + o.no,
      '<div class="row between"><span class="muted">客户：' + esc(o.customerName) + '</span><span>' + statusTag(DB.orderStatus(o)) + '</span></div>' +
      '<table class="table mt12"><thead><tr><th>商品</th><th>单位</th><th>数量</th><th>单价</th><th>小计</th></tr></thead><tbody>' + items + '</tbody></table>' +
      '<div class="settle-line"><span>应收合计</span><span class="v">' + money(o.total) + '</span></div>' +
      '<div class="settle-line"><span>已收</span><span class="v">' + money(o.paid) + '</span></div>' +
      '<div class="settle-line total"><span>欠款</span><span class="v" style="color:var(--c-danger)">' + money(debt) + '</span></div>', foot);
  };
  window.App.receiveSale = function (id) {
    var o = DB.get('sales', id); if (!o) return;
    var debt = o.total - o.paid;
    openModal('收款 — ' + o.no,
      '<div class="field"><label>客户</label><input value="' + esc(o.customerName) + '" disabled/></div>' +
      '<div class="field"><label>待收金额</label><input value="' + debt + '" disabled/></div>' +
      '<div class="field"><label>本次收款</label><input id="rcvAmt" type="number" value="' + debt + '"/></div>',
      '<button class="btn" onclick="App.closeModal()">取消</button><button class="btn btn--primary" onclick="App.doReceive(\'' + o.customerId + '\',\'' + id + '\')">确认收款</button>');
  };
  window.App.doReceive = function (cid, oid) {
    var amt = parseFloat($('#rcvAmt').value) || 0;
    if (cid) DB.applyPayment('customer', cid, amt); else DB.update('sales', oid, { paid: DB.get('sales', oid).total });
    closeModal(); toast('收款成功', 'ok'); route();
  };

  /* ---------- 采购管理 ---------- */
  views.purchase = function () {
    document.getElementById('viewTitle').textContent = '采购管理';
    var list = DB.all('purchases').slice().sort(function (a, b) { return b.ts - a.ts; });
    var rows = list.map(function (o) {
      return '<tr data-id="' + o.id + '" class="clk"><td>' + esc(o.no) + '</td><td>' + esc(o.date) + '</td><td>' + esc(o.supplierName) + '</td>' +
        '<td class="mono">' + money(o.total) + '</td><td class="mono">' + money(o.paid) + '</td><td>' + statusTag(DB.orderStatus(o)) + '</td>' +
        '<td class="right"><button class="btn btn--sm" onclick="App.openPurchase(\'' + o.id + '\')">详情</button></td></tr>';
    }).join('') || '<tr><td colspan="7" class="empty">暂无采购单</td></tr>';
    app.innerHTML =
      '<div class="view-head"><h2>采购管理</h2><span class="sub">共 ' + list.length + ' 张进货单</span>' +
      '<div class="spacer"></div><button class="btn btn--primary" onclick="App.openPurchaseForm()">＋ 新建进货单</button></div>' +
      '<div class="card"><table class="table"><thead><tr><th>单号</th><th>日期</th><th>供应商</th><th>金额</th><th>已付</th><th>状态</th><th class="right">操作</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  };
  window.App.openPurchase = function (id) {
    var o = DB.get('purchases', id); if (!o) return;
    var items = o.items.map(function (it) { return '<tr><td>' + esc(it.name) + '</td><td>' + esc(it.unit) + '</td><td class="mono">' + it.qty + '</td><td class="mono">' + money(it.price) + '</td><td class="mono">' + money(it.subtotal) + '</td></tr>'; }).join('');
    var debt = o.total - o.paid;
    openModal('进货单 ' + o.no,
      '<div class="row between"><span class="muted">供应商：' + esc(o.supplierName) + '</span><span>' + statusTag(DB.orderStatus(o)) + '</span></div>' +
      '<table class="table mt12"><thead><tr><th>商品</th><th>单位</th><th>数量</th><th>单价</th><th>小计</th></tr></thead><tbody>' + items + '</tbody></table>' +
      '<div class="settle-line total"><span>进货总额</span><span class="v">' + money(o.total) + '</span></div>' +
      (debt > 0 ? '<div class="settle-line"><span>未付</span><span class="v" style="color:var(--c-danger)">' + money(debt) + '</span></div>' : ''),
      '<button class="btn" onclick="App.closeModal()">关闭</button>');
  };
  window.App.openPurchaseForm = function () {
    var supOpts = '<option value="">选择供应商</option>' + DB.all('suppliers').map(function (s) { return '<option value="' + s.id + '">' + esc(s.name) + '</option>'; }).join('');
    var prodOpts = DB.all('products').map(function (p) { return '<option value="' + p.id + '">' + esc(p.name + ' (' + p.brand + ')') + '</option>'; }).join('');
    openModal('新建进货单',
      '<div class="field"><label>供应商</label><select id="puSup">' + supOpts + '</select></div>' +
      '<div class="field"><label>商品行</label><div id="puRows"></div>' +
      '<button class="btn btn--sm" onclick="App.addPuRow()">＋ 添加商品</button></div>' +
      '<div class="field"><label>已付金额（留空=欠款）</label><input id="puPaid" type="number" value="0"/></div>' +
      '<div class="field"><label>付款方式</label><select id="puMethod"><option>银行</option><option>微信</option><option>现金</option><option>欠款</option></select></div>' +
      '<div id="puSum" class="settle-line total"><span>合计</span><span class="v">¥0.00</span></div>',
      '<button class="btn" onclick="App.closeModal()">取消</button><button class="btn btn--primary" onclick="App.savePurchase()">入库并保存</button>');
    window.__puRows = [];
    window.App.addPuRow();
    window.__prodOpts = prodOpts;
  };
  window.App.addPuRow = function () {
    var rows = window.__puRows;
    rows.push({ pid: DB.all('products')[0] ? DB.all('products')[0].id : '', qty: 1, price: 0 });
    renderPuRows();
  };
  function renderPuRows() {
    var box = $('#puRows'); if (!box) return;
    var opts = window.__prodOpts || DB.all('products').map(function (p) { return '<option value="' + p.id + '">' + esc(p.name) + '</option>'; }).join('');
    box.innerHTML = window.__puRows.map(function (r, i) {
      return '<div class="row" style="gap:6px;margin-bottom:6px" data-i="' + i + '">' +
        '<select class="pu-pid" style="flex:2">' + opts.replace('value="' + r.pid + '"', 'value="' + r.pid + '" selected') + '</select>' +
        '<input class="pu-qty" type="number" value="' + r.qty + '" style="width:60px" placeholder="数量"/>' +
        '<input class="pu-price" type="number" value="' + r.price + '" style="width:80px" placeholder="单价"/>' +
        '<button class="btn btn--sm btn--danger" onclick="App.delPuRow(' + i + ')">✕</button></div>';
    }).join('');
    Array.prototype.forEach.call(box.children, function (row, i) {
      row.querySelector('.pu-pid').addEventListener('change', function (e) { window.__puRows[i].pid = e.target.value; });
      row.querySelector('.pu-qty').addEventListener('input', function (e) { window.__puRows[i].qty = parseInt(e.target.value) || 0; updatePuSum(); });
      row.querySelector('.pu-price').addEventListener('input', function (e) { window.__puRows[i].price = parseFloat(e.target.value) || 0; updatePuSum(); });
    });
    updatePuSum();
  }
  window.App.delPuRow = function (i) { window.__puRows.splice(i, 1); renderPuRows(); };
  function updatePuSum() {
    var sum = window.__puRows.reduce(function (a, r) { return a + (r.qty || 0) * (r.price || 0); }, 0);
    var el = $('#puSum'); if (el) el.innerHTML = '<span>合计</span><span class="v">' + money(sum) + '</span>';
  }
  window.App.savePurchase = function () {
    var sid = $('#puSup').value;
    if (!sid) { toast('请选择供应商', 'err'); return; }
    var items = window.__puRows.filter(function (r) { return r.pid && r.qty > 0; }).map(function (r) { return { productId: r.pid, qty: r.qty, price: r.price || 0 }; });
    if (!items.length) { toast('请至少添加一件商品', 'err'); return; }
    var sup = DB.get('suppliers', sid);
    var paid = parseFloat($('#puPaid').value) || 0;
    var method = $('#puMethod').value === '欠款' ? '欠款' : $('#puMethod').value;
    var realPaid = method === '欠款' ? 0 : paid;
    DB.recordPurchase({ supplierId: sid, supplierName: sup.name, items: items, paid: realPaid, method: method });
    closeModal(); toast('进货入库成功', 'ok'); route();
  };

  /* ---------- 库存管理 ---------- */
  views.inventory = function () {
    document.getElementById('viewTitle').textContent = '库存管理';
    var list = DB.all('products').sort(function (a, b) { return a.stock - b.stock; });
    var thr = DB.settings().lowStock;
    var rows = list.map(function (p) {
      var low = p.stock <= (p.lowStock || thr);
      return '<tr><td><b>' + esc(p.name) + '</b><div class="meta muted">' + esc(p.brand) + ' · ' + esc(p.type) + '</div></td>' +
        '<td>' + esc(p.category) + '</td><td>' + esc(p.unit) + '</td>' +
        '<td>' + (low ? '<span class="tag tag--danger">' + p.stock + '</span>' : p.stock) + '</td>' +
        '<td>' + esc(p.lowStock || thr) + '</td>' +
        '<td class="right"><button class="btn btn--sm" onclick="App.adjustStock(\'' + p.id + '\')">调整</button></td></tr>';
    }).join('');
    var logs = DB.all('stockLogs').slice().sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); }).slice(0, 30)
      .map(function (l) {
        var cls = l.type === 'in' ? 'tag--success' : (l.type === 'out' ? 'tag--danger' : 'tag--warning');
        var t = l.type === 'in' ? '入库' : (l.type === 'out' ? '出库' : '调整');
        return '<tr><td>' + esc(l.date) + '</td><td><span class="tag ' + cls + '">' + t + '</span></td><td>' + esc(l.productName) + '</td><td class="mono">' + (l.qty > 0 ? '+' : '') + l.qty + '</td><td class="muted">' + esc(l.remark) + '</td></tr>';
      }).join('') || '<tr><td colspan="5" class="empty">暂无出入库记录</td></tr>';

    app.innerHTML =
      '<div class="view-head"><h2>库存管理</h2><span class="sub">实时库存 · 低库存预警 · 出入库流水</span></div>' +
      '<div class="grid grid--2">' +
      card('实时库存（' + list.length + '）', '<table class="table"><thead><tr><th>商品</th><th>分类</th><th>单位</th><th>库存</th><th>阈值</th><th class="right">操作</th></tr></thead><tbody>' + rows + '</tbody></table>') +
      card('出入库流水（最近30条）', '<div style="max-height:520px;overflow:auto"><table class="table"><thead><tr><th>日期</th><th>类型</th><th>商品</th><th>数量</th><th>备注</th></tr></thead><tbody>' + logs + '</tbody></table></div>') +
      '</div>';
  };
  window.App.adjustStock = function (pid) {
    var p = DB.get('products', pid); if (!p) return;
    openModal('库存调整 — ' + p.name,
      '<div class="row between"><span class="muted">当前库存</span><span class="mono">' + p.stock + ' ' + esc(p.unit) + '</span></div>' +
      '<div class="field mt12"><label>调整数量（正数=增加，负数=减少）</label><input id="adjQty" type="number" value="0"/></div>' +
      '<div class="field"><label>备注</label><input id="adjRemark" placeholder="如：盘点修正"/></div>',
      '<button class="btn" onclick="App.closeModal()">取消</button><button class="btn btn--primary" onclick="App.doAdjust(\'' + pid + '\')">确定</button>');
  };
  window.App.doAdjust = function (pid) {
    var q = parseInt($('#adjQty').value) || 0;
    if (!q) { toast('请输入调整数量', 'err'); return; }
    DB.adjustStock(pid, q, $('#adjRemark').value.trim() || '库存调整');
    closeModal(); toast('库存已更新', 'ok'); route();
  };

  /* ---------- 报表分析 ---------- */
  views.reports = function () {
    document.getElementById('viewTitle').textContent = '报表分析';
    var sales = DB.all('sales'), purch = DB.all('purchases');
    var revenue = sales.reduce(function (a, s) { return a + s.total; }, 0);
    var paidRev = sales.reduce(function (a, s) { return a + s.paid; }, 0);
    var purchTotal = purch.reduce(function (a, p) { return a + p.total; }, 0);
    // 估算毛利：销量 × 最近一次采购单价
    var lastCost = {};
    purch.forEach(function (p) { p.items.forEach(function (it) { lastCost[it.productId] = it.price; }); });
    var cost = sales.reduce(function (a, s) { return a + s.items.reduce(function (x, it) { return x + it.qty * (lastCost[it.productId] || 0); }, 0); }, 0);
    var profit = revenue - cost;
    var receiv = DB.receivables().reduce(function (a, r) { return a + r.debt; }, 0);
    var payab = DB.payables().reduce(function (a, p) { return a + p.unpaid; }, 0);
    var top = DB.topProducts(6);
    var custRank = DB.all('customers').map(function (c) {
      var amt = DB.all('sales').filter(function (s) { return s.customerId === c.id; }).reduce(function (a, s) { return a + s.total; }, 0);
      return { name: c.name, amt: amt };
    }).filter(function (x) { return x.amt > 0; }).sort(function (a, b) { return b.amt - a.amt; }).slice(0, 6);

    app.innerHTML =
      '<div class="grid grid--kpi">' +
      kpiCard('累计销售额', money(revenue), '📈', '') +
      kpiCard('毛利(估算)', money(profit), '💡', 'kpi--success') +
      kpiCard('应收欠款', money(receiv), '🏦', 'kpi--warning') +
      kpiCard('应付货款', money(payab), '🚚', 'kpi--danger') +
      '</div>' +
      '<div class="grid grid--2 mt16">' +
      card('近 7 天销售趋势', barChart(DB.salesTrend(7).map(function (x) { return x.date; }), DB.salesTrend(7).map(function (x) { return x.total; }), '#2D5BE3')) +
      card('商品销量 TOP6', top.length ? barChart(top.map(function (p) { return p.name.length > 6 ? p.name.slice(0, 6) : p.name; }), top.map(function (p) { return p.qty; }), '#FF7A33') : '<div class="empty">暂无销量</div>') +
      '</div>' +
      '<div class="grid grid--2 mt16">' +
      card('客户销售排行', (custRank.length ? custRank.map(function (c, i) { return '<div class="row between" style="padding:7px 0;border-bottom:1px solid var(--c-border)"><span>' + (i + 1) + '. ' + esc(c.name) + '</span><span class="mono">' + money(c.amt) + '</span></div>'; }).join('') : '<div class="empty">暂无数据</div>')) +
      card('关键指标',
        '<div class="settle-line"><span>销售笔数</span><span class="v">' + sales.length + ' 笔</span></div>' +
        '<div class="settle-line"><span>已收货款</span><span class="v">' + money(paidRev) + '</span></div>' +
        '<div class="settle-line"><span>进货总额</span><span class="v">' + money(purchTotal) + '</span></div>' +
        '<div class="settle-line total"><span>在售商品</span><span class="v">' + DB.all('products').length + ' 种</span></div>') +
      '</div>';
  };

  /* ---------- 财务管理 ---------- */
  views.finance = function () {
    document.getElementById('viewTitle').textContent = '财务管理';
    var rec = DB.receivables();
    var pay = DB.payables();
    var recRows = rec.map(function (r) {
      return '<tr><td>' + esc(r.name) + '</td><td class="muted">' + esc(r.phone) + '</td><td class="mono">' + money(r.debt) + '</td><td class="right"><button class="btn btn--sm btn--primary" onclick="App.payDebt(\'customer\',\'' + r.id + '\')">收款</button></td></tr>';
    }).join('') || '<tr><td colspan="4" class="empty">无应收欠款 🎉</td></tr>';
    var payRows = pay.map(function (p) {
      return '<tr><td>' + esc(p.name) + '</td><td class="muted">' + esc(p.phone) + '</td><td class="mono">' + money(p.unpaid) + '</td><td class="right"><button class="btn btn--sm btn--accent" onclick="App.payDebt(\'supplier\',\'' + p.id + '\')">付款</button></td></tr>';
    }).join('') || '<tr><td colspan="4" class="empty">无应付货款 🎉</td></tr>';
    var fin = DB.all('finance').slice().sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); }).slice(0, 40)
      .map(function (f) {
        var cls = f.type === 'receive' ? 'tag--success' : 'tag--danger';
        var t = f.type === 'receive' ? '收款' : '付款';
        return '<tr><td>' + esc(f.date) + '</td><td><span class="tag ' + cls + '">' + t + '</span></td><td>' + esc(f.party) + '</td><td class="mono">' + money(f.amount) + '</td><td class="muted">' + esc(f.remark) + '</td></tr>';
      }).join('') || '<tr><td colspan="5" class="empty">暂无收付款记录</td></tr>';

    app.innerHTML =
      '<div class="view-head"><h2>财务管理</h2><span class="sub">应收 / 应付 / 收付款流水</span></div>' +
      '<div class="grid grid--2">' +
      card('应收欠款（客户）', '<table class="table"><thead><tr><th>客户</th><th>电话</th><th>欠款</th><th class="right">操作</th></tr></thead><tbody>' + recRows + '</tbody></table>') +
      card('应付货款（供应商）', '<table class="table"><thead><tr><th>供应商</th><th>电话</th><th>未付</th><th class="right">操作</th></tr></thead><tbody>' + payRows + '</tbody></table>') +
      '</div>' +
      '<div class="mt16">' + card('收付款流水', '<table class="table"><thead><tr><th>日期</th><th>类型</th><th>往来方</th><th>金额</th><th>备注</th></tr></thead><tbody>' + fin + '</tbody></table>') + '</div>';
  };
  window.App.payDebt = function (kind, pid) {
    var isC = kind === 'customer';
    var party = isC ? DB.get('customers', pid) : DB.get('suppliers', pid);
    var debt = isC ? DB.receivables().find(function (r) { return r.id === pid; }).debt : DB.payables().find(function (p) { return p.id === pid; }).unpaid;
    openModal(isC ? '客户收款' : '供应商付款',
      '<div class="field"><label>' + (isC ? '客户' : '供应商') + '</label><input value="' + esc(party.name) + '" disabled/></div>' +
      '<div class="field"><label>待' + (isC ? '收' : '付') + '金额</label><input value="' + debt + '" disabled/></div>' +
      '<div class="field"><label>本次' + (isC ? '收款' : '付款') + '金额</label><input id="pdAmt" type="number" value="' + debt + '"/></div>',
      '<button class="btn" onclick="App.closeModal()">取消</button><button class="btn btn--primary" onclick="App.doPayDebt(\'' + kind + '\',\'' + pid + '\')">确认</button>');
  };
  window.App.doPayDebt = function (kind, pid) {
    var amt = parseFloat($('#pdAmt').value) || 0;
    DB.applyPayment(kind, pid, amt);
    closeModal(); toast('已记录', 'ok'); route();
  };

  /* ---------- 系统设置 ---------- */
  views.settings = function () {
    document.getElementById('viewTitle').textContent = '系统设置';
    var s = DB.settings();
    app.innerHTML =
      '<div class="grid grid--2">' +
      card('基础信息',
        '<div class="field"><label>店铺名称</label><input id="setShop" value="' + esc(s.shopName) + '"/></div>' +
        '<div class="field"><label>默认低库存阈值</label><input id="setLow" type="number" value="' + esc(s.lowStock) + '"/></div>' +
        '<button class="btn btn--primary" onclick="App.saveSettings()">保存设置</button>') +
      card('数据维护',
        '<p class="muted">清空会删除本设备全部业务数据并恢复初始示例数据，操作不可撤销。</p>' +
        '<button class="btn btn--danger mt12" onclick="App.resetData()">清空并重置数据</button>') +
      '</div>';
  };
  window.App.saveSettings = function () {
    DB.saveSettings({ shopName: $('#setShop').value.trim() || '家电批发中心', lowStock: parseInt($('#setLow').value) || 10 });
    document.getElementById('brandName').textContent = DB.settings().shopName;
    document.getElementById('shopName').textContent = DB.settings().shopName;
    toast('设置已保存', 'ok');
  };
  window.App.resetData = function () {
    if (!confirm('确定清空全部数据并恢复示例？此操作不可撤销！')) return;
    DB.reset(); toast('已重置', 'ok'); route();
  };

  /* ---------- 数据管理 ---------- */
  views.data = function () {
    document.getElementById('viewTitle').textContent = '数据管理';
    var s = DB.settings();
    var counts = ['products', 'customers', 'suppliers', 'sales', 'purchases', 'stockLogs', 'finance'].map(function (c) { return c + '：' + DB.all(c).length; }).join('　|　');
    app.innerHTML =
      '<div class="grid grid--2">' +
      card('备份与恢复',
        '<p class="muted">数据仅保存在本设备浏览器。更换设备或共享给他人时，使用「导出备份」下载文件，再在目标设备「导入备份」。</p>' +
        '<div class="row wrap mt12">' +
        '<button class="btn btn--primary" onclick="App.exportData()">⬇️ 导出备份</button>' +
        '<button class="btn" onclick="App.importData()">⬆️ 导入备份</button>' +
        '<input type="file" id="importFile" accept=".json" style="display:none" onchange="App.doImport(this)"/>' +
        '</div>') +
      card('存储信息',
        '<div class="settle-line"><span>店铺</span><span class="v">' + esc(s.shopName) + '</span></div>' +
        '<div class="settle-line total"><span>数据量</span><span class="v" style="font-size:13px">' + counts + '</span></div>' +
        '<p class="muted mt12">部署到 GitHub Pages 后，手机浏览器打开同一网址即可使用（各设备数据独立）。</p>') +
      '</div>';
  };
  window.App.exportData = function () {
    var json = DB.exportData();
    var blob = new Blob([json], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = '家电ERP备份_' + today() + '.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast('备份已下载', 'ok');
  };
  window.App.importData = function () { $('#importFile').click(); };
  window.App.doImport = function (input) {
    var file = input.files[0]; if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try { DB.importData(reader.result); toast('导入成功', 'ok'); route(); }
      catch (e) { toast('导入失败：' + e.message, 'err'); }
    };
    reader.readAsText(file);
    input.value = '';
  };

  /* ---------------- 路由 ---------------- */
  function route() {
    var id = (location.hash || '').replace('#', '') || 'dashboard';
    if (!views[id]) id = 'dashboard';
    highlight(id);
    (views[id] || views.dashboard)();
  }
  window.addEventListener('hashchange', route);
  // 全局动作
  window.App.closeModal = closeModal;
  window.App.openSheet = openSheet;
  window.App.closeSheet = closeSheet;
  window.App.__route = route;   // 测试钩子：同步触发渲染（jsdom 的 hashchange 是异步的）

  // 绑定底部「我的」菜单
  document.getElementById('bottomNav').addEventListener('click', function (e) {
    var a = e.target.closest('[data-id]');
    if (a && a.getAttribute('data-id') === 'more') { e.preventDefault(); openSheet(); }
  });
  document.getElementById('sheetMask').addEventListener('click', function (e) {
    if (e.target.id === 'sheetMask') closeSheet();
  });

  /* ---------------- 启动 ---------------- */
  DB.init();
  var s0 = DB.settings();
  document.getElementById('brandName').textContent = s0.shopName;
  document.getElementById('shopName').textContent = s0.shopName;
  renderNav();
  route();
})();
