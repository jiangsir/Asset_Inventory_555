/**
 * 財產盤點系統 555 - UI 管理模塊
 * 處理用戶界面交互
 */

const ui = {
  
  currentAsset: null,
  notificationQueue: [],

  /**
   * 初始化 UI
   */
  init: function() {
    this.attachEventListeners();
    this.loadRecentAssets();
  },

  /**
   * 綁定 UI 事件
   */
  attachEventListeners: function() {
    // 離線模式
    const offlineModeCheckbox = document.getElementById('offlineMode');
    if (offlineModeCheckbox) {
      offlineModeCheckbox.addEventListener('change', (e) => {
        app.config.offlineMode = e.target.checked;
      });
    }

    // 調試信息
    const debugCheckbox = document.getElementById('showDebugInfo');
    if (debugCheckbox) {
      debugCheckbox.addEventListener('change', (e) => {
        app.config.debug = e.target.checked;
      });
    }

    // 照片上限
    const photoLimitSelect = document.getElementById('photoLimit');
    if (photoLimitSelect) {
      photoLimitSelect.addEventListener('change', (e) => {
        app.config.photoLimit = parseInt(e.target.value) || 10;
      });
    }
  },

  /**
   * 顯示指定屏幕
   */
  showScreen: function(screenId) {
    // 隱藏所有屏幕
    document.querySelectorAll('.screen').forEach(screen => {
      screen.classList.remove('active');
    });

    // 顯示指定屏幕
    const screen = document.getElementById(screenId);
    if (screen) {
      screen.classList.add('active');
    }
  },

  /**
   * 返回掃描界面
   */
  backToScan: function() {
    this.showScreen('scanSection');
    document.getElementById('assetCodeInput').value = '';
    document.getElementById('assetCodeInput').focus();
  },

  /**
   * 顯示財產詳情
   */
  showAssetDetail: function(asset) {
    this.currentAsset = asset;

    // 填充只讀字段
    document.getElementById('detailTitle').textContent = asset.name || '財產詳情';
    document.getElementById('detail-assetCode').textContent = asset.code;
    document.getElementById('detail-assetName').textContent = asset.name;
    document.getElementById('detail-purchaseDate').textContent = this.formatDate(asset.purchaseDate);
    document.getElementById('detail-unit').textContent = asset.unit;
    document.getElementById('detail-model').textContent = asset.model;
    document.getElementById('detail-quantity').textContent = asset.quantity;
    document.getElementById('detail-unitPrice').textContent = this.formatCurrency(asset.unitPrice);
    document.getElementById('detail-totalPrice').textContent = this.formatCurrency(asset.totalPrice);
    document.getElementById('detail-lifespan').textContent = asset.lifespan;

    // 填充可編輯字段
    document.getElementById('edit-location').value = asset.location || '';
    document.getElementById('edit-remark').value = asset.remark || '';
    document.getElementById('edit-scrappable').value = asset.scrappable || '';

    // 填充照片
    this.displayPhotos(asset.photos);

    // 在標題旁顯示工作表名稱（若後端有提供）
    const sheetBadge = document.getElementById('detailSheetName');
    if (sheetBadge) {
      if (asset.sheetName) {
        sheetBadge.textContent = asset.sheetName;
        sheetBadge.title = `工作表：${asset.sheetName}`;
        sheetBadge.setAttribute('aria-hidden', 'false');
        sheetBadge.classList.remove('visually-hidden');

        // 可點擊以複製工作表名稱（提供回饋），同時支援鍵盤操作
        sheetBadge.setAttribute('role', 'button');
        sheetBadge.setAttribute('tabindex', '0');
        sheetBadge.style.cursor = 'pointer';
        const copySheetName = async () => {
          try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
              await navigator.clipboard.writeText(asset.sheetName);
              ui.showNotification('success', '已複製', `工作表名稱已複製：${asset.sheetName}`);
            } else {
              // fallback
              const ta = document.createElement('textarea');
              ta.value = asset.sheetName;
              document.body.appendChild(ta);
              ta.select();
              document.execCommand('copy');
              document.body.removeChild(ta);
              ui.showNotification('success', '已複製', `工作表名稱已複製：${asset.sheetName}`);
            }
          } catch (err) {
            console.warn('copy failed', err);
            ui.showNotification('error', '複製失敗', '無法複製工作表名稱');
          }
        };
        sheetBadge.onclick = copySheetName;
        sheetBadge.onkeydown = (ev) => {
          if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault();
            copySheetName();
          }
        };

      } else {
        sheetBadge.textContent = '';
        sheetBadge.title = '工作表名稱';
        sheetBadge.setAttribute('aria-hidden', 'true');
        sheetBadge.classList.add('visually-hidden');
        sheetBadge.removeAttribute('role');
        sheetBadge.removeAttribute('tabindex');
        sheetBadge.onclick = null;
        sheetBadge.onkeydown = null;
        sheetBadge.style.cursor = '';
      }
    }

    // 顯示詳情屏幕
    this.showScreen('detailSection');
  },

  /**
   * 顯示設置界面
   */
  showSettings: function() {
    // 載入當前設置（API URL 和 Spreadsheet ID 已硬編碼在 config）
    document.getElementById('offlineMode').checked = app.config.offlineMode;
    document.getElementById('showDebugInfo').checked = app.config.debug;
    document.getElementById('photoLimit').value = app.config.photoLimit;

    this.showScreen('settingsSection');
  },

  /**
   * 保存設置
   */
  saveSettings: function() {
    // 從表單讀取應用設置（API URL 和 Spreadsheet ID 不可修改）
    app.config.offlineMode = document.getElementById('offlineMode').checked;
    app.config.debug = document.getElementById('showDebugInfo').checked;
    app.config.photoLimit = parseInt(document.getElementById('photoLimit').value);

    // 保存設置
    app.saveConfig();
    this.showNotification('success', '已保存', '設置已保存');
    setTimeout(() => this.backToScan(), 1500);
  },

  /**
   * 保存資產修改
   */
  saveAsset: async function(e) {
    e.preventDefault();

    if (!this.currentAsset) {
      this.showNotification('error', '錯誤', '沒有選中的財產');
      return;
    }

    const assetData = {
      code: this.currentAsset.code,
      location: document.getElementById('edit-location').value,
      remark: document.getElementById('edit-remark').value,
      scrappable: document.getElementById('edit-scrappable').value,
      photos: this.currentAsset.photos || []
    };

    await app.saveAsset(assetData);
  },

  /**
   * 重置表單
   */
  resetForm: function() {
    if (this.currentAsset) {
      this.showAssetDetail(this.currentAsset);
      this.showNotification('info', '已重置', '表單已恢復為原始值');
    }
  },

  /**
   * 顯示照片
   */
  displayPhotos: function(photos = []) {
    const gallery = document.getElementById('photoGallery');
    gallery.innerHTML = '';

    // 簡單快取，避免重複向後端請求相同縮圖
    this._photoCache = this._photoCache || {};
    // 用於 map 前端顯示索引 -> 實際 photo id(s)
    this._displayPhotoMap = [];

    // 先把傳入的 photos 分群（若縮圖與原圖同時存在，視為一組）
    const groups = [];
    const byBase = new Map();

    const normalizeBase = (p) => {
      if (!p) return null;
      if (p.name) return String(p.name).replace(/_thumb(?=\.[a-z]+$)/i, '').replace(/-thumb(?=\.[a-z]+$)/i, '');
      // fallback: try URL
      if (p.url) return p.url.replace(/_thumb(?=\.[a-z]+($|\?))/i, '').replace(/-thumb(?=\.[a-z]+($|\?))/i, '');
      return p.id || null;
    };

    photos.forEach(p => {
      const base = normalizeBase(p) || (p.id ? `id:${p.id}` : Math.random().toString(36).slice(2,8));
      if (!byBase.has(base)) byBase.set(base, []);
      byBase.get(base).push(p);
    });

    // 轉成 group（thumbnail 優先，full 優先為 viewer target）
    for (const [base, items] of byBase.entries()) {
      const group = { base, thumb: null, full: null, others: [] };
      for (const it of items) {
        if (it.isThumbnail || (it.name && /_thumb/i.test(it.name))) {
          group.thumb = group.thumb || it;
        } else if (!group.full) {
          group.full = it;
        } else {
          group.others.push(it);
        }
      }
      // 若沒有 thumbnail，但只有 full，將 full 當作 thumb（點擊時也會嘗試載入更大圖）
      if (!group.thumb && group.full) group.thumb = group.full;
      // 若只有其他（沒有 name/id），把第一個當 thumb
      if (!group.thumb && group.others.length) group.thumb = group.others.shift();
      groups.push(group);
    }

    // 實際渲染：只顯示每組的一張縮圖（若存在）
    const limit = app.config.photoLimit || 0;
    const toShow = limit > 0 ? groups.slice(0, limit) : groups;

    toShow.forEach((g, idx) => {
      const div = document.createElement('div');
      div.className = 'photo-item';

      const img = document.createElement('img');
      img.alt = `照片 ${idx + 1}`;
      img.className = 'photo-thumb';
      img.src = '';
      img.dataset.displayIndex = idx;
      img.setAttribute('role', 'button');

      const removeBtn = document.createElement('button');
      removeBtn.className = 'photo-remove';
      removeBtn.textContent = '✕';
      removeBtn.onclick = () => ui.removePhoto(idx);

      div.appendChild(img);
      div.appendChild(removeBtn);
      gallery.appendChild(div);

      // 記錄 mapping（thumbId, fullId）以便刪除/檢視使用
      const mapEntry = { thumbId: g.thumb && g.thumb.id, fullId: g.full && g.full.id, thumbUrl: g.thumb && g.thumb.url, fullUrl: g.full && g.full.url };
      this._displayPhotoMap.push(mapEntry);

      // 若存在原圖（fullId 或 fullUrl 且與 thumb 不相同），在縮圖上顯示小徽章
      if ((mapEntry.fullId && String(mapEntry.fullId) !== String(mapEntry.thumbId)) || (mapEntry.fullUrl && mapEntry.fullUrl !== mapEntry.thumbUrl)) {
        const badge = document.createElement('div');
        badge.className = 'photo-badge';
        badge.title = '有原圖，點擊以檢視完整影像';
        badge.setAttribute('role', 'button');
        badge.setAttribute('tabindex', '0');
        badge.innerHTML = `<span class="badge-dot" aria-hidden="true"></span><span class="badge-text">原圖</span>`;
        badge.onclick = (ev) => {
          ev.stopPropagation();
          ui.viewPhotoFull(mapEntry, false);
        };
        badge.onkeydown = (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); ui.viewPhotoFull(mapEntry, false); } };
        // append badge to the photo-item container (left-top)
        div.appendChild(badge);
      }

      // 取得縮圖 src（優先使用 thumbnail 檔案 id 的 inline dataUrl）
      const setThumbSrc = (src, servedAsThumbnail) => {
        img.src = src;
        img.classList.remove('loading');
        img.onclick = () => ui.viewPhotoFull(mapEntry, servedAsThumbnail);
      };

      // 如果 thumb 有 id，透過 proxy 取得 dataUrl（或 uc fallback）
      if (g.thumb && g.thumb.id) {
        const cacheKey = `id:${g.thumb.id}`;
        if (this._photoCache[cacheKey]) {
          setThumbSrc(this._photoCache[cacheKey], true);
        } else {
          img.classList.add('loading');
          sheetApi.getPhoto({ fileId: g.thumb.id }).then(res => {
            if (res && res.success && res.dataUrl) {
              this._photoCache[cacheKey] = res.dataUrl;
              setThumbSrc(res.dataUrl, true);
              return;
            }
            // fallback to drive uc if inline not available
            if (res && res.error === 'file_too_large_for_inline_preview') {
              const uc = 'https://drive.google.com/uc?export=view&id=' + g.thumb.id;
              this._photoCache[cacheKey] = uc;
              setThumbSrc(uc, false);
              return;
            }
            img.classList.add('broken');
          }).catch(err => { console.warn('servePhoto error', err); img.classList.add('broken'); });
        }

      } else if (g.thumb && g.thumb.url) {
        // 直接用可嵌入的 URL
        setThumbSrc(g.thumb.url, false);
      } else {
        img.classList.add('broken');
      }
    });

    // 更新照片計數
    const limitText = limit === 0 ? '無限制' : `最多 ${limit} 張`;
    document.getElementById('photoHint').textContent = `已上傳 ${groups.length} 張 / ${limitText}`;
  },

  /**
   * 查看照片
   */
  viewPhoto: function(url) {
    const modal = document.getElementById('photoModal');
    const preview = document.getElementById('photoPreview');
    preview.src = url;
    modal.style.display = 'flex';
  },

  /**
   * 在畫廊中點擊縮圖：嘗試載入原圖（若有），否則顯示縮圖
   * mapEntry: { thumbId, fullId, thumbUrl, fullUrl }
   */
  viewPhotoFull: async function(mapEntry = {}, servedAsThumbnail = false) {
    const modal = document.getElementById('photoModal');
    const preview = document.getElementById('photoPreview');

    // 先用 thumbnail 作為 placeholder（若有）
    if (mapEntry.thumbId) {
      const cacheKey = `id:${mapEntry.thumbId}`;
      if (this._photoCache && this._photoCache[cacheKey]) preview.src = this._photoCache[cacheKey];
      else if (mapEntry.thumbUrl) preview.src = mapEntry.thumbUrl;
    } else if (mapEntry.thumbUrl) {
      preview.src = mapEntry.thumbUrl;
    } else {
      preview.src = '';
    }

    modal.style.display = 'flex';

    // 更新 modal 的外部連結（Drive）顯示狀態
    try {
      const externalLink = document.getElementById('photoExternalLink');
      if (externalLink) {
        externalLink.style.display = 'none';
        externalLink.removeAttribute('href');
        externalLink.setAttribute('aria-hidden', 'true');
      }
    } catch (e) { /* ignore */ }

    // 嘗試載入 full image（優先 fileId，再 fullUrl）
    try {
      if (mapEntry.fullId) {
        const res = await sheetApi.getPhoto({ fileId: mapEntry.fullId });
        if (res && res.success && res.dataUrl) {
          preview.src = res.dataUrl;
          return;
        }
        // 若回傳 413 或无法 inline，顯示「在 Drive 開啟」連結並保留縮圖
        if (res && res.error === 'file_too_large_for_inline_preview') {
          const driveUrl = 'https://drive.google.com/uc?export=view&id=' + mapEntry.fullId;
          preview.dataset.fallbackLink = driveUrl;
          try {
            const externalLink = document.getElementById('photoExternalLink');
            if (externalLink) {
              externalLink.href = driveUrl;
              externalLink.style.display = 'inline-block';
              externalLink.setAttribute('aria-hidden', 'false');
            }
          } catch (e) { /* ignore */ }
          return;
        }
      }

      if (mapEntry.fullUrl) {
        // 直接嘗試載入遠端 fullUrl（可能需要授權）
        preview.src = mapEntry.fullUrl;
        try {
          const externalLink = document.getElementById('photoExternalLink');
          if (externalLink) {
            externalLink.href = mapEntry.fullUrl;
            externalLink.style.display = 'inline-block';
            externalLink.setAttribute('aria-hidden', 'false');
          }
        } catch (e) { /* ignore */ }
        return;
      }

    } catch (err) {
      console.warn('viewPhotoFull failed to load full image', err);
    }

    // 最後回退：如果只有縮圖，已經顯示縮圖；若什麼都沒有，顯示破圖標示
    if (!preview.src) {
      preview.classList.add('broken');
    }
  },

  /**
   * 刪除照片（支援以畫廊索引刪除整組）
   */
  removePhoto: async function(displayIndex) {
    // map back to actual photo ids
    const map = (this._displayPhotoMap && this._displayPhotoMap[displayIndex]) || null;
    if (!this.currentAsset || !this.currentAsset.photos || !map) return;

    if (!confirm('確定要刪除這張照片嗎？')) return;

    // Optimistic UI: mute the gallery item
    const gallery = document.getElementById('photoGallery');
    const item = gallery && gallery.children && gallery.children[displayIndex];
    if (item) item.classList.add('muted');

    try {
      // 優先刪除 full image（若存在），否則刪除縮圖
      const targetId = map.fullId || map.thumbId || null;

      if (targetId) {
        const res = await sheetApi.removePhoto(this.currentAsset.code, targetId);
        if (!(res && (res.success || res.warning))) throw new Error((res && res.error) || 'remove failed');

        // 從本地 currentAsset.photos 中移除所有對應的 id（thumb/full）
        this.currentAsset.photos = (this.currentAsset.photos || []).filter(p => String(p.id) !== String(map.fullId) && String(p.id) !== String(map.thumbId));

        // 更新 UI（並同步至後端以確保一致性）
        this.displayPhotos(this.currentAsset.photos);
        ui.showNotification('success', '刪除完成', '照片已從系統移除');
        return;
      }

      // 若沒有 id（只有 URL），直接從本地移除並透過 saveAsset 更新 sheet
      this.currentAsset.photos = (this.currentAsset.photos || []).filter(p => p.url !== map.thumbUrl && p.url !== map.fullUrl);
      await app.saveAsset(this.currentAsset);
      this.displayPhotos(this.currentAsset.photos);
      ui.showNotification('success', '刪除完成', '照片已從記錄移除');

    } catch (err) {
      console.warn('removePhoto failed:', err);
      if (item) item.classList.remove('muted');
      ui.showNotification('error', '刪除失敗', err && err.message ? err.message : String(err));
    }
  },

  /**
   * 載入最近查詢的資產
   */
  loadRecentAssets: async function() {
    try {
      const assets = await dataManager.getRecentAssets(6);
      this.displayRecentAssets(assets);
    } catch (error) {
      console.error('載入最近查詢失敗:', error);
    }
  },

  /**
   * 顯示最近查詢列表
   */
  displayRecentAssets: function(assets) {
    const container = document.getElementById('recentItemsContainer');

    if (assets.length === 0) {
      container.innerHTML = '<p class="text-muted">暫無最近查詢</p>';
      return;
    }

    container.innerHTML = assets
      .map(asset => `
        <div class="item-card" onclick="app.queryAsset('${asset.code}')">
          <div class="item-card-code">${asset.code}</div>
          <div class="item-card-name">${(asset.model || asset.name) || '-'}</div>
          <div class="item-card-unit">${(asset.location || asset.unit) || '-'}</div>
        </div>
      `)
      .join('');
  },

  /**
   * 同步數據
   */
  syncData: function() {
    app.syncData();
  },

  /**
   * 顯示加載指示器
   */
  showLoading: function(message = '加載中...') {
    const indicator = document.getElementById('loadingIndicator');
    document.getElementById('loadingText').textContent = message;
    indicator.style.display = 'flex';
  },

  /**
   * 隱藏加載指示器
   */
  hideLoading: function() {
    document.getElementById('loadingIndicator').style.display = 'none';
  },

  /**
   * 顯示通知消息
   */
  showNotification: function(type, title, message) {
    const container = document.getElementById('notificationContainer');

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;

    const icons = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ'
    };

    notification.innerHTML = `
      <div class="notification-icon">${icons[type]}</div>
      <div class="notification-content">
        <div class="notification-title">${title}</div>
        <div class="notification-message">${message}</div>
      </div>
      <button class="notification-close" onclick="this.parentElement.remove()">✕</button>
    `;

    container.appendChild(notification);

    // 5 秒後自動移除
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 5000);
  },

  /**
   * 上傳進度回饋（會暫時更新右上同步按鈕文字以顯示百分比）
   */
  showUploadProgress: function(percent) {
    try {
      const btn = document.getElementById('syncBtn');
      if (!btn) return;
      btn.dataset.orig = btn.dataset.orig || btn.textContent;
      btn.textContent = `⟳ ${percent}%`;
      btn.setAttribute('aria-busy', 'true');
    } catch (e) { console.debug('showUploadProgress error', e); }
  },

  clearUploadProgress: function() {
    try {
      const btn = document.getElementById('syncBtn');
      if (!btn) return;
      if (btn.dataset.orig) btn.textContent = btn.dataset.orig;
      btn.removeAttribute('aria-busy');
    } catch (e) { console.debug('clearUploadProgress error', e); }
  },

  /**
   * 格式化日期
   */
  formatDate: function(date) {
    if (!date) return '-';
    try {
      return new Date(date).toLocaleDateString('zh-TW');
    } catch {
      return String(date);
    }
  },

  /**
   * 格式化貨幣
   */
  formatCurrency: function(amount) {
    if (!amount) return '-';
    try {
      return new Intl.NumberFormat('zh-TW', {
        style: 'currency',
        currency: 'TWD'
      }).format(amount);
    } catch {
      return String(amount);
    }
  }
};
