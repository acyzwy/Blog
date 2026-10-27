/**
 * theme.js - 主题（亮/暗/跟随系统）
 * 依赖：无
 * 说明：
 *   - 默认跟随系统 prefers-color-scheme
 *   - 导航栏主题按钮三态循环：亮 → 暗 → 跟随系统 → 亮
 *   - 选择保存在 localStorage（key: yzwy-theme）
 *   - data-theme 控制实际配色；data-theme-mode 控制导航栏图标
 *   - 同步切换代码高亮（highlight.js）主题样式表
 */
(function (global) {
  'use strict';

  const THEME_KEY = 'yzwy-theme'; // 可选值：light / dark / system
  const MODE_CYCLE = ['light', 'dark', 'system']; // 三态循环顺序

  const Theme = {
    mode: 'system', // 用户选择模式
    onChange: null, // 主题变化回调 function(effective, mode)，供评论区等外部组件同步

    /** 初始化：读取偏好并应用 */
    init() {
      this.mode = localStorage.getItem(THEME_KEY) || 'system';
      this.apply();

      // 系统外观变化时，若处于“跟随系统”模式则即时刷新
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => { if (this.mode === 'system') this.apply(); };
      if (typeof mq.addEventListener === 'function') mq.addEventListener('change', handler);
      else if (typeof mq.addListener === 'function') mq.addListener(handler);
    },

    /** 当前系统是否为暗色 */
    isSystemDark() {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    },

    /** 最终生效主题：light / dark */
    effective() {
      if (this.mode === 'system') return this.isSystemDark() ? 'dark' : 'light';
      return this.mode;
    },

    /** 应用主题 */
    apply() {
      const eff = this.effective();

      // 写入 data-theme（实际配色）与 data-theme-mode（图标显示）
      document.documentElement.setAttribute('data-theme', eff);
      document.documentElement.setAttribute('data-theme-mode', this.mode);

      // 切换 highlight.js 主题
      const lightCss = document.getElementById('hljs-theme-light');
      const darkCss = document.getElementById('hljs-theme-dark');
      if (lightCss) lightCss.disabled = (eff === 'dark');
      if (darkCss) darkCss.disabled = (eff !== 'dark');

      const btn = document.getElementById('themeBtn');
      if (btn) {
        const label = this._btnLabel();
        btn.setAttribute('aria-label', label);
        btn.title = label; // 悬停提示
      }

      // 通知外部组件（如 giscus 评论区）主题已变化
      if (typeof this.onChange === 'function') this.onChange(eff, this.mode);
    },

    /** 三态循环后的下一个模式：亮 -> 暗 -> 跟随系统 -> 亮 */
    _nextMode() {
      return MODE_CYCLE[(MODE_CYCLE.indexOf(this.mode) + 1) % MODE_CYCLE.length];
    },

    /** 按钮提示文案（描述“点击后将切到哪种模式”） */
    _btnLabel() {
      const next = this._nextMode();
      return {
        light: '切换到亮色模式',
        dark: '切换到暗色模式',
        system: '切换为跟随系统'
      }[next];
    },

    /** 手动切换：三态循环（亮 <-> 暗 <-> 跟随系统） */
    toggle() {
      this.mode = this._nextMode();
      if (this.mode === 'system') {
        localStorage.removeItem(THEME_KEY);
      } else {
        localStorage.setItem(THEME_KEY, this.mode);
      }
      this.apply();
    },

    /** 恢复跟随系统 */
    reset() {
      this.mode = 'system';
      localStorage.removeItem(THEME_KEY);
      this.apply();
    }
  };

  global.Theme = Theme;
})(window);