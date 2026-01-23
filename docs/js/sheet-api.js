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

      // 只在 POST 時添加 Content-Type header，避免 CORS preflight
      if (method === 'POST') {
        options.headers = {
          'Content-Type': 'application/json'
        };
        if (data) {
          options.body = JSON.stringify(data);
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
      
      // 一定要打印 debug 信息
      console.log('%c[API RESPONSE]', 'color: #ff0000; font-weight: bold; font-size: 14px', 'Action:', action, 'Full Response:', result);
      
      // 如果有調試信息，打印到 console
      if (result.debug) {
        console.log('%c[API DEBUG INFO]', 'color: #0066cc; font-weight: bold; font-size: 12px', result.debug);
      }
      
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
   * 上傳照片
   */
  uploadPhoto: async function(photoData) {
    return this.request('uploadPhoto', 'POST', {
      code: photoData.code,
      photoBase64: photoData.photoBase64,
      photoName: photoData.photoName || null
    });
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
