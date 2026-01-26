/**
 * 財產盤點系統 555 - Spreadsheet API 封裝
 * 與 Google Apps Script 後端通信
 */

const sheetApi = {
  
  // API 配置
  apiUrl: '',
  timeout: 30000,

  /**
   * 初始化 API
   */
  init: function(apiUrl) {
    this.apiUrl = apiUrl;
    if (!apiUrl) {
      console.warn('未配置 GAS API URL');
    } else {
      // 测试 API 连接
      this.testConnection();
    }
  },

  /**
   * 测试 API 连接
   */
  testConnection: async function() {
    try {
      const result = await this.request('test');
      console.log('%c[API 测试]', 'color: #00dd00; font-weight: bold; font-size: 14px', 'API 连接成功', result);
    } catch (error) {
      console.error('%c[API 测试失败]', 'color: #ff0000; font-weight: bold; font-size: 14px', error);
    }
  },

  /**
   * 執行 API 請求
   */
  request: async function(action, method = 'GET', data = null) {
    if (!this.apiUrl) {
      throw new Error('未配置 API URL，請在設置中配置');
    }

    try {
      const options = {
        method: method
      };

      // POST 處理策略：
      // - 若包含大欄位（例如 photoBase64），使用 FormData（瀏覽器會設定 multipart/form-data），
      //   這屬於 simple request（不會觸發 preflight），且能正確傳送大型文本/二進位資料；
      // - 其他 POST 請求使用 application/x-www-form-urlencoded 並把整個物件放在 payload 欄位（避免 preflight）。
      if (method === 'POST') {
        if (data && data.photoBase64) {
          // 大檔案路徑：使用 FormData（不要手動設定 Content-Type）
          const form = new FormData();
          // 把常用欄位拆成獨立欄位，方便 Apps Script 直接讀取
          if (data.code) form.append('code', data.code);
          if (data.photoBase64) form.append('photoBase64', data.photoBase64);
          if (data.photoName) form.append('photoName', data.photoName);
          options.body = form;
          // 刪除 headers，讓瀏覽器自動設定 boundary
          try {
            console.log(`[API request] sending photoBase64 length=${data.photoBase64.length} chars (~${Math.round((data.photoBase64.length*3/4)/1024)} KB)`);
          } catch (e) { /* ignore */ }
        } else {
          // 小型 POST：用 payload 欄位的 urlencoded 字串（避免 preflight）
          options.headers = {
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
          };
          if (data) {
            options.body = new URLSearchParams({ payload: JSON.stringify(data) }).toString();
          }
        }
      }

      // 構建 URL
      let url = `${this.apiUrl}?action=${encodeURIComponent(action)}`;

      if (method === 'GET' && data) {
        Object.entries(data).forEach(([key, value]) => {
          url += `&${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
        });
      }

      // 設置超時
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);
      options.signal = controller.signal;

      const response = await fetch(url, options);
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      // 無論如何都打印完整的 API 響應
      console.log('%c━━━ [API RESPONSE] ━━━', 'color: #ff0000; font-weight: bold; font-size: 14px; background: #ffeeee; padding: 5px;');
      console.log('%cAction:', 'color: #ff0000; font-weight: bold', action);
      console.log('%cFull Response:', 'color: #ff0000; font-weight: bold', result);
      console.log('%cDebug Info:', 'color: #0066cc; font-weight: bold', result.debug || 'NO DEBUG INFO');
      console.log('%c━━━━━━━━━━━━━━━━━━━', 'color: #ff0000; font-weight: bold; font-size: 14px; background: #ffeeee; padding: 5px;');
      
      return result;

    } catch (error) {
      console.error('API 請求失敗:', error);
      throw error;
    }
  },

  /**
   * 獲取單個資產
   */
  getAsset: async function(code) {
    return this.request('getAsset', 'GET', { code });
  },

  /**
   * 搜索資產
   */
  searchAssets: async function(query, limit = 10) {
    return this.request('searchAssets', 'GET', { query, limit });
  },

  /**
   * 獲取最近的資產列表
   */
  getRecentAssets: async function(limit = 10) {
    return this.request('getRecentAssets', 'GET', { limit });
  },

  /**
   * 更新資產數據
   */
  updateAsset: async function(assetData) {
    const data = {
      code: assetData.code,
      location: assetData.location || '',
      remark: assetData.remark || '',
      scrappable: assetData.scrappable || '',
      photos: assetData.photos || []
    };

    return this.request('updateAsset', 'POST', data);
  },

  /**
   * 上傳照片（自動分片處理與進度回調）
   * - 對於小檔案直接走單一請求
   * - 對於大於 CHUNK_SIZE 的 base64，採用分片上傳
   */
  uploadPhoto: async function(photoData, onProgress = null) {
    const CHUNK_SIZE = 100 * 1024; // 100k chars per chunk (~75KB binary)

    // 更友善的錯誤與診斷資訊
    if (!photoData) {
      throw new Error('missing photoData — caller must pass {code, photoBase64}');
    }
    if (!photoData.photoBase64) {
      const codeInfo = photoData.code ? ('code=' + photoData.code) : 'no-code';
      throw new Error('missing photoBase64 (' + codeInfo + '). Ensure the caller passes the base64 string or that camera.read completed.');
    }

    // 防禦式：如果傳入的是物件（例如 {url:...}），不要盲目傳到後端
    let b64 = photoData.photoBase64;
    if (typeof b64 === 'object' && b64 !== null) {
      if (b64.photoBase64) b64 = b64.photoBase64;
      else throw new Error('photoBase64 must be a base64 string or data:URI');
    }

    if (typeof b64 !== 'string' || !Number.isFinite(b64.length)) {
      throw new Error('invalid photoBase64 (expected string with length)');
    }

    if (b64.length <= CHUNK_SIZE) {
      // 小檔案直接上傳（原始路徑）
      return this.request('uploadPhoto', 'POST', {
        code: photoData.code,
        photoBase64: b64,
        photoName: photoData.photoName || null
      });
    }

    // 大檔案：分片上傳
    return this.uploadPhotoChunked(photoData.code, b64, photoData.photoName || null, CHUNK_SIZE, onProgress);
  },

  /**
   * 分片上傳實作
   */
  uploadPhotoChunked: async function(code, photoBase64, photoName = null, chunkSize = 100*1024, onProgress = null) {
    const total = Math.ceil(photoBase64.length / chunkSize);
    if (!Number.isFinite(total) || total <= 0) throw new Error('invalid photo length for chunking');
    const uploadId = `${code}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;

    let uploadedParts = 0;
    for (let i = 0; i < total; i++) {
      const start = i * chunkSize;
      const chunk = photoBase64.slice(start, start + chunkSize);

      // 重試機制
      const MAX_RETRIES = 3;
      let attempt = 0;
      let ok = false;
      let lastErr = null;

      while (attempt < MAX_RETRIES && !ok) {
        try {
          await this.request('uploadChunk', 'POST', { uploadId, index: i, total, chunk });
          ok = true;
          uploadedParts++;
        } catch (err) {
          attempt++;
          lastErr = err;
          console.warn(`uploadChunk attempt ${attempt} failed for ${uploadId}#${i}`, err);
          // 小延遲再重試
          await new Promise(r => setTimeout(r, 300 * attempt));
        }
      }

      if (!ok) {
        throw new Error('上傳分片失敗：' + (lastErr && lastErr.message));
      }

      if (typeof onProgress === 'function') {
        try { onProgress(Math.round(((i+1)/total)*100), i, total); } catch(e){/* ignore */}
      }
    }

    if (uploadedParts === 0) throw new Error('no chunks were uploaded');

    // 通知後端組合並完成上傳
    const finishResult = await this.request('finishUpload', 'POST', { uploadId, code, photoName });
    return finishResult;
  },


  /**
   * 單一分片上傳（保留，供未來直接呼叫）
   */
  uploadChunk: async function(uploadId, index, chunk, total) {
    return this.request('uploadChunk', 'POST', { uploadId, index, chunk, total });
  },

  /**
   * 通知後端完成上傳並組合分片
   */
  finishUpload: async function(uploadId, code, photoName = null) {
    return this.request('finishUpload', 'POST', { uploadId, code, photoName });
  },

  /**
   * 嘗試把 Drive 檔案附加到資產（server-side repair helper）
   */
  repairAttach: async function(code, fileId = null) {
    const data = { code };
    if (fileId) data.fileId = fileId;
    return this.request('repairAttach', 'POST', data);
  },

  /**
   * 取回 Drive 檔案的 dataURL（proxy，由 Apps Script 提供）
   * 參數：fileId 或 code
   */
  getPhoto: async function({ fileId = null, code = null } = {}) {
    const params = {};
    if (fileId) params.fileId = fileId;
    if (code) params.code = code;
    return this.request('servePhoto', 'GET', params);
  },

  /**
   * 刪除照片
   */
  deletePhoto: async function(photoId) {
    return this.request('deletePhoto', 'POST', { photoId });
  },

  /**
   * 測試 API 連接
   */
  testConnection: async function() {
    try {
      const result = await this.getRecentAssets(1);
      return {
        success: result.success !== false,
        message: result.success ? '連接成功' : result.error
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  },

  /**
   * 批量獲取資產
   */
  getAssets: async function(codes) {
    if (!Array.isArray(codes) || codes.length === 0) {
      return { success: false, error: '編號列表為空' };
    }

    try {
      const results = [];
      
      // 順序執行，避免併發過多
      for (const code of codes) {
        const result = await this.getAsset(code);
        if (result.success) {
          results.push(result.asset);
        }
      }

      return { success: true, assets: results };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  /**
   * 批量更新資產（用於數據遷移）
   */
  updateAssetsBatch: async function(assetsData) {
    if (!Array.isArray(assetsData) || assetsData.length === 0) {
      return { success: false, error: '資料列表為空' };
    }

    try {
      const results = [];
      let successCount = 0;
      let errorCount = 0;

      for (const assetData of assetsData) {
        try {
          const result = await this.updateAsset(assetData);
          if (result.success) {
            results.push({ code: assetData.code, success: true });
            successCount++;
          } else {
            results.push({ code: assetData.code, success: false, error: result.error });
            errorCount++;
          }
        } catch (error) {
          results.push({ code: assetData.code, success: false, error: error.message });
          errorCount++;
        }

        // 避免服務器負荷，稍作延遲
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      return {
        success: errorCount === 0,
        results: results,
        summary: { successCount, errorCount }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
};
