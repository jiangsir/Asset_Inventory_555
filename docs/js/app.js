/**
 * 財產盤點系統 555 - 主應用邏輯
 * 協調各個模塊的工作流
 */

// ============================================
// 應用初始化
// ============================================

const app = {
  config: {
    // GAS API 配置
    gasUrl: 'https://script.google.com/macros/s/AKfycbxWRMdDuVXE-EIAQ_newRtBMvcAHNKxXTWv7zQ4KL5z1vT85zNteOQUPmEj8Yrj1ME5/exec',
    
    // Google Spreadsheet 配置
    spreadsheetId: '1DT_hQlOCNr7WN8gLysO3Y9WFB8hYYroeHWMRxTzprDs',
    sheetName: '財產列表',
    
    // 應用配置
    offlineMode: false,
    photoLimit: 10,
    debug: false
  },

  /**
   * 初始化應用
   */
  init: async function() {
    console.log('初始化財產盤點系統 555');

    // 載入設置
    this.loadConfig();

    // 初始化 API 客戶端必須優先（ui.init 會使用）
    sheetApi.init(this.config.gasUrl);

    // 初始化 dataManager（必須等待 Promise 完成）
    try {
      await dataManager.init();
    } catch (error) {
      console.error('數據管理器初始化失敗:', error);
    }

    // 初始化其他模塊
    ui.init();
    scanner.init();
    camera.init();

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
      try {
        const loaded = JSON.parse(saved);
        // 只載入有效的設置，保留默認的 gasUrl
        if (loaded.sheetName) this.config.sheetName = loaded.sheetName;
        if (loaded.offlineMode !== undefined) this.config.offlineMode = loaded.offlineMode;
        if (loaded.photoLimit !== undefined) this.config.photoLimit = loaded.photoLimit;
        if (loaded.debug !== undefined) this.config.debug = loaded.debug;
        // 只在有效的 URL 時才覆蓋 gasUrl
        if (loaded.gasUrl && loaded.gasUrl.includes('script.google.com')) {
          this.config.gasUrl = loaded.gasUrl;
        }
      } catch (e) {
        console.warn('設置讀取失敗，使用默認設置');
      }
    }

    // 如果未配置 GAS URL，提示用戶
    if (!this.config.gasUrl) {
      console.warn('未配置 GAS URL，請在設置中配置');
      // 延遲顯示通知，確保 UI 已初始化
      setTimeout(() => {
        if (ui && ui.showNotification) {
          ui.showNotification('warning', '未配置', '請在設置中填寫 API 地址');
        }
      }, 500);
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
    console.log('%c━━ 【查詢財產】━━', 'color: #ff6600; font-weight: bold; font-size: 13px; background: #fff5e6; padding: 5px;');
    console.log('%c查詢編號:', 'color: #ff6600; font-weight: bold', `"${code}"`);

    try {
      const asset = await sheetApi.getAsset(code);
      console.log('%c查詢結果:', 'color: #ff6600; font-weight: bold', asset.success ? '找到' : '未找到');
      console.log('%c完整結果對象:', 'color: #ff6600; font-weight: bold', asset);
      console.log('%c━━━━━━━━━━━━', 'color: #ff6600; font-weight: bold; font-size: 13px; background: #fff5e6; padding: 5px;');

      if (asset.success) {
        // 把 wrapper-level 的 sheetName 注入到實際 asset 物件（後端把 sheetName 放在 response 層）
        const fetched = asset.asset || {};
        if (asset.sheetName) fetched.sheetName = asset.sheetName;

        // 保存到最近查詢歷史（含 sheetName），並顯示詳情
        dataManager.addRecentAsset(fetched);

        // 顯示詳情界面（badge 會顯示 fetched.sheetName）
        ui.showAssetDetail(fetched);
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
    console.log('%c━━ 【搜索建議】━━', 'color: #ff6600; font-weight: bold; font-size: 13px; background: #fff5e6; padding: 5px;');
    console.log('%c搜索關鍵詞:', 'color: #ff6600; font-weight: bold', `"${query}"`);
    try {
      const results = await sheetApi.searchAssets(query);
      console.log('%c搜索結果:', 'color: #ff6600; font-weight: bold', `找到 ${results.results?.length || 0} 個結果`);
      console.log('%c完整結果對象:', 'color: #ff6600; font-weight: bold', results);
      console.log('%c━━━━━━━━━━━━', 'color: #ff6600; font-weight: bold; font-size: 13px; background: #fff5e6; padding: 5px;');

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

        // 若後端把 sheetName 放在 wrapper 層，注入到 result.asset（確保 UI 能顯示）
        if (result.sheetName && result.asset) {
          result.asset.sheetName = result.sheetName;
        }

        // 更新本地存儲（包含 sheetName）
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
  // ======== Image helpers ========
  resizeDataUrl: async function(dataUrl, maxSide = 1600, quality = 0.75) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const ratio = Math.min(1, maxSide / Math.max(img.width, img.height));
        const cw = Math.round(img.width * ratio);
        const ch = Math.round(img.height * ratio);
        const c = document.createElement('canvas');
        c.width = cw; c.height = ch;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0, cw, ch);
        const out = c.toDataURL('image/jpeg', quality);
        resolve(out);
      };
      img.onerror = (e) => reject(e);
      img.src = dataUrl;
    });
  },

  estimateBytesFromBase64: function(b64) {
    if (!b64) return 0;
    const withoutPrefix = b64.indexOf('base64,')>0 ? b64.split('base64,')[1] : b64;
    const padding = (withoutPrefix.endsWith('==') ? 2 : (withoutPrefix.endsWith('=') ? 1 : 0));
    return Math.ceil((withoutPrefix.length * 3)/4) - padding;
  },

  // ======== Upload with thumbnail-first + parallel chunking ========
  uploadPhoto: async function(photoBase64, fileName = null, onProgress = null) {
    ui.showLoading('正在上傳照片...');

    // 防禦式檢查
    console.log('[app.uploadPhoto] received photoBase64?', !!photoBase64, 'length=', photoBase64 ? (photoBase64.length || 'undefined') : 0, 'assetCode=', ui && ui.currentAsset ? ui.currentAsset.code : 'NO_ASSET');
    if (!photoBase64) {
      const fallback = (window.camera && window.camera.capturedPhoto) || (ui && ui.currentAsset && ui.currentAsset.photos && ui.currentAsset.photos[0]) || null;
      if (fallback) photoBase64 = fallback;
      else { ui.showNotification('error','上傳失敗','本地未取得照片 (請重新拍照或選擇相片)'); ui.hideLoading(); throw new Error('missing photoBase64'); }
    }

    // 若傳入的是物件，嘗試取出 base64
    if (typeof photoBase64 === 'object' && photoBase64 !== null) {
      if (photoBase64.url && window.barcodeScanner && window.barcodeScanner.fetchImageAsBase64) {
        try { photoBase64 = await window.barcodeScanner.fetchImageAsBase64(photoBase64.url); } catch(e){/* ignore */}
      } else if (photoBase64.photoBase64) {
        photoBase64 = photoBase64.photoBase64;
      }
    }

    if (typeof photoBase64 !== 'string' || !Number.isFinite(photoBase64.length)) {
      ui.showNotification('error','上傳失敗','照片格式不正確'); ui.hideLoading(); throw new Error('invalid photo data');
    }

    try {
      const code = ui.currentAsset && ui.currentAsset.code;

      // 1) 產生縮圖 (快速顯示)，先上傳並 attach 到資產
      try {
        const dataUrl = photoBase64.indexOf('data:') === 0 ? photoBase64 : ('data:image/jpeg;base64,' + photoBase64);
        const thumb = await this.resizeDataUrl(dataUrl, 400, 0.7);
        const thumbB64 = thumb.split(',')[1];

        // 上傳縮圖（小檔走單次請求），並立即 attach 以便在 sheet 顯示
        const thumbRes = await sheetApi.uploadPhoto({ code, photoBase64: thumbB64, photoName: (fileName||'photo') + '_thumb.jpg', meta: { isThumbnail: true } });
        if (thumbRes && thumbRes.success && thumbRes.photo && thumbRes.photo.id) {
          // 嘗試把縮圖附加到 asset（server-side attach helper）
          await sheetApi.repairAttach(code, thumbRes.photo.id);
          // 立即在 UI 顯示（optimistic update）
          ui.currentAsset = ui.currentAsset || {};
          ui.currentAsset.photos = ui.currentAsset.photos || [];
          ui.currentAsset.photos.unshift({ id: thumbRes.photo.id, url: thumbRes.photo.url, name: thumbRes.photo.name });
          ui.displayPhotos(ui.currentAsset.photos);
        }
      } catch (thumbErr) {
        console.warn('thumbnail upload failed', thumbErr);
      }

      // 2) 如果原檔很大，先嘗試壓縮成合理大小再上傳 full image
      const estimated = this.estimateBytesFromBase64(photoBase64);
      if (estimated > (2.4 * 1024 * 1024)) {
        try {
          const dataUrl = photoBase64.indexOf('data:') === 0 ? photoBase64 : ('data:image/jpeg;base64,' + photoBase64);
          const resized = await this.resizeDataUrl(dataUrl, 1600, 0.78);
          photoBase64 = resized.split(',')[1];
        } catch (e) {
          console.warn('full-image resize failed, uploading original', e);
        }
      }

      // 3) 以並行分片上傳 full image（uploadPhoto 內會選擇 chunked 路徑）
      const result = await sheetApi.uploadPhoto({ code, photoBase64, photoName: fileName, meta: { originalSize: estimated || null } }, (pct, uploadedParts, totalParts) => {
        // progress callback
        try { ui.showUploadProgress(pct); } catch(e){ console.log('progress', pct); }
        if (typeof onProgress === 'function') onProgress(pct, uploadedParts, totalParts);
      });

      if (result && result.success) {
        ui.showNotification('success', '上傳成功', '照片已保存');
        // 完成後用後端的 asset 更新 UI（保守刷新）
        if (result.asset) {
          ui.currentAsset = result.asset;
          ui.displayPhotos(ui.currentAsset.photos || []);
        } else {
          // 否則嘗試拉一遍最新 asset
          try { const fresh = await sheetApi.getAsset(code); if (fresh && fresh.success) { ui.currentAsset = fresh.asset; ui.displayPhotos(fresh.asset.photos || []); } } catch(e){}
        }
        return result;
      } else {
        ui.showNotification('error', '上傳失敗', result && result.error || '無法上傳照片');
        return result;
      }

    } catch (error) {
      console.error('上傳錯誤:', error);
      ui.showNotification('error', '錯誤', error.message || String(error));
      return null;
    } finally {
      ui.hideLoading(); ui.clearUploadProgress();
    }
  },

  // 簡易上傳效能測試（Console 可呼叫）
  uploadPerfTest: async function(dataUrl, opts = {}) {
    const start = Date.now();
    const res = await this.uploadPhoto(dataUrl.indexOf('data:')===0?dataUrl.split(',')[1]:dataUrl, opts.fileName || 'perf.jpg', (pct)=>console.log('pct',pct));
    console.log('uploadPerfTest result', res, 'took', (Date.now()-start)/1000, 's');
    return res;
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
