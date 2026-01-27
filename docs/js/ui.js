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

    photos.forEach((photo, index) => {
      const div = document.createElement('div');
      div.className = 'photo-item';

      // placeholder img (會被 async 填入 src)
      const img = document.createElement('img');
      img.alt = `照片 ${index + 1}`;
      img.dataset.photoIndex = index;
      img.className = 'photo-thumb';
      img.src = '';
      img.onload = () => { img.classList.remove('loading'); };
      img.onerror = () => { img.classList.add('broken'); img.alt = `照片 ${index + 1}`; };

      const removeBtn = document.createElement('button');
      removeBtn.className = 'photo-remove';
      removeBtn.textContent = '✕';
      removeBtn.onclick = () => ui.removePhoto(index);

      div.appendChild(img);
      div.appendChild(removeBtn);
      gallery.appendChild(div);

      // 決定如何取得可用的 src：
      // - 若 photo.url 是一般可直接嵌入的圖檔（非 private Drive），直接使用
      // - 若 photo.id 存在或 URL 為 Drive 的 webView，使用後端 proxy servePhoto 取得 dataURL
      const isLikelyDirect = photo.url && (/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(photo.url) || /googleusercontent\.com/.test(photo.url));

      if (isLikelyDirect) {
        img.src = photo.url;
        img.onclick = () => ui.viewPhoto(photo.url);
      } else if (photo.id) {
        const cacheKey = `id:${photo.id}`;
        if (this._photoCache[cacheKey]) {
          img.src = this._photoCache[cacheKey];
          img.onclick = () => ui.viewPhoto(this._photoCache[cacheKey]);
        } else {
          img.classList.add('loading');
          // async fetch via proxy
          sheetApi.getPhoto({ fileId: photo.id }).then(res => {
            if (res && res.success && res.dataUrl) {
              this._photoCache[cacheKey] = res.dataUrl;
              img.src = res.dataUrl;
              img.onclick = () => ui.viewPhoto(res.dataUrl);
              return;
            }

            // 若檔案過大無法 inline，嘗試使用通用的 Drive embed URL（若檔案為私有，瀏覽器仍可能無法載入）
            if (res && res.error === 'file_too_large_for_inline_preview') {
              const uc = 'https://drive.google.com/uc?export=view&id=' + photo.id;
              this._photoCache[cacheKey] = uc;
              img.src = uc;
              img.onclick = () => ui.viewPhoto(uc);
              return;
            }

            console.warn('servePhoto failed for', photo.id, res && res.error);
            img.classList.add('broken');
          }).catch(err => {
            console.warn('servePhoto error', err);
            img.classList.add('broken');
          });
        }
      } else if (photo.url && /drive\.google\.com/.test(photo.url)) {
        // Drive webView link without id field — try to extract id then proxy
        const m = (photo.url.match(/[-\w]{25,}/) || [])[0];
        if (m) {
          const cacheKey = `id:${m}`;
          if (this._photoCache[cacheKey]) {
            img.src = this._photoCache[cacheKey];
            img.onclick = () => ui.viewPhoto(this._photoCache[cacheKey]);
          } else {
            img.classList.add('loading');
            sheetApi.getPhoto({ fileId: m }).then(res => {
              if (res && res.success && res.dataUrl) {
                this._photoCache[cacheKey] = res.dataUrl;
                img.src = res.dataUrl;
                img.onclick = () => ui.viewPhoto(res.dataUrl);
              } else {
                img.classList.add('broken');
              }
            }).catch(() => img.classList.add('broken'));
          }
        } else {
          img.classList.add('broken');
        }
      } else if (photo.url) {
        // 最後的嘗試：直接使用 URL（可能會被瀏覽器阻擋或顯示 broken）
        img.src = photo.url;
        img.onclick = () => ui.viewPhoto(photo.url);
      } else {
        img.classList.add('broken');
      }
    });

    // 更新照片計數
    const limit = app.config.photoLimit;
    const limitText = limit === 0 ? '無限制' : `最多 ${limit} 張`;
    document.getElementById('photoHint').textContent = 
      `已上傳 ${photos.length} 張 / ${limitText}`;
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
   * 刪除照片
   */
  removePhoto: async function(index) {
    if (!this.currentAsset || !this.currentAsset.photos || !this.currentAsset.photos[index]) return;

    const photo = this.currentAsset.photos[index];
    if (!confirm('確定要刪除這張照片嗎？')) return;

    // Optimistic UI: disable remove button for this item
    const gallery = document.getElementById('photoGallery');
    const item = gallery && gallery.children && gallery.children[index];
    if (item) item.classList.add('muted');

    try {
      // 若照片有 Drive file id，呼叫後端原子刪除（Drive + sheet）
      if (photo.id) {
        const res = await sheetApi.removePhoto(this.currentAsset.code, photo.id);
        if (res && (res.success || res.warning)) {
          // 移除本地並更新視圖
          this.currentAsset.photos.splice(index, 1);
          this.displayPhotos(this.currentAsset.photos);
          ui.showNotification('success', '刪除完成', '照片已從系統移除');
          return;
        }

        // 失敗：回滾 UI
        throw new Error((res && res.error) || 'remove failed');
      }

      // 若沒有 photo.id（只有 url），只更新 sheet（透過 saveAsset）
      this.currentAsset.photos.splice(index, 1);
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
          <div class="item-card-name">${asset.name}</div>
          <div class="item-card-unit">${asset.unit}</div>
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
