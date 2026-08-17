# 自动化测试说明

零依赖设计原则：不引入测试框架，只用 `node` + `jsdom`（唯一 devDependency）。
`index.html` 仍可双击直接打开，测试不参与运行时。

## 怎么跑

```bash
npm install        # 只装 jsdom
npm run check      # 语法门禁：node --check db.js / app.js
npm test           # 全量测试
npm run test:db    # 只跑数据层
npm run test:ui    # 只跑界面层
```

任一失败 → 退出码 1，禁止提交。

## 文件结构

| 文件 | 职责 |
|---|---|
| `run.js` | 极简 runner，提供全局 `section()` / `check()` / `checkThrows()`，汇总 `X passed, Y failed` |
| `helpers/env.js` | `freshDB()` 返回全新种子数据的 DB（清 require 缓存 + 重置 localStorage shim） |
| `helpers/dom.js` | `boot()` 用 jsdom 装载 `index.html` + `db.js` + `app.js`，返回 `$ / $$ / go / click / fire` 等便捷方法 |
| `db.spec.js` | 数据层：A 基线 · B P0 回归 · C 投产能力 |
| `ui.spec.js` | 界面层：D 基线 · E P0 交互 · F v1 验收 · G 投产可用性 |

## jsdom 装配踩坑（勿回退）

1. **不能用 `file://` 作为 jsdom 的 url** —— 内联脚本执行时会抛 `DOMException`。必须用 `https://local.test/`。
2. **`<script src="assets/*.js">` 在 jsdom 中不会自动加载** —— 需手动按 `db.js → app.js` 顺序把文件内容注入 `<script>`。
3. **`URL.createObjectURL` 未实现** —— 导出备份测试需先打桩。
4. **`hashchange` 是异步派发的** —— 测试用 `App.__route()` 同步触发渲染。

## 基线记录

| 阶段 | 断言数 | 说明 |
|---|---|---|
| Sprint 0（基线固化） | **107 passed / 0 failed** | A1–A10 数据层基线 + D1–D11 界面层基线 |
| Sprint 1（P0 修复） | 176 passed / 0 failed | 追加 B1–B8 数据层回归 + E1–E4 交互回归 |
| Sprint 2（验收补齐） | 216 passed / 0 failed | 追加 F1–F6 |
| Sprint 3（投产可用性） | 248 passed / 0 failed | 追加 C1–C4 + G1–G4 |
| Sprint 4（收口） | 258 passed / 0 failed | 追加手机视口验收 H1–H2 |

> 断言数只允许增加。若某次改动导致总数下降，说明有测试被删除或跳过 —— 视为不合格。
