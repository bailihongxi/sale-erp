/* ============================================================
   界面层测试环境助手（jsdom 装配）

   ⚠️ 踩过的坑，务必保留：
   1) JSDOM 用 file:// 作为 url，会在 window.eval / 内联脚本执行时抛 DOMException
      → 必须用 https 源；
   2) index.html 里的 <script src="assets/*.js"> 在 jsdom 中不会自动加载（无网络/无 resources）
      → 手动把文件内容以 <script> 形式注入 document.body，保证执行顺序 db.js → app.js；
   3) 每个 JSDOM 实例拥有独立 localStorage，天然隔离，无需手工清理。
   ============================================================ */
'use strict';

var fs = require('fs');
var path = require('path');
var ROOT = path.join(__dirname, '..', '..');

function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

/** 解析 jsdom：优先项目 node_modules，找不到则尝试 NODE_PATH 指向的共享目录 */
var _jsdom = null;
function jsdom() {
  if (_jsdom) return _jsdom;
  try { _jsdom = require('jsdom'); }
  catch (e) {
    var hint = '\n未找到 jsdom。请在项目根目录执行：npm install\n';
    throw new Error(hint + e.message);
  }
  return _jsdom;
}

/**
 * 装载完整应用（index.html + db.js + app.js）
 * @param {object} opts
 *   opts.width / opts.height  视口尺寸（用于手机端断言）
 *   opts.hash                 初始路由，如 '#products'
 *   opts.beforeApp(window)    在 app.js 执行前的钩子（可预置 localStorage）
 * @returns {{ window, document, DB, App, errors }}
 */
function boot(opts) {
  opts = opts || {};
  var JSDOM = jsdom().JSDOM;
  var html = read('index.html');

  var errors = [];
  var dom = new JSDOM(html, {
    url: 'https://local.test/' + (opts.hash || ''),
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole: makeConsole(errors)
  });
  var window = dom.window;

  // 视口尺寸（jsdom 不做真实布局，仅供依赖 innerWidth 的代码分支使用）
  if (opts.width) Object.defineProperty(window, 'innerWidth', { value: opts.width, configurable: true });
  if (opts.height) Object.defineProperty(window, 'innerHeight', { value: opts.height, configurable: true });

  // jsdom 未实现 URL.createObjectURL（导出备份用到）
  if (!window.URL.createObjectURL) {
    window.URL.createObjectURL = function () { return 'blob:mock'; };
    window.URL.revokeObjectURL = function () { };
  }
  // 默认让 confirm 返回 true，便于测试删除/重置类操作；测试内可覆盖
  window.confirm = function () { return true; };
  window.alert = function () { };

  if (typeof opts.beforeApp === 'function') opts.beforeApp(window);

  inject(window, 'assets/db.js');
  inject(window, 'assets/app.js');

  return {
    window: window,
    document: window.document,
    DB: window.DB,
    App: window.App,
    errors: errors,
    /** 切换路由并同步执行渲染（jsdom 的 hashchange 是异步派发的） */
    go: function (id) {
      window.location.hash = '#' + id;
      window.App.__route ? window.App.__route() : window.dispatchEvent(new window.Event('hashchange'));
    },
    $: function (sel) { return window.document.querySelector(sel); },
    $$: function (sel) { return Array.prototype.slice.call(window.document.querySelectorAll(sel)); },
    text: function (sel) { var e = window.document.querySelector(sel); return e ? e.textContent : ''; },
    fire: function (el, type) { el.dispatchEvent(new window.Event(type, { bubbles: true })); },
    click: function (el) { el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true })); }
  };
}

function inject(window, rel) {
  var s = window.document.createElement('script');
  s.textContent = read(rel);
  window.document.body.appendChild(s);
}

function makeConsole(errors) {
  var VirtualConsole = jsdom().VirtualConsole;
  var vc = new VirtualConsole();
  vc.on('jsdomError', function (e) { errors.push(e.message || String(e)); });
  vc.on('error', function (m) { errors.push(String(m)); });
  // 屏蔽 CSS 解析等噪音，但保留 log 便于调试
  vc.on('warn', function () { });
  vc.on('info', function () { });
  vc.on('log', function () { });
  return vc;
}

module.exports = { boot: boot, read: read, ROOT: ROOT };
