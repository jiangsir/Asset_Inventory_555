/**
 * 財產盤點系統 555 - Google Apps Script API
 * 提供 HTTP 端點供前端調用
 */

/**
 * HTTP 入口點 - 處理 GET 和 POST 請求
 */
function doGet(e) {
  const action = e.parameter.action;
  
  try {
    let result = {};
    switch(action) {
      case 'getAsset':
        result = handleGetAsset(e.parameter.code);
        break;
      case 'searchAssets':
        result = handleSearchAssets(e.parameter.query);
        break;
      case 'getRecentAssets':
        result = handleGetRecentAssets(e.parameter.limit);
        break;
      case 'test':
        result = {success: true, message: '測試成功', timestamp: new Date().toISOString()};
        break;
      default:
        result = {success: false, error: '未知的操作'};
    }
    return createCorsResponse(result);
  } catch(error) {
    Logger.log('GET 錯誤: ' + error);
    return createCorsResponse({success: false, error: error.toString()});
  }
}

function doPost(e) {
  const action = e.parameter.action;
  let data = {};
  
  try {
    // 嘗試解析請求體：
    // - 若前端以 application/x-www-form-urlencoded 傳入，Apps Script 會把欄位放到 e.parameter
    // - 若前端直接傳送 raw JSON，則解析 e.postData.contents
    if (e.parameter && e.parameter.payload) {
      try {
        data = JSON.parse(e.parameter.payload);
        Logger.log('doPost: parsed payload from e.parameter.payload');
      } catch (err) {
        data = {};
        Logger.log('doPost: failed to parse e.parameter.payload');
      }
    } else if (e.parameter && (e.parameter.photoBase64 || e.parameter.code)) {
      // 支援 multipart/form-data 或瀏覽器以 FormData 發送的情況（欄位會出現在 e.parameter）
      data = {
        code: e.parameter.code || null,
        photoBase64: e.parameter.photoBase64 || null,
        photoName: e.parameter.photoName || null
      };
      Logger.log('doPost: parsed fields from e.parameter (form data) — code=' + (data.code ? 'YES' : 'NO') + ', photoBase64 length=' + (data.photoBase64 ? data.photoBase64.length : 0));
    } else if (e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
        Logger.log('doPost: parsed JSON from e.postData.contents (type=' + (e.postData.type || 'unknown') + ')');
      } catch (err) {
        data = {};
        Logger.log('doPost: failed to parse e.postData.contents (type=' + (e.postData.type || 'unknown') + ')');
      }
    }
    
    let result = {};
    switch(action) {
      case 'updateAsset':
        result = handleUpdateAsset(data);
        break;
      case 'uploadPhoto':
        result = handleUploadPhoto(data);
        break;
      case 'deletePhoto':
        result = handleDeletePhoto(data);
        break;
      default:
        result = {success: false, error: '未知的操作'};
    }
    return createCorsResponse(result);
  } catch(error) {
    Logger.log('POST 錯誤: ' + error);
    return createCorsResponse({success: false, error: error.toString()});
  }
}

/**
 * 處理 CORS 預檢請求
 */
// ============================================
// GET 請求處理
// ============================================

/**
 * 按編號查詢單個財產
 */
function handleGetAsset(assetCode) {
  if (!assetCode) {
    return sendResponse({success: false, error: '缺少編號參數'}, 400);
  }
  
  try {
  const assetResult = SheetManager.getAssetByCode(assetCode);
    if (assetResult.asset) {
      return sendResponse({
        success: true,
        asset: assetResult.asset,
        debug: {
          action: 'getAsset',
          sheetName: assetResult.sheetName,
          code: assetCode,
          found: true,
          timestamp: new Date().toISOString()
        }
      });
    } else {
      return sendResponse({
        success: false,
        error: `未找到該編號(${assetCode})的財產`,
        debug: {
          action: 'getAsset',
          sheetName: assetResult.sheetName,
          code: assetCode,
          found: false,
          timestamp: new Date().toISOString()
        }
      }, 404);
    }
  } catch(error) {
    return sendResponse({success: false, error: error.toString()}, 500);
  }
}

/**
 * 搜索財產（按編號或名稱）
 */
function handleSearchAssets(query) {
  if (!query) {
    return sendResponse({success: false, error: '缺少查詢參數'}, 400);
  }
  
  try {
  const searchResult = SheetManager.searchAssets(query, 10);
    const results = searchResult.results || [];
    return sendResponse({
      success: true,
      results: results,
      debug: {
        action: 'searchAssets',
        sheetName: searchResult.sheetName,
        query: query,
        resultCount: results.length,
        timestamp: new Date().toISOString()
      }
    });
  } catch(error) {
    return sendResponse({success: false, error: error.toString()}, 500);
  }
}

/**
 * 獲取最近查詢的財產列表
 */
function handleGetRecentAssets(limit) {
  limit = parseInt(limit) || 10;
  
  try {
    const recentAssets = SheetManager.getRecentAssets(limit);
    return sendResponse({
      success: true,
      assets: recentAssets
    });
  } catch(error) {
    return sendResponse({success: false, error: error.toString()}, 500);
  }
}

// ============================================
// POST 請求處理
// ============================================

/**
 * 更新財產信息
 */
function handleUpdateAsset(data) {
  // 驗證必需字段
  if (!data.code) {
    return sendResponse({success: false, error: '缺少財產編號'}, 400);
  }
  
  try {
    // 準備更新數據
    const updateData = {
      code: data.code,
      location: data.location || '',
      remark: data.remark || '',
      scrappable: data.scrappable || '',
      photos: data.photos || []
    };
    
    // 調用 SheetManager 更新
    const result = SheetManager.updateAsset(updateData);
    
    if (result.success) {
      return sendResponse({
        success: true,
        message: '財產信息已更新',
        asset: result.asset
      });
    } else {
      return sendResponse({
        success: false,
        error: result.error || '更新失敗'
      }, 400);
    }
  } catch(error) {
    return sendResponse({success: false, error: error.toString()}, 500);
  }
}

/**
 * 上傳照片
 */
function handleUploadPhoto(data) {
  // 更詳細的驗證與日誌，並接受 data URL 或純 base64
  const code = data && data.code ? String(data.code).trim() : null;
  let photoBase64 = data && data.photoBase64 ? String(data.photoBase64) : null;
  const photoName = data && data.photoName ? String(data.photoName) : null;

  Logger.log('[handleUploadPhoto] incoming — code=' + (code ? 'YES' : 'NO') + ', photoBase64 length=' + (photoBase64 ? photoBase64.length : 0));

  if (!code) {
    return sendResponse({success: false, error: '缺少財產編號 (code)'}, 400);
  }
  if (!photoBase64) {
    return sendResponse({success: false, error: '缺少照片資料 (photoBase64) 或 資料已被截斷'}, 400);
  }

  // 支援 data:<mime>;base64,xxxx 的情況
  if (photoBase64.indexOf('data:') === 0) {
    const parts = photoBase64.split(',');
    if (parts.length > 1) photoBase64 = parts[1];
  }

  try {
    const result = DriveManager.uploadPhoto(code, photoBase64, photoName);

    if (result.success) {
      return sendResponse({
        success: true,
        message: '照片已上傳',
        photo: result.photo
      });
    } else {
      Logger.log('[handleUploadPhoto] DriveManager.uploadPhoto failed: ' + result.error);
      return sendResponse({
        success: false,
        error: result.error || '上傳失敗'
      }, 400);
    }
  } catch(error) {
    Logger.log('[handleUploadPhoto] exception: ' + error);
    return sendResponse({success: false, error: error.toString()}, 500);
  }
}

/**
 * 刪除照片
 */
function handleDeletePhoto(data) {
  if (!data.photoId) {
    return sendResponse({success: false, error: '缺少照片 ID'}, 400);
  }
  
  try {
    const result = DriveManager.deletePhoto(data.photoId);
    
    if (result.success) {
      return sendResponse({
        success: true,
        message: '照片已刪除'
      });
    } else {
      return sendResponse({
        success: false,
        error: result.error || '刪除失敗'
      }, 400);
    }
  } catch(error) {
    return sendResponse({success: false, error: error.toString()}, 500);
  }
}

// ============================================
// 輔助函數
// ============================================

/**
 * 創建支持 CORS 的 JSON 響應
 */
function createCorsResponse(data) {
  // 使用 ContentService 來創建 JSON 響應
  const html = JSON.stringify(data);
  const output = ContentService.createTextOutput(html);
  output.setMimeType(ContentService.MimeType.JSON);
  
  return output;
}

/**
 * 發送 JSON 響應（帶 CORS headers）
 */
function sendResponse(data, statusCode = 200) {
  return data;
}

/**
 * 生成部署 URL 提示
 */
function getDeploymentURL() {
  const scriptId = ScriptApp.getScriptId();
  const url = `https://script.google.com/macros/d/${scriptId}/usercopy`;
  Logger.log('部署 URL: ' + url);
  return url;
}
