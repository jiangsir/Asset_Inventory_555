/**
 * 財產盤點系統 555 - Spreadsheet 管理模塊
 * 處理 Spreadsheet 的讀寫操作
 */

const SheetManager = {
  SPREADSHEET_ID: '1DT_hQlOCNr7WN8gLysO3Y9WFB8hYYroeHWMRxTzprDs',
  TARGET_SHEET_NAMES: ['一般性財產:江其勳', '一般性財產:江其勳-資訊', '非消耗性財產:江其勳', '非消耗性財產:江其勳-資訊'],
  
  // 列映射配置
  COLUMNS: {
    A: { name: '購置日期', index: 0 },
    B: { name: '財產編號', index: 1 },
    C: { name: '財產名稱', index: 2 },
    D: { name: '年限', index: 3 },
    E: { name: '使用單位', index: 4 },
    F: { name: '型式廠牌', index: 5 },
    G: { name: '數量', index: 6 },
    H: { name: '單價', index: 7 },
    I: { name: '總價', index: 8 },
    J: { name: '存放地點', index: 9 },
    K: { name: '備註', index: 10 },
    L: { name: '可否報廢', index: 11 },
    M: { name: '實物照片', index: 12 },
    N: { name: '編輯時間', index: 13 }
  },

  /**
   * 獲取活躍 Spreadsheet
   */
  getSpreadsheet: function() {
    try {
      return SpreadsheetApp.openById(this.SPREADSHEET_ID);
    } catch (e) {
      Logger.log('開啟 Spreadsheet 失敗: ' + e);
      return null;
    }
  },

  getSheet: function() {
    const ss = this.getSpreadsheet();
    if (!ss) return null;

    for (const name of this.TARGET_SHEET_NAMES) {
      const sheet = ss.getSheetByName(name);
      if (sheet) {
        return sheet;
      }
    }

    return ss.getActiveSheet();
  },

  getSheetName: function() {
    const sheet = this.getSheet();
    return sheet ? sheet.getName() : '未知';
  },

  getSheetsInOrder: function() {
    const ss = this.getSpreadsheet();
    if (!ss) return [];

    const sheets = [];
    for (const name of this.TARGET_SHEET_NAMES) {
      const sheet = ss.getSheetByName(name);
      if (sheet) {
        sheets.push(sheet);
      }
    }

    if (!sheets.length) {
      const fallback = ss.getActiveSheet();
      if (fallback) sheets.push(fallback);
    }

    return sheets;
  },

  getSheetData: function(sheet) {
    if (!sheet) return null;
    const range = sheet.getDataRange();
    return range.getValues();
  },

  /**
   * 獲取所有數據（包含標題）
   */
  getAllData: function() {
    const sheet = this.getSheet();
    if (!sheet) return null;
    
    const range = sheet.getDataRange();
    return range.getValues();
  },

  /**
   * 按編號查詢財產
   */
  getAssetByCode: function(code) {
    code = String(code).trim();
    const sheets = this.getSheetsInOrder();
    let lastSheetName = '未知';

    for (const sheet of sheets) {
      const sheetName = sheet.getName();
      lastSheetName = sheetName;

      Logger.log(`[getAssetByCode] Sheet名稱: ${sheetName}`);
      Logger.log(`[getAssetByCode] 查詢編號: ${code}`);
      Logger.log(`[getAssetByCode] 搜索欄位: B (財產編號)`);

      const data = this.getSheetData(sheet);
      if (!data || data.length < 2) {
        Logger.log(`[getAssetByCode] Sheet ${sheetName} 數據為空或不足2行，跳過`);
        continue;
      }

      Logger.log(`[getAssetByCode] Sheet ${sheetName} 數據總行數: ${data.length}`);

      for (let i = 1; i < data.length; i++) {
        const cellValue = String(data[i][this.COLUMNS.B.index]).trim();
        Logger.log(`[getAssetByCode] 第 ${i+1} 行比較: "${cellValue}" === "${code}" ?`);
        if (cellValue === code) {
          Logger.log(`[getAssetByCode] 在 ${sheetName} 找到匹配於第 ${i+1} 行`);
          return {
            asset: this.formatAssetData(data[i], i),
            sheetName: sheetName
          };
        }
      }
    }

    Logger.log(`[getAssetByCode] 未在任何目標工作表找到匹配的編號`);
    return { asset: null, sheetName: lastSheetName };
  },

  /**
   * 搜索財產（按編號或名稱）
   */
  searchAssets: function(query, limit = 10) {
    query = String(query).toLowerCase().trim();
    const sheets = this.getSheetsInOrder();
    let lastSheetName = '未知';

    Logger.log(`[searchAssets] 搜索關鍵詞: ${query}`);
    Logger.log(`[searchAssets] 搜索欄位: B (財產編號) 和 C (財產名稱)`);

    for (const sheet of sheets) {
      const sheetName = sheet.getName();
      lastSheetName = sheetName;
      Logger.log(`[searchAssets] 嘗試在 ${sheetName} 搜索`);

      const data = this.getSheetData(sheet);
      if (!data || data.length < 2) {
        Logger.log(`[searchAssets] Sheet ${sheetName} 數據為空或不足2行，跳過`);
        continue;
      }

      Logger.log(`[searchAssets] Sheet ${sheetName} 數據總行數: ${data.length}`);
      const results = [];

      for (let i = 1; i < data.length && results.length < limit; i++) {
        const code = String(data[i][this.COLUMNS.B.index]).toLowerCase();
        const name = String(data[i][this.COLUMNS.C.index]).toLowerCase();

        if (code.includes(query) || name.includes(query)) {
          Logger.log(`[searchAssets] Sheet ${sheetName} 第 ${i+1} 行匹配 - 編號: ${code}, 名稱: ${name}`);
          results.push(this.formatAssetData(data[i], i));
        }
      }

      if (results.length > 0) {
        Logger.log(`[searchAssets] 在 ${sheetName} 找到 ${results.length} 個結果`);
        return { results, sheetName };
      }
    }

    Logger.log(`[searchAssets] 未在任何目標工作表找到結果`);
    return { results: [], sheetName: lastSheetName };
  },

  /**
   * 獲取最近編輯的財產
   */
  getRecentAssets: function(limit = 10) {
    const data = this.getAllData();
    
    if (!data || data.length < 2) return [];
    
    // 按編輯時間排序（假設 N 欄有時間戳）
    const assets = [];
    for (let i = 1; i < data.length; i++) {
      assets.push({
        data: data[i],
        rowIndex: i
      });
    }
    
    // 按編輯時間反向排序
    assets.sort((a, b) => {
      const timeA = new Date(a.data[this.COLUMNS.N.index] || 0).getTime();
      const timeB = new Date(b.data[this.COLUMNS.N.index] || 0).getTime();
      return timeB - timeA;
    });
    
    // 返回前 limit 項
    return assets.slice(0, limit).map(item => 
      this.formatAssetData(item.data, item.rowIndex)
    );
  },

  /**
   * 格式化財產數據為對象
   */
  formatAssetData: function(row, rowIndex) {
    return {
      rowIndex: rowIndex + 1, // 1-based for Spreadsheet
      code: String(row[this.COLUMNS.B.index] || ''),
      purchaseDate: row[this.COLUMNS.A.index] || '',
      name: String(row[this.COLUMNS.C.index] || ''),
      lifespan: String(row[this.COLUMNS.D.index] || ''),
      unit: String(row[this.COLUMNS.E.index] || ''),
      model: String(row[this.COLUMNS.F.index] || ''),
      quantity: row[this.COLUMNS.G.index] || '',
      unitPrice: row[this.COLUMNS.H.index] || '',
      totalPrice: row[this.COLUMNS.I.index] || '',
      location: String(row[this.COLUMNS.J.index] || ''),
      remark: String(row[this.COLUMNS.K.index] || ''),
      scrappable: String(row[this.COLUMNS.L.index] || ''),
      photos: this.parsePhotos(row[this.COLUMNS.M.index]),
      editTime: row[this.COLUMNS.N.index] || ''
    };
  },

  /**
   * 解析照片數據（向後相容：支援 JSON array 與純 URL 列表）
   * 回傳格式：array of { id?, name?, url, size?, mimeType?, uploadDate? }
   */
  parsePhotos: function(photoData) {
    if (!photoData) return [];

    try {
      // 已存成 JSON（舊形式或結構化 metadata）
      if (typeof photoData === 'string' && photoData.trim().startsWith('[')) {
        const parsed = JSON.parse(photoData);
        // 若是 array of strings（舊遺留），轉為 objects
        if (Array.isArray(parsed)) {
          return parsed.map(p => {
            if (typeof p === 'string') return { url: p };
            return p;
          });
        }
        return [];
      }

      // 如果是陳列的 URL（新形式），允許以換行、逗號或分號分隔
      if (typeof photoData === 'string') {
        const parts = photoData.split(/\r?\n|,|;/).map(s => s.trim()).filter(Boolean);
        return parts.map(u => ({ url: u }));
      }

      // 已經是陣列（object 或 string）
      if (Array.isArray(photoData)) {
        return photoData.map(p => (typeof p === 'string' ? { url: p } : p));
      }

      return [];
    } catch(e) {
      Logger.log('照片解析錯誤: ' + e);
      return [];
    }
  },

  /**
   * 把 photos 資料序列化為寫入 Spreadsheet 的字串（新格式：換行分隔的 URL）
   */
  serializePhotosForSheet: function(photos) {
    try {
      if (!photos) return '';
      if (!Array.isArray(photos)) return String(photos).trim();

      // photos 可以是 array of objects 或 array of urls
      const urls = photos.map(p => {
        if (!p) return '';
        if (typeof p === 'string') return p.trim();
        return (p.url || p.webViewLink || p.name || '').toString().trim();
      }).filter(Boolean);

      // 使用換行符號存放多張照片（在 Spreadsheet 中可直接點開/預覽）
      return urls.join('\n');
    } catch (e) {
      Logger.log('[serializePhotosForSheet] error: ' + e);
      return '';
    }
  },

  /**
   * 更新財產數據
   */
  updateAsset: function(updateData) {
    try {
      const existingAssetResult = this.getAssetByCode(updateData.code);
      
      if (!existingAssetResult.asset) {
        return {
          success: false,
          error: '未找到該財產編號'
        };
      }
      
      // 必須在找到該資產的同一張表上寫入（以前用 this.getSheet() 會取到第一張存在的目標表，
      // 如果資產在不同 sheet 就會導致 row 為 undefined，引發「setting '9'」錯誤）
      const rowIndex = existingAssetResult.asset.rowIndex; // 1-based
      const targetSheetName = existingAssetResult.sheetName || this.getSheetName();
      const ss = this.getSpreadsheet();
      const sheet = ss.getSheetByName(targetSheetName) || this.getSheet();

      // 讀取該表的資料並做邊界檢查
      const allData = this.getSheetData(sheet);
      if (!allData || rowIndex < 1 || rowIndex > allData.length) {
        Logger.log('[updateAsset] Row index out of range — sheet: ' + targetSheetName + ', rowIndex: ' + rowIndex + ', rows: ' + (allData ? allData.length : 0));
        return { success: false, error: '資料行不存在或工作表不一致 (sheet: ' + targetSheetName + ')' };
      }

      // 取得目標列（保險起見，若 row 為 undefined 則建立空陣列）
      let row = allData[rowIndex - 1] || [];

      // 確保 row 長度至少包含我們要寫入的欄位數量
      const requiredCols = Math.max(...Object.values(this.COLUMNS).map(c => c.index)) + 1;
      if (row.length < requiredCols) {
        for (let i = row.length; i < requiredCols; i++) row[i] = '';
      }

      // 更新可編輯字段（防禦式寫入）
      Logger.log('[updateAsset] 更新 ' + targetSheetName + ' 第 ' + rowIndex + ' 行');
      row[this.COLUMNS.J.index] = updateData.location || '';
      row[this.COLUMNS.K.index] = updateData.remark || '';
      row[this.COLUMNS.L.index] = updateData.scrappable || '';
      row[this.COLUMNS.M.index] = this.serializePhotosForSheet(updateData.photos || []);
      row[this.COLUMNS.N.index] = new Date();

      // 寫入 Spreadsheet（指定 columns 長度為 requiredCols，避免短列造成錯誤）
      const range = sheet.getRange(rowIndex, 1, 1, requiredCols);
      range.setValues([row.slice(0, requiredCols)]);

      // 重新讀取並回傳更新後的資產資料
      const updatedAssetResult = this.getAssetByCode(updateData.code);
      
      return {
        success: true,
        asset: updatedAssetResult.asset
      };
      
    } catch(error) {
      Logger.log('更新錯誤: ' + error);
      return {
        success: false,
        error: error.toString()
      };
    }
  },

  /**
   * 將單張 Drive 照片的 metadata 附加到資產的 M 欄（photos JSON）
   * - id,name,url,size,mimeType,uploadDate
   * - 保持去重（以 id 為準）
   */
  addPhotoToAsset: function(code, photoInfo) {
    try {
      if (!code) return { success: false, error: 'missing code' };
      if (!photoInfo || !photoInfo.id) return { success: false, error: 'missing photoInfo or id' };

      const existing = this.getAssetByCode(code);
      if (!existing.asset) return { success: false, error: 'asset not found' };

      const targetSheetName = existing.sheetName || this.getSheetName();
      const ss = this.getSpreadsheet();
      const sheet = ss.getSheetByName(targetSheetName);
      const rowIndex = existing.asset.rowIndex; // 1-based

      const allData = this.getSheetData(sheet);
      if (!allData || rowIndex < 1 || rowIndex > allData.length) {
        return { success: false, error: 'row out of range' };
      }

      const requiredCols = Math.max(...Object.values(this.COLUMNS).map(c => c.index)) + 1;
      let row = allData[rowIndex - 1] || [];
      if (row.length < requiredCols) for (let i = row.length; i < requiredCols; i++) row[i] = '';

      const existingPhotos = this.parsePhotos(row[this.COLUMNS.M.index]);

      // 去重
      const exists = existingPhotos.some(p => String(p.id) === String(photoInfo.id));
      if (!exists) {
        existingPhotos.push({
          id: photoInfo.id,
          name: photoInfo.name || '',
          url: photoInfo.url || photoInfo.webViewLink || '',
          size: photoInfo.size || 0,
          mimeType: photoInfo.mimeType || '',
          uploadDate: photoInfo.uploadDate || (new Date()).toISOString()
        });
      } else {
        // 若已存在則更新內容
        for (let i = 0; i < existingPhotos.length; i++) {
          if (String(existingPhotos[i].id) === String(photoInfo.id)) {
            existingPhotos[i] = Object.assign({}, existingPhotos[i], photoInfo);
            break;
          }
        }
      }

      // 寫入 M 欄：使用簡單的 URL 換行列表以利在 Spreadsheet 中快速預覽/點擊
      row[this.COLUMNS.M.index] = this.serializePhotosForSheet(existingPhotos);
      row[this.COLUMNS.N.index] = new Date();

      const range = sheet.getRange(rowIndex, 1, 1, requiredCols);
      range.setValues([row.slice(0, requiredCols)]);

      return { success: true, asset: this.getAssetByCode(code).asset };

    } catch (err) {
      Logger.log('[addPhotoToAsset] error: ' + err);
      return { success: false, error: err && err.toString ? err.toString() : String(err) };
    }
  },

  /**
   * 將無法附加到表格的 Drive 照片記錄到 PENDING_ATTACHMENTS 以便後續修復
   */
  logPendingAttachment: function(code, photoInfo, errorMsg, attempts) {
    try {
      const ss = this.getSpreadsheet();
      let sheet = ss.getSheetByName('PENDING_ATTACHMENTS');
      if (!sheet) {
        sheet = ss.insertSheet('PENDING_ATTACHMENTS');
        sheet.appendRow(['timestamp','code','fileId','photoName','error','attempts']);
      }

      const row = [new Date(), code || '', (photoInfo && photoInfo.id) || '', (photoInfo && photoInfo.name) || '', String(errorMsg || ''), attempts || 0];
      sheet.appendRow(row);
      return { success: true, row: sheet.getLastRow() };
    } catch (e) {
      Logger.log('[logPendingAttachment] error: ' + e);
      return { success: false, error: e && e.toString ? e.toString() : String(e) };
    }
  },

  /**
   * 遷移舊數據到新財產
   * 用於"註解跟比對"功能擴展
   */
  migrateOldData: function(oldCode, newCode, fieldsToMigrate = ['location', 'remark', 'scrappable', 'photos']) {
    try {
      const oldAssetResult = this.getAssetByCode(oldCode);
      const newAssetResult = this.getAssetByCode(newCode);
      
      if (!oldAssetResult.asset || !newAssetResult.asset) {
        return {
          success: false,
          error: '舊或新編號不存在'
        };
      }
      
      // 準備遷移數據
      const migratedData = {
        code: newCode
      };
      
      // 只遷移指定字段
      if (fieldsToMigrate.includes('location')) {
        migratedData.location = oldAssetResult.asset.location;
      }
      if (fieldsToMigrate.includes('remark')) {
        migratedData.remark = oldAssetResult.asset.remark;
      }
      if (fieldsToMigrate.includes('scrappable')) {
        migratedData.scrappable = oldAssetResult.asset.scrappable;
      }
      if (fieldsToMigrate.includes('photos')) {
        migratedData.photos = oldAssetResult.asset.photos;
      }
      
      // 執行更新
      return this.updateAsset(migratedData);
      
    } catch(error) {
      Logger.log('遷移錯誤: ' + error);
      return {
        success: false,
        error: error.toString()
      };
    }
  },

  /**
   * 批量遷移舊表的照片和注釋到新表
   * 按財產編號自動匹配
   */
  migrateFromOldNotes: function(oldSheetName) {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const oldSheet = ss.getSheetByName(oldSheetName);
      
      if (!oldSheet) {
        return {
          success: false,
          error: '找不到舊表: ' + oldSheetName
        };
      }
      
      const oldData = oldSheet.getDataRange().getValues();
      let migrateCount = 0;
      let errorCount = 0;
      
      // 從第2行開始遍歷舊表
      for (let i = 1; i < oldData.length; i++) {
        const oldCode = String(oldData[i][1]).trim(); // B 欄
        
        if (!oldCode) continue;
        
        try {
          const result = this.migrateOldData(oldCode, oldCode);
          if (result.success) {
            migrateCount++;
          } else {
            errorCount++;
          }
        } catch(e) {
          errorCount++;
          Logger.log('遷移失敗 - 編號 ' + oldCode + ': ' + e);
        }
      }
      
      return {
        success: true,
        message: `遷移完成：${migrateCount} 成功，${errorCount} 失敗`,
        migrateCount: migrateCount,
        errorCount: errorCount
      };
      
    } catch(error) {
      Logger.log('批量遷移錯誤: ' + error);
      return {
        success: false,
        error: error.toString()
      };
    }
  },

  /**
   * 驗證財產數據的完整性
   */
  validateAssetData: function(asset) {
    const errors = [];
    
    if (!asset.code) {
      errors.push('財產編號不能為空');
    }
    
    if (!asset.name) {
      errors.push('財產名稱不能為空');
    }
    
    // 位置和備註有字符限制
    if (asset.location && asset.location.length > 200) {
      errors.push('存放地點長度不能超過 200 字符');
    }
    
    if (asset.remark && asset.remark.length > 500) {
      errors.push('備註長度不能超過 500 字符');
    }
    
    return {
      valid: errors.length === 0,
      errors: errors
    };
  }
};
