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

    photos.forEach((photo, index) => {
      const div = document.createElement('div');
      div.className = 'photo-item';
      div.innerHTML = `
        <img src="${photo.url}" alt="照片 ${index + 1}" onclick="ui.viewPhoto('${photo.url}')">
        <button class="photo-remove" onclick="ui.removePhoto(${index})">✕</button>
      `;
      gallery.appendChild(div);
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
  removePhoto: function(index) {
    if (confirm('確定要刪除這張照片嗎？')) {
      this.currentAsset.photos.splice(index, 1);
      this.displayPhotos(this.currentAsset.photos);
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
