/**
 * 財產盤點系統 555 - 主應用邏輯
 * 協調各個模塊的工作流
 */

// ============================================
// 應用初始化
// ============================================

const app = {
  config: {
    gasUrl: 'https://script.google.com/macros/s/AKfycbxWRMdDuVXE-EIAQ_newRtBMvcAHNKxXTWv7zQ4KL5z1vT85zNteOQUPmEj8Yrj1ME5/exec',
    sheetName: '財產列表',
    offlineMode: false,
    photoLimit: 10,
    debug: false
  },

  /**
   * 初始化應用
   */
  init: function() {
    console.log('初始化財產盤點系統 555');

    // 載入設置
    this.loadConfig();

    // 初始化模塊
    dataManager.init();
    ui.init();
    scanner.init();
    camera.init();
    sheetApi.init(this.config.gasUrl);

    // 綁定事件監聽器
    this.bindEventListeners();

    // 顯示掃描界面
    ui.showScreen('scanSection');

    console.log('應用初始化完成');
  },

  /**
   * 載入保存的設置
   */
  loadConfig: function() {
    const saved = localStorage.getItem('appConfig');
    if (saved) {
      const loaded = JSON.parse(saved);
      Object.assign(this.config, loaded);
    }

    // 如果未配置 GAS URL，提示用戶
    if (!this.config.gasUrl) {
      console.warn('未配置 GAS URL，請在設置中配置');
      ui.showNotification('warning', '未配置', '請在設置中填寫 Spreadsheet 和 API 地址');
    }
  },

  /**
   * 保存設置
   */
  saveConfig: function() {
    localStorage.setItem('appConfig', JSON.stringify(this.config));
    console.log('設置已保存');
  },

  /**
   * 綁定全局事件監聽器
   */
  bindEventListeners: function() {
    // 掃描輸入框
    const codeInput = document.getElementById('assetCodeInput');
    codeInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const code = codeInput.value.trim();
        if (code) {
          this.queryAsset(code);
        }
      }
    });

    // 搜索建議
    codeInput.addEventListener('input', (e) => {
      const query = e.target.value.trim();
      if (query.length >= 2) {
        this.showSearchSuggestions(query);
      } else {
        document.getElementById('searchSuggestions').style.display = 'none';
      }
    });

    // 防止虛擬鍵盤自動關閉（可選）
    codeInput.addEventListener('focus', () => {
      codeInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  },

  /**
   * 查詢財產
   */
  queryAsset: async function(code) {
    ui.showLoading('正在查詢財產...');

    try {
      const asset = await sheetApi.getAsset(code);

      if (asset.success) {
        // 保存到最近查詢歷史
        dataManager.addRecentAsset(asset.asset);

        // 顯示詳情界面
        ui.showAssetDetail(asset.asset);
      } else {
        ui.showNotification('error', '查詢失敗', asset.error || '未找到該財產');
      }
    } catch (error) {
      console.error('查詢錯誤:', error);
      ui.showNotification('error', '錯誤', error.message);
    } finally {
      ui.hideLoading();
    }
  },

  /**
   * 顯示搜索建議
   */
  showSearchSuggestions: async function(query) {
    try {
      const results = await sheetApi.searchAssets(query);

      if (results.success && results.results.length > 0) {
        const suggestionsDiv = document.getElementById('searchSuggestions');
        const container = document.getElementById('suggestionsContainer');

        container.innerHTML = results.results
          .slice(0, 10)
          .map(asset => `
            <div class="item-card" onclick="app.queryAsset('${asset.code}')">
              <div class="item-card-code">${asset.code}</div>
              <div class="item-card-name">${asset.name}</div>
              <div class="item-card-unit">${asset.unit}</div>
            </div>
          `)
          .join('');

        suggestionsDiv.style.display = 'block';
      } else {
        document.getElementById('searchSuggestions').style.display = 'none';
      }
    } catch (error) {
      console.error('搜索建議錯誤:', error);
    }
  },

  /**
   * 保存財產修改
   */
  saveAsset: async function(assetData) {
    ui.showLoading('正在保存...');

    try {
      const result = await sheetApi.updateAsset(assetData);

      if (result.success) {
        ui.showNotification('success', '保存成功', '財產信息已更新');

        // 更新本地存儲
        dataManager.updateAsset(result.asset);

        // 刷新顯示
        setTimeout(() => {
          ui.showAssetDetail(result.asset);
        }, 1000);
      } else {
        ui.showNotification('error', '保存失敗', result.error || '無法保存數據');
      }
    } catch (error) {
      console.error('保存錯誤:', error);
      ui.showNotification('error', '錯誤', error.message);
    } finally {
      ui.hideLoading();
    }
  },

  /**
   * 上傳照片
   */
  uploadPhoto: async function(photoBase64, fileName = null) {
    ui.showLoading('正在上傳照片...');

    try {
      const result = await sheetApi.uploadPhoto({
        code: ui.currentAsset.code,
        photoBase64: photoBase64,
        photoName: fileName
      });

      if (result.success) {
        ui.showNotification('success', '上傳成功', '照片已保存');
        return result.photo;
      } else {
        ui.showNotification('error', '上傳失敗', result.error || '無法上傳照片');
        return null;
      }
    } catch (error) {
      console.error('上傳錯誤:', error);
      ui.showNotification('error', '錯誤', error.message);
      return null;
    } finally {
      ui.hideLoading();
    }
  },

  /**
   * 同步數據
   */
  syncData: async function() {
    ui.showLoading('正在同步...');

    try {
      // 如果是離線模式，從本地加載
      if (this.config.offlineMode) {
        dataManager.loadCachedData();
        ui.showNotification('info', '已加載', '使用本地快取數據');
      } else {
        // 從服務器同步最近的資產
        const result = await sheetApi.getRecentAssets(20);
        if (result.success) {
          dataManager.cacheAssets(result.assets);
          ui.showNotification('success', '同步完成', `已同步 ${result.assets.length} 項資產`);
        }
      }
    } catch (error) {
      console.error('同步錯誤:', error);
      ui.showNotification('error', '同步失敗', error.message);
    } finally {
      ui.hideLoading();
    }
  }
};

// ============================================
// 應用啟動
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  app.init();
});

// 頁面卸載時保存設置
window.addEventListener('beforeunload', () => {
  app.saveConfig();
});
