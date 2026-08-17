/* =========================================================
   电器批发零售 ERP · 原型交互 (UI Designer)
   轻量交互：导航 / 侧栏折叠 / 开单加减 / 弹窗 / Toast / Tab
   ========================================================= */
(function () {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

  /* ---- 侧边栏折叠 / 移动端抽屉 ---- */
  const sidebar = $(".sidebar");
  const backdrop = $(".backdrop");
  $(".topbar__toggle")?.addEventListener("click", () => {
    if (window.innerWidth <= 860) {
      sidebar.classList.toggle("open");
      backdrop.classList.toggle("show");
    } else {
      sidebar.classList.toggle("collapsed");
    }
  });
  backdrop?.addEventListener("click", () => {
    sidebar.classList.remove("open");
    backdrop.classList.remove("show");
  });

  /* ---- 视图切换（导航） ---- */
  const views = $$(".view");
  const crumb = $("#crumb");
  const crumbSub = $("#crumbSub");
  const titles = {
    dashboard: ["工作台", "经营概览与待办"],
    pos: ["销售开单", "快速收银 / 批发开单"],
    products: ["商品管理", "商品档案与分类"],
    purchase: ["采购管理", "进货订单与供应商"],
    sales: ["销售管理", "销售订单与客户"],
    inventory: ["库存管理", "库存预警与盘点"],
    report: ["报表分析", "经营数据与趋势"],
    finance: ["财务管理", "收付款与对账"],
    settings: ["系统设置", "企业与权限配置"],
    data: ["数据管理", "备份 / 导入导出 / 日志"],
  };
  $$(".nav__item").forEach((item) => {
    item.addEventListener("click", () => {
      const target = item.dataset.target;
      $$(".nav__item").forEach((n) => n.classList.remove("active"));
      item.classList.add("active");
      views.forEach((v) => v.classList.toggle("active", v.dataset.view === target));
      const t = titles[target];
      if (t) { crumb.textContent = t[0]; crumbSub.textContent = t[1]; }
      if (window.innerWidth <= 860) { sidebar.classList.remove("open"); backdrop.classList.remove("show"); }
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  /* ---- 分段控件 / Tab ---- */
  $$(".seg").forEach((seg) => {
    seg.addEventListener("click", (e) => {
      if (!e.target.matches("button")) return;
      $$("button", seg).forEach((b) => b.classList.remove("active"));
      e.target.classList.add("active");
    });
  });
  $$(".tabs").forEach((tabs) => {
    tabs.addEventListener("click", (e) => {
      if (!e.target.matches("button")) return;
      const group = tabs.dataset.group;
      $$(`.tabs[data-group="${group}"] button`).forEach((b) => b.classList.remove("active"));
      e.target.classList.add("active");
    });
  });

  /* ---- 开关 ---- */
  $$(".switch").forEach((sw) => sw.addEventListener("click", () => sw.classList.toggle("on")));

  /* ---- Toast ---- */
  const toast = $("#toast");
  let toastTimer;
  function showToast(msg, ok = true) {
    toast.innerHTML = (ok ? '<span class="ok">✓</span>' : '⚠') + " " + msg;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
  }

  /* ---- Modal ---- */
  const mask = $("#modalMask");
  function openModal(title, bodyHTML) {
    $("#modalTitle").textContent = title;
    $("#modalBody").innerHTML = bodyHTML;
    mask.classList.add("show");
  }
  function closeModal() { mask.classList.remove("show"); }
  $("#modalClose")?.addEventListener("click", closeModal);
  mask?.addEventListener("click", (e) => { if (e.target === mask) closeModal(); });
  window.openModal = openModal;
  window.closeModal = closeModal;
  window.showToast = showToast;

  /* ---- 销售开单：购物车逻辑 ---- */
  const cart = []; // {id,name,spec,price,qty}
  const cartList = $("#cartList");
  const cartCount = $("#cartCount");
  const cartTotalEl = $("#cartTotal");

  function renderCart() {
    if (!cartList) return;
    if (cart.length === 0) {
      cartList.innerHTML = '<div class="empty" style="padding:40px 0">购物车为空<br><small>点击左侧商品加入</small></div>';
    } else {
      cartList.innerHTML = cart.map((it, i) => `
        <div class="cart-row">
          <div>
            <div class="cart-row__name">${it.name}</div>
            <div class="cart-row__spec">${it.spec} · ¥${it.price.toFixed(2)}</div>
          </div>
          <div class="cart-row__right">
            <div class="stepper">
              <button data-act="dec" data-i="${i}">−</button>
              <span>${it.qty}</span>
              <button data-act="inc" data-i="${i}">+</button>
            </div>
            <div class="cart-row__sum">¥${(it.price * it.qty).toFixed(2)}</div>
            <button class="cart-del" data-act="del" data-i="${i}">×</button>
          </div>
        </div>`).join("");
    }
    const count = cart.reduce((s, it) => s + it.qty, 0);
    const total = cart.reduce((s, it) => s + it.price * it.qty, 0);
    if (cartCount) cartCount.textContent = count;
    const cartCount2 = $("#cartCount2"); if (cartCount2) cartCount2.textContent = count;
    if (cartTotalEl) cartTotalEl.textContent = "¥" + total.toFixed(2);
    const payable = $("#payable"); if (payable) payable.textContent = "¥" + total.toFixed(2);
  }

  function addToCart(p) {
    const found = cart.find((it) => it.id === p.id);
    if (found) found.qty++; else cart.push({ ...p, qty: 1 });
    renderCart();
  }

  $$(".prod").forEach((el) => {
    el.addEventListener("click", () => {
      addToCart({
        id: el.dataset.id,
        name: el.dataset.name,
        spec: el.dataset.spec,
        price: parseFloat(el.dataset.price),
      });
    });
  });

  cartList?.addEventListener("click", (e) => {
    const btn = e.target.closest("button"); if (!btn) return;
    const i = +btn.dataset.i; const act = btn.dataset.act;
    if (act === "inc") cart[i].qty++;
    if (act === "dec") { cart[i].qty--; if (cart[i].qty <= 0) cart.splice(i, 1); }
    if (act === "del") cart.splice(i, 1);
    renderCart();
  });

  /* 结算方式选择 */
  $$(".pay-method").forEach((m) =>
    m.addEventListener("click", () => {
      $$(".pay-method").forEach((x) => x.classList.remove("active"));
      m.classList.add("active");
    })
  );

  $("#submitOrder")?.addEventListener("click", () => {
    if (cart.length === 0) { showToast("请先添加商品", false); return; }
    showToast("开单成功，已保存至销售订单");
    cart.length = 0; renderCart();
    closeModal();
  });

  /* 分类切换（仅高亮） */
  $$(".cat-item").forEach((c) =>
    c.addEventListener("click", () => {
      $$(".cat-item").forEach((x) => x.classList.remove("active"));
      c.classList.add("active");
    })
  );

  renderCart();
})();
