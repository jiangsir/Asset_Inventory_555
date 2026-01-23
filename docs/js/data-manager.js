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
        resolve();
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

    const request = store.put(asset);

    request.onerror = () => {
      console.error('添加最近查詢失敗:', request.error);
    };

    request.onsuccess = () => {
      console.log('已添加到最近查詢:', asset.code);
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
        const results = request.result
          .sort((a, b) => new Date(b.queryTime) - new Date(a.queryTime))
          .slice(0, limit);

        resolve(results);
      };
    });
  },

  /**
   * 更新最近查詢列表 UI
   */
  updateRecentList: async function() {
    const assets = await this.getRecentAssets(6);
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
