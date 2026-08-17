/* ============================================================
   数据层测试环境助手
   freshDB()  —— 丢弃 require 缓存与 localStorage shim，返回一份全新种子数据的 DB
   ============================================================ */
'use strict';

var path = require('path');
var DB_PATH = path.join(__dirname, '..', '..', 'assets', 'db.js');

/**
 * 返回全新的 DB（种子数据已初始化）。
 * 每次调用都彻底重置状态，避免测试之间互相污染。
 */
function freshDB() {
  delete require.cache[require.resolve(DB_PATH)];
  delete globalThis.__ls;
  delete globalThis.DB;
  require(DB_PATH);
  var DB = globalThis.DB;
  DB.init();
  return DB;
}

/** 返回一份空白账本的 DB（无任何业务数据） */
function blankDB() {
  var DB = freshDB();
  if (typeof DB.reset === 'function') {
    try { DB.reset('blank'); } catch (e) { /* 旧版 reset 无参数 */ }
  }
  return DB;
}

module.exports = { freshDB: freshDB, blankDB: blankDB, DB_PATH: DB_PATH };
