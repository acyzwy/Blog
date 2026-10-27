/**
 * ui.js - 界面交互（导航栏、侧边栏、搜索、滚动、加载、提示）
 * 依赖：utils.js / theme.js / posts.js
 */
(function (global) {
  'use strict';

  const UI = {
    $: (sel) => Utils.$(sel),
    _toastTimer: null,

    // 导航栏滚动阈值（供 _bindNavbarScroll 与 syncNavbar 共用）
    NAVBAR_BG_THRESHOLD: 8,
    NAVBAR_HIDE_THRESHOLD: 80,

    /** 初始化所有交互 */
    init() {
      this._bindNavbar();
      this._bindNavbarScroll();
      this._bindSidebar();
      this._bindSearch();
      this._bindScrollDown();
      this._bindKeyboard();
    },

    /* ---------------- 导航栏 ---------------- */
    _bindNavbar() {
      this.$('#menuBtn').addEventListener('click', () => this.openSidebar());
      this.$('#searchBtn').addEventListener('click', () => this.openSearch());
      this.$('#themeBtn').addEventListener('click', () => Theme.toggle());
    },
    
    /* ---------------- 导航栏：背景显现 + 下滑收起 / 上滑显示 ---------------- */
    _bindNavbarScroll() {
      const navbar = this.$('.navbar');
      if (!navbar) return;

      this._navbarLastY = window.scrollY;
    
      const onScroll = () => {
        const y = window.scrollY;
    
        // 回到页面最顶部：全透明 + 显示
        if (y <= this.NAVBAR_BG_THRESHOLD) {
          navbar.classList.remove('scrolled', 'hidden');
          this._navbarLastY = y;
          return;
        }
    
        // 已离开顶部：恢复毛玻璃背景
        navbar.classList.add('scrolled');
    
        // 下滑 -> 平滑收起隐藏；上滑 -> 显示
        if (y > this._navbarLastY && y > this.NAVBAR_HIDE_THRESHOLD) {
          navbar.classList.add('hidden');
        } else if (y < this._navbarLastY) {
          navbar.classList.remove('hidden');
        }
    
        this._navbarLastY = y;
      };
    
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll(); // 页面刷新时同步当前状态
    },

    /**
     * 程序化恢复滚动位置后调用：让导航栏状态与目标位置同步，
     * 避免一次性跳到下方被误判为“下滑”而隐藏导航栏。
     */
    syncNavbar(y = window.scrollY) {
      const navbar = this.$('.navbar');
      if (!navbar) return;
      this._navbarLastY = y;
      if (y <= this.NAVBAR_BG_THRESHOLD) {
        navbar.classList.remove('scrolled', 'hidden');
      } else {
        navbar.classList.add('scrolled');
        navbar.classList.remove('hidden');
      }
    },

    /* ---------------- 侧边栏 ---------------- */
    openSidebar() {
      this.closeSearch();
      this.$('#sidebar').classList.add('open');
      this.$('#sidebarMask').hidden = false;
      document.body.style.overflow = 'hidden';
    },
    closeSidebar() {
      this.$('#sidebar').classList.remove('open');
      this.$('#sidebarMask').hidden = true;
      document.body.style.overflow = '';
    },
    _bindSidebar() {
      this.$('#sidebarMask').addEventListener('click', () => this.closeSidebar());
      // 点击侧边栏内链接后自动关闭
      this.$('#sidebar').querySelectorAll('a').forEach((a) => {
        a.addEventListener('click', () => this.closeSidebar());
      });
    },

    /* ---------------- 搜索 ---------------- */
    openSearch() {
      this.closeSidebar();
      const overlay = this.$('#searchOverlay');
      overlay.hidden = false;
      document.body.style.overflow = 'hidden';
      const input = this.$('#searchInput');
      input.value = '';
      this.$('#searchResults').innerHTML = '<p class="search-hint">输入关键词开始搜索</p>';
      setTimeout(() => input.focus(), 60);
    },
    closeSearch() {
      this.$('#searchOverlay').hidden = true;
      document.body.style.overflow = '';
    },
    _bindSearch() {
      const input = this.$('#searchInput');
      const results = this.$('#searchResults');

      this.$('#searchClearBtn').addEventListener('click', () => this.closeSearch());

      // 输入防抖后搜索
      const run = Utils.debounce(() => {
        const list = Posts.search(input.value);
        if (!list.length) {
          results.innerHTML = '<p class="search-empty">未找到相关文章</p>';
          return;
        }
        results.innerHTML = list.slice(0, 20).map((p) => `
          <a class="search-item" href="#/post/${encodeURIComponent(p.id)}">
            <div class="search-item-title">${Utils.escapeHtml(p.title)}</div>
            <div class="search-item-date">${Utils.escapeHtml(Utils.formatDate(p.date))}</div>
          </a>`).join('');
      }, 180);

      input.addEventListener('input', run);

      // 点击搜索结果后关闭浮层（hashchange 已由路由处理）
      results.addEventListener('click', (e) => {
        if (e.target.closest('.search-item')) this.closeSearch();
      });
    },

    /* ---------------- 页面切换 ---------------- */
    /** 隐藏所有 .page，仅显示指定 id 的页面 */
    showPage(id) {
      Utils.$$('.page').forEach((el) => { el.hidden = true; });
      const target = document.getElementById(id);
      if (target) target.hidden = false;
    },

    /* ---------------- 滚动到文章列表 ---------------- */
    _bindScrollDown() {
      const btn = this.$('#scrollDownBtn');
      if (btn) {
        btn.addEventListener('click', (e) => { e.preventDefault(); this.scrollToPosts(); });
      }

      // 首页 Hero 顶部向下滚动滚轮时，平滑滑到文章列表
      document.addEventListener('wheel', (e) => {
        const homeVisible = this.$('#homePage') && !this.$('#homePage').hidden;
        if (homeVisible && window.scrollY <= 10 && e.deltaY > 0) {
          e.preventDefault();
          this.scrollToPosts();
        }
      }, { passive: false });
    },
    scrollToPosts() {
      const target = this.$('#postList');
      if (!target) return;
    
      const top = target.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    },

    /* ---------------- 键盘快捷键 ---------------- */
    _bindKeyboard() {
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { this.closeSearch(); this.closeSidebar(); }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
          e.preventDefault();
          this.openSearch();
        }
      });
    },

    /* ---------------- 加载遮罩 ---------------- */
    showLoading() { this.$('#loadingOverlay').hidden = false; },
    hideLoading() { this.$('#loadingOverlay').hidden = true; },

    /* ---------------- 轻提示 ---------------- */
    toast(msg, type = 'info') {
      const el = this.$('#toast');
      el.textContent = msg;
      el.className = 'toast show' +
        (type === 'error' ? ' error' : type === 'success' ? ' success' : '');
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
    }
  };

  global.UI = UI;
})(window);