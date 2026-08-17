/* ============================================================
   极简测试 runner —— 不引入测试框架，保持项目零构建原则
   用法：
     node tests/run.js          跑全部
     node tests/run.js db       只跑 db.spec.js
     node tests/run.js ui       只跑 ui.spec.js
   规约：
     全局暴露 section(name) / check(name, cond, extra)
     末尾打印 "X passed, Y failed"，有失败则 exit 1
   ============================================================ */
'use strict';

var results = [];
var currentSection = '(root)';

global.section = function (name) {
  currentSection = name;
  console.log('\n── ' + name + ' ' + '─'.repeat(Math.max(2, 54 - name.length)));
};

global.check = function (name, cond, extra) {
  var pass = !!cond;
  results.push({ section: currentSection, name: name, pass: pass, extra: extra });
  console.log((pass ? '  ✅ ' : '  ❌ ') + name + (extra != null && !pass ? '   → ' + extra : ''));
  return pass;
};

/** 断言应当抛错；err 为抛出的错误对象，便于进一步断言 */
global.checkThrows = function (name, fn, matcher) {
  var thrown = null;
  try { fn(); } catch (e) { thrown = e; }
  if (!thrown) return global.check(name, false, '未抛出异常');
  if (typeof matcher === 'function') return global.check(name, matcher(thrown), '实际: ' + thrown.message);
  return global.check(name, true);
};

var filter = (process.argv[2] || '').toLowerCase();
var specs = [];
if (!filter || filter === 'db') specs.push('./db.spec.js');
if (!filter || filter === 'ui') specs.push('./ui.spec.js');

(async function () {
  for (var i = 0; i < specs.length; i++) {
    var mod = require(specs[i]);
    var run = mod && (mod.run || mod);
    if (typeof run === 'function') {
      // 单个 spec 崩溃只登记为失败并继续，避免掩盖其他 spec 的结果
      try {
        await run();
      } catch (e) {
        global.check('【' + specs[i] + ' 运行崩溃，后续断言未执行】', false,
          (e && e.message) + '\n' + (e && e.stack || ''));
      }
    }
  }

  var passed = results.filter(function (r) { return r.pass; }).length;
  var failed = results.length - passed;

  console.log('\n' + '='.repeat(60));
  if (failed) {
    console.log('失败明细：');
    results.filter(function (r) { return !r.pass; }).forEach(function (r) {
      console.log('  ✗ [' + r.section + '] ' + r.name + (r.extra != null ? '   → ' + r.extra : ''));
    });
    console.log('');
  }
  console.log(passed + ' passed, ' + failed + ' failed');
  console.log('='.repeat(60));
  process.exit(failed ? 1 : 0);
})().catch(function (e) {
  console.error('\n💥 测试运行器崩溃：');
  console.error(e && e.stack || e);
  process.exit(1);
});
