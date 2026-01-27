/**
 * 財產盤點系統 555 - 數據管理模塊
 * 處理本地存儲、快取和數據同步
 */

const dataManager = {
  
  // IndexedDB 數據庫配置
  DB_NAME: 'AssetInventoryDB',
  DB_VERSION: 1,
  STORES: {
    assets: 'assets',
    recent: 'recent',
    cache: 'cache'
  },

  db: null,

  /**
   * 初始化 IndexedDB
   */
  init: function() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => {
        console.error('IndexedDB 打開失敗:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('IndexedDB 初始化成功');
        // 若 IndexedDB 尚無 recent 記錄但 localStorage 有備份，嘗試回補
        this._reconcileRecentBackup().catch(err => console.debug('reconcileRecentBackup error', err)).finally(() => resolve());
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // 創建財產存儲
        if (!db.objectStoreNames.contains(this.STORES.assets)) {
          const assetStore = db.createObjectStore(this.STORES.assets, { keyPath: 'code' });
          assetStore.createIndex('editTime', 'editTime', { unique: false });
        }

        // 創建最近查詢存儲
        if (!db.objectStoreNames.contains(this.STORES.recent)) {
          db.createObjectStore(this.STORES.recent, { keyPath: 'code' });
        }

        // 創建快取存儲
        if (!db.objectStoreNames.contains(this.STORES.cache)) {
          db.createObjectStore(this.STORES.cache, { keyPath: 'id' });
        }
      };
    });
  },

  /**
   * 添加到最近查詢
   */
  addRecentAsset: function(asset) {
    const txn = this.db.transaction([this.STORES.recent], 'readwrite');
    const store = txn.objectStore(this.STORES.recent);

    // 添加查詢時間戳
    asset.queryTime = new Date().toISOString();
    // 立刻做 localStorage 備份（避免頁面快速刷新時遺失）
    try { this._saveRecentBackup(asset); } catch (e) { /* ignore */ }

    const request = store.put(asset);

    request.onerror = () => {
      console.error('添加最近查詢失敗:', request.error);
    };

    request.onsuccess = () => {
      console.log('已添加到最近查詢:', asset.code);
      try { this._saveRecentBackup(asset); } catch (e) { console.debug('saveRecentBackup failed', e); }
      this.updateRecentList();
    };
  },

  /**
   * 獲取最近查詢列表
   */
  getRecentAssets: function(limit = 10) {
    return new Promise((resolve, reject) => {
      const txn = this.db.transaction([this.STORES.recent], 'readonly');
      const store = txn.objectStore(this.STORES.recent);
      const request = store.getAll();

      request.onerror = () => {
        reject(request.error);
      };

      request.onsuccess = () => {
        // 按查詢時間排序並限制數量
        const dbResults = request.result
          .sort((a, b) => new Date(b.queryTime) - new Date(a.queryTime));

        if (dbResults.length > 0) {
          resolve(dbResults.slice(0, limit));
          return;
        }

        // DB 無資料 → 嘗試從 localStorage 的備份回退
        try {
          const backup = this._loadRecentFromBackup() || [];
          resolve(backup.slice(0, limit));
        } catch (e) {
          resolve([]);
        }
      };
    });
  },

  /**
   * 更新最近查詢列表 UI
   */
  updateRecentList: async function() {
    const assets = await this.getRecentAssets(6);
    const container = document.getElementById('recentItemsContainer');

    // If there are no assets, do not blindly overwrite an inline backup render.
    // Only show the empty message if the container is currently empty.
    if (!assets || assets.length === 0) {
      if (container && (!container.children || container.children.length === 0)) {
        container.innerHTML = '<p class="text-muted">暫無最近查詢</p>';
      }
      return;
    }

    // Prefer using the UI module's rendering (keeps templates consistent).
    if (window.ui && typeof ui.displayRecentAssets === 'function') {
      try {
        ui.displayRecentAssets(assets);
        return;
      } catch (e) {
        console.debug('[dataManager] ui.displayRecentAssets failed', e);
      }
    }

    // Fallback: render with model/location (preserve user's requested fields)
    if (container) {
      container.innerHTML = assets
        .map(asset => `
          <div class="item-card" data-code="${asset.code}" onclick="(window.app&&app.queryAsset)?app.queryAsset('${asset.code}'):null">
            <div class="item-card-code">${asset.code}</div>
            <div class="item-card-name">${(asset.model || asset.name) || ''}</div>
            <div class="item-card-unit">${(asset.location || asset.unit) || ''}</div>
          </div>
        `)
        .join('');
    }
  },

  /**
   * 本地備份：把最近查詢用一個輕量快照寫入 localStorage（同步、可靠）
   * 備份格式：[{ code, model, name, location, unit, sheetName, queryTime }, ...]
   */
  _saveRecentBackup: function(asset, maxItems = 20) {
    try {
      const key = 'recent_backup_v1';
      const raw = localStorage.getItem(key);
      let arr = raw ? JSON.parse(raw) : [];
      // 移除同 code 的舊項
      arr = arr.filter(a => String(a.code) !== String(asset.code));
      arr.unshift({
        code: asset.code,
        model: asset.model || asset.name || '',
        name: asset.name || '',
        location: asset.location || asset.unit || '',
        unit: asset.unit || '',
        sheetName: asset.sheetName || '',
        queryTime: asset.queryTime || new Date().toISOString()
      });
      arr = arr.slice(0, maxItems);
      localStorage.setItem(key, JSON.stringify(arr));
    } catch (e) {
      console.debug('[dataManager] saveRecentBackup failed', e);
    }
  },

  _loadRecentFromBackup: function() {
    try {
      const key = 'recent_backup_v1';
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch (e) {
      console.debug('[dataManager] loadRecentFromBackup failed', e);
      return [];
    }
  },

  _reconcileRecentBackup: async function() {
    // 若 recent store 為空且 localStorage 有備份，將備份回寫到 IndexedDB
    try {
      const txn = this.db.transaction([this.STORES.recent], 'readonly');
      const store = txn.objectStore(this.STORES.recent);
      const req = store.getAll();
      const results = await new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });

      if (results && results.length > 0) return; // DB 已有資料，不需回補

      const backup = this._loadRecentFromBackup();
      if (!backup || backup.length === 0) return;

      const wtxn = this.db.transaction([this.STORES.recent], 'readwrite');
      const wstore = wtxn.objectStore(this.STORES.recent);
      backup.forEach(item => {
        try { wstore.put(item); } catch (e) { /* ignore single item errors */ }
      });

      await new Promise((resolve, reject) => {
        wtxn.oncomplete = () => resolve();
        wtxn.onerror = () => reject(wtxn.error);
      });
      console.log('[dataManager] recent store reconciled from localStorage backup');
    } catch (e) {
      console.debug('[dataManager] reconcileRecentBackup error', e);
    }
  },

  /**
   * 快取資產列表
   */
  cacheAssets: function(assets) {
    const txn = this.db.transaction([this.STORES.assets], 'readwrite');
    const store = txn.objectStore(this.STORES.assets);

    assets.forEach(asset => {
      store.put(asset);
    });

    return new Promise((resolve) => {
      txn.oncomplete = () => {
        console.log(`已快取 ${assets.length} 項資產`);
        resolve();
      };
    });
  },

  /**
   * 從快取獲取資產
   */
  getCachedAsset: function(code) {
    return new Promise((resolve, reject) => {
      const txn = this.db.transaction([this.STORES.assets], 'readonly');
      const store = txn.objectStore(this.STORES.assets);
      const request = store.get(code);

      request.onerror = () => {
        reject(request.error);
      };

      request.onsuccess = () => {
        resolve(request.result || null);
      };
    });
  },

  /**
   * 更新快取中的資產
   */
  updateAsset: function(asset) {
    const txn = this.db.transaction([this.STORES.assets], 'readwrite');
    const store = txn.objectStore(this.STORES.assets);
    store.put(asset);
  },

  /**
   * 載入本地快取數據（離線模式）
   */
  loadCachedData: async function() {
    const txn = this.db.transaction([this.STORES.assets], 'readonly');
    const store = txn.objectStore(this.STORES.assets);
    const request = store.getAll();

    return new Promise((resolve) => {
      request.onsuccess = () => {
        console.log(`從快取加載 ${request.result.length} 項資產`);
        resolve(request.result);
      };
    });
  },

  /**
   * 清空本地數據
   */
  clearLocalData: function() {
    if (!confirm('確定要清空所有本地數據嗎？')) {
      return;
    }

    const txn = this.db.transaction(
      [this.STORES.assets, this.STORES.recent, this.STORES.cache],
      'readwrite'
    );

    txn.objectStore(this.STORES.assets).clear();
    txn.objectStore(this.STORES.recent).clear();
    txn.objectStore(this.STORES.cache).clear();

    txn.oncomplete = () => {
      console.log('本地數據已清空');
      ui.showNotification('success', '已清空', '所有本地數據已清除');
    };

    txn.onerror = () => {
      console.error('清空數據失敗:', txn.error);
      ui.showNotification('error', '失敗', '無法清空本地數據');
    };
  },

  /**
   * 導出本地數據為 JSON
   */
  exportLocalData: async function() {
    try {
      const assets = await this.loadCachedData();
      const data = {
        exportDate: new Date().toISOString(),
        assetCount: assets.length,
        assets: assets
      };

      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      // 觸發下載
      const a = document.createElement('a');
      a.href = url;
      a.download = `asset_inventory_${new Date().getTime()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      ui.showNotification('success', '導出成功', '數據已保存');
    } catch (error) {
      console.error('導出錯誤:', error);
      ui.showNotification('error', '導出失敗', error.message);
    }
  },

  /**
   * 保存本地編輯（待同步）
   */
  savePendingEdit: function(assetCode, editData) {
    const txn = this.db.transaction([this.STORES.cache], 'readwrite');
    const store = txn.objectStore(this.STORES.cache);

    const pending = {
      id: `edit_${assetCode}_${Date.now()}`,
      assetCode: assetCode,
      editData: editData,
      timestamp: new Date().toISOString(),
      synced: false
    };

    store.put(pending);

    console.log('已保存待同步編輯:', assetCode);
  },

  /**
   * 獲取待同步的編輯
   */
  getPendingEdits: async function() {
    const txn = this.db.transaction([this.STORES.cache], 'readonly');
    const store = txn.objectStore(this.STORES.cache);
    const request = store.getAll();

    return new Promise((resolve) => {
      request.onsuccess = () => {
        const pendings = request.result.filter(item => !item.synced);
        resolve(pendings);
      };
    });
  },

  /**
   * 標記編輯為已同步
   */
  markAsSynced: function(editId) {
    const txn = this.db.transaction([this.STORES.cache], 'readwrite');
    const store = txn.objectStore(this.STORES.cache);

    store.get(editId).onsuccess = (event) => {
      const item = event.target.result;
      if (item) {
        item.synced = true;
        store.put(item);
      }
    };
  },

  /**
   * 獲取存儲空間使用情況（如果瀏覽器支持）
   */
  getStorageInfo: async function() {
    if (!navigator.storage || !navigator.storage.estimate) {
      return null;
    }

    try {
      const estimate = await navigator.storage.estimate();
      return {
        usage: estimate.usage,
        quota: estimate.quota,
        percent: (estimate.usage / estimate.quota * 100).toFixed(2)
      };
    } catch (error) {
      console.error('獲取存儲信息失敗:', error);
      return null;
    }
  },

  /**
   * 搜索本地快取
   */
  searchLocal: async function(query) {
    const txn = this.db.transaction([this.STORES.assets], 'readonly');
    const store = txn.objectStore(this.STORES.assets);
    const request = store.getAll();

    return new Promise((resolve) => {
      request.onsuccess = () => {
        const query_lower = query.toLowerCase();
        const results = request.result.filter(asset =>
          asset.code.toLowerCase().includes(query_lower) ||
          asset.name.toLowerCase().includes(query_lower)
        );
        resolve(results);
      };
    });
  }
};

// 應用啟動時初始化
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await dataManager.init();
    console.log('數據管理器初始化完成');
  } catch (error) {
    console.error('數據管理器初始化失敗:', error);
  }
});
