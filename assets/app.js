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

  /* 界面临时状态（筛选条件 / 表单草稿 / 焦点记忆）
     统一收在这里，不再往 window 上挂 __xxx 全局（MNR-09） */
  var uiState = {};

  /* ---------------- 工具 ---------------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function money(n) { return CUR + Number(n || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function num(n) { return Number(n || 0).toLocaleString('zh-CN'); }
  function short(n) { n = Number(n || 0); if (n >= 10000) return (n / 10000).toFixed(1) + '万'; if (n >= 1000) return (n / 1000).toFixed(1) + 'k'; return String(Math.round(n)); }
  function today() { return DB.todayStr(); }
  /**
   * 单据状态标签。
   * kind='purchase' 时用付款口径（已付清/部分付/未付），
   * 否则用收款口径（已结清/部分收/欠款）——同一个 status 在采购单里说"已结清"会误导（MNR-06）。
   */
  function statusTag(s, kind) {
    var buy = kind === 'purchase';
    if (s === 'paid') return '<span class="tag tag--success">' + (buy ? '已付清' : '已结清') + '</span>';
    if (s === 'partial') return '<span class="tag tag--warning">' + (buy ? '部分付' : '部分收') + '</span>';
    if (s === 'unpaid') return '<span class="tag tag--danger">' + (buy ? '未付' : '欠款') + '</span>';
    return '<span class="tag">' + esc(s) + '</span>';
  }

  /** 下拉选项：pairs = [[value, label], ...] */
  function opt(pairs, cur) {
    return pairs.map(function (p) {
      return '<option value="' + esc(p[0]) + '"' + (String(cur) === String(p[0]) ? ' selected' : '') + '>' + esc(p[1]) + '</option>';
    }).join('');
  }

  /** 只取未停用的往来单位，用于各类下拉框（停用后不再新开单，但历史单据保留） */
  function activeParties(col) {
    return DB.all(col).filter(function (x) { return !x.archived; });
  }

  /** 日期是否落在筛选区间内：'all' | 'today' | 天数字符串 */
  function inRange(dateStr, range) {
    if (!range || range === 'all') return true;
    if (range === 'today') return dateStr === today();
    var days = parseInt(range, 10);
    if (!(days > 0)) return true;
    var from = new Date();
    from.setDate(from.getDate() - (days - 1));
    return String(dateStr || '') >= DB.todayStr(from);
  }

  /** 单据状态是否命中筛选：'all' | 'paid' | 'partial' | 'unpaid' | 'open'(未结清) */
  function statusHit(o, want) {
    if (!want || want === 'all') return true;
    var s = DB.orderStatus(o);
    if (want === 'open') return s !== 'paid';
    return s === want;
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

  /* ---------------- 持久化失败常驻横幅（BUG-05） ---------------- */
  function showPersistBanner(msg) {
    var el = document.getElementById('persistBanner');
    if (!el) return;
    var m = document.getElementById('persistBannerMsg');
    if (m && msg) m.textContent = msg;
    el.classList.add('show');
  }
  function hidePersistBanner() {
    var el = document.getElementById('persistBanner');
    if (el) el.classList.remove('show');
  }
  window.App = window.App || {};
  window.App.retryPersist = function () {
    if (DB.persistOk()) { hidePersistBanner(); toast('数据已保存', 'ok'); }
    else toast('仍然无法保存，请先导出备份', 'err');
  };

  /* ---------------- 导航 ---------------- */
  var NAV = [
    { group: '经营' },
    { id: 'dashboard', name: '工作台', ico: '📊' },
    { id: 'products', name: '商品管理', ico: '📦' },
    { id: 'pos', name: '销售开单', ico: '🧾' },
    { id: 'sales', name: '销售管理', ico: '💰' },
    { id: 'purchase', name: '采购管理', ico: '🚚' },
    { id: 'customers', name: '客户管理', ico: '👥' },
    { id: 'suppliers', name: '供应商', ico: '🏭' },
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
    // 等比缩放：preserveAspectRatio="none" 会把文字随视口拉扁，手机上尤其明显（MNR-01）
    return '<svg class="chart" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="xMidYMid meet">' + bars + '</svg>';
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

    var reminder = exportReminderHtml();
    var blankGuide = (DB.all('products').length === 0)
      ? '<div class="mt16">' + emptyGuide({
        ico: '📦', title: '还没有数据',
        desc: '先从下面两步开始：① 新增商品　② 建供应商并进货',
        actions: '<button class="btn btn--primary" onclick="App.editProduct()">＋ 新增商品</button>' +
          '<button class="btn" onclick="location.hash=\'#purchase\'">进货管理</button>'
      }) + '</div>'
      : '';

    app.innerHTML =
      reminder +
      '<div class="grid grid--kpi">' +
      kpiCard('今日营收', money(d.revenue), '💰', '') +
      kpiCard('今日订单', d.orderCount + ' 单', '🧾', 'kpi--accent') +
      kpiCard('库存预警', d.stockWarnings + ' 项', '⚠️', 'kpi--danger') +
      kpiCard('应收欠款', money(d.receivables), '🏦', 'kpi--warning') +
      '</div>' +
      blankGuide +
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

  /** 「N 天未备份」提醒黄条（S3-03）：超过 7 天没导出就提示，刚导出则不显示 */
  function exportReminderHtml() {
    var le = DB.settings().lastExportAt;
    if (le) {
      var days = Math.floor((Date.now() - new Date(le).getTime()) / 86400000);
      if (days <= 7) return '';
    }
    var txt = le ? ('已 ' + Math.floor((Date.now() - new Date(le).getTime()) / 86400000) + ' 天') : '从未';
    return '<div class="export-reminder show" id="exportReminder">⚠️ 已 ' + txt + '未导出备份，建议到「数据管理」导出一份，防止数据丢失。</div>';
  }

  /* ---------- 商品管理 ---------- */
  views.products = function () {
    document.getElementById('viewTitle').textContent = '商品管理';
    var list = DB.all('products');
    var PAGE_SIZE = 50;
    var filter = uiState.prodFilter || (uiState.prodFilter = { kw: '', type: '全部', page: 1 });
    var types = Array.from(new Set(list.map(function (p) { return p.type; }).filter(Boolean)));
    // 计算重复名称集合（全量统计，不受分页/筛选影响）
    var nameCount = {};
    list.forEach(function (p) { var n = (p.name || '').trim(); if (n) nameCount[n] = (nameCount[n] || 0) + 1; });
    var dupNames = {};
    Object.keys(nameCount).forEach(function (n) { if (nameCount[n] > 1) dupNames[n] = true; });
    var dupCount = Object.keys(dupNames).length;

    var hasProd = list.length > 0;
    var typeOptions = ['全部'].concat(types).map(function (t) {
      return '<option value="' + esc(t) + '"' + (filter.type === t ? ' selected' : '') + '>' + esc(t) + '</option>';
    }).join('');
    var bodyBlock = hasProd
      ? '<div class="card prod-table"><table class="table"><thead><tr>' +
        '<th>名称</th><th>品牌</th><th>型号</th><th>类型</th><th>单位</th><th>批发价</th><th>零售价</th><th>库存</th><th class="right">操作</th>' +
        '</tr></thead><tbody id="prodBody"></tbody></table></div>' +
        '<div class="prod-cards" id="prodCards"></div>' +
        '<div class="pagination" id="prodPager"></div>'
      : emptyGuide({ ico: '📦', title: '还没有商品', desc: '新增第一个商品，开始管理你的库存',
          actions: '<button class="btn btn--primary" onclick="App.editProduct()">＋ 新增第一个商品</button>' });

    app.innerHTML =
      '<div class="view-head"><h2>商品管理</h2><span class="sub">共 ' + list.length + ' 个商品' +
        (dupCount > 0 ? '　<span class="tag tag--warning">⚠️ ' + dupCount + ' 个重名</span>' : '') + '</span>' +
      '<div class="spacer"></div>' +
      (dupCount > 0 ? '<button class="btn btn--sm btn--warning" onclick="App.mergeDuplicateProducts()">🔧 合并重名商品</button>' : '') +
      '<button class="btn" onclick="App.openBatchImport()">📥 批量导入</button>' +
      '<button class="btn btn--primary" onclick="App.editProduct()">＋ 新增商品</button></div>' +
      (hasProd ? '<div class="prod-filter">' +
        '<div class="search"><span>🔍</span><input id="prodKw" placeholder="搜索名称/品牌/型号" value="' + esc(filter.kw) + '"/></div>' +
        '<select id="prodType" class="prod-filter__type">' + typeOptions + '</select>' +
        '<button class="btn btn--sm prod-filter__btn" id="prodSearchBtn">搜索</button>' +
        '</div>' : '') +
      bodyBlock;

    if (hasProd) {
      $('#prodKw').addEventListener('input', function (e) {
        filter.kw = e.target.value;
        filter.page = 1;
        renderProdRows();
      });
      $('#prodType').addEventListener('change', function (e) {
        filter.type = e.target.value;
        filter.page = 1;
        renderProdRows();
      });
      $('#prodSearchBtn').addEventListener('click', function () {
        filter.kw = $('#prodKw').value;
        filter.type = $('#prodType').value;
        filter.page = 1;
        renderProdRows();
      });
    }
    renderProdRows();
    function getFiltered() {
      return list.filter(function (p) {
        if (filter.kw && (p.name + p.brand + p.model).toLowerCase().indexOf(filter.kw.toLowerCase()) < 0) return false;
        if (filter.type !== '全部' && p.type !== filter.type) return false;
        return true;
      });
    }
    function renderPager(total) {
      var pager = $('#prodPager');
      if (!pager) return;
      var pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
      if (filter.page > pages) filter.page = pages;
      if (total <= PAGE_SIZE) { pager.innerHTML = ''; return; }
      var start = (filter.page - 1) * PAGE_SIZE + 1;
      var end = Math.min(filter.page * PAGE_SIZE, total);
      pager.innerHTML =
        '<div class="pagination__info">显示 ' + start + '-' + end + ' / 共 ' + total + ' 条</div>' +
        '<div class="pagination__btns">' +
        '<button class="btn btn--sm" data-act="prev"' + (filter.page <= 1 ? ' disabled' : '') + '>上一页</button>' +
        '<span class="pagination__page">第 ' + filter.page + ' / ' + pages + ' 页</span>' +
        '<button class="btn btn--sm" data-act="next"' + (filter.page >= pages ? ' disabled' : '') + '>下一页</button>' +
        '</div>';
      pager.querySelectorAll('button[data-act]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var act = btn.getAttribute('data-act');
          if (act === 'prev' && filter.page > 1) filter.page--;
          if (act === 'next' && filter.page < pages) filter.page++;
          renderProdRows();
        });
      });
    }
    function renderProdRows() {
      var filtered = getFiltered();
      var total = filtered.length;
      var pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
      if (filter.page > pages) filter.page = pages;
      var startIdx = (filter.page - 1) * PAGE_SIZE;
      var pageData = filtered.slice(startIdx, startIdx + PAGE_SIZE);
      var body = $('#prodBody');
      if (body) {
        body.innerHTML = pageData.map(function (p) {
          var low = p.stock <= (p.lowStock || DB.settings().lowStock);
          var isDup = dupNames[(p.name || '').trim()];
          var nameHtml = isDup ? '<b class="dup-name" title="存在重名商品">' + esc(p.name) + '</b>' : '<b>' + esc(p.name) + '</b>';
          return '<tr><td>' + nameHtml + '</td><td>' + esc(p.brand) + '</td><td>' + esc(p.model) + '</td><td>' + esc(p.type) + '</td><td>' + esc(p.unit) + '</td><td class="mono">' + money(p.priceWholesale) + '</td><td class="mono">' + money(p.priceRetail) + '</td><td>' + (low ? '<span class="tag tag--danger">' + p.stock + '</span>' : p.stock) + '</td><td class="right"><button class="btn btn--sm" onclick="App.editProduct(\'' + p.id + '\')">编辑</button> <button class="btn btn--sm btn--danger" onclick="App.delProduct(\'' + p.id + '\')">删除</button></td></tr>';
        }).join('') || '<tr><td colspan="9" class="empty">没有匹配的商品</td></tr>';
      }
      var cards = $('#prodCards');
      if (cards) {
        cards.innerHTML = pageData.map(function (p) {
          var isDup = dupNames[(p.name || '').trim()];
          var nameHtml = isDup ? '<span class="product-card__name dup-name" title="存在重名商品">' + esc(p.name) + '</span>' : '<span class="product-card__name">' + esc(p.name) + '</span>';
          return '<div class="product-card" data-id="' + p.id + '">' +
            '<div class="product-card__row">' +
              nameHtml +
              '<span class="muted">' + esc(p.type || '') + '</span>' +
            '</div>' +
            '<div class="product-card__row">' +
              '<span>进' + money(p.priceWholesale) + '</span>' +
              '<span>售' + money(p.priceRetail) + '</span>' +
              '<span>库存' + p.stock + esc(p.unit) + '</span>' +
            '</div>' +
          '</div>';
        }).join('') || '<div class="empty">没有匹配的商品</div>';
      }
      renderPager(total);
    }
  };

  window.App = window.App || {};
  window.App.editProduct = function (id) {
    var p = id ? DB.get('products', id) : null;
    var f = function (k, v) { return p ? p[k] : (v || ''); };
    var body =
      '<div class="field"><label>商品名称 *</label><input id="f_name" value="' + esc(f('name')) + '"/></div>' +
      '<div class="grid grid--2">' +
      '<div class="field"><label>品牌</label><input id="f_brand" value="' + esc(f('brand')) + '"/></div>' +
      '<div class="field"><label>型号</label><input id="f_model" value="' + esc(f('model')) + '"/></div>' +
      '</div>' +
      '<div class="grid grid--2">' +
      '<div class="field"><label>类型</label><input id="f_type" value="' + esc(f('type')) + '"/></div>' +
      '<div class="field"><label>单位</label><input id="f_unit" value="' + esc(f('unit', '台')) + '"/></div>' +
      '</div>' +
      '<div class="grid grid--3">' +
      '<div class="field"><label>批发价</label><input id="f_pw" type="number" value="' + esc(f('priceWholesale', 0)) + '"/></div>' +
      '<div class="field"><label>零售价</label><input id="f_pr" type="number" value="' + esc(f('priceRetail', 0)) + '"/></div>' +
      '<div class="field"><label>低库存阈值</label><input id="f_low" type="number" value="' + esc(f('lowStock', 10)) + '"/></div>' +
      '</div>' +
      '<div class="field"><label>当前库存</label><input id="f_stock" type="number" value="' + esc(f('stock', 0)) + '"/></div>';
    openModal(p ? '编辑商品' : '新增商品', body,
      '<button class="btn" onclick="App.closeModal()">取消</button><button class="btn btn--primary" onclick="App.saveProduct(\'' + (id || '') + '\')">保存</button>');
  };
  window.App.saveProduct = function (id) {
    var data = {
      name: $('#f_name').value.trim(), brand: $('#f_brand').value.trim(), model: $('#f_model').value.trim(),
      type: $('#f_type').value.trim(), unit: $('#f_unit').value.trim() || '台',
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
  /** 合并重名商品：同名商品保留第一条，库存/价格累加到保留项，删除其余重复项 */
  window.App.mergeDuplicateProducts = function () {
    var all = DB.all('products');
    var groups = {};
    all.forEach(function (p) {
      var n = (p.name || '').trim();
      if (!n) return;
      if (!groups[n]) groups[n] = [];
      groups[n].push(p);
    });
    var merged = 0, removed = 0;
    Object.keys(groups).forEach(function (name) {
      var group = groups[name];
      if (group.length <= 1) return;
      // 保留第一条，累加库存和价格（取加权平均价）
      var keep = group[0];
      var totalStock = keep.stock || 0;
      var totalCost = (keep.priceWholesale || 0) * (keep.stock || 0);
      for (var i = 1; i < group.length; i++) {
        var p = group[i];
        totalStock += (p.stock || 0);
        totalCost += (p.priceWholesale || 0) * (p.stock || 0);
        DB.remove('products', p.id);
        removed++;
      }
      var avgPrice = totalStock > 0 ? totalCost / totalStock : keep.priceWholesale || 0;
      DB.update('products', keep.id, {
        stock: totalStock,
        priceWholesale: Math.round(avgPrice * 100) / 100
      });
      merged++;
    });
    if (removed > 0) {
      toast('已合并 ' + merged + ' 组重名商品，删除 ' + removed + ' 条重复项', 'ok');
    } else {
      toast('没有重名商品需要合并', 'ok');
    }
    route();
  };
  /** 批量导入商品（CSV / TSV / JSON） */
  window.App.openBatchImport = function () {
    var sample = '商品名称,品牌,型号,类型,单位,批发价,零售价,低库存阈值,库存\n美的空调 KFR-35GW,美的,KFR-35GW,空调,台,1899,2299,10,20\n九阳豆浆机 JYDZ,九阳,JYDZ,小家电,台,199,299,5,30';
    var body =
      '<div class="row" style="margin-bottom:10px;gap:8px;flex-wrap:wrap">' +
      '<button class="btn btn--sm" onclick="App.chooseCsvFile()">📂 选择CSV文件</button>' +
      '<button class="btn btn--sm" onclick="App.downloadCsvTemplate()">📄 下载 CSV 模板</button>' +
      '<input type="file" id="batchFile" accept=".csv,.txt" style="display:none" onchange="App.loadCsvFile(this)"/>' +
      '<span class="muted" style="font-size:12px;align-self:center">先下载模板编辑，再选择CSV文件将内容载入下方文本框</span>' +
      '</div>' +
      '<div class="field"><label>粘贴 CSV / TSV / JSON</label><textarea id="batchArea" rows="10" placeholder="' + esc(sample) + '"></textarea></div>' +
      '<div class="muted" style="font-size:12px;margin-top:6px">支持 CSV（逗号分隔，可含表头）、TSV（制表符分隔）或 JSON 数组。表头可用「商品名称,品牌,型号,类型,单位,批发价,零售价,低库存阈值,库存」或对应英文 key；无表头时按此顺序解析。</div>';
    openModal('批量导入商品', body,
      '<button class="btn" onclick="App.closeModal()">取消</button>' +
      '<button class="btn btn--primary" onclick="App.doBatchImport()">开始导入</button>');
  };

  /** 生成商品批量导入 CSV 模板文本（表头 + 2 行示例，不含 BOM） */
  function csvTemplateText() {
    var header = '商品名称,品牌,型号,类型,单位,批发价,零售价,低库存阈值,库存';
    var rows = [
      '示例-美的空调,美的,KFR-35GW,空调,台,1899,2299,10,20',
      '示例-九阳豆浆机,九阳,JYDZ,小家电,台,199,299,5,30'
    ];
    return header + '\n' + rows.join('\n') + '\n';
  }

  /** 点击「选择CSV文件」按钮，触发隐藏的文件选择器 */
  window.App.chooseCsvFile = function () {
    var input = $('#batchFile');
    if (input) input.click();
  };

  /** 读取用户选择的CSV文件，将内容载入批量导入文本框 */
  window.App.loadCsvFile = function (input) {
    var file = input && input.files && input.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (e) {
      var text = e.target.result;
      // 去除 UTF-8 BOM，避免首列表头解析异常
      if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
      var area = $('#batchArea');
      if (area) {
        area.value = text;
        area.focus();
      }
      toast('已载入文件：' + file.name, 'ok');
    };
    reader.onerror = function () {
      toast('文件读取失败', 'err');
    };
    reader.readAsText(file, 'UTF-8');
    // 允许重复选择同一文件
    input.value = '';
  };

  /** 下载商品批量导入 CSV 模板（含表头 + 2 行示例，带 BOM 防 Excel 乱码） */
  window.App.downloadCsvTemplate = function () {
    var csv = '\uFEFF' + csvTemplateText();
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = '商品批量导入模板.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 100);
    toast('模板已下载', 'ok');
  };
  window.App.doBatchImport = function () {
    var raw = ($('#batchArea') && $('#batchArea').value) || '';
    if (!raw.trim()) { toast('没有输入内容', 'err'); return; }
    var rows = [];
    var errors = [];
    // 先尝试 JSON 数组
    try {
      var parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) rows = parsed;
      else if (parsed && Array.isArray(parsed.products)) rows = parsed.products;
      else errors.push('JSON 不是数组');
    } catch (e) {
      // CSV / TSV
      var delim = raw.indexOf('\t') >= 0 ? '\t' : ',';
      var lines = raw.split(/\r?\n/).filter(function (l) { return l.trim(); });
      if (lines.length === 0) { errors.push('没有有效行'); }
      else {
        var keys = ['name','brand','model','type','unit','priceWholesale','priceRetail','lowStock','stock'];
        var aliases = {
          name: ['商品名称','name','名称'],
          brand: ['品牌','brand'],
          model: ['型号','model'],
          type: ['类型','type'],
          unit: ['单位','unit'],
          priceWholesale: ['批发价','priceWholesale','进货价','成本价'],
          priceRetail: ['零售价','priceRetail','售价','price','sellPrice'],
          lowStock: ['低库存阈值','lowStock','预警库存'],
          stock: ['库存','stock']
        };
        var first = lines[0];
        var parts = first.split(delim).map(function (h) { return h.trim(); });
        var hasHeader = parts.some(function (h) { return aliases.name.indexOf(h) >= 0 || aliases.priceWholesale.indexOf(h) >= 0; });
        var headers = hasHeader ? parts : null;
        var start = hasHeader ? 1 : 0;
        for (var i = start; i < lines.length; i++) {
          var cells = lines[i].split(delim).map(function (c) { return c.trim(); });
          var row = {};
          if (headers) {
            for (var hi = 0; hi < headers.length; hi++) {
              var h = headers[hi];
              for (var k in aliases) {
                if (aliases[k].indexOf(h) >= 0) row[k] = cells[hi];
              }
            }
          } else {
            for (var ki = 0; ki < keys.length; ki++) row[keys[ki]] = cells[ki];
          }
          rows.push(row);
        }
      }
    }
    var created = 0, skipped = 0, dupSkipped = 0;
    var toInsert = [];
    // 现有商品名称集合，用于导入去重
    var existNames = {};
    DB.all('products').forEach(function (p) { existNames[(p.name || '').trim()] = true; });
    var importNames = {}; // 本次导入内已出现的名称
    for (var ri = 0; ri < rows.length; ri++) {
      var row = rows[ri];
      if (!row.name || !String(row.name).trim()) {
        errors.push('第 ' + (ri + 1) + ' 行缺少商品名称'); skipped++; continue;
      }
      var nm = String(row.name).trim();
      // 导入去重：与现有商品同名，或本次导入内重复，均跳过
      if (existNames[nm] || importNames[nm]) {
        dupSkipped++; skipped++;
        errors.push('第 ' + (ri + 1) + ' 行「' + nm + '」名称重复，已跳过');
        continue;
      }
      importNames[nm] = true;
      toInsert.push({
        name: nm,
        brand: String(row.brand || '').trim(),
        model: String(row.model || '').trim(),
        type: String(row.type || '').trim(),
        unit: String(row.unit || '').trim() || '台',
        priceWholesale: parseFloat(row.priceWholesale) || 0,
        priceRetail: parseFloat(row.priceRetail) || 0,
        lowStock: parseInt(row.lowStock, 10) || 10,
        stock: parseInt(row.stock, 10) || 0
      });
      created++;
    }
    // 批量写入：只持久化一次，避免大数据量时反复写 localStorage 导致卡顿
    if (toInsert.length > 0) {
      DB.insertBatch('products', toInsert);
    }
    closeModal();
    var msg = '已导入 ' + created + ' 个商品' + (skipped ? '，跳过 ' + skipped + ' 行' : '');
    if (errors.length) msg += '（' + errors[0] + (errors.length > 1 ? ' 等' : '') + '）';
    toast(msg, created > 0 ? 'ok' : 'err');
    route();
  };

  /* ---------- 销售开单（POS） ---------- */
  var pos = { items: {}, customerId: null, discount: 0, paid: 0, method: '现金', kw: '' };
  views.pos = function () {
    document.getElementById('viewTitle').textContent = '销售开单';
    app.innerHTML =
      '<div class="view-head"><h2>销售开单</h2><span class="sub">选商品 → 填数量 → 结算（支持欠款/多单位）</span></div>' +
      '<div class="pos">' +
      '<div class="card cart" id="posCart"></div>' +
      '<div class="card card__pad">' +
      '<div class="search" style="margin-bottom:10px"><span>🔍</span><input id="posKw" placeholder="搜索商品名称/品牌/型号/类型"/></div>' +
      '<div class="prod-grid" id="posGrid"></div>' +
      '</div>' +
      '</div>';

    $('#posKw').addEventListener('input', function (e) { pos.kw = e.target.value; filterPos(); });
    renderPosGrid(); renderPosCart();
  };
  /** 搜索范围与商品管理保持一致：名称 + 品牌 + 型号 + 类型（MNR-08） */
  function filterPos() {
    var grid = $('#posGrid'); if (!grid) return;
    Array.prototype.forEach.call(grid.children, function (card) {
      var t = card.getAttribute('data-s') || '';
      card.style.display = (!pos.kw || t.indexOf(pos.kw.toLowerCase()) >= 0) ? '' : 'none';
    });
  }
  function renderPosGrid() {
    var grid = $('#posGrid');
    if (!grid) return;
    var prods = DB.all('products');
    grid.innerHTML = prods.map(function (p) {
      var s = ((p.name || '') + (p.brand || '') + (p.model || '') + (p.type || '')).toLowerCase();
      return '<div class="prod-card" data-pid="' + p.id + '" data-s="' + esc(s) + '">' +
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
    if (!pos.items[pid]) pos.items[pid] = { qty: 1, price: p.priceWholesale, tier: 'w' };
    else pos.items[pid].qty += 1;
    renderPosCart();
  }
  /** 档位 → 单价（w 批发 / r 零售 / c 自定义保持原值） */
  function tierPrice(p, tier, cur) {
    if (tier === 'r') return DB.round2(p.priceRetail);
    if (tier === 'w') return DB.round2(p.priceWholesale);
    return DB.round2(cur);
  }
  function renderPosCart() {
    var c = $('#posCart'); if (!c) return;
    var ids = Object.keys(pos.items);
    var over = [];                      // 超库存的行，用于结算前拦截提示
    var rows = ids.length ? ids.map(function (pid) {
      var it = pos.items[pid], p = DB.get('products', pid);
      if (!p) return '';
      var isOver = it.qty > p.stock;
      if (isOver) over.push(p.name + '（需 ' + it.qty + '，存 ' + p.stock + '）');
      var tier = it.tier || 'w';
      return '<div class="cart-item' + (isOver ? ' over' : '') + '" data-pid="' + pid + '">' +
        '<div class="nm">' + esc(p.name) +
        (isOver ? '<span class="cart-warn">超库存</span>' : '') +
        '<div class="meta muted">批发 ' + money(p.priceWholesale) + ' · 零售 ' + money(p.priceRetail) + ' · 库存 ' + p.stock + ' ' + esc(p.unit) + '</div></div>' +
        '<div class="cart-ops">' +
        '<div class="qty"><button data-act="dec">−</button><input value="' + it.qty + '" data-act="set"/><button data-act="inc">＋</button></div>' +
        '<input class="cart-price mono" data-act="price" type="number" step="0.01" min="0" value="' + it.price + '" title="本单成交单价"/>' +
        '<select class="cart-tier" data-act="tier" title="价格档位">' +
        opt([['w', '批发'], ['r', '零售'], ['c', '自定义']], tier) + '</select>' +
        '</div>' +
        '<div class="mono cart-amt">' + money(it.qty * it.price) + '</div>' +
        '<button class="btn btn--sm btn--danger" data-act="del">✕</button></div>';
    }).join('') : '<div class="empty">点击左侧商品加入购物车</div>';

    var subtotal = ids.reduce(function (a, pid) { var it = pos.items[pid]; return a + it.qty * it.price; }, 0);
    var discount = pos.discount || 0;
    var total = Math.max(0, subtotal - discount);
    var paid = pos.paid || 0;
    var debt = Math.max(0, total - paid);
    // 停用客户不再出现在开单下拉；末尾提供现场建档入口（批发现场高频）
    var custOpts = '<option value="">散客</option>' +
      activeParties('customers').map(function (x) {
        return '<option value="' + x.id + '"' + (pos.customerId === x.id ? ' selected' : '') + '>' + esc(x.name) + '</option>';
      }).join('') +
      '<option value="__new__">＋ 新增客户…</option>';

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
      (over.length ? '<div class="cart-warn" style="display:block;margin-top:8px;padding:6px 8px">库存不足：' + esc(over.join('、')) + '，请调整数量或先入库</div>' : '') +
      '<button class="btn btn--primary btn--block mt12" onclick="App.settlePos()">💰 确认结算</button>' +
      '</div></div>';

    $('#posCust').addEventListener('change', function (e) {
      if (e.target.value === '__new__') {         // 现场建档：新客户上门就要开单
        e.target.value = pos.customerId || '';
        window.App.editCustomer('', true);
        return;
      }
      pos.customerId = e.target.value || null;
    });
    $('#posDisc').addEventListener('input', function (e) { pos.discount = parseFloat(e.target.value) || 0; renderPosCart(); });
    $('#posPaid').addEventListener('input', function (e) { pos.paid = parseFloat(e.target.value) || 0; renderPosCart(); });
    $('#posMethod').addEventListener('change', function (e) { pos.method = e.target.value; });
    Array.prototype.forEach.call(c.querySelectorAll('.cart-item'), function (row) {
      var pid = row.getAttribute('data-pid');
      row.querySelector('[data-act="inc"]').addEventListener('click', function () { pos.items[pid].qty++; renderPosCart(); });
      row.querySelector('[data-act="dec"]').addEventListener('click', function () { if (pos.items[pid].qty > 1) pos.items[pid].qty--; else delete pos.items[pid]; renderPosCart(); });
      row.querySelector('[data-act="del"]').addEventListener('click', function () { delete pos.items[pid]; renderPosCart(); });
      // 手输数量：input/change 都要即时重算合计与超库存提示
      var setQty = function (e) {
        var v = parseInt(e.target.value, 10);
        if (!(v > 0)) v = 1;
        if (!pos.items[pid]) return;
        pos.items[pid].qty = v;
        uiState.posFocus = { pid: pid, act: 'set' };
        renderPosCart();
      };
      row.querySelector('[data-act="set"]').addEventListener('input', setQty);
      row.querySelector('[data-act="set"]').addEventListener('change', setQty);
      // 改单价：用 change 而非 input，避免每敲一个字符就整块重绘导致光标跳走（GAP-01）
      row.querySelector('[data-act="price"]').addEventListener('change', function (e) {
        if (!pos.items[pid]) return;
        var v = parseFloat(e.target.value);
        pos.items[pid].price = DB.round2(v > 0 ? v : 0);
        pos.items[pid].tier = 'c';               // 手改过就算自定义价
        uiState.posFocus = { pid: pid, act: 'price' };
        renderPosCart();
      });
      // 切价格档位：批发 / 零售 一键回填，自定义保持当前价
      row.querySelector('[data-act="tier"]').addEventListener('change', function (e) {
        var p = DB.get('products', pid);
        if (!pos.items[pid] || !p) return;
        pos.items[pid].tier = e.target.value;
        pos.items[pid].price = tierPrice(p, e.target.value, pos.items[pid].price);
        uiState.posFocus = { pid: pid, act: 'tier' };
        renderPosCart();
      });
    });
    restorePosFocus(c);
  }
  /** 全量重绘后把焦点还给刚编辑的控件，否则连续改价改量会一直丢焦点 */
  function restorePosFocus(c) {
    var f = uiState.posFocus;
    if (!f) return;
    uiState.posFocus = null;
    var el = c.querySelector('.cart-item[data-pid="' + f.pid + '"] [data-act="' + f.act + '"]');
    if (!el || !el.focus) return;
    try {
      el.focus();
      // number 类型输入框调 setSelectionRange 在部分浏览器会抛错，这里只对文本框做
      if (el.setSelectionRange && el.type !== 'number' && el.tagName === 'INPUT') {
        el.setSelectionRange(String(el.value).length, String(el.value).length);
      }
    } catch (ignore) { /* 焦点恢复失败不影响业务 */ }
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
    var o;
    try {
      o = DB.recordSale({ customerId: custId, customerName: custName, items: items, discount: pos.discount || 0, paid: paid, method: method });
    } catch (e) {
      // 库存不足整单拒绝：保留购物车内容，方便用户改数量或先入库（BUG-02 UI 侧）
      if (e && (e.code === 'OUT_OF_STOCK' || e.code === 'EMPTY_ITEMS')) { toast(e.message, 'err'); renderPosCart(); return; }
      toast('开单失败：' + (e && e.message || e), 'err');
      return;
    }
    pos.items = {}; pos.discount = 0; pos.paid = 0; pos.method = '现金';
    toast('开单成功：' + o.no, 'ok');
    renderPosGrid();          // 库存已变化，同步刷新商品卡上的库存数字
    renderPosCart();
  };

  /* ---------- 销售管理 ---------- */
  views.sales = function () {
    document.getElementById('viewTitle').textContent = '销售管理';
    var f = uiState.saleFilter || (uiState.saleFilter = { status: 'all', range: 'all', kw: '' });
    app.innerHTML =
      '<div class="view-head"><h2>销售管理</h2><span class="sub" id="saleSub"></span></div>' +
      '<div class="row wrap" style="margin-bottom:12px">' +
      '<select class="sel" id="saStatus">' +
      opt([['all', '全部状态'], ['open', '未结清（含部分收）'], ['unpaid', '欠款'], ['partial', '部分收'], ['paid', '已结清']], f.status) +
      '</select>' +
      '<select class="sel" id="saRange">' +
      opt([['all', '全部日期'], ['today', '今日'], ['7', '近 7 天'], ['30', '近 30 天']], f.range) +
      '</select>' +
      '<div class="search"><span>🔍</span><input id="saKw" placeholder="搜索单号 / 客户" value="' + esc(f.kw) + '"/></div>' +
      '</div>' +
      '<div class="card"><table class="table"><thead><tr><th>单号</th><th>日期</th><th>客户</th><th class="right">金额</th><th class="right">已收</th><th>状态</th><th class="right">操作</th></tr></thead><tbody id="saleBody"></tbody></table></div>';

    $('#saStatus').addEventListener('change', function (e) { f.status = e.target.value; renderSaleRows(); });
    $('#saRange').addEventListener('change', function (e) { f.range = e.target.value; renderSaleRows(); });
    $('#saKw').addEventListener('input', function (e) { f.kw = e.target.value; renderSaleRows(); });
    renderSaleRows();
  };
  function renderSaleRows() {
    var body = $('#saleBody'); if (!body) return;
    var f = uiState.saleFilter, kw = (f.kw || '').toLowerCase();
    var all = DB.all('sales');
    var list = all.slice().sort(function (a, b) { return b.ts - a.ts; }).filter(function (o) {
      if (!statusHit(o, f.status)) return false;
      if (!inRange(o.date, f.range)) return false;
      if (kw && ((o.no || '') + (o.customerName || '')).toLowerCase().indexOf(kw) < 0) return false;
      return true;
    });
    body.innerHTML = list.map(function (o) {
      return '<tr data-id="' + o.id + '" class="clk">' +
        '<td>' + esc(o.no) + '</td><td>' + esc(o.date) + '</td><td>' + esc(o.customerName) + '</td>' +
        '<td class="right mono">' + money(o.total) + '</td><td class="right mono">' + money(o.paid) + '</td>' +
        '<td>' + statusTag(DB.orderStatus(o)) + '</td>' +
        '<td class="right"><button class="btn btn--sm" onclick="App.openSale(\'' + o.id + '\')">详情</button></td></tr>';
    }).join('') || '<tr class="empty-row"><td colspan="7" class="empty">' + (all.length ? '没有匹配的销售单' : '暂无销售单') + '</td></tr>';
    var sub = $('#saleSub');
    if (sub) {
      var amt = list.reduce(function (a, o) { return a + o.total; }, 0);
      var debt = list.reduce(function (a, o) { return a + Math.max(0, o.total - o.paid); }, 0);
      sub.textContent = list.length + ' / ' + all.length + ' 张单 · 金额 ' + money(amt) + ' · 欠款 ' + money(debt);
    }
  }
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
    var debt = DB.round2(o.total - o.paid);
    var isWalkin = !o.customerId;
    openModal('收款 — ' + o.no,
      '<div class="field"><label>客户</label><input value="' + esc(o.customerName) + '" disabled/></div>' +
      '<div class="field"><label>待收金额</label><input value="' + debt + '" disabled/></div>' +
      '<div class="field"><label>本次收款</label><input id="rcvAmt" type="number" step="0.01" value="' + debt + '"/></div>' +
      '<p class="muted">' + (isWalkin
        ? '散客单据：收款只冲抵本单。'
        : '客户单据：收款按开单时间先后自动冲抵该客户的未结清单据。') + '</p>',
      '<button class="btn" onclick="App.closeModal()">取消</button>' +
      '<button class="btn btn--primary" onclick="App.doReceive(\'' + (o.customerId || '') + '\',\'' + id + '\')">确认收款</button>');
  };
  /** cid 为空 = 散客单：走单据级收款，只影响本单且照常记流水（BUG-07） */
  window.App.doReceive = function (cid, oid) {
    var amt = parseFloat($('#rcvAmt').value) || 0;
    if (amt <= 0) { toast('请输入收款金额', 'err'); return; }
    var r = cid ? DB.applyPayment('customer', cid, amt) : DB.receiveOnOrder('sales', oid, amt);
    closeModal();
    reportPayment(r, '收款');
    route();
  };
  /** 统一提示实际冲抵与被忽略的超额部分（BUG-03） */
  function reportPayment(r, label) {
    r = r || { applied: 0, ignored: 0 };
    if (r.applied <= 0) { toast('没有可冲抵的欠款，未记账', 'err'); return; }
    if (r.ignored > 0) toast('已' + label + ' ' + money(r.applied) + '，超出 ' + money(r.ignored) + ' 未记录', 'ok');
    else toast(label + '成功 ' + money(r.applied), 'ok');
  }

  /* ---------- 采购管理 ---------- */
  views.purchase = function () {
    document.getElementById('viewTitle').textContent = '采购管理';
    var list = DB.all('purchases').slice().sort(function (a, b) { return b.ts - a.ts; });
    var rows = list.map(function (o) {
      return '<tr data-id="' + o.id + '" class="clk"><td>' + esc(o.no) + '</td><td>' + esc(o.date) + '</td><td>' + esc(o.supplierName) + '</td>' +
        '<td class="right mono">' + money(o.total) + '</td><td class="right mono">' + money(o.paid) + '</td>' +
        '<td>' + statusTag(DB.orderStatus(o), 'purchase') + '</td>' +
        '<td class="right"><button class="btn btn--sm" onclick="App.openPurchase(\'' + o.id + '\')">详情</button></td></tr>';
    }).join('') || '<tr class="empty-row"><td colspan="7" class="empty">暂无采购单</td></tr>';
    app.innerHTML =
      '<div class="view-head"><h2>采购管理</h2><span class="sub">共 ' + list.length + ' 张进货单</span>' +
      '<div class="spacer"></div><button class="btn btn--primary" onclick="App.openPurchaseForm()">＋ 新建进货单</button></div>' +
      '<div class="card"><table class="table"><thead><tr><th>单号</th><th>日期</th><th>供应商</th><th class="right">金额</th><th class="right">已付</th><th>状态</th><th class="right">操作</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  };
  window.App.openPurchase = function (id) {
    var o = DB.get('purchases', id); if (!o) return;
    var items = o.items.map(function (it) { return '<tr><td>' + esc(it.name) + '</td><td>' + esc(it.unit) + '</td><td class="mono">' + it.qty + '</td><td class="mono">' + money(it.price) + '</td><td class="mono">' + money(it.subtotal) + '</td></tr>'; }).join('');
    var debt = DB.round2(o.total - o.paid);
    openModal('进货单 ' + o.no,
      '<div class="row between"><span class="muted">供应商：' + esc(o.supplierName || '其他供应商') + '</span><span>' + statusTag(DB.orderStatus(o), 'purchase') + '</span></div>' +
      '<table class="table mt12"><thead><tr><th>商品</th><th>单位</th><th>数量</th><th>单价</th><th>小计</th></tr></thead><tbody>' + items + '</tbody></table>' +
      '<div class="settle-line"><span>进货总额</span><span class="v">' + money(o.total) + '</span></div>' +
      '<div class="settle-line"><span>已付</span><span class="v">' + money(o.paid) + '</span></div>' +
      (debt > 0.005 ? '<div class="settle-line total"><span>未付</span><span class="v" style="color:var(--c-danger)">' + money(debt) + '</span></div>' : ''),
      '<button class="btn" onclick="App.closeModal()">关闭</button>' +
      (debt > 0.005 ? '<button class="btn btn--primary" onclick="App.payPurchase(\'' + o.id + '\')">💰 付款 ' + money(debt) + '</button>' : ''));
  };
  /** 进货单付款：只冲抵本单，超额自动截断（复用 receiveOnOrder，MNR-02） */
  window.App.payPurchase = function (id) {
    var o = DB.get('purchases', id); if (!o) return;
    var left = DB.round2(o.total - o.paid);
    openModal('付款 — ' + o.no,
      '<div class="field"><label>供应商</label><input value="' + esc(o.supplierName || '其他供应商') + '" disabled/></div>' +
      '<div class="field"><label>未付金额</label><input value="' + left + '" disabled/></div>' +
      '<div class="field"><label>本次付款</label><input id="ppAmt" type="number" step="0.01" value="' + left + '"/></div>' +
      '<p class="muted">付款只冲抵本张进货单，超出未付金额的部分不会记账。</p>',
      '<button class="btn" onclick="App.closeModal()">取消</button>' +
      '<button class="btn btn--primary" onclick="App.doPayPurchase(\'' + id + '\')">确认付款</button>');
  };
  window.App.doPayPurchase = function (id) {
    var amt = parseFloat($('#ppAmt').value) || 0;
    if (amt <= 0) { toast('请输入付款金额', 'err'); return; }
    var r = DB.receiveOnOrder('purchases', id, amt);
    closeModal();
    reportPayment(r, '付款');
    route();
  };
  window.App.openPurchaseForm = function () {
    var sups = activeParties('suppliers');
    if (!sups.length) { toast('请先到「供应商」新增一个供应商', 'err'); return; }
    var supOpts = '<option value="">选择供应商</option>' + sups.map(function (s) { return '<option value="' + s.id + '">' + esc(s.name) + '</option>'; }).join('');
    var prodOpts = DB.all('products').map(function (p) { return '<option value="' + p.id + '">' + esc(p.name + ' (' + p.brand + ')') + '</option>'; }).join('');
    openModal('新建进货单',
      '<div class="field"><label>供应商</label><select id="puSup">' + supOpts + '</select></div>' +
      '<div class="field"><label>商品行</label><div id="puRows"></div>' +
      '<button class="btn btn--sm" onclick="App.addPuRow()">＋ 添加商品</button></div>' +
      '<div class="field"><label>已付金额（留空=欠款）</label><input id="puPaid" type="number" value="0"/></div>' +
      '<div class="field"><label>付款方式</label><select id="puMethod"><option>银行</option><option>微信</option><option>现金</option><option>欠款</option></select></div>' +
      '<div id="puSum" class="settle-line total"><span>合计</span><span class="v">¥0.00</span></div>',
      '<button class="btn" onclick="App.closeModal()">取消</button><button class="btn btn--primary" onclick="App.savePurchase()">入库并保存</button>');
    uiState.puRows = [];
    uiState.prodOpts = prodOpts;
    window.App.addPuRow();
  };
  window.App.addPuRow = function () {
    var rows = uiState.puRows || (uiState.puRows = []);
    rows.push({ pid: DB.all('products')[0] ? DB.all('products')[0].id : '', qty: 1, price: 0 });
    renderPuRows();
  };
  function renderPuRows() {
    var box = $('#puRows'); if (!box) return;
    var allProds = DB.all('products');
    box.innerHTML = (uiState.puRows || []).map(function (r, i) {
      return '<div class="row" style="gap:6px;margin-bottom:6px" data-i="' + i + '">' +
        '<div style="flex:2;min-width:0">' +
        '<input class="pu-kw" placeholder="搜索名称/品牌/型号" style="width:100%;margin-bottom:4px"/>' +
        '<select class="pu-pid" style="width:100%"><option value="">选择商品</option></select>' +
        '</div>' +
        '<input class="pu-qty" type="number" value="' + r.qty + '" style="width:60px" placeholder="数量"/>' +
        '<input class="pu-price" type="number" value="' + r.price + '" style="width:80px" placeholder="单价"/>' +
        '<button class="btn btn--sm btn--danger" onclick="App.delPuRow(' + i + ')">✕</button></div>';
    }).join('');
    Array.prototype.forEach.call(box.children, function (row, i) {
      var sel = row.querySelector('.pu-pid');
      var kwIn = row.querySelector('.pu-kw');
      var priceIn = row.querySelector('.pu-price');
      function buildOptions(kw) {
        var pid = uiState.puRows[i].pid;
        var html = allProds.filter(function (p) {
          if (!kw) return true;
          if (p.id === pid) return true;
          var t = (p.name + ' ' + p.brand + ' ' + p.model + ' ' + p.type).toLowerCase();
          return t.indexOf(kw.toLowerCase()) >= 0;
        }).map(function (p) {
          return '<option value="' + p.id + '"' + (p.id === pid ? ' selected' : '') + '>' + esc(p.name + ' (' + p.brand + ')') + '</option>';
        }).join('');
        sel.innerHTML = html || '<option value="">无匹配商品</option>';
      }
      buildOptions('');
      kwIn.addEventListener('input', function (e) { buildOptions(e.target.value); });
      sel.addEventListener('change', function (e) {
        uiState.puRows[i].pid = e.target.value;
        var p = DB.get('products', e.target.value);
        if (p && priceIn && (!parseFloat(priceIn.value) || parseFloat(priceIn.value) === 0)) {
          priceIn.value = p.priceWholesale;
          uiState.puRows[i].price = p.priceWholesale;
        }
        updatePuSum();
      });
      row.querySelector('.pu-qty').addEventListener('input', function (e) { uiState.puRows[i].qty = parseInt(e.target.value) || 0; updatePuSum(); });
      priceIn.addEventListener('input', function (e) { uiState.puRows[i].price = parseFloat(e.target.value) || 0; updatePuSum(); });
    });
    updatePuSum();
  }
  window.App.delPuRow = function (i) { uiState.puRows.splice(i, 1); renderPuRows(); };
  function updatePuSum() {
    var sum = (uiState.puRows || []).reduce(function (a, r) { return a + (r.qty || 0) * (r.price || 0); }, 0);
    var el = $('#puSum'); if (el) el.innerHTML = '<span>合计</span><span class="v">' + money(sum) + '</span>';
  }
  window.App.savePurchase = function () {
    var sid = $('#puSup').value;
    if (!sid) { toast('请选择供应商', 'err'); return; }
    var items = (uiState.puRows || []).filter(function (r) { return r.pid && r.qty > 0; }).map(function (r) { return { productId: r.pid, qty: r.qty, price: r.price || 0 }; });
    if (!items.length) { toast('请至少添加一件商品', 'err'); return; }
    var sup = DB.get('suppliers', sid);
    var paid = parseFloat($('#puPaid').value) || 0;
    var method = $('#puMethod').value === '欠款' ? '欠款' : $('#puMethod').value;
    var realPaid = method === '欠款' ? 0 : paid;
    DB.recordPurchase({ supplierId: sid, supplierName: sup.name, items: items, paid: realPaid, method: method });
    closeModal(); toast('进货入库成功', 'ok'); route();
  };

  /* ---------- 客户 / 供应商档案（GAP-02） ----------
     两张表结构同构，用同一套渲染与增删改逻辑，避免复制粘贴走偏。 */
  function partyStats(col) {
    var isC = col === 'customers';
    var key = isC ? 'customerId' : 'supplierId';
    var amt = {}, debt = {}, cnt = {};
    DB.all(isC ? 'sales' : 'purchases').forEach(function (o) {
      var id = o[key]; if (!id) return;
      amt[id] = DB.round2((amt[id] || 0) + Number(o.total || 0));
      debt[id] = DB.round2((debt[id] || 0) + Math.max(0, DB.round2(o.total - o.paid)));
      cnt[id] = (cnt[id] || 0) + 1;
    });
    return { amt: amt, debt: debt, cnt: cnt };
  }
  function partyView(col) {
    var isC = col === 'customers';
    var title = isC ? '客户管理' : '供应商';
    var fKey = isC ? 'custFilter' : 'supFilter';
    var f = uiState[fKey] || (uiState[fKey] = { kw: '' });
    var all = DB.all(col);
    var hasAny = all.length > 0;
    document.getElementById('viewTitle').textContent = title;
    var tableCard = hasAny
      ? '<div class="card"><table class="table"><thead><tr>' +
        '<th>' + (isC ? '客户名称' : '供应商名称') + '</th><th>电话</th><th>地址</th>' +
        '<th class="right">累计交易额</th><th class="right">' + (isC ? '当前欠款' : '当前应付') + '</th>' +
        '<th>状态</th><th class="right">操作</th>' +
        '</tr></thead><tbody id="' + (isC ? 'custBody' : 'supBody') + '"></tbody></table></div>'
      : emptyGuide({ ico: isC ? '👥' : '🏭', title: '还没有' + (isC ? '客户' : '供应商'),
          desc: '新增第一个' + (isC ? '客户' : '供应商') + '，开单时即可选择',
          actions: '<button class="btn btn--primary" onclick="App.' + (isC ? 'editCustomer' : 'editSupplier') + '()">＋ 新增' + (isC ? '客户' : '供应商') + '</button>' });

    app.innerHTML =
      '<div class="view-head"><h2>' + title + '</h2><span class="sub" id="partySub"></span>' +
      '<div class="spacer"></div>' +
      '<button class="btn btn--primary" onclick="App.' + (isC ? 'editCustomer' : 'editSupplier') + '()">＋ 新增' + (isC ? '客户' : '供应商') + '</button></div>' +
      (hasAny ? '<div class="row wrap" style="margin-bottom:12px"><div class="search"><span>🔍</span>' +
        '<input id="' + (isC ? 'custKw' : 'supKw') + '" placeholder="搜索名称 / 电话 / 地址" value="' + esc(f.kw) + '"/></div></div>' : '') +
      tableCard;
    if (hasAny) {
      $('#' + (isC ? 'custKw' : 'supKw')).addEventListener('input', function (e) { f.kw = e.target.value; renderPartyRows(col); });
    }
    renderPartyRows(col);
  }
  function renderPartyRows(col) {
    var isC = col === 'customers';
    var body = $(isC ? '#custBody' : '#supBody'); if (!body) return;
    var f = uiState[isC ? 'custFilter' : 'supFilter'] || { kw: '' };
    var kw = (f.kw || '').toLowerCase();
    var st = partyStats(col);
    var all = DB.all(col);
    var list = all.filter(function (x) {
      if (!kw) return true;
      return ((x.name || '') + (x.phone || '') + (x.address || '')).toLowerCase().indexOf(kw) >= 0;
    });
    body.innerHTML = list.map(function (x) {
      var d = st.debt[x.id] || 0;
      return '<tr data-id="' + x.id + '">' +
        '<td><b>' + esc(x.name) + '</b></td>' +
        '<td class="muted">' + esc(x.phone) + '</td>' +
        '<td class="muted">' + esc(x.address) + '</td>' +
        '<td class="right mono">' + money(st.amt[x.id] || 0) + ' <span class="muted">/ ' + (st.cnt[x.id] || 0) + ' 笔</span></td>' +
        '<td class="right mono">' + (d > 0.005 ? '<span style="color:var(--c-danger)">' + money(d) + '</span>' : money(0)) + '</td>' +
        '<td>' + (x.archived ? '<span class="tag tag--warning">停用</span>' : '<span class="tag tag--success">正常</span>') + '</td>' +
        '<td class="right">' +
        '<button class="btn btn--sm" onclick="App.' + (isC ? 'editCustomer' : 'editSupplier') + '(\'' + x.id + '\')">编辑</button> ' +
        (x.archived
          ? '<button class="btn btn--sm" onclick="App.' + (isC ? 'restoreCustomer' : 'restoreSupplier') + '(\'' + x.id + '\')">启用</button>'
          : '<button class="btn btn--sm btn--danger" onclick="App.' + (isC ? 'delCustomer' : 'delSupplier') + '(\'' + x.id + '\')">删除</button>') +
        '</td></tr>';
    }).join('') || '<tr class="empty-row"><td colspan="7" class="empty">没有匹配的' + (isC ? '客户' : '供应商') + '</td></tr>';
    var sub = $('#partySub');
    if (sub) {
      var owe = list.reduce(function (a, x) { return a + (st.debt[x.id] || 0); }, 0);
      sub.textContent = '共 ' + all.length + ' 家 · 停用 ' + all.filter(function (x) { return x.archived; }).length +
        ' · ' + (isC ? '应收' : '应付') + ' ' + money(owe);
    }
  }
  views.customers = function () { partyView('customers'); };
  views.suppliers = function () { partyView('suppliers'); };

  /** 建档弹窗；fromPos=true 表示从开单页现场建档，保存后自动选中该客户 */
  function partyForm(col, id, fromPos) {
    var isC = col === 'customers';
    var x = id ? DB.get(col, id) : null;
    var pre = isC ? 'c_' : 's_';
    openModal((x ? '编辑' : '新增') + (isC ? '客户' : '供应商'),
      '<div class="field"><label>' + (isC ? '客户' : '供应商') + '名称 *</label><input id="' + pre + 'name" value="' + esc(x ? x.name : '') + '"/></div>' +
      '<div class="field"><label>联系电话</label><input id="' + pre + 'phone" value="' + esc(x ? x.phone : '') + '"/></div>' +
      '<div class="field"><label>地址</label><input id="' + pre + 'addr" value="' + esc(x ? x.address : '') + '"/></div>' +
      '<div class="field"><label>备注</label><input id="' + pre + 'remark" value="' + esc(x ? x.remark : '') + '"/></div>' +
      (x && x.archived ? '<p class="muted">当前为停用状态，不会出现在开单/进货下拉框，历史单据与欠款保持不变。</p>' : ''),
      '<button class="btn" onclick="App.closeModal()">取消</button>' +
      '<button class="btn btn--primary" onclick="App.' + (isC ? 'saveCustomer' : 'saveSupplier') +
      '(\'' + (id || '') + '\'' + (fromPos ? ', true' : '') + ')">保存</button>');
  }
  function partySave(col, id, fromPos) {
    var pre = col === 'customers' ? 'c_' : 's_';
    var data = {
      name: $('#' + pre + 'name').value.trim(),
      phone: $('#' + pre + 'phone').value.trim(),
      address: $('#' + pre + 'addr').value.trim(),
      remark: $('#' + pre + 'remark').value.trim()
    };
    if (!data.name) { toast('请填写名称', 'err'); return; }
    var dup = DB.all(col).filter(function (x) { return x.id !== id && x.name === data.name; }).length;
    if (dup) { toast('已存在同名记录，请换个名称', 'err'); return; }
    var x = id ? DB.update(col, id, data) : DB.insert(col, data);
    closeModal();
    toast('已保存', 'ok');
    if (fromPos && x) { pos.customerId = x.id; renderPosCart(); return; }
    route();
  }
  /** 删除保护：被单据引用过的往来单位禁止硬删，只能停用，否则历史单据与应收会对不上账 */
  function partyDelete(col, id) {
    var isC = col === 'customers';
    var key = isC ? 'customerId' : 'supplierId';
    var used = DB.all(isC ? 'sales' : 'purchases').filter(function (o) { return o[key] === id; }).length;
    var label = isC ? '客户' : '供应商';
    if (used) {
      if (!confirm('该' + label + '已有 ' + used + ' 笔单据，删除会导致历史单据与欠款对不上账。\n是否改为「停用」？（停用后不再出现在开单下拉框，历史数据完整保留）')) return;
      DB.update(col, id, { archived: true });
      toast('已停用该' + label + '，历史单据与欠款保持不变', 'ok');
      route(); return;
    }
    if (!confirm('确定删除该' + label + '？')) return;
    DB.remove(col, id);
    toast('已删除', 'ok');
    route();
  }
  window.App.editCustomer = function (id, fromPos) { partyForm('customers', id, fromPos); };
  window.App.saveCustomer = function (id, fromPos) { partySave('customers', id, fromPos); };
  window.App.delCustomer = function (id) { partyDelete('customers', id); };
  window.App.restoreCustomer = function (id) { DB.update('customers', id, { archived: false }); toast('已启用', 'ok'); route(); };
  window.App.editSupplier = function (id) { partyForm('suppliers', id); };
  window.App.saveSupplier = function (id) { partySave('suppliers', id); };
  window.App.delSupplier = function (id) { partyDelete('suppliers', id); };
  window.App.restoreSupplier = function (id) { DB.update('suppliers', id, { archived: false }); toast('已启用', 'ok'); route(); };

  /* ---------- 库存管理 ---------- */
  views.inventory = function () {
    document.getElementById('viewTitle').textContent = '库存管理';
    var f = uiState.invFilter || (uiState.invFilter = { kw: '', lowOnly: false });
    var logs = DB.all('stockLogs').slice().sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); }).slice(0, 30)
      .map(function (l) {
        var cls = l.type === 'in' ? 'tag--success' : (l.type === 'out' ? 'tag--danger' : 'tag--warning');
        var t = l.type === 'in' ? '入库' : (l.type === 'out' ? '出库' : '调整');
        return '<tr><td>' + esc(l.date) + '</td><td><span class="tag ' + cls + '">' + t + '</span></td><td>' + esc(l.productName) + '</td><td class="mono">' + (l.qty > 0 ? '+' : '') + l.qty + '</td><td class="muted">' + esc(l.remark) + '</td></tr>';
      }).join('') || '<tr><td colspan="5" class="empty">暂无出入库记录</td></tr>';

    var thr = DB.settings().lowStock;
    var prods = DB.all('products');
    var hasProd = prods.length > 0;
    var stockCard = hasProd
      ? card('实时库存（<span id="invCount"></span>）', '<table class="table"><thead><tr><th>商品</th><th>单位</th><th>库存</th><th>阈值</th><th class="right">操作</th></tr></thead><tbody id="invBody"></tbody></table>')
      : emptyGuide({ ico: '🏬', title: '还没有库存', desc: '先去新增商品并进货，库存会自动汇总到这里',
          actions: '<button class="btn btn--primary" onclick="App.editProduct()">＋ 新增商品</button>' });

    app.innerHTML =
      '<div class="view-head"><h2>库存管理</h2><span class="sub" id="invSub"></span></div>' +
      (hasProd ? '<div class="row wrap" style="margin-bottom:12px">' +
        '<div class="search"><span>🔍</span><input id="invKw" placeholder="搜索名称/品牌/型号/类型" value="' + esc(f.kw) + '"/></div>' +
        '<label class="row" style="gap:6px;font-size:13px;color:var(--c-muted)"><input type="checkbox" id="invLowOnly"' + (f.lowOnly ? ' checked' : '') + '/> 只看预警</label>' +
        '</div>' : '') +
      '<div class="grid grid--2">' +
      stockCard +
      card('出入库流水（最近30条）', '<div style="max-height:520px;overflow:auto"><table class="table"><thead><tr><th>日期</th><th>类型</th><th>商品</th><th>数量</th><th>备注</th></tr></thead><tbody>' + logs + '</tbody></table></div>') +
      '</div>';

    if (hasProd) {
      $('#invKw').addEventListener('input', function (e) { f.kw = e.target.value; renderInvRows(); });
      $('#invLowOnly').addEventListener('change', function (e) { f.lowOnly = e.target.checked; renderInvRows(); });
    }
    renderInvRows();

    function renderInvRows() {
      var body = $('#invBody'); if (!body) return;
      var rows = prods.filter(function (p) {
        if (f.lowOnly && !(p.stock <= (p.lowStock || thr))) return false;
        if (f.kw && (p.name + p.brand + p.model + p.type).toLowerCase().indexOf(f.kw.toLowerCase()) < 0) return false;
        return true;
      }).map(function (p) {
        var low = p.stock <= (p.lowStock || thr);
        return '<tr data-pid="' + p.id + '">' +
          '<td><b>' + esc(p.name) + '</b></td>' +
          '<td>' + esc(p.unit) + '</td>' +
          '<td class="mono">' + (low ? '<span class="tag tag--danger">' + p.stock + '</span>' : p.stock) + '</td>' +
          '<td class="muted">' + (p.lowStock || thr) + '</td>' +
          '<td class="right"><button class="btn btn--sm" onclick="App.adjustStock(\'' + p.id + '\')">调整</button></td>' +
          '</tr>';
      }).join('') || '<tr class="empty-row"><td colspan="5" class="empty">没有匹配的库存</td></tr>';
      body.innerHTML = rows;
      var cnt = $('#invCount'); if (cnt) cnt.textContent = prods.length;
      var sub = $('#invSub'); if (sub) sub.textContent = '实时库存 · 低库存预警 ' + DB.stockWarnings().length + ' 项 · 出入库流水';
    }
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
    // 无采购成本商品：毛利为估算值，缺成本会让毛利虚高，报表需显著提示（F6）
    var noCostIds = {};
    sales.forEach(function (s) { s.items.forEach(function (it) { if (!lastCost[it.productId]) noCostIds[it.productId] = 1; }); });
    var missN = Object.keys(noCostIds).length;
    var receiv = DB.receivables().reduce(function (a, r) { return a + r.debt; }, 0);
    var payab = DB.payables().reduce(function (a, p) { return a + p.unpaid; }, 0);
    var top = DB.topProducts(6);
    var custRank = DB.all('customers').map(function (c) {
      var amt = DB.all('sales').filter(function (s) { return s.customerId === c.id; }).reduce(function (a, s) { return a + s.total; }, 0);
      return { name: c.name, amt: amt };
    }).filter(function (x) { return x.amt > 0; }).sort(function (a, b) { return b.amt - a.amt; }).slice(0, 6);

    app.innerHTML =
      (missN > 0 ? '<p class="muted mt12">⚠️ 毛利为估算值：有 ' + missN + ' 种商品无采购成本记录，成本按 0 计算，毛利可能偏高。</p>' : '') +
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
    // 往来主体一律取自聚合结果：散客 / 其他供应商这类虚拟主体在客户表里查不到（BUG-01 UI 侧）
    var row = (isC ? DB.receivables() : DB.payables()).filter(function (x) { return x.id === pid; })[0];
    if (!row) { toast('该往来方已无欠款', 'err'); return; }
    var debt = isC ? row.debt : row.unpaid;
    openModal(isC ? '客户收款' : '供应商付款',
      '<div class="field"><label>' + (isC ? '客户' : '供应商') + '</label><input value="' + esc(row.name) + (row.walkin ? '（合计）' : '') + '" disabled/></div>' +
      (row.phone ? '<div class="field"><label>联系电话</label><input value="' + esc(row.phone) + '" disabled/></div>' : '') +
      '<div class="field"><label>待' + (isC ? '收' : '付') + '金额（' + row.orders + ' 张单）</label><input value="' + debt + '" disabled/></div>' +
      '<div class="field"><label>本次' + (isC ? '收款' : '付款') + '金额</label><input id="pdAmt" type="number" step="0.01" value="' + debt + '"/></div>' +
      '<p class="muted">按开单时间先后自动冲抵未结清单据，超出欠款的部分不会记账。</p>',
      '<button class="btn" onclick="App.closeModal()">取消</button><button class="btn btn--primary" onclick="App.doPayDebt(\'' + kind + '\',\'' + pid + '\')">确认</button>');
  };
  window.App.doPayDebt = function (kind, pid) {
    var amt = parseFloat($('#pdAmt').value) || 0;
    if (amt <= 0) { toast('请输入金额', 'err'); return; }
    var r = DB.applyPayment(kind, pid, amt);
    closeModal();
    reportPayment(r, kind === 'customer' ? '收款' : '付款');
    route();
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
        '<p class="muted">清空会删除本设备全部业务数据。正式使用请先「导出备份」，再清空为空白账本从零开始；或随时恢复示例数据用于演示。</p>' +
        '<div class="row wrap mt12">' +
        '<button class="btn btn--danger" onclick="App.resetBlankConfirm()">🗑️ 清空为空白账本</button>' +
        '<button class="btn" onclick="App.resetDemoConfirm()">↺ 恢复示例数据</button>' +
        '</div>') +
      card('GitHub Pages 数据同步',
        '<p class="muted">将本机数据以 base64 写入 GitHub 仓库文件，供网页版读取或下次构建后作为默认数据。需具有 repo 权限的 Personal Access Token。</p>' +
        '<div class="field"><label>GitHub Token</label><input id="ghToken" type="password" placeholder="ghp_..."/></div>' +
        '<div class="grid grid--2">' +
        '<div class="field"><label>仓库（owner/repo）</label><input id="ghRepo" value="' + esc(s.ghRepo || '') + '" placeholder="如 bailihongxi/sale-erp"/></div>' +
        '<div class="field"><label>分支</label><input id="ghBranch" value="' + esc(s.ghBranch || 'main') + '"/></div>' +
        '</div>' +
        '<div class="field"><label>文件路径</label><input id="ghPath" value="' + esc(s.ghPath || 'data/state.json') + '"/></div>' +
        '<button class="btn btn--primary mt12" onclick="App.syncToGitHub()">🚀 导出并更新到 GitHub</button>') +
      '</div>';
  };
  window.App.saveSettings = function () {
    DB.saveSettings({ shopName: $('#setShop').value.trim() || '家电批发中心', lowStock: parseInt($('#setLow').value) || 10 });
    document.getElementById('brandName').textContent = DB.settings().shopName;
    document.getElementById('shopName').textContent = DB.settings().shopName;
    toast('设置已保存', 'ok');
  };
  /** base64 编码（支持中文） */
  function b64u(s) { return btoa(unescape(encodeURIComponent(s))); }
  window.App.syncToGitHub = function () {
    var token = $('#ghToken').value.trim();
    var repo = $('#ghRepo').value.trim();
    var branch = ($('#ghBranch').value || 'main').trim();
    var path = ($('#ghPath').value || 'data/state.json').trim();
    if (!token) { toast('请输入 GitHub Token', 'err'); return; }
    if (!repo || repo.split('/').length !== 2) { toast('仓库格式应为 owner/repo', 'err'); return; }
    if (!path) { toast('请输入文件路径', 'err'); return; }
    DB.saveSettings({ ghRepo: repo, ghBranch: branch, ghPath: path });
    var api = 'https://api.github.com/repos/' + repo + '/contents/' + encodeURIComponent(path);
    var headers = { 'Authorization': 'token ' + token, 'Accept': 'application/vnd.github+json' };
    var content = b64u(DB.exportData());
    fetch(api + '?ref=' + encodeURIComponent(branch), { method: 'GET', headers: headers })
      .then(function (r) { return r.json(); })
      .then(function (data) { return doPush(data && data.sha); })
      .catch(function () { return doPush(null); });
    function doPush(sha) {
      var body = { message: 'Sync ERP data @ ' + new Date().toISOString(), content: content, branch: branch };
      if (sha) body.sha = sha;
      fetch(api, {
        method: 'PUT',
        headers: Object.assign({ 'Content-Type': 'application/json' }, headers),
        body: JSON.stringify(body)
      })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, status: r.status, json: j }; }); })
      .then(function (res) {
        if (res.ok) {
          var url = res.json.content && res.json.content.html_url;
          toast('已同步到 GitHub' + (url ? '：' + url : ''), 'ok');
        } else {
          toast('同步失败：' + ((res.json && res.json.message) || res.status), 'err');
        }
      })
      .catch(function (e) { toast('同步失败：' + (e && e.message || e), 'err'); });
    }
  };
  window.App.resetData = function () { window.App.resetBlankConfirm(); };
  window.App.resetBlankConfirm = function () {
    openModal('清空为空白账本',
      '<p>此操作将删除本机全部业务数据，恢复为空白账本（可重新建商品、进货、开单）。</p>' +
      '<label class="row" style="gap:8px;margin-top:10px"><input type="checkbox" id="rbExported"/> 我已导出备份（数据管理 → 导出备份）</label>',
      '<button class="btn" onclick="App.closeModal()">取消</button>' +
      '<button class="btn btn--danger" id="rbGo" disabled onclick="App.doResetBlank()">确认清空</button>');
    var cb = $('#rbExported');
    var go = $('#rbGo');
    if (cb && go) cb.addEventListener('change', function () { go.disabled = !cb.checked; });
  };
  window.App.doResetBlank = function () {
    DB.reset('blank'); closeModal(); toast('已清空为空白账本', 'ok'); route();
  };
  window.App.resetDemoConfirm = function () {
    if (!confirm('确定恢复示例数据？当前数据将被覆盖。')) return;
    DB.reset('demo'); toast('已恢复示例数据', 'ok'); route();
  };

  /* ---------- 数据管理 ---------- */
  views.data = function () {
    document.getElementById('viewTitle').textContent = '数据管理';
    var s = DB.settings();
    var counts = ['products', 'customers', 'suppliers', 'sales', 'purchases', 'stockLogs', 'finance'].map(function (c) { return c + '：' + DB.all(c).length; }).join('　|　');
    var info = DB.storageInfo();
    var pct = info.percent;
    var fillCls = pct >= 95 ? 'usage__fill--danger' : (pct >= 80 ? 'usage__fill--warn' : '');
    var snaps = DB.snapshots();
    var snapRows = snaps.length ? snaps.map(function (sn) {
      return '<div class="row between" style="padding:6px 0"><span class="muted">快照 ' + sn.index + '（' + (sn.size / 1024).toFixed(1) + ' KB）</span>' +
        '<button class="btn btn--sm" onclick="App.restoreSnapshot(' + sn.index + ')">恢复</button></div>';
    }).join('') : '<div class="empty">暂无快照</div>';
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
        '<div class="usage"><div class="row between" style="margin-top:10px"><span class="muted">本地存储占用</span><span class="mono">' + (info.used / 1024).toFixed(1) + ' KB / 约 ' + (info.limit / 1024 / 1024).toFixed(0) + ' MB（' + pct.toFixed(1) + '%）</span></div>' +
        '<div class="usage__bar"><div class="usage__fill ' + fillCls + '" style="width:' + Math.min(100, pct) + '%"></div></div></div>' +
        '<p class="muted mt12">数据仅保存在当前浏览器，各设备独立。更换设备请用「导出备份」迁移。</p>') +
      '</div>' +
      '<div class="mt16">' + card('本地快照（自动）',
        '<p class="muted">每隔一段时间自动保存一份账本快照，误删/误导入后可从此处恢复（环形保留 3 份）。</p>' +
        '<div class="row wrap mt12"><button class="btn btn--sm" onclick="App.snapshotNow()">📸 立即快照</button></div>' +
        '<div class="mt12">' + snapRows + '</div>') + '</div>';
  };
  window.App.snapshotNow = function () { DB.snapshotNow(); toast('已创建快照', 'ok'); route(); };
  window.App.restoreSnapshot = function (i) {
    if (!confirm('恢复快照将覆盖当前数据，确定继续？')) return;
    try { DB.restoreSnapshot(i); toast('已从快照 ' + i + ' 恢复', 'ok'); route(); }
    catch (e) { toast('恢复失败：' + e.message, 'err'); }
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
    closeSheet();                 // 兜底：任何路由切换都关掉手机版菜单与弹窗（BUG-06）
    closeModal();
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
  window.App.routeSync = route;   // 测试钩子：同步触发渲染（jsdom 的 hashchange 是异步的）

  // 绑定底部「我的」菜单
  document.getElementById('bottomNav').addEventListener('click', function (e) {
    var a = e.target.closest('[data-id]');
    if (a && a.getAttribute('data-id') === 'more') { e.preventDefault(); openSheet(); }
  });
  document.getElementById('sheetMask').addEventListener('click', function (e) {
    if (e.target.id === 'sheetMask') closeSheet();
  });
  // 手机版：点菜单项后必须立刻收起遮罩，否则页面被盖住无法操作（BUG-06）
  document.getElementById('sheetNav').addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('.nav__item')) closeSheet();
  });
  // 弹窗：点遮罩空白处 / 按 ESC 关闭（MNR-05）
  document.getElementById('modalMask').addEventListener('click', function (e) {
    if (e.target.id === 'modalMask') closeModal();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' && e.keyCode !== 27) return;
    if (document.getElementById('sheetMask').classList.contains('show')) { closeSheet(); return; }
    if (document.getElementById('modalMask').classList.contains('show')) closeModal();
  });

  /* ---------------- 存储位置徽标 + 首次引导（GAP-05） ---------------- */
  function fillOriginBadge() {
    var el = document.getElementById('originBadge');
    if (!el) return;
    var isFile = location.protocol === 'file:';
    var label = isFile ? '本机文件(file://)' : (location.origin || '');
    el.textContent = '📍 ' + label;
    el.title = isFile ? '数据存于本机文件：换用局域网地址 / 手机打开会看到另一份独立数据' : '数据存于 ' + label + '：换用其它方式打开会看到另一份独立数据';
    el.classList.toggle('origin-badge--file', isFile);
  }
  function initRunState() {
    fillOriginBadge();
    if (!DB.settings().firstRunDone) {
      var el = document.getElementById('firstRunHint');
      var msg = document.getElementById('firstRunHintMsg');
      if (el && msg) {
        msg.textContent = '这是一个新的数据存储位置。如需迁移旧账本，请到「数据管理」用「导入备份」恢复；注意：双击文件 / 局域网地址 / 手机 是三个互相独立的数据，互不相通。';
        el.classList.add('show');
      }
      DB.saveSettings({ firstRunDone: true });
    }
  }
  window.App.dismissFirstRun = function () {
    var el = document.getElementById('firstRunHint');
    if (el) el.classList.remove('show');
  };

  /* ---------------- 空态引导（S3-04） ---------------- */
  function emptyGuide(opts) {
    return '<div class="empty-guide"><div class="empty-guide__ico">' + (opts.ico || '📭') + '</div>' +
      '<div class="empty-guide__title">' + esc(opts.title) + '</div>' +
      '<div class="empty-guide__desc">' + esc(opts.desc) + '</div>' +
      (opts.actions || '') + '</div>';
  }

  /* ---------------- 启动 ---------------- */
  // 先注册持久化失败回调，确保首次 init/seed 的写入失败也能被用户看到（BUG-05）
  DB.onPersistError(function (msg) { showPersistBanner(msg); });
  DB.init();
  initRunState();
  var s0 = DB.settings();
  document.getElementById('brandName').textContent = s0.shopName;
  document.getElementById('shopName').textContent = s0.shopName;
  renderNav();
  route();
})();
