/**
 * 財產盤點系統 555 - Google Drive 管理模塊
 * 處理照片上傳和管理
 */

const DriveManager = {

  // 根文件夾名稱（自動創建）
  ROOT_FOLDER_NAME: '財產盤點系統_照片庫',

  /**
   * 獲取或創建根文件夾
   */
  getRootFolder: function() {
    try {
      const folders = DriveApp.getFoldersByName(this.ROOT_FOLDER_NAME);
      
      if (folders.hasNext()) {
        return folders.next();
      } else {
        // 創建根文件夾
        return DriveApp.createFolder(this.ROOT_FOLDER_NAME);
      }
    } catch(error) {
      Logger.log('獲取根文件夾錯誤: ' + error);
      throw error;
    }
  },

  /**
   * 獲取或創建財產文件夾
   */
  getAssetFolder: function(assetCode) {
    try {
      const rootFolder = this.getRootFolder();
      const folderName = '資產_' + String(assetCode).replace(/[^\w\-]/g, '_');
      
      const folders = rootFolder.getFoldersByName(folderName);
      
      if (folders.hasNext()) {
        return folders.next();
      } else {
        // 創建財產文件夾
        return rootFolder.createFolder(folderName);
      }
    } catch(error) {
      Logger.log('獲取資產文件夾錯誤: ' + error);
      throw error;
    }
  },

  /**
   * 上傳照片到 Google Drive
   * @param {string} assetCode - 財產編號
   * @param {string} photoBase64 - Base64 編碼的照片數據
   * @param {string} photoName - 照片名稱（可選）
   * @returns {object} {success: bool, photo: object}
   */
  uploadPhoto: function(assetCode, photoBase64, photoName = null) {
    try {
      // 驗證參數
      if (!assetCode || !photoBase64) {
        return {
          success: false,
          error: '缺少編號或照片數據'
        };
      }

      // 驗證並解碼 Base64 數據（加強日誌與錯誤處理）
      if (!photoBase64 || String(photoBase64).length === 0) {
        return { success: false, error: 'empty photoBase64' };
      }

      Logger.log('[DriveManager.uploadPhoto] incoming — code=' + assetCode + ', photoBase64 length=' + String(photoBase64).length + ', photoName=' + (photoName || 'null'));

      let binaryString;
      try {
        binaryString = Utilities.base64Decode(photoBase64);
      } catch (err) {
        Logger.log('[DriveManager.uploadPhoto] base64Decode failed: ' + err);
        return { success: false, error: 'base64 decode failed: ' + err.toString() };
      }

      // 生成照片名稱
      if (!photoName) {
        const timestamp = new Date().getTime();
        photoName = `photo_${timestamp}.jpg`;
      }

      // 建立 Blob 時明確帶上 name（避免某些 API 對空 name 的限制）
      const blob = Utilities.newBlob(binaryString, 'image/jpeg', photoName || ('photo_' + new Date().getTime() + '.jpg'));

      // 獲取資產文件夾並上傳
      const assetFolder = this.getAssetFolder(assetCode);
      let file;
      try {
        file = assetFolder.createFile(blob);
        // setName 仍然保留以確保命名一致
        file.setName(photoName);
      } catch (err) {
        Logger.log('[DriveManager.uploadPhoto] createFile failed: ' + err);
        return { success: false, error: err.toString() };
      }

      // 生成照片信息對象
      const photoInfo = {
        id: file.getId(),
        name: photoName,
        url: file.getUrl(),
        downloadUrl: file.getDownloadUrl(),
        uploadDate: new Date().toISOString(),
        size: file.getSize(),
        mimeType: file.getMimeType()
      };

      return {
        success: true,
        photo: photoInfo
      };

    } catch(error) {
      Logger.log('照片上傳錯誤: ' + error);
      return {
        success: false,
        error: error.toString()
      };
    }
  },

  /** TEMP UPLOAD (chunk) helpers **/
  getTempFolder: function() {
    try {
      const root = this.getRootFolder();
      const name = 'tmp_uploads';
      const it = root.getFoldersByName(name);
      if (it.hasNext()) return it.next();
      return root.createFolder(name);
    } catch (err) {
      Logger.log('getTempFolder error: ' + err);
      throw err;
    }
  },

  saveUploadChunk: function(uploadId, index, chunk) {
    try {
      const folder = this.getTempFolder();
      const fileName = `${uploadId}_part_${index}`;
      const files = folder.getFilesByName(fileName);
      if (files.hasNext()) {
        const f = files.next();
        f.setContent(chunk);
      } else {
        folder.createFile(fileName, chunk, 'text/plain');
      }
      return true;
    } catch (err) {
      Logger.log('saveUploadChunk error: ' + err);
      return err.toString();
    }
  },

  assembleUploadParts: function(uploadId) {
    try {
      const folder = this.getTempFolder();
      const files = folder.getFiles();
      const parts = [];
      while (files.hasNext()) {
        const f = files.next();
        const n = f.getName();
        if (n.indexOf(uploadId + '_part_') === 0) {
          const idx = parseInt(n.split('_part_')[1], 10);
          parts.push({ idx: idx, content: f.getBlob().getDataAsString() });
        }
      }

      if (!parts.length) return { success: false, error: 'no parts found' };
      parts.sort((a,b) => a.idx - b.idx);
      const assembled = parts.map(p => p.content).join('');
      return { success: true, data: assembled };
    } catch (err) {
      Logger.log('assembleUploadParts error: ' + err);
      return { success: false, error: err.toString() };
    }
  },

  cleanupUploadParts: function(uploadId) {
    try {
      const folder = this.getTempFolder();
      const files = folder.getFiles();
      const deleted = [];
      while (files.hasNext()) {
        const f = files.next();
        if (f.getName().indexOf(uploadId + '_part_') === 0) {
          deleted.push(f.getName());
          f.setTrashed(true);
        }
      }
      return { success: true, deletedCount: deleted.length };
    } catch (err) {
      Logger.log('cleanupUploadParts error: ' + err);
      return { success: false, error: err.toString() };
    }
  },

  /**
   * 刪除照片
   * @param {string} photoId - Google Drive 文件 ID
   * @returns {object} {success: bool}
   */
  deletePhoto: function(photoId) {
    try {
      const file = DriveApp.getFileById(photoId);
      file.setTrashed(true);

      return {
        success: true
      };

    } catch(error) {
      Logger.log('刪除照片錯誤: ' + error);
      return {
        success: false,
        error: error.toString()
      };
    }
  },

  /**
   * 獲取資產的所有照片
   * @param {string} assetCode - 財產編號
   * @returns {array} 照片信息數組
   */
  getAssetPhotos: function(assetCode) {
    try {
      const assetFolder = this.getAssetFolder(assetCode);
      const files = assetFolder.getFiles();
      const photos = [];

      while (files.hasNext()) {
        const file = files.next();
        
        // 只包含圖片文件
        if (file.getMimeType().startsWith('image/')) {
          photos.push({
            id: file.getId(),
            name: file.getName(),
            url: file.getUrl(),
            downloadUrl: file.getDownloadUrl(),
            size: file.getSize(),
            mimeType: file.getMimeType()
          });
        }
      }

      return photos;

    } catch(error) {
      Logger.log('獲取照片列表錯誤: ' + error);
      return [];
    }
  },

  /**
   * 獲取資產資料夾中最新（按修改時間）的圖片
   * @param {string} assetCode
   * @returns {object} {success: bool, photo: {id,name,url,size,mimeType,uploadDate}} 或 {success:false, error: string}
   */
  getLatestPhoto: function(assetCode) {
    try {
      const assetFolder = this.getAssetFolder(assetCode);
      const files = assetFolder.getFiles();
      let latest = null;

      while (files.hasNext()) {
        const f = files.next();
        if (!f.getMimeType().startsWith('image/')) continue;
        const t = f.getLastUpdated() ? f.getLastUpdated().getTime() : 0;
        if (!latest || t > latest.t) {
          latest = { f: f, t: t };
        }
      }

      if (!latest) return { success: false, error: 'no photos found' };
      const file = latest.f;
      return {
        success: true,
        photo: {
          id: file.getId(),
          name: file.getName(),
          url: file.getUrl(),
          size: file.getSize(),
          mimeType: file.getMimeType(),
          uploadDate: file.getLastUpdated() ? file.getLastUpdated().toISOString() : (new Date()).toISOString()
        }
      };
    } catch (err) {
      Logger.log('[getLatestPhoto] error: ' + err);
      return { success: false, error: err && err.toString ? err.toString() : String(err) };
    }
  },

  /**
   * 批量刪除資產的所有照片
   * @param {string} assetCode - 財產編號
   * @returns {object} {success: bool, deletedCount: number}
   */
  deleteAssetPhotos: function(assetCode) {
    try {
      const assetFolder = this.getAssetFolder(assetCode);
      const files = assetFolder.getFiles();
      let deletedCount = 0;

      while (files.hasNext()) {
        const file = files.next();
        file.setTrashed(true);
        deletedCount++;
      }

      return {
        success: true,
        deletedCount: deletedCount
      };

    } catch(error) {
      Logger.log('批量刪除照片錯誤: ' + error);
      return {
        success: false,
        error: error.toString()
      };
    }
  },

  /**
   * 獲取資產文件夾的大小（字節）
   * @param {string} assetCode - 財產編號
   * @returns {number} 文件夾總大小
   */
  getAssetFolderSize: function(assetCode) {
    try {
      const assetFolder = this.getAssetFolder(assetCode);
      const files = assetFolder.getFiles();
      let totalSize = 0;

      while (files.hasNext()) {
        const file = files.next();
        totalSize += file.getSize();
      }

      return totalSize;

    } catch(error) {
      Logger.log('計算文件夾大小錯誤: ' + error);
      return 0;
    }
  },

  /**
   * 獲取整個照片庫的大小統計
   * @returns {object} {totalSize: number, assetCount: number}
   */
  getLibraryStats: function() {
    try {
      const rootFolder = this.getRootFolder();
      const folders = rootFolder.getFolders();
      let totalSize = 0;
      let assetCount = 0;

      while (folders.hasNext()) {
        const folder = folders.next();
        const files = folder.getFiles();

        while (files.hasNext()) {
          const file = files.next();
          totalSize += file.getSize();
        }

        assetCount++;
      }

      return {
        totalSize: totalSize,
        assetCount: assetCount,
        totalSizeGB: (totalSize / (1024 * 1024 * 1024)).toFixed(2)
      };

    } catch(error) {
      Logger.log('計算庫統計錯誤: ' + error);
      return {
        totalSize: 0,
        assetCount: 0,
        totalSizeGB: 0
      };
    }
  },

  /**
   * 清理過期文件（可選功能）
   * 刪除指定天數前的文件
   * @param {number} daysOld - 天數
   * @returns {object} {success: bool, deletedCount: number}
   */
  cleanupOldFiles: function(daysOld = 30) {
    try {
      const rootFolder = this.getRootFolder();
      const folders = rootFolder.getFolders();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      let deletedCount = 0;

      while (folders.hasNext()) {
        const folder = folders.next();
        const files = folder.getFiles();

        while (files.hasNext()) {
          const file = files.next();
          
          // 檢查修改時間
          if (file.getLastUpdated() < cutoffDate) {
            file.setTrashed(true);
            deletedCount++;
          }
        }
      }

      return {
        success: true,
        deletedCount: deletedCount
      };

    } catch(error) {
      Logger.log('清理舊文件錯誤: ' + error);
      return {
        success: false,
        error: error.toString()
      };
    }
  },

  /**
   * 導出資產的照片為 ZIP 檔案（Google Drive 內建功能限制，需手動實現）
   * 這里只是提供一個框架
   */
  exportAssetPhotosAsZip: function(assetCode) {
    try {
      // 注意：Google Apps Script 沒有內建 ZIP 功能
      // 可以考慮使用外部 API 或手動下載
      const photos = this.getAssetPhotos(assetCode);
      
      return {
        success: true,
        message: '需要手動下載文件夾或使用外部工具',
        photos: photos
      };

    } catch(error) {
      Logger.log('導出錯誤: ' + error);
      return {
        success: false,
        error: error.toString()
      };
    }
  }
};
