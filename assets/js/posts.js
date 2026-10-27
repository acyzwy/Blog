/**
 * posts.js - 文章数据加载与渲染
 * 依赖：utils.js
 * 说明：
 *   - 首页读取 blogs/index.json 渲染列表（摘要来自 PHP 自动生成）
 *   - 详情页通过 blogs/post_{id}.json 加载完整内容
 *   - 文章数超过 PAGE_THRESHOLD 时启用前端分页，否则全量渲染
 */
(function (global) {
  'use strict';

  const Posts = {
    INDEX_URL: 'blogs/index.json',
    POST_URL: (id) => `blogs/post_${id}.json`,
    POSTS_PER_PAGE: 6,   // 启用分页时每页文章数
    PAGE_THRESHOLD: 6,  // 文章数超过该值启用前端分页

    indexData: null,     // 缓存的 index.json 原始数据
    posts: [],           // 按日期倒序排列的元信息数组
    currentPage: 1,

    _listContainer: null,
    _paginationContainer: null,

    /** 注入渲染容器引用 */
    setListContainer(el) { this._listContainer = el; },
    setPaginationContainer(el) { this._paginationContainer = el; },

    /**
     * 加载文章索引（带缓存）
     * @param {boolean} force 是否强制刷新缓存
     */
    async loadIndex(force = false) {
      if (this.indexData && !force) return this.indexData;
      const res = await fetch(this.INDEX_URL, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data || !Array.isArray(data.posts)) throw new Error('index.json 结构不正确');
      this.indexData = data;
      // 按文章id倒序
      this.posts = data.posts.slice().sort((a, b) => b.id - a.id);
      return data;
    },

    /**
     * 加载单篇文章完整数据
     * @param {number} id 文章 ID
     */
    async getPost(id) {
      const res = await fetch(this.POST_URL(id), { cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    },

    /** 渲染卡片列表 + 分页 */
    refresh(page = this.currentPage) {
      if (this._listContainer) this.renderList(this._listContainer, page);
      if (this._paginationContainer) this.renderPagination(this._paginationContainer);
    },

    /**
     * 渲染文章卡片列表
     * @param {HTMLElement} container
     * @param {number} page 页码（从 1 开始）
     */
renderList(container, page = 1) {
  const posts = this.posts;
  if (!posts.length) {
    container.innerHTML = '<p class="empty">暂无文章</p>';
    return;
  }

  const total = posts.length;
  const enablePagination = total > this.PAGE_THRESHOLD;
  const perPage = this.POSTS_PER_PAGE;
  const totalPages = enablePagination ? Math.ceil(total / perPage) : 1;
  page = Math.min(Math.max(1, page), totalPages);
  this.currentPage = page;

  const list = enablePagination
    ? posts.slice((page - 1) * perPage, page * perPage)
    : posts;

  // 生成卡片 HTML（包含图片占位）
  const html = list.map((p) => {
    const title = Utils.escapeHtml(p.title || '无标题');
    const date = Utils.escapeHtml(Utils.formatDate(p.date));
    const summary = Utils.escapeHtml(p.summary || '');
    return `
      <a class="post-card" href="#/post/${encodeURIComponent(p.id)}" data-id="${p.id}">
        <div class="post-card-image">
          <div class="ripple-placeholder"></div>
          <img class="post-card-img" src="" alt="${title}" loading="lazy">
          <time class="post-card-date-tag">${date}</time>
          <h3 class="post-card-title-tag">${title}</h3>
        </div>
        <div class="post-card-body">
          <p class="post-card-summary">${summary}</p>
        </div>
      </a>`;
  }).join('');

  container.innerHTML = html;

  // 异步加载图片
  this._loadImages(container);
},

async _loadImages(container) {
  const cards = container.querySelectorAll('.post-card');
  for (const card of cards) {
    const id = card.dataset.id;
    const img = card.querySelector('.post-card-img');
    const placeholder = card.querySelector('.ripple-placeholder');

    const url = await this._getCover(id);
    if (url) {
      const tempImg = new Image();
      tempImg.onload = () => {
        img.src = url;
        img.style.display = 'block';
        placeholder.style.display = 'none';
      };
      tempImg.onerror = () => {
        placeholder.style.display = 'none';
        img.style.display = 'none';
        // 删除失效缓存
        delete this._coverCache[id];
        this._saveCache();
      };
      tempImg.src = url;
    } else {
      placeholder.style.display = 'none';
    }
  }
},

// 在 Posts 对象中添加
_coverCache: null,  // 内存缓存 { '1': 'https://...', '2': 'https://...' }

// 加载缓存（从 sessionStorage）
_loadCache() {
  try {
    const cached = sessionStorage.getItem('post-covers');
    this._coverCache = cached ? JSON.parse(cached) : {};
  } catch (e) {
    this._coverCache = {};
  }
},

// 保存缓存到 sessionStorage
_saveCache() {
  try {
    sessionStorage.setItem('post-covers', JSON.stringify(this._coverCache));
  } catch (e) {
    // 存储空间不足时忽略
  }
},

// 获取单张图片（带缓存）
async _getCover(postId) {
  this._loadCache();  // 确保缓存已加载
  
  // 如果缓存中有，直接返回
  if (this._coverCache[postId]) {
    return this._coverCache[postId];
  }
  
  // 否则请求API
  try {
    const res = await fetch('https://api.yppp.net/pc.php?return=json', { cache: 'no-cache' });
    const data = await res.json();
    if (data.code === '200' && data.acgurl) {
      this._coverCache[postId] = data.acgurl;
      this._saveCache();
      return data.acgurl;
    }
  } catch (e) {
    // 失败返回 null
  }
  return null;
},

/**
 * 渲染分页控件（点击后刷新列表与分页）
 */
renderPagination(container) {
  const total = this.posts.length;
  if (total <= this.PAGE_THRESHOLD) { container.innerHTML = ''; return; }

  const totalPages = Math.ceil(total / this.POSTS_PER_PAGE);
  const cur = this.currentPage;

  let html = '';

  // 第一页时不显示“上一页”按钮（向左箭头）
  if (cur > 1) {
    html += `<button type="button" class="page-prev" data-page="${cur - 1}" aria-label="上一页">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
           stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M19 12H5M12 19l-7-7 7-7"/>
      </svg>
    </button>`;
  }

  // 页码按钮：当前页前后各 2 个，共 5 个；中间页码多时用省略号连接首尾
  const start = Math.max(1, Math.min(cur - 2, totalPages - 4));
  const end = Math.min(totalPages, start + 4);
  if (start > 1) {
    html += `<button type="button" data-page="1">1</button>`;
    if (start > 2) html += '<span class="page-dots">…</span>';
  }
  for (let i = start; i <= end; i++) {
    html += `<button type="button" data-page="${i}" class="${i === cur ? 'active' : ''}">${i}</button>`;
  }
  if (end < totalPages) {
    if (end < totalPages - 1) html += '<span class="page-dots">…</span>';
    html += `<button type="button" data-page="${totalPages}">${totalPages}</button>`;
  }

  // 最后一页时不显示“下一页”按钮（向右箭头）
  if (cur < totalPages) {
    html += `<button type="button" class="page-next" data-page="${cur + 1}" aria-label="下一页">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
           stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M5 12h14M12 5l7 7-7 7"/>
      </svg>
    </button>`;
  }

  container.innerHTML = html;

  container.querySelectorAll('button[data-page]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const page = parseInt(btn.dataset.page, 10);
      this.refresh(page);
      // 滚动到文章列表位置
      this._scrollToPostList();
    });
  });
},

/**
 * 滚动到文章列表位置
 */
_scrollToPostList() {
  // 延迟执行以确保 DOM 已更新
  setTimeout(() => {
    const target = document.getElementById('postList');
    if (target) {
      const top = target.getBoundingClientRect().top + window.scrollY - 30;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    }
  }, 50);
},

    /**
     * 搜索文章（按标题 / 摘要，不区分大小写）
     * @param {string} keyword
     */
    search(keyword) {
      const kw = String(keyword || '').trim().toLowerCase();
      if (!kw) return [];
      return this.posts.filter((p) => {
        const title = (p.title || '').toLowerCase();
        const summary = (p.summary || '').toLowerCase();
        return title.includes(kw) || summary.includes(kw);
      });
    }
  };

  global.Posts = Posts;
})(window);