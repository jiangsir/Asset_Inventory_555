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
    switch(action) {
      case 'getAsset':
        return handleGetAsset(e.parameter.code);
      case 'searchAssets':
        return handleSearchAssets(e.parameter.query);
      case 'getRecentAssets':
        return handleGetRecentAssets(e.parameter.limit);
      default:
        return sendResponse({success: false, error: '未知的操作'}, 400);
    }
  } catch(error) {
    Logger.log('GET 錯誤: ' + error);
    return sendResponse({success: false, error: error.toString()}, 500);
  }
}

function doPost(e) {
  const action = e.parameter.action;
  let data = {};
  
  try {
    // 嘗試解析 JSON 請求體
    if (e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    }
    
    switch(action) {
      case 'updateAsset':
        return handleUpdateAsset(data);
      case 'uploadPhoto':
        return handleUploadPhoto(data);
      case 'deletePhoto':
        return handleDeletePhoto(data);
      default:
        return sendResponse({success: false, error: '未知的操作'}, 400);
    }
  } catch(error) {
    Logger.log('POST 錯誤: ' + error);
    return sendResponse({success: false, error: error.toString()}, 500);
  }
}

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
    const asset = SheetManager.getAssetByCode(assetCode);
    if (asset) {
      return sendResponse({
        success: true,
        asset: asset
      });
    } else {
      return sendResponse({
        success: false,
        error: '未找到該編號的財產'
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
    const results = SheetManager.searchAssets(query, 10);
    return sendResponse({
      success: true,
      results: results
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
  if (!data.code || !data.photoBase64) {
    return sendResponse({success: false, error: '缺少必需參數'}, 400);
  }
  
  try {
    const result = DriveManager.uploadPhoto(data.code, data.photoBase64, data.photoName);
    
    if (result.success) {
      return sendResponse({
        success: true,
        message: '照片已上傳',
        photo: result.photo
      });
    } else {
      return sendResponse({
        success: false,
        error: result.error || '上傳失敗'
      }, 400);
    }
  } catch(error) {
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
 * 發送 JSON 響應
 */
function sendResponse(data, statusCode = 200) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
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
