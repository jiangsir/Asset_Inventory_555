/**
 * 財產盤點系統 555 - Spreadsheet 管理模塊
 * 處理 Spreadsheet 的讀寫操作
 */

const SheetManager = {
  
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
  getSheet: function() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    return ss.getSheetByName('財產列表') || ss.getActiveSheet();
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
    const sheet = this.getSheet();
    const sheetName = sheet ? sheet.getName() : '未知';
    
    Logger.log(`[getAssetByCode] Sheet名稱: ${sheetName}`);
    Logger.log(`[getAssetByCode] 查詢編號: ${code}`);
    Logger.log(`[getAssetByCode] 搜索欄位: B (財產編號)`);
    
    const data = this.getAllData();
    
    if (!data || data.length < 2) {
      Logger.log(`[getAssetByCode] 數據為空或不足2行，返回null`);
      return null;
    }
    
    Logger.log(`[getAssetByCode] 數據總行數: ${data.length}`);
    
    // 從第2行開始查找（第1行是標題）
    for (let i = 1; i < data.length; i++) {
      const cellValue = String(data[i][this.COLUMNS.B.index]).trim();
      Logger.log(`[getAssetByCode] 第 ${i+1} 行比較: "${cellValue}" === "${code}" ?`);
      if (cellValue === code) {
        Logger.log(`[getAssetByCode] 找到匹配於第 ${i+1} 行`);
        return this.formatAssetData(data[i], i);
      }
    }
    
    Logger.log(`[getAssetByCode] 未找到匹配的編號`);
    return null;
  },

  /**
   * 搜索財產（按編號或名稱）
   */
  searchAssets: function(query, limit = 10) {
    query = String(query).toLowerCase().trim();
    const sheet = this.getSheet();
    const sheetName = sheet ? sheet.getName() : '未知';
    
    Logger.log(`[searchAssets] Sheet名稱: ${sheetName}`);
    Logger.log(`[searchAssets] 搜索關鍵詞: ${query}`);
    Logger.log(`[searchAssets] 搜索欄位: B (財產編號) 和 C (財產名稱)`);
    
    const data = this.getAllData();
    
    if (!data || data.length < 2) {
      Logger.log(`[searchAssets] 數據為空或不足2行，返回空陣列`);
      return [];
    }
    
    Logger.log(`[searchAssets] 數據總行數: ${data.length}`);
    
    const results = [];
    
    for (let i = 1; i < data.length && results.length < limit; i++) {
      const code = String(data[i][this.COLUMNS.B.index]).toLowerCase();
      const name = String(data[i][this.COLUMNS.C.index]).toLowerCase();
      
      if (code.includes(query) || name.includes(query)) {
        Logger.log(`[searchAssets] 第 ${i+1} 行匹配 - 編號: ${code}, 名稱: ${name}`);
        results.push(this.formatAssetData(data[i], i));
      }
    }
    
    Logger.log(`[searchAssets] 找到 ${results.length} 個結果`);
    return results;
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
   * 解析照片數據（JSON 格式）
   */
  parsePhotos: function(photoData) {
    if (!photoData) return [];
    
    try {
      if (typeof photoData === 'string') {
        return JSON.parse(photoData);
      }
      return Array.isArray(photoData) ? photoData : [];
    } catch(e) {
      Logger.log('照片解析錯誤: ' + e);
      return [];
    }
  },

  /**
   * 更新財產數據
   */
  updateAsset: function(updateData) {
    try {
      const existingAsset = this.getAssetByCode(updateData.code);
      
      if (!existingAsset) {
        return {
          success: false,
          error: '未找到該財產編號'
        };
      }
      
      const sheet = this.getSheet();
      const rowIndex = existingAsset.rowIndex;
      
      // 準備更新的行數據
      const allData = this.getAllData();
      const row = allData[rowIndex - 1]; // 轉換為 0-based
      
      // 更新可編輯字段
      row[this.COLUMNS.J.index] = updateData.location || '';
      row[this.COLUMNS.K.index] = updateData.remark || '';
      row[this.COLUMNS.L.index] = updateData.scrappable || '';
      row[this.COLUMNS.M.index] = JSON.stringify(updateData.photos || []);
      row[this.COLUMNS.N.index] = new Date();
      
      // 寫入 Spreadsheet
      const range = sheet.getRange(rowIndex, 1, 1, row.length);
      range.setValues([row]);
      
      // 返回更新後的資產
      const updatedAsset = this.getAssetByCode(updateData.code);
      
      return {
        success: true,
        asset: updatedAsset
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
   * 遷移舊數據到新財產
   * 用於"註解跟比對"功能擴展
   */
  migrateOldData: function(oldCode, newCode, fieldsToMigrate = ['location', 'remark', 'scrappable', 'photos']) {
    try {
      const oldAsset = this.getAssetByCode(oldCode);
      const newAsset = this.getAssetByCode(newCode);
      
      if (!oldAsset || !newAsset) {
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
        migratedData.location = oldAsset.location;
      }
      if (fieldsToMigrate.includes('remark')) {
        migratedData.remark = oldAsset.remark;
      }
      if (fieldsToMigrate.includes('scrappable')) {
        migratedData.scrappable = oldAsset.scrappable;
      }
      if (fieldsToMigrate.includes('photos')) {
        migratedData.photos = oldAsset.photos;
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
