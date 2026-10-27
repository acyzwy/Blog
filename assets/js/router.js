/**
 * router.js - 极简 Hash 路由
 * 依赖：无
 * 路由表：
 *   #/home      -> 首页
 *   #/post/{id} -> 文章详情
 *   #/about     -> 关于页
 *   #/ 或空     -> 首页
 */
(function (global) {
  'use strict';

  const Router = {
    onChange: null,                        // 路由变化回调：function(route) {}
    current: { page: 'home', id: null },   // 当前路由

    /** 初始化：监听 hashchange，并处理首次加载 */
    init() {
      window.addEventListener('hashchange', () => this._handle());
      // 首次进入无 hash 时补全 #/home（用 replaceState 避免新增历史记录）
      if (!location.hash) history.replaceState(null, '', '#/home');
      this._handle();
    },

    /* 解析当前 hash 为路由对象 */
    parse(hash = location.hash) {
      const clean = String(hash).replace(/^#\/?/, ''); // 去掉 '#/' 前缀
      const parts = clean.split('/').filter(Boolean);
      if (!parts.length) {
        return { page: 'home', id: null };
      }
      const page = parts[0];
      const id = parts.length > 1 ? Number(parts[1]) : null;
      return {
        page,
        id: Number.isFinite(id) ? id : null
      };
    },

    /** 编程式跳转：navigate('post/1') */
    navigate(path) {
      location.hash = '#/' + path;
    },

    /** 触发路由变更 */
    _handle() {
      this.current = this.parse();
      if (typeof this.onChange === 'function') this.onChange(this.current);
    }
  };

  global.Router = Router;
})(window);