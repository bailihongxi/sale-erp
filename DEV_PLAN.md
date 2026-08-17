# 家电批发进销存 ERP — 开发计划（基于 PRD v1）

> **文档定位**：本文是 `PRD.md` 的执行层文档。PRD 说「要做什么」，本文说「谁在哪个文件改哪几行、怎么验证通过」。
> **基线版本**：git `29c1cc2`（v1 已实现，1624 行代码）
> **计划周期**：约 5 个工作日（40 人时），分 5 个 Sprint
> **使用方式**：按 §8「逐日执行顺序」自上而下做；每完成一个任务卡，跑该卡的「验收命令」，通过后按 §6 约定提交。
> **执行状态（2026-08-17）**：Sprint 0–4 全部完成，318 项自动化断言全绿；GitHub Pages 已上线 `https://bailihongxi.github.io/sale-erp/`；已打 `v1.1` 标签。手机端验收见 `docs/mobile-check.md`。

---

## 1. 现状基线（已完成，不要重做）

| 文件 | 行数 | 内容 | 状态 |
|---|---|---|---|
| `index.html` | 56 | 应用外壳（侧边栏/顶栏/弹窗/Sheet/Toast 容器） | ✅ 可用 |
| `assets/style.css` | 267 | 设计令牌 + 组件 + 响应式（1100px / 768px 两个断点） | ✅ 可用 |
| `assets/db.js` | 309 | localStorage 持久化、种子数据、CRUD、业务操作、聚合 | ⚠️ 有 6 处缺陷 |
| `assets/app.js` | 716 | 哈希路由 + 10 个模块视图 + 全部交互 | ⚠️ 有 8 处缺陷 |
| `.github/workflows/deploy.yml` | — | GitHub Actions 自动发布 Pages | ✅ 待首次验证 |
| `PRD.md` / `README.md` | — | 需求与说明 | ✅ |
| `design/` | — | 早期静态原型（与正式实现重复） | 🗑 待归档 |

**PRD §10 验收标准的真实达成度**：A 组 ✅、B 组 ✅、C 组 ⚠️（C6「改单价」未实现）、D 组 ✅、E 组 ⚠️（散客欠款漏算）、F 组 ⚠️（无写入失败保护）、G 组 ❌（测试脚本在 `/tmp`，未入库、无法复现）。

---

## 2. 差距审计（已实测验证，非推测）

以下缺陷通过 node 直接运行 `db.js` 复现，输出证据见每条「实测」栏。

### 2.1 P0 — 会导致账实不符或流程中断（必须修）

| ID | 位置 | 现象（实测） | 业务影响 |
|---|---|---|---|
| **BUG-01** | `db.js:235-238` `dashboard()`、`db.js:274-280` `receivables()` | 应收只遍历 `state.customers`，`customerId=null` 的**散客欠款单永远不进应收**。实测：散客赊账 1000 元，应收从 5380 → 5380，纹丝不动；财务应收列表也查不到 | 老板看板少算欠款，散客赊的账**从系统里消失**，直接违反 PRD 验收 E12 |
| **BUG-02** | `db.js:163-167` `recordSale()` | 用 `Math.max(0, stock - qty)` 静默截断，**可以超卖**。实测：库存 15 卖 65，库存变 0，但出库流水记 -65 | 账实不符（流水 65 ≠ 实减 15），库存数据从此不可信 |
| **BUG-03** | `db.js:212-226` `applyPayment()` | 收款超过欠款时，多余部分被丢弃，但 finance 流水**按输入全额记账**。实测：欠 500 输 99999，流水记 99999 | 财务流水虚增 9.9 万，对不上账 |
| **BUG-04** | `db.js:294-298` `importData()` | 只校验 `data.products` 存在。实测：导入缺 `sales/finance` 的 JSON 不报错，**下一次开单直接崩** `Cannot read properties of undefined (reading 'push')` | 导入一个不完整备份 → 应用变砖，且原数据已被覆盖 |
| **BUG-05** | `db.js:38` `persist()` | `STORE.setItem` 无 try/catch。localStorage 配额满、Safari 隐私模式下会抛异常 | **静默丢数据**，直接违反 PRD §7「刷新/关闭/重启不丢失」硬要求 |
| **BUG-06** | `app.js:80` + `app.js:701-707` | 手机「我的」Sheet 里点任意模块，只触发 hashchange，**从不调用 `closeSheet()`**，遮罩仍盖屏 | 手机端点一次菜单就被卡住，只能点空白处退出 —— 手机端阻塞性缺陷 |
| **BUG-07** | `app.js:408-412` `doReceive()` | 散客单（无 `customerId`）收款时走 `DB.update(paid: total)`，**忽略用户输入金额强制全额结清**，且不写 finance 流水 | 部分收款变全额，收款记录丢失 |
| **BUG-08** | `app.js:497` `views.inventory` | `DB.all('products').sort(...)` 缺 `.slice()`，**原地改写 state.products 顺序**并被 persist 落盘 | 商品档案顺序被库存页永久污染，diff 噪音 |

### 2.2 P1 — PRD 明确要求但未实现（v1 验收不通过）

| ID | 位置 | 差距 | PRD 依据 |
|---|---|---|---|
| **GAP-01** | `app.js:312-316` 购物车行 | **购物车没有单价输入框**，只能用批发价；且 `app.js:351` 改数量的 input 事件不调用 `renderPosCart()`，合计不刷新 | §10-C6「加减数量、**改单价**实时更新小计与合计」、§5「操作：改数量/单价」 |
| **GAP-02** | 全局 | **客户 / 供应商完全没有管理界面**，只有 3 条种子数据，无法新增。开单只能选这 3 个客户 | §9 明确「仅基础档案」→ 基础档案至少要能增删改，否则 v1 无法真实使用 |
| **GAP-03** | `db.js:299` `reset()` | 只能「恢复示例数据」，**没有「清空为空白账本」**。真实商户上线第一件事就是清掉示例数据 | §7「清空重置」的实际使用意图 |
| **GAP-04** | 仓库根目录 | 自动化测试写在 `/tmp/erp_test.js`，**未入库**，换机/重启即丢，无法复现 PRD 声称的 17 项断言 | §10-G「自动化回归（已实现）」 |
| **GAP-05** | 文档 + UI | `file://` 双击打开 与 `http://localhost:8080` 是**两个不同 origin，localStorage 互不相通**。用户换一种打开方式就会以为「数据丢了」 | §7 的用户感知直接相关，属高频误判陷阱 |

### 2.3 P2 — 体验与代码质量（不阻塞验收）

| ID | 位置 | 问题 |
|---|---|---|
| MNR-01 | `app.js:100` | `preserveAspectRatio="none"` 使图表在窄屏被拉伸、文字变形 |
| MNR-02 | `app.js:20-25` `statusTag` | 采购单复用销售文案，显示「已结清/部分收/欠款」，应为「已付清/部分付/未付」 |
| MNR-03 | `app.js:278` `filterPos` | POS 搜索只匹配 名称+品牌，商品管理页匹配 名称/品牌/型号/类型，两处不一致 |
| MNR-04 | `app.js:256` | `custOpts` 声明后未使用（死代码） |
| MNR-05 | `index.html:35-41` | 弹窗遮罩不支持点击关闭，也不响应 ESC |
| MNR-06 | `app.js:428-438` | 采购单详情**没有付款按钮**（销售单有收款），两侧不对称 |
| MNR-07 | `app.js:495-520` | 库存管理无搜索框，商品上百行后无法定位 |
| MNR-08 | `app.js:370-383` | 销售管理无状态筛选/日期筛选 |
| MNR-09 | `app.js:151,450,452` | `window.__prodFilter` / `window.__puRows` / `window.__prodOpts` 挂全局变量 |
| MNR-10 | `app.js:544-547` | 毛利估算对「无采购记录」的商品按成本 0 计算，毛利虚高且无提示 |
| MNR-11 | `design/` | 旧原型与正式实现并存，后续开发易改错文件 |

---

## 3. 迭代路线图

```
Sprint 0  工程化底座        0.5 天   测试入库 · 脚本 · 归档旧原型
   ↓
Sprint 1  P0 缺陷修复        1.5 天   BUG-01 ~ BUG-08（账实一致 + 手机可用）
   ↓
Sprint 2  v1 验收补齐        1.5 天   GAP-01 ~ GAP-02 + P2 关键项
   ↓
Sprint 3  投产可用性         1.0 天   GAP-03 · GAP-05 · 存储护栏 · 导入快照
   ↓
Sprint 4  部署与手机验收     0.5 天   GitHub Pages 首发 · 手机实机 · 文档同步
```

**关键顺序原则**：Sprint 0 必须先做 —— 没有可复现的测试网，后面每次改 `db.js` 都在赌运气。

---

## 4. 任务卡（可直接执行）

### Sprint 0 · 工程化底座（0.5 天 / 4 人时） ✅ 已完成

---

#### S0-01 · 把自动化测试落进仓库
**类型** GAP-04 ｜ **工作量** 2h ｜ **依赖** 无

**目标**：`/tmp/erp_test.js` 里的 17 项断言重建为仓库内可复现的测试，任何人 clone 后一条命令能跑。

**新建文件**
```
tests/
  helpers/dom.js      # jsdom 装载 index.html + db.js + app.js 的公共装配
  db.spec.js          # 数据层：CRUD / 聚合 / 库存联动 / 收款冲抵 / 导出导入
  ui.spec.js          # 界面层：10 视图渲染 / 品牌型号类型列 / 开单点击 / 弹窗
  run.js              # 极简 runner：无外部依赖，汇总 pass/fail，失败 exit 1
package.json          # 仅用于声明 scripts 与 devDependency: jsdom
```

**`tests/run.js` 要点**（不引入测试框架，保持零构建原则）
```js
// 提供全局 check(name, cond) / section(name)，收集结果
// 末尾打印 "X passed, Y failed"，有失败则 process.exit(1)
```

**`tests/helpers/dom.js` 要点**（踩过的坑，务必照抄）
```js
// jsdom 用 file:// 作为 url 会在 window.eval 时抛 DOMException
// 必须用 https 源 + 手动注入脚本：
new JSDOM(html, { url: 'https://local.test/', runScripts: 'dangerously', pretendToBeVisual: true })
// 再把 db.js / app.js 内容以 <script> 形式插入 document.body
```

**`package.json`**
```json
{
  "name": "sale-erp",
  "private": true,
  "scripts": {
    "test": "node tests/run.js",
    "test:db": "node tests/run.js db",
    "check": "node --check assets/db.js && node --check assets/app.js",
    "serve": "python3 -m http.server 8080"
  },
  "devDependencies": { "jsdom": "^24.0.0" }
}
```
> `node_modules/` 加入 `.gitignore`；`package.json` 只服务测试，**不引入任何构建步骤**，`index.html` 仍可直接双击打开。

**验收命令**
```bash
cd /Users/ybf/Desktop/SaleSystem
npm install                 # 仅装 jsdom
npm run check               # 期望：无输出、退出码 0
npm test                    # 期望：末行 "NN passed, 0 failed"，退出码 0
```

---

#### S0-02 · 归档旧原型，消除改错文件的风险
**类型** MNR-11 ｜ **工作量** 0.5h ｜ **依赖** 无

```bash
mkdir -p docs/archive
git mv design docs/archive/design-prototype-v0
# 在 docs/archive/README.md 写明：此目录为早期视觉原型，非运行代码，勿修改
```
**验收**：根目录只剩 `index.html` + `assets/` 为运行代码；`git status` 干净。

---

#### S0-03 · 建立回归基线快照
**类型** 工程 ｜ **工作量** 1.5h ｜ **依赖** S0-01

**目标**：修 bug 前先固化「当前正确的行为」，防止修 A 弄坏 B。

在 `tests/db.spec.js` 中补充**当前已正确**的行为断言（这些必须一直绿）：
- 种子数据 8 商品 / 3 客户 / 3 供应商 / 7 销售单 / 3 采购单
- 开单后库存递减、生成出库流水、欠款单状态 `unpaid`
- 采购入库后库存递增、生成入库流水
- 有 `customerId` 的客户收款可冲抵至 `paid`
- `exportData() → importData()` 往返后商品数不变
- `salesTrend(7)` 返回 7 条

**验收**：`npm test` 全绿，记下基线数字（如 `31 passed`）写入 `tests/README.md`。

---

### Sprint 1 · P0 缺陷修复（1.5 天 / 12 人时） ✅ 已完成

> 每张卡都遵循同一节奏：**先在 `db.spec.js`/`ui.spec.js` 写一条会失败的断言 → 改代码 → 断言转绿 → 全量 `npm test`**。

---

#### S1-01 · 散客欠款计入应收（BUG-01）
**严重度** P0 ｜ **工作量** 2h ｜ **文件** `assets/db.js`

**改法**：应收不再按「客户表」聚合，改为按**销售单**聚合，无 `customerId` 的归入虚拟主体「散客」。

```js
// db.js 重写 receivables()
function receivables() {
  ensure();
  var map = {};                       // key = customerId || '__walkin__'
  state.sales.forEach(function (s) {
    var debt = s.total - s.paid;
    if (debt <= 0.005) return;                       // 见 S1-04 金额精度
    var k = s.customerId || '__walkin__';
    if (!map[k]) {
      var c = s.customerId ? get('customers', s.customerId) : null;
      map[k] = { id: s.customerId || '__walkin__', name: c ? c.name : '散客',
                 phone: c ? c.phone : '', debt: 0, walkin: !s.customerId };
    }
    map[k].debt += debt;
  });
  return Object.keys(map).map(function (k) { return map[k]; })
    .sort(function (a, b) { return b.debt - a.debt; });
}
// dashboard() 里的 receivables 改为：receivables().reduce((a,r)=>a+r.debt, 0)
```
同理修 `payables()`（无 `supplierId` 的进货单归「其他供应商」）。

**连带**：`applyPayment('customer','__walkin__',amt)` 需支持散客——按 `customerId == null` 过滤单据；`app.js:603 payDebt` 对 `walkin=true` 的行隐藏电话列并显示「散客（合计）」。

**验收**
```bash
node -e "require('./assets/db.js');const D=globalThis.DB;D.init();
const b=D.dashboard().receivables;const p=D.all('products')[0];
D.recordSale({customerId:null,customerName:'散客',items:[{productId:p.id,qty:1,price:1000}],paid:0,method:'欠款'});
console.log('应收增量', D.dashboard().receivables-b, '应为 1000');
console.log('列表含散客', D.receivables().some(r=>r.name==='散客'));"
```
期望：`应收增量 1000` / `列表含散客 true`。

---

#### S1-02 · 禁止超卖（BUG-02）
**严重度** P0 ｜ **工作量** 2h ｜ **文件** `assets/db.js` + `assets/app.js`

**改法**：`recordSale` 改为**事务式**——先全量校验库存，任一行不足则整单拒绝，不做任何写入。

```js
function recordSale(p) {
  ensure();
  // 1) 预校验（含同一商品多行合并）
  var need = {};
  p.items.forEach(function (it) { need[it.productId] = (need[it.productId] || 0) + it.qty; });
  var short = [];
  Object.keys(need).forEach(function (pid) {
    var prod = get('products', pid);
    if (!prod) { short.push({ name: '(已删除商品)', want: need[pid], have: 0 }); return; }
    if (prod.stock < need[pid]) short.push({ name: prod.name, want: need[pid], have: prod.stock });
  });
  if (short.length) {
    var err = new Error('库存不足：' + short.map(function (s) {
      return s.name + '(需' + s.want + '/存' + s.have + ')'; }).join('、'));
    err.code = 'OUT_OF_STOCK'; err.detail = short;
    throw err;                                    // 整单拒绝，零写入
  }
  // 2) 原逻辑写入，扣减改为直减（已确保充足）
  prod.stock = prod.stock - it.qty;
  ...
}
```

`app.js` 的 `settlePos()` 包 try/catch，把 `err.detail` 渲染成清单式提示：
```js
try { var o = DB.recordSale({...}); }
catch (e) { if (e.code === 'OUT_OF_STOCK') { toast(e.message, 'err'); return; } throw e; }
```
另在 `addPos()` 加软提示：加入数量 > 库存时行内标红「超库存」，但**不阻止**（批发场景允许先记单后补货 → 是否放开由业务决定，默认阻止结算）。

**验收**
```bash
node -e "require('./assets/db.js');const D=globalThis.DB;D.init();
const q=D.all('products')[4];const s=q.stock;
try{ D.recordSale({customerId:null,customerName:'散客',items:[{productId:q.id,qty:s+50,price:100}],paid:0,method:'现金'}); console.log('FAIL 未拦截'); }
catch(e){ console.log('已拦截:', e.code, '| 库存未变:', q.stock===s, '| 未产生流水:', D.all('stockLogs').filter(l=>l.productId===q.id&&l.qty===s+50).length===0); }"
```
期望：`已拦截: OUT_OF_STOCK | 库存未变: true | 未产生流水: true`。

---

#### S1-03 · 收付款不得超额记账（BUG-03）
**严重度** P0 ｜ **工作量** 1h ｜ **文件** `assets/db.js:208-226`

**改法**：`applyPayment` 只把**真正冲抵掉的金额**写进 finance，并返回结果给 UI。

```js
function applyPayment(kind, partyId, amount) {
  ...
  var remain = amount, applied = 0;
  list.forEach(function (o) {
    if (remain <= 0) return;
    var pay = Math.min(o.total - o.paid, remain);
    o.paid = round2(o.paid + pay); remain = round2(remain - pay); applied = round2(applied + pay);
  });
  if (applied <= 0) return { applied: 0, ignored: amount };
  state.finance.push({ ..., amount: applied, ... });   // ← 只记 applied
  persist();
  return { applied: applied, ignored: round2(amount - applied) };
}
```
UI（`app.js doPayDebt` / `doReceive`）：`ignored > 0` 时提示「已冲抵 ¥X，超出 ¥Y 未记录」。

**验收**
```bash
node -e "require('./assets/db.js');const D=globalThis.DB;D.init();
const c=D.all('customers')[1],p=D.all('products')[0];
const o=D.recordSale({customerId:c.id,customerName:c.name,items:[{productId:p.id,qty:1,price:500}],paid:0,method:'欠款'});
const r=D.applyPayment('customer',c.id,99999);
const f=D.all('finance').slice(-1)[0];
console.log('流水金额',f.amount,'应≤',o.total,'| applied',r.applied,'ignored',r.ignored);"
```
期望：流水金额 = 实际欠款（不出现 99999），`ignored` 为差额。

---

#### S1-04 · 金额精度统一（预防性，配合 S1-01/03）
**严重度** P0-预防 ｜ **工作量** 1h ｜ **文件** `assets/db.js`

当前用 float 直接累加，多次部分收款后可能残留 `0.0000001` 导致单据**永远无法结清**（本次实测未触发，但 `applyPayment` 反复冲抵下必然出现）。

**改法**：新增并统一使用
```js
function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
function isPaidOff(o) { return o.paid >= o.total - 0.005; }   // 容差 0.5 分
```
落点：`recordSale`/`recordPurchase` 的 `subtotal/total/paid`、`applyPayment` 累加、`orderStatus`（改用 `isPaidOff`）、`receivables/payables` 的 `debt <= 0.005` 判定。

**验收**：新增断言 —— 总额 99.99 分三次收 33.33 后 `orderStatus === 'paid'`；总额 0.03 分三次收 0.01 后同样结清。

---

#### S1-05 · 导入备份强校验 + 自动快照（BUG-04）
**严重度** P0 ｜ **工作量** 1.5h ｜ **文件** `assets/db.js:294-298` + `app.js:676-685`

**改法**
```js
var COLLECTIONS = ['products','customers','suppliers','sales','purchases','stockLogs','finance'];
function importData(json) {
  var data;
  try { data = JSON.parse(json); } catch (e) { throw new Error('文件不是合法 JSON'); }
  if (!data || typeof data !== 'object') throw new Error('备份内容为空');
  if (!Array.isArray(data.products)) throw new Error('缺少商品数据，可能不是本系统的备份文件');
  var snapshot = STORE.getItem(KEY);            // 导入前快照，供回滚
  COLLECTIONS.forEach(function (c) { if (!Array.isArray(data[c])) data[c] = []; });  // 缺失集合补空数组
  data.settings = Object.assign({ shopName: '家电批发中心', lowStock: 10, currency: '¥' }, data.settings || {});
  data.__meta = { schema: 1, importedAt: new Date().toISOString() };
  try { state = data; persist(); }
  catch (e) { if (snapshot) STORE.setItem(KEY, snapshot); state = null; load(); throw e; }
  return { ok: true, counts: COLLECTIONS.map(function (c) { return c + ':' + state[c].length; }) };
}
```
同时 `exportData()` 增加 `__meta: { schema: 1, exportedAt, app: 'sale-erp' }`，为未来结构升级留迁移钩子。
UI：导入前 `confirm('导入会覆盖本机现有数据，确定继续？')`，成功后 toast 显示各集合条数。

**验收**
```bash
node -e "require('./assets/db.js');const D=globalThis.DB;D.init();
D.importData(JSON.stringify({products:[{id:'x',name:'t',stock:5,priceWholesale:1,priceRetail:2,unit:'台'}]}));
D.recordSale({customerId:null,customerName:'散客',items:[{productId:'x',qty:1,price:1}],paid:1,method:'现金'});
console.log('缺字段备份导入后开单成功，无崩溃');
try{ D.importData('{\"a\":1}'); }catch(e){ console.log('非法备份被拒:', e.message); }"
```
期望：不再出现 `reading 'push'` 崩溃；非法文件被明确拒绝。

---

#### S1-06 · 写入失败可感知（BUG-05）
**严重度** P0 ｜ **工作量** 1.5h ｜ **文件** `assets/db.js:38` + `app.js`

**改法**
```js
var onPersistError = null;                       // 由 app.js 注入
function persist() {
  try { STORE.setItem(KEY, JSON.stringify(state)); return true; }
  catch (e) {
    var quota = /quota|exceed/i.test(e.name + e.message);
    if (onPersistError) onPersistError(quota
      ? '本地存储已满，数据未保存！请立即到「数据管理」导出备份，再清理历史流水。'
      : '数据保存失败：' + e.message + '（可能处于隐私模式）');
    return false;
  }
}
root.DB.onPersistError = function (fn) { onPersistError = fn; };
```
`app.js` 启动时注册：以**红色常驻横幅**（非一闪而过的 toast）提示，并提供「立即导出备份」按钮。

补充：`assets/db.js` 增 `storageInfo()` 返回当前占用字节与估算上限，数据管理页展示进度条（80% 变黄、95% 变红）。

**验收**：在浏览器 Console 执行
```js
// 模拟配额耗尽
const orig = localStorage.setItem.bind(localStorage);
localStorage.setItem = () => { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; };
// 触发一次开单 → 期望出现红色常驻横幅，而不是静默成功
localStorage.setItem = orig;
```

---

#### S1-07 · 手机端 Sheet 点击后自动关闭（BUG-06）
**严重度** P0（手机阻塞）｜ **工作量** 0.5h ｜ **文件** `assets/app.js`

**改法**
```js
document.getElementById('sheetNav').addEventListener('click', function (e) {
  if (e.target.closest('.nav__item')) closeSheet();
});
// 兜底：路由切换必关 sheet
function route() { closeSheet(); closeModal(); ...原逻辑 }
```
顺手做 MNR-05：`modalMask` 点击遮罩关闭 + `keydown ESC` 关闭。

**验收**（jsdom 断言，写入 `ui.spec.js`）
```js
window.App.openSheet();
document.querySelector('#sheetNav .nav__item').click();
check('Sheet 点击后自动关闭', !document.getElementById('sheetMask').classList.contains('show'));
```
外加手机实机：Safari 打开 → 我的 → 点「销售开单」→ 遮罩应消失并进入开单页。

---

#### S1-08 · 散客收款走正确通道（BUG-07）
**严重度** P0 ｜ **工作量** 1h ｜ **文件** `assets/app.js:399-412`

**改法**：删掉 `DB.update('sales', oid, {paid: total})` 这条捷径，新增单据级收款 API。

```js
// db.js 新增
function receiveOnOrder(col, orderId, amount) {
  ensure();
  var o = get(col, orderId); if (!o) throw new Error('单据不存在');
  var pay = Math.min(round2(amount), round2(o.total - o.paid));
  if (pay <= 0) return { applied: 0 };
  o.paid = round2(o.paid + pay);
  state.finance.push({ id: uid(), date: todayStr(),
    type: col === 'sales' ? 'receive' : 'pay',
    party: col === 'sales' ? o.customerName : o.supplierName,
    amount: pay, remark: (col === 'sales' ? '销售收款 ' : '采购付款 ') + o.no });
  persist();
  return { applied: pay };
}
```
`doReceive` 统一改为：有 `customerId` → `applyPayment`（跨单冲抵）；散客 → `receiveOnOrder('sales', oid, amt)`。两条路径**都写 finance 流水**。

**验收**：散客欠款单收一半 → 状态 `partial`、finance 新增 1 条金额为一半；再收余额 → `paid`。

---

#### S1-09 · 消除库存页排序副作用（BUG-08）
**严重度** P0-数据洁净 ｜ **工作量** 0.2h ｜ **文件** `assets/app.js:497`

```diff
- var list = DB.all('products').sort(function (a, b) { return a.stock - b.stock; });
+ var list = DB.all('products').slice().sort(function (a, b) { return a.stock - b.stock; });
```
顺手全局排查：`grep -n "DB.all([^)]*).sort" assets/app.js` 必须为空。

**验收**
```bash
node -e "require('./assets/db.js');const D=globalThis.DB;D.init();
const first=D.all('products')[0].id; /* 模拟渲染库存页排序 */
D.all('products').slice().sort((a,b)=>a.stock-b.stock);
console.log('原顺序未被污染:', D.all('products')[0].id===first);"
```

**Sprint 1 DoD**：`npm test` 全绿且断言数 ≥ 基线 + 12；`npm run check` 通过；PRD §10 E12 与 C7 手工复验通过。

---

### Sprint 2 · v1 验收补齐（1.5 天 / 12 人时） ✅ 已完成

---

#### S2-01 · 购物车支持改单价 + 多价格切换（GAP-01）
**严重度** P1（验收项）｜ **工作量** 3h ｜ **文件** `assets/app.js:307-353`

**改法**
1. 购物车每行加单价输入框，与数量同排：
```js
'<div class="qty"><button data-act="dec">−</button><input data-act="set" value="'+it.qty+'"/><button data-act="inc">＋</button></div>' +
'<input class="cart-price" data-act="price" type="number" step="0.01" value="'+it.price+'" style="width:84px"/>' +
'<select data-act="tier" style="width:76px">' +   // 批发/零售/自定义
  '<option value="w">批发</option><option value="r">零售</option><option value="c">自定义</option></select>'
```
2. 三个事件都必须重算合计（当前 BUG：`set` 不重算）：
```js
row.querySelector('[data-act="set"]').addEventListener('change', function (e) {
  pos.items[pid].qty = Math.max(1, parseInt(e.target.value) || 1); renderPosCart(); });
row.querySelector('[data-act="price"]').addEventListener('change', function (e) {
  pos.items[pid].price = round2(parseFloat(e.target.value) || 0);
  pos.items[pid].tier = 'c'; renderPosCart(); });
row.querySelector('[data-act="tier"]').addEventListener('change', function (e) {
  var p = DB.get('products', pid);
  pos.items[pid].tier = e.target.value;
  if (e.target.value === 'w') pos.items[pid].price = p.priceWholesale;
  if (e.target.value === 'r') pos.items[pid].price = p.priceRetail;
  renderPosCart(); });
```
> 用 `change` 而非 `input`，避免每敲一个字符就整块重渲染导致光标跳走（当前 `renderPosCart` 是全量 innerHTML 重建）。

3. 记住焦点：重渲染后把焦点还给刚编辑的输入框（记录 `pid + act`，渲染后 `.focus()` 并 `setSelectionRange` 到末尾）。

**验收**（`ui.spec.js`）
```js
document.querySelector('.prod-card').click();
const priceInput = document.querySelector('.cart-item [data-act="price"]');
priceInput.value = '888'; priceInput.dispatchEvent(new window.Event('change'));
check('改单价后合计更新', document.querySelector('#posCart').textContent.includes('888'));
```
手工：加 2 件 → 改数量为 5 → 合计立刻 ×5；切「零售」→ 单价跳到零售价并重算。

---

#### S2-02 · 客户 / 供应商基础档案管理（GAP-02）
**严重度** P1（v1 不可用）｜ **工作量** 4h ｜ **文件** `app.js`（新增 2 视图）+ `index.html` 无需改

**改法**
1. `NAV` 在「经营」组内、`采购管理` 之后插入两项：
```js
{ id: 'customers', name: '客户管理', ico: '👥' },
{ id: 'suppliers', name: '供应商', ico: '🏭' },
```
2. 新增 `views.customers` / `views.suppliers`：表格（名称/电话/地址/累计交易额/当前欠款）+ 新增/编辑/删除 + 搜索。
3. **删除保护**：被销售单/进货单引用过的客户/供应商禁止硬删，改为
```js
if (DB.all('sales').some(s => s.customerId === id)) {
  // 提示「该客户已有 N 笔交易，不能删除；可改为停用」→ update(archived:true)
}
```
被停用的客户不出现在开单下拉框，但历史单据与应收保持完整。
4. 开单页客户下拉框末尾加「＋ 新增客户」，直接开弹窗建档并自动选中（批发现场高频：新客户上门就要开单）。

**验收**
- `npm test` 新增断言：`#nav .nav__item` 数量由 10 → 12；`views.customers` 渲染出表格且含种子 3 行。
- 手工：新增客户「测试批发部」→ 开单页下拉可选 → 赊账 → 财务应收出现该客户 → 尝试删除被拦截并提示停用。

---

#### S2-03 · 采购付款入口 + 状态文案修正（MNR-02 / MNR-06）
**工作量** 1.5h ｜ **文件** `assets/app.js:20-25, 428-438`

- `statusTag(status, kind)` 增第二参：`kind='purchase'` 时输出「已付清 / 部分付 / 未付」。全部调用点补参数。
- 进货单详情未付 > 0 时增加「💰 付款」按钮 → 复用 `receiveOnOrder('purchases', id, amt)`。

**验收**：进货单详情出现付款按钮，付款后状态标签显示「部分付/已付清」，财务流水新增 `pay` 记录且应付减少。

---

#### S2-04 · 列表可用性：销售筛选 / 库存搜索 / POS 搜索对齐（MNR-03/07/08）
**工作量** 2.5h ｜ **文件** `assets/app.js`

- 销售管理：状态下拉（全部/已结清/部分收/欠款）+ 日期范围（今日/近7天/近30天/全部）+ 客户关键字，纯前端过滤。
- 库存管理：搜索框（名称/品牌/型号）+「只看预警」开关。
- POS：`filterPos` 匹配范围补齐 `model + type`，与商品管理一致。

**验收**：销售管理选「欠款」只剩欠款单且条数与财务应收笔数一致；库存搜索「海尔」只剩海尔商品。

---

#### S2-05 · 图表与代码整洁（MNR-01/04/09/10）
**工作量** 1h ｜ **文件** `assets/app.js`

- 去掉 `preserveAspectRatio="none"`，改 `preserveAspectRatio="xMidYMid meet"`；CSS 加 `.chart{width:100%;height:auto}`。
- 删除 `app.js:256` 死代码 `custOpts`。
- `window.__prodFilter/__puRows/__prodOpts` 收进 IIFE 内的 `var uiState = {}`。
- 毛利卡片加脚注：「N 种商品无采购成本记录，按 0 计入，毛利偏高」。

**验收**：手机视口图表文字不变形；`grep -n "window.__" assets/app.js` 为空。

**Sprint 2 DoD**：PRD §10 A–F 全组手工复验通过（含 C6 改单价）；`npm test` 断言数 ≥ 基线 + 20。

---

### Sprint 3 · 投产可用性（1 天 / 8 人时） ✅ 已完成

---

#### S3-01 · 空白账本 + 示例数据双模式（GAP-03）
**工作量** 2h ｜ **文件** `assets/db.js:299` + `app.js:640`

```js
function reset(mode) {                 // mode: 'demo' | 'blank'
  STORE.removeItem(KEY); state = null;
  if (mode === 'blank') {
    state = { settings:{shopName:'我的家电店',lowStock:10,currency:'¥'},
      products:[], customers:[], suppliers:[], sales:[], purchases:[], stockLogs:[], finance:[],
      __meta:{schema:1} };
    persist();
  } else seed();
}
```
系统设置页两个按钮：**「清空为空白账本（正式使用）」** / 「恢复示例数据（演示）」，各自二次确认，并**强制先导出备份**（未导出则按钮 disabled，或确认框里带「我已备份」勾选）。

**验收**：点空白账本 → 各列表全空、工作台全 0、无 JS 报错；新增 1 个商品即可开单。

---

#### S3-02 · 消除 file:// 与 localhost 的数据割裂（GAP-05）
**工作量** 2h ｜ **文件** `app.js` + `README.md` + `PRD.md §7`

**问题本质**：`file://` 与 `http://localhost:8080` 与 GitHub Pages 域名是**三个独立 origin**，各存一份数据。用户换一种打开方式就会以为数据丢了 —— 这是本项目最容易被误判为「数据丢失」的坑。

**改法**
1. 顶栏（或数据管理页顶部）常驻显示当前存储位置徽标：
```js
var origin = location.protocol === 'file:' ? '本机文件(file://)' : location.origin;
// 徽标文案：「当前数据存放于：本机文件(file://)｜换用其它打开方式将看到另一份数据」
```
2. 首次在某个 origin 打开且检测到「无数据」时，弹一次性引导：「这是一个新的存储位置，如需迁移旧数据请用导入备份」。
3. `README.md` 置顶「**只用一种方式打开**」，并推荐固定为 `npm run serve` → `http://localhost:8080`（便于与手机同网访问）；同步更新 `PRD.md §7` 增加「origin 隔离」说明。

**验收**：`file://` 打开与 `localhost:8080` 打开分别显示不同徽标文案；README 首屏能看到该警告。

---

#### S3-03 · 数据安全护栏：自动本地快照 + 存储用量（配合 S1-06）
**工作量** 3h ｜ **文件** `assets/db.js` + `app.js`

- **滚动快照**：每次成功 `persist()` 后，若距上次快照 > 6 小时，把当前 JSON 写入 `sale_erp_v1_snap_{1,2,3}`（环形 3 份），数据管理页提供「从快照恢复」。防误删/误导入。
- **导出提醒**：距上次导出 > 7 天，工作台顶部黄条提示「已 N 天未备份，建议导出」（`settings.lastExportAt`）。
- **存储用量**：数据管理页显示 `已用 X KB / 约 5 MB` 进度条（复用 S1-06 的 `storageInfo()`）；超 80% 提示清理历史流水。
- **流水归档**（可选）：`stockLogs` 超 5000 条时提示导出后归档旧数据。

**验收**：手动改 `lastExportAt` 为 10 天前 → 工作台出现黄条；数据管理页显示用量与 3 个快照槽位；从快照恢复后数据回到快照时点。

---

#### S3-04 · 首屏空态与引导
**工作量** 1h ｜ **文件** `assets/app.js`

空白账本下各页给出可点击的引导（而非空白表格）：工作台「还没有数据，先去① 新增商品 ② 建供应商进货」；商品页空态 → 大按钮「＋ 新增第一个商品」。

**验收**：空白账本下 10 个页面均无「空白到不知道下一步」的死角。

**Sprint 3 DoD**：空白账本可从零走通「建商品 → 进货入库 → 开单收款 → 看报表 → 导出备份」全链路。

---

### Sprint 4 · 部署与手机验收（0.5 天 / 4 人时） ✅ 已完成

---

#### S4-01 · GitHub Pages 首次发布
**工作量** 1.5h ｜ **依赖** Sprint 1-3 完成

```bash
cd /Users/ybf/Desktop/SaleSystem
# 1) 本地最后一次门禁
npm run check && npm test

# 2) 建远端仓库（需先安装并登录 gh，或在网页端手动建库）
gh auth status || gh auth login
gh repo create sale-erp --public --source=. --remote=origin --push
# 无 gh 时：网页建库后
#   git remote add origin https://github.com/<用户名>/sale-erp.git
#   git branch -M main && git push -u origin main

# 3) 开启 Pages：仓库 Settings → Pages → Source 选 "GitHub Actions"
# 4) 观察部署
gh run list --limit 3
gh run watch
```
**验收**：`https://<用户名>.github.io/sale-erp/` 能打开；Console 无 404（重点确认 `assets/*` 相对路径与 `.nojekyll` 生效）。

---

#### S4-02 · 手机实机验收（v1 定位：以查看为主）
**工作量** 1.5h

**检查清单**（iPhone Safari + 安卓 Chrome 各跑一遍）
1. 底部标签栏 4 项可切换，安全区不被 Home 条遮挡；
2. 「我的」→ 点任意模块 → **遮罩自动关闭**（S1-07 回归）；
3. 工作台 KPI 单列排布、图表不变形不横向溢出；
4. 商品/库存表格可横向滚动，不撑破布局；
5. 开单页在手机上单列堆叠、结算区可达，能完成一笔小额开单；
6. 数据管理：手机导入 Mac 导出的 JSON → 数据完整出现（iOS 从「文件」App 选取）；
7. 明确验证 Mac 与手机数据**互不影响**（符合 PRD 设定，不是 bug）。

**产出**：`docs/mobile-check.md` 记录截图与结论。

---

#### S4-03 · 文档同步与版本收口
**工作量** 1h

- `PRD.md`：§7 增补 origin 隔离与快照机制；§8 勾选新完成项；§9 移出已实现项；§10 补充 S1/S2 新增验收点；标注 `v1.1 / 2026-08-xx`。
- `README.md`：置顶「只用一种方式打开」；补 `npm test` / `npm run serve` / 部署三步。
- `DEV_PLAN.md`（本文）：任务卡打勾，遗留项转入 §5 Backlog。
- 打标签：`git tag -a v1.1 -m "P0 修复 + 客户供应商管理 + 投产护栏" && git push --tags`

---

## 5. Backlog（v1.2+，v1.1 已发布，本表为后续迭代）

| 优先级 | 项 | 说明 |
|---|---|---|
| 高 | 打印小票/销售单 | `window.print()` + 58mm/A4 打印样式表，PRD §9 已列暂缓 |
| 高 | PWA 离线可用 | manifest + Service Worker，手机加桌面图标、断网可查（与「本地优先」天然契合） |
| 中 | 键盘流开单 | 回车搜索、数字键改量、F 键结算，批发场景效率关键 |
| 中 | 报表下钻与导出 CSV | 点柱状图看明细，导出 Excel |
| 中 | 商品条码 + 手机扫码 | `BarcodeDetector` / getUserMedia |
| 低 | 深色模式 | 令牌已预留，加 `[data-theme=dark]` 覆盖层 |
| 低 | 多单位换算 | 台/箱/件换算比（当前仅单一单位） |
| 低 | IndexedDB 迁移 | localStorage 5MB 见顶后的扩容路径 |

---

## 6. 工程约定

**分支**：`main`（可部署）← `fix/*` `feat/*`（每张任务卡一个分支，卡号入分支名，如 `fix/s1-02-oversell`）

**提交信息**
```
<type>(<scope>): <简述> [<卡号>]

fix(db): 销售开单事务化校验，禁止超卖 [S1-02]
feat(app): 新增客户/供应商基础档案管理 [S2-02]
test(db): 补齐收付款冲抵与精度回归断言 [S1-04]
docs(prd): 同步 origin 隔离与快照机制说明 [S4-03]
```

**每次提交前门禁（硬性）**
```bash
npm run check && npm test
```
任一失败禁止提交。

**代码风格**（延续现状，不引入构建）
- 纯 ES5 语法 + IIFE，不用模块打包，保证双击 `index.html` 直接运行；
- 所有插入 DOM 的用户数据必须过 `esc()`（防 XSS，尤其商品名/备注）；
- 金额一律经 `round2()`，比较用 `isPaidOff()`，禁止裸 `==` 比较浮点；
- 新增 DB 写操作必须：① 参数校验 → ② 单一入口写 state → ③ `persist()` 返回值检查。

---

## 7. 风险与回滚

| 风险 | 概率 | 影响 | 应对 |
|---|---|---|---|
| 修 `receivables()` 破坏工作台/报表数据 | 中 | 高 | S0-03 基线断言先固化；改动后对比修改前后 `dashboard()` 快照差异 |
| 禁止超卖后与真实批发习惯冲突（先开单后补货） | 中 | 中 | 保留可配置项 `settings.allowNegativeStock`（默认关），业务反馈后一键放开 |
| localStorage 5MB 见顶 | 低（长期高） | 高 | S3-03 用量监控 + 流水归档；见顶则触发 Backlog 的 IndexedDB 迁移 |
| GitHub Pages 路径导致 `assets/` 404 | 中 | 中 | 全部用相对路径（现状已是）+ `.nojekyll`；S4-01 首发后立即查 Console |
| 用户误导入错备份覆盖数据 | 中 | 高 | S1-05 导入前自动快照 + S3-03 环形快照可回滚 |
| 单文件 `app.js` 已 716 行，继续膨胀难维护 | 高 | 中 | Sprint 2 起按模块拆 `assets/views/*.js`（仍用 `<script>` 顺序加载，不引构建） |

**回滚**：任一 Sprint 出问题 → `git revert <该卡 commit>`；数据层面 → 数据管理页「从快照恢复」或导入最近一次导出的 JSON。

---

## 8. 逐日执行顺序（照此推进即可）

| 日 | 任务卡 | 产出 | 收尾门禁 |
|---|---|---|---|
| **D1 上午** | S0-01 · S0-02 | `tests/` 入库、`package.json`、旧原型归档 | `npm test` 首绿，记录基线断言数 |
| **D1 下午** | S0-03 · S1-01 | 基线断言 + 散客应收修复 | 散客赊账进应收，全量测试绿 |
| **D2 上午** | S1-02 · S1-03 | 防超卖、收付款不超额 | 超卖被拦截且零写入 |
| **D2 下午** | S1-04 · S1-05 | 金额精度、导入强校验+快照 | 缺字段备份不再崩溃 |
| **D3 上午** | S1-06 · S1-07 · S1-08 · S1-09 | 写入失败横幅、手机 Sheet、散客收款、排序副作用 | **Sprint 1 DoD** 达成 |
| **D3 下午** | S2-01 | 购物车改单价 + 多价格切换 | PRD §10-C6 通过 |
| **D4 上午** | S2-02 | 客户/供应商管理（含删除保护） | 导航 12 项，新客户可直接开单 |
| **D4 下午** | S2-03 · S2-04 · S2-05 | 采购付款、列表筛选、图表整洁 | **Sprint 2 DoD**，A–F 全组通过 |
| **D5 上午** | S3-01 · S3-02 | 空白账本、origin 徽标与文档警示 | 空白账本走通全链路 |
| **D5 下午** | S3-03 · S3-04 · S4-01 · S4-02 · S4-03 | 快照护栏、空态引导、Pages 首发、手机验收、文档收口 | 线上可访问，打 `v1.1` 标签 |

**工作量汇总**：Sprint 0 = 4h ｜ Sprint 1 = 12h ｜ Sprint 2 = 12h ｜ Sprint 3 = 8h ｜ Sprint 4 = 4h ｜ **合计 40 人时**

> **结果（2026-08-17）**：D1–D5 全部执行完毕。最终 `318 passed, 0 failed`；GitHub Pages 站点可访问（已验证 `index.html` 与 `assets/*` 均 200、无 404）；已打 `v1.1` 标签并推送。

---

## 9. 完成定义（Definition of Done）

一张任务卡算完成，必须同时满足：
1. 卡内「验收命令 / 验收步骤」全部通过，且结果贴进 commit 说明或 PR 描述；
2. 新增至少 1 条自动化断言覆盖该修复点（防回归）；
3. `npm run check && npm test` 全绿；
4. 若改动影响 PRD 已写内容 → 同步更新 `PRD.md` 对应章节；
5. 桌面 Chrome + 手机 Safari 各点一遍受影响页面，无 Console 报错。

**v1.1 整体发布条件**：
- PRD §10 A–G 七组验收标准**全部**可复现通过（G 组必须能用 `npm test` 一键复现）；
- 空白账本从零走通「建商品 → 进货入库 → 开单收款 → 报表 → 导出/导入备份」；
- GitHub Pages 线上可访问，手机浏览器完成查看类操作；
- 存在明确的备份与恢复路径（导出文件 + 3 份滚动快照）。

---

*本计划随执行更新：任务完成打勾，新发现问题追加到 §2 审计表并归入对应 Sprint 或 §5 Backlog。*
