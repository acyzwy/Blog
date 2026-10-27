/**
 * comments.js - 评论区（giscus）
 * 依赖：theme.js
 * 说明：
 *   - 按 giscus.app 官方文档注入 <script src="https://giscus.app/client.js"> 元素
 *   - 懒加载：仅进入文章详情页时注入，首页/关于页不加载
 *   - 每篇文章使用稳定映射（data-mapping="specific" + data-term="blog-post-{id}"），
 *     评论挂在 acyzwy/blog-comment 仓库的 Discussion 上（首条评论时自动创建）
 *   - 界面语言：data-lang="zh-CN"（官方简体中文）
 *   - 主题跟随网站（亮/暗/跟随系统）：
 *       注入时按 Theme.effective() 设置 data-theme；
 *       之后主题切换时向 iframe 发送 { giscus: { setConfig: { theme } } }（giscus 官方协议）
 *   - 加载动画 + 失败提示：避免网络慢时一片空白，便于排查
 */
(function (global) {
  'use strict';

  // ---- giscus 仓库配置（来自 giscus.app 配置器 / GitHub API）----
  const REPO = 'acyzwy/blog-comment';          // 公开仓库（已安装 giscus App）
  const REPO_ID = 'R_kgDOT7yCGg';
  const CATEGORY = 'General';
  const CATEGORY_ID = 'DIC_kwDOT7yCGs4DDn1m';

  const CLIENT_URL = 'https://giscus.app/client.js';
  const GISCUS_ORIGIN = 'https://giscus.app';
  const TIMEOUT_MS = 15000;                     // 等待 iframe 生成的最长时间

  const Comments = {
    /** 当前已加载评论的文章 id */
    _postId: null,
    /** 加载超时检测定时器 */
    _timer: null,

    /** 站点主题（light/dark）-> giscus 主题 */
    _themeName() {
      return Theme.effective() === 'dark' ? 'dark' : 'light';
    },

    /** 在文章详情页加载评论区（官方 script 元素方式） */
    load(postId) {
      const container = document.getElementById('commentsContainer');
      if (!container) return;

      // 同一篇且评论已正常加载 -> 复用，不重复注入；
      // 首次进入 / 切换文章 / 上次加载失败(显示过提示) -> 重新注入
      const showingFallback = !!container.querySelector('.comments-fallback');
      if (this._postId === postId && !showingFallback) return;

      this._clearTimer();
      container.innerHTML = '';               // 切换文章时移除旧 iframe
      this._postId = postId;

      // 加载动画：等待 giscus iframe 就绪（网络慢时避免一片空白）
      const loading = document.createElement('div');
      loading.className = 'comments-loading';
      loading.innerHTML =
        '<div class="spinner" aria-hidden="true"></div>' +
        '<p class="comments-loading-text">评论加载中…</p>';
      container.appendChild(loading);

      const script = document.createElement('script');
      script.src = CLIENT_URL;
      script.setAttribute('data-repo', REPO);
      script.setAttribute('data-repo-id', REPO_ID);
      script.setAttribute('data-category', CATEGORY);
      script.setAttribute('data-category-id', CATEGORY_ID);
      script.setAttribute('data-mapping', 'specific');
      script.setAttribute('data-term', 'blog-post-' + postId);
      script.setAttribute('data-strict', '0');
      script.setAttribute('data-reactions-enabled', '1');
      script.setAttribute('data-emit-metadata', '0');
      script.setAttribute('data-input-position', 'bottom');
      script.setAttribute('data-theme', this._themeName());
      script.setAttribute('data-lang', 'zh-CN');
      script.setAttribute('data-loading', 'lazy');
      script.setAttribute('crossorigin', 'anonymous');
      script.async = true;
      script.onerror = () =>
        this._showFallback('评论脚本加载失败：请确认网络可访问 giscus.app，然后刷新重试。');
      container.appendChild(script);

      this._watch(container);
    },

    /** 轮询等待 giscus iframe 生成；超时则给出提示 */
    _watch(container) {
      let waited = 0;
      this._timer = setInterval(() => {
        waited += 1000;
        const frame = container.querySelector('iframe.giscus-frame');
        if (frame) {
          this._clearTimer();
          // 评论已就绪：去掉加载动画与可能存在的失败提示
          const loading = container.querySelector('.comments-loading');
          if (loading) loading.remove();
          const fb = container.querySelector('.comments-fallback');
          if (fb) fb.remove();
          return;
        }
        if (waited >= TIMEOUT_MS) {
          this._clearTimer();
          this._showFallback('评论组件加载失败：请确认网络可访问 giscus.app / GitHub，或稍后重试。');
        }
      }, 1000);
    },

    _clearTimer() {
      if (this._timer) { clearInterval(this._timer); this._timer = null; }
    },

    /** 在评论区显示提示（仅当 iframe 尚未加载时） */
    _showFallback(msg) {
      const container = document.getElementById('commentsContainer');
      if (!container) return;
      if (container.querySelector('iframe.giscus-frame')) return;
      if (container.querySelector('.comments-fallback')) return;
      const loading = container.querySelector('.comments-loading');
      if (loading) loading.remove();          // 先去掉加载动画
      const p = document.createElement('p');
      p.className = 'comments-fallback';
      p.textContent = msg;
      container.appendChild(p);
    },

    /** 站点主题切换后，同步 giscus 主题 */
    setTheme() {
      const frame = document.querySelector('iframe.giscus-frame');
      if (!frame || !frame.contentWindow) return;
      frame.contentWindow.postMessage(
        { giscus: { setConfig: { theme: this._themeName() } } },
        GISCUS_ORIGIN
      );
    }
  };

  // 站点主题每次变化（Theme.apply()）时同步评论区
  Theme.onChange = function () { Comments.setTheme(); };

  global.Comments = Comments;
})(window);
