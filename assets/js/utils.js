/**
 * utils.js - 通用工具函数
 * 依赖：无
 */
(function (global) {
  'use strict';

  const Utils = {
    /** 选择器快捷方式 */
    $(sel, ctx) { return (ctx || document).querySelector(sel); },
    $$(sel, ctx) { return Array.from((ctx || document).querySelectorAll(sel)); },

    /** 转义 HTML，防止 XSS */
    escapeHtml(str) {
      return String(str == null ? '' : str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    },

    /** 去除 HTML 标签，返回纯文本 */
    stripHtml(html) {
      const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
      return (doc.body.textContent || '').trim();
    },

    /** 截取文本前 n 个字符，超长加省略号 */
    truncate(str, n) {
      const s = String(str || '');
      return s.length > n ? s.slice(0, n) + '…' : s;
    },

    /** 格式化日期：2026-08-08 -> 2026 年 08 月 08 日 */
    formatDate(dateStr) {
      const m = String(dateStr || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (m) return `${m[1]} 年 ${m[2]} 月 ${m[3]} 日`;
      return dateStr || '';
    },

    /** 防抖 */
    debounce(fn, wait = 200) {
      let timer = null;
      return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), wait);
      };
    },

    /** 轻提示（转交给 ui.js 实现） */
    toast(msg, type) {
      if (global.UI && typeof global.UI.toast === 'function') {
        global.UI.toast(msg, type);
      } else {
        console.warn('[toast]', msg);
      }
    }
  };

  global.Utils = Utils;
})(window);