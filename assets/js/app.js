/**
 * app.js - 应用入口与路由渲染调度
 * 依赖：utils / theme / posts / ui / router
 */
(function (global) {
  'use strict';

  const App = {
    /** sessionStorage 键：保存离开首页时的分页页码 + 滚动位置 */
    HOME_STATE_KEY: 'yzwy-home-state',

    _lastPage: null, // 上一个路由页面，用于判断是否“离开首页”

    /** 入口 */
    async init() {
      Theme.init();          // 主题
      UI.init();             // 界面交互
      Router.onChange = (route) => this.handleRoute(route);
      Router.init();         // 路由（首次进入即触发一次 onChange）

      this.loadSidebarCount(); // 侧边栏文章数
      this.loadHitokoto();     // 首页一言
    },

    /* ---------------- 首页位置记忆 ---------------- */
    /** 离开首页前保存：当前分页页码 + 滚动位置 */
    saveHomeState() {
      try {
        sessionStorage.setItem(this.HOME_STATE_KEY, JSON.stringify({
          page: Posts.currentPage || 1,
          scrollY: window.scrollY || 0
        }));
      } catch (e) { /* 存储不可用时忽略 */ }
    },

    /** 读取保存的首页位置；无记录返回 null */
    loadHomeState() {
      try {
        const s = sessionStorage.getItem(this.HOME_STATE_KEY);
        return s ? JSON.parse(s) : null;
      } catch (e) {
        return null;
      }
    },

    /* ---------------- 路由处理 ---------------- */
    async handleRoute(route) {
      const { page, id } = route;
      const prev = this._lastPage;
      this._lastPage = page;

      // 标记是否处于首页（Hero 为深色背景图，透明导航栏需要白色文字/图标）
      document.body.classList.toggle('on-hero', page === 'home');

      // 切换路由时收起浮层
      UI.closeSearch();
      UI.closeSidebar();

      // 离开首页前往其它页面时，记录首页位置（分页 + 滚动），供返回时恢复
      if (prev === 'home' && page !== 'home') {
        this.saveHomeState();
      }

      if (page === 'post' && id != null) {
        await this.renderPost(id);
      } else if (page === 'about') {
        this.renderAbout();
      } else {
        await this.renderHome();
      }
    },

    /* ---------------- 首页 ---------------- */
    async renderHome() {
      UI.showLoading();
      try {
        const data = await Posts.loadIndex();
        Posts.setListContainer(Utils.$('#postListContainer'));
        Posts.setPaginationContainer(Utils.$('#pagination'));

        // 恢复进入文章前的分页页码
        const homeState = this.loadHomeState();
        const page = (homeState && homeState.page) || 1;
        Posts.refresh(page);

        this.updateSidebarCount(data);
        UI.showPage('homePage');
        document.title = '宇宙无垠 | 首页';
        this._activateNav('home');

        // 恢复进入文章前的滚动位置；无记录则回到顶部
        if (homeState && homeState.scrollY != null) {
          window.scrollTo(0, homeState.scrollY);
          UI.syncNavbar(homeState.scrollY); // 同步导航栏状态，避免被误判为“下滑”而隐藏
        } else {
          window.scrollTo(0, 0);
          UI.syncNavbar(0);
        }
      } catch (err) {
        UI.toast('文章列表加载失败：' + err.message, 'error');
        document.title = '宇宙无垠 | 首页';
        window.scrollTo(0, 0);
      } finally {
        UI.hideLoading();
      }
    },

    /* ---------------- 文章详情 ---------------- */
    async renderPost(id) {
      UI.showLoading();
      try {
        const post = await Posts.getPost(id);

        Utils.$('#postDetailTitle').textContent = post.title || '无标题';
        Utils.$('#postDetailMeta').innerHTML =
          `<time>${Utils.escapeHtml(Utils.formatDate(post.date))}</time>`;

        const contentEl = Utils.$('#postDetailContent');
        const raw = post.content || '';
        // 富文本 HTML 直接渲染；纯文本（如 Markdown 原文）则转义渲染
        const looksLikeHtml = /<[a-z][\s\S]*>/i.test(raw);
        contentEl.innerHTML = looksLikeHtml ? raw : Utils.escapeHtml(raw);

        // 代码块高亮（highlight.js）
        if (window.hljs) {
          contentEl.querySelectorAll('pre code').forEach((block) => {
            hljs.highlightElement(block);
          });
        }

        // 正文图片懒加载
        contentEl.querySelectorAll('img').forEach((img) => { img.loading = 'lazy'; });

        UI.showPage('postPage');
        // 懒加载评论区（giscus，主题跟随站点设置）
        if (window.Comments) Comments.load(id);
        document.title = `${post.title} | 宇宙无垠`;
        window.scrollTo(0, 0);
      } catch (err) {
        UI.toast('文章加载失败：' + err.message, 'error');
        // 失败回退到首页（此时 renderHome 会恢复到进入文章前的位置）
        history.replaceState(null, '', '#/home');
        await this.renderHome();
      } finally {
        UI.hideLoading();
      }
    },

    /* ---------------- 关于 ---------------- */
    renderAbout() {
      UI.showPage('aboutPage');
      document.title = '关于 | 宇宙无垠';
      this._activateNav('about');
      window.scrollTo(0, 0);
    },

    /* ---------------- 侧边栏 ---------------- */
    updateSidebarCount(data) {
      const count = (data && Array.isArray(data.posts)) ? data.posts.length : 0;
      Utils.$('#sidebarPostCount').textContent = count;
    },
    async loadSidebarCount() {
      try {
        const data = await Posts.loadIndex();
        this.updateSidebarCount(data);
      } catch (e) { /* 首页加载时会再处理 */ }
    },

    /** 高亮侧边栏当前导航项 */
    _activateNav(page) {
      Utils.$$('.sidebar-link').forEach((a) => {
        const active = (page === 'about' && a.getAttribute('href') === '#/about') ||
                       (page !== 'about' && a.getAttribute('href') === '#/home');
        a.classList.toggle('active', active);
      });
    },

    /* ---------------- 一言 ---------------- */
    loadHitokoto() {
      const el = Utils.$('#hitokoto');
      const fallback = '宇宙无垠，探索无限。';
      fetch('https://v1.hitokoto.cn/?c=i&encode=json', { cache: 'no-cache' })
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error('HTTP ' + res.status))))
        .then((data) => { el.textContent = data.hitokoto || fallback; })
        .catch(() => { el.textContent = fallback; });
    }
  };

  // 页面结构解析完成后启动应用
  document.addEventListener('DOMContentLoaded', () => App.init());
})(window);