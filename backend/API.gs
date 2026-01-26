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
      case 'uploadChunk':
        result = handleUploadChunk(data);
        break;
      case 'finishUpload':
        result = handleFinishUpload(data);
        break;
      case 'repairAttach':
        result = handleRepairAttach(data);
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
 * 處理上傳分片
 * 接收：{ uploadId, index, total, chunk }
 */
function handleUploadChunk(data) {
  if (!data || !data.uploadId || data.index === undefined || !data.chunk) {
    return sendResponse({ success: false, error: '缺少 uploadId/index/chunk' }, 400);
  }

  try {
    const uploadId = String(data.uploadId);
    const index = parseInt(data.index, 10);
    const chunk = String(data.chunk);

    const res = DriveManager.saveUploadChunk(uploadId, index, chunk);
    return sendResponse({ success: res === true, message: res === true ? 'chunk saved' : res });
  } catch (err) {
    Logger.log('[handleUploadChunk] ' + err);
    return sendResponse({ success: false, error: err.toString() }, 500);
  }
}

/**
 * 完成分片上傳並組合（接收 uploadId, code, photoName）
 */
function handleFinishUpload(data) {
  if (!data || !data.uploadId || !data.code) {
    return sendResponse({ success: false, error: '缺少 uploadId 或 code' }, 400);
  }

  try {
    const uploadId = String(data.uploadId);
    const code = String(data.code);
    const photoName = data.photoName || null;

    Logger.log('[handleFinishUpload] uploadId=' + uploadId + ', code=' + code + ', photoName=' + photoName);

    const assembled = DriveManager.assembleUploadParts(uploadId);
    if (!assembled || !assembled.success) {
      Logger.log('[handleFinishUpload] assemble failed: ' + (assembled && assembled.error));
      return sendResponse({ success: false, error: assembled && assembled.error ? assembled.error : '組合失敗' }, 500);
    }

    const base64 = assembled.data || '';
    Logger.log('[handleFinishUpload] assembled length=' + (base64 ? base64.length : 0));

    if (!base64 || base64.length < 10) {
      return sendResponse({ success: false, error: 'assembled data is empty or too small' }, 400);
    }

    const result = DriveManager.uploadPhoto(code, base64, photoName);

    // 嘗試清理零散檔案（非阻塞）
    try { DriveManager.cleanupUploadParts(uploadId); } catch(e){ Logger.log('[handleFinishUpload] cleanup failed: ' + e); }

    if (!result || !result.success) {
      Logger.log('[handleFinishUpload] uploadPhoto returned error: ' + (result && result.error));
      return sendResponse({ success: false, error: result && result.error ? result.error : '上傳失敗' }, 500);
    }

    // Drive 上傳成功——嘗試把照片 metadata 寫回 Spreadsheet（重試機制）
    const photo = result.photo;
    let attachResult = null;
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        Logger.log('[handleFinishUpload] attempting to attach photo to sheet — attempt=' + attempt + ', code=' + code + ', fileId=' + (photo && photo.id));
        attachResult = SheetManager.addPhotoToAsset(code, photo);
        if (attachResult && attachResult.success) {
          Logger.log('[handleFinishUpload] attached to sheet successfully');
          return sendResponse({ success: true, photo: photo, asset: attachResult.asset });
        }

        Logger.log('[handleFinishUpload] attach attempt failed: ' + (attachResult && attachResult.error));
      } catch (e) {
        Logger.log('[handleFinishUpload] attach threw: ' + e);
        attachResult = { success: false, error: e && e.toString ? e.toString() : String(e) };
      }

      // 指數回退（短暫）
      Utilities.sleep(250 * attempt);
    }

    // 如果到這裡仍失敗，記錄到待修復表並回傳部分成功（Drive 已上傳）
    try {
      const logRes = SheetManager.logPendingAttachment(code, photo, attachResult && attachResult.error ? attachResult.error : 'unknown', maxAttempts);
      Logger.log('[handleFinishUpload] logged pending attachment: ' + JSON.stringify(logRes));
      return sendResponse({ success: true, photo: photo, warning: 'sheet_attach_failed', repair: logRes });
    } catch (logErr) {
      Logger.log('[handleFinishUpload] failed to log pending attachment: ' + logErr);
      return sendResponse({ success: true, photo: photo, warning: 'sheet_attach_failed_and_log_failed', error: (attachResult && attachResult.error) || String(logErr) });
    }

  } catch (err) {
    Logger.log('[handleFinishUpload] exception: ' + err);
    return sendResponse({ success: false, error: err.toString() }, 500);
  }
}


/**
 * 嘗試把指定 Drive 檔案（或該資產的最新檔案）附加到資產的 Spreadsheet
 * 接收：{ code, fileId? }
 */
function handleRepairAttach(data) {
  if (!data || !data.code) return sendResponse({ success: false, error: '缺少 code' }, 400);

  try {
    const code = String(data.code);
    let photoInfo = null;

    if (data.fileId) {
      // 以指定 fileId 為準
      try {
        const f = DriveApp.getFileById(String(data.fileId));
        photoInfo = { id: f.getId(), name: f.getName(), url: f.getUrl(), size: f.getSize(), mimeType: f.getMimeType(), uploadDate: f.getLastUpdated() ? f.getLastUpdated().toISOString() : (new Date()).toISOString() };
      } catch (e) {
        return sendResponse({ success: false, error: 'invalid fileId: ' + e.toString() }, 400);
      }
    } else {
      // 取該資產最新的照片
      const latest = DriveManager.getLatestPhoto(code);
      if (!latest || !latest.success) return sendResponse({ success: false, error: latest && latest.error ? latest.error : 'no photo found' }, 404);
      photoInfo = latest.photo;
    }

    const attachRes = SheetManager.addPhotoToAsset(code, photoInfo);
    if (attachRes && attachRes.success) return sendResponse({ success: true, asset: attachRes.asset });

    // 若附加失敗，記錄並回傳錯誤
    const logRes = SheetManager.logPendingAttachment(code, photoInfo, attachRes && attachRes.error ? attachRes.error : 'attach_failed', 0);
    return sendResponse({ success: false, error: attachRes && attachRes.error ? attachRes.error : 'attach_failed', repair: logRes }, 500);
  } catch (err) {
    Logger.log('[handleRepairAttach] exception: ' + err);
    return sendResponse({ success: false, error: err.toString() }, 500);
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
