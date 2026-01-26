/**
 * 財產盤點系統 555 - 條碼掃描模塊
 * 處理條碼掃描功能
 */

const scanner = {

  /**
   * 初始化掃描器
   */
  init: function() {
    console.log('條碼掃描器初始化');
    // 檢查設備支持
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.warn('當前設備不支持相機訪問');
    }
  },

  /**
   * 打開相機進行掃描
   */
  openCamera: function() {
    camera.openCamera();
  },

  /**
   * 處理掃描到的條碼
   */
  processBarcode: function(code) {
    // 可以在此添加條碼格式驗證
    code = String(code).trim();

    if (!code) {
      ui.showNotification('warning', '掃描失敗', '未識別到條碼');
      return;
    }

    const input = document.getElementById('assetCodeInput');
    if (input) {
      input.value = code;
    }

    app.queryAsset(code);
  },

  /**
   * 驗證條碼格式（可擴展）
   */
  validateBarcode: function(code) {
    // 例如：檢查長度、前綴等
    return code && code.length > 0;
  }
};

/**
 * 財產盤點系統 555 - 相機和拍照模塊
 * 處理拍照和圖片上傳
 */

const camera = {

  currentStream: null,
  capturedPhoto: null,
  barcodeDetector: null,
  scannerFrameId: null,
  detectorCanvas: null,

  /**
   * 初始化相機
   */
  init: function() {
    console.log('相機模塊初始化');
    this.setupBarcodeDetector();
  },

  setupBarcodeDetector: function() {
    if (!('BarcodeDetector' in window)) {
      console.warn('當前瀏覽器不支援 BarcodeDetector；請使用支援的瀏覽器或設備');
      this.barcodeDetector = null;
      return;
    }

    try {
      this.barcodeDetector = new BarcodeDetector({
        formats: [
          'ean_13',
          'ean_8',
          'upc_a',
          'upc_e',
          'code_128',
          'code_39',
          'code_93',
          'codabar',
          'itf',
          'qr_code'
        ]
      });
    } catch (error) {
      console.warn('BarcodeDetector 初始化失敗，暫時無法使用掃描功能', error);
      this.barcodeDetector = null;
    }
  },

  /**
   * 打開相機
   */
  openCamera: async function() {
    const modal = document.getElementById('cameraModal');

    try {
      // 請求相機權限
      const constraints = {
        video: {
          facingMode: { ideal: 'environment' }, // 優先使用後置相機
          width: { max: 1920 },
          height: { max: 1080 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.currentStream = stream;

      // 顯示相機界面
      modal.style.display = 'flex';

      const video = document.getElementById('videoPreview');
      video.srcObject = stream;
      video.play();

      video.addEventListener('loadedmetadata', () => {
        this.startBarcodeDetection(video);
      });

    } catch (error) {
      console.error('相機訪問失敗:', error);

      if (error.name === 'NotAllowedError') {
        ui.showNotification('error', '權限被拒絕', '請允許應用訪問相機');
      } else if (error.name === 'NotFoundError') {
        ui.showNotification('error', '未找到相機', '您的設備可能沒有相機');
      } else {
        ui.showNotification('error', '相機錯誤', error.message);
      }
    }
  },

  /**
   * 關閉相機
   */
  closeCamera: function() {
    if (this.currentStream) {
      this.currentStream.getTracks().forEach(track => track.stop());
      this.currentStream = null;
    }

    this.stopBarcodeDetection();

    const modal = document.getElementById('cameraModal');
    modal.style.display = 'none';
  },

  /**
   * 拍照
   */
  takePhoto: function() {
    const video = document.getElementById('videoPreview');

    if (!video || !video.srcObject) {
      ui.showNotification('error', '錯誤', '相機未初始化');
      return;
    }

    try {
      // 創建 canvas 捕獲視頻幀
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);

      // 轉換為 Base64
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      const photoBase64 = dataUrl.split(',')[1];
      this.capturedPhoto = photoBase64;
      // mirror to camera module and global for robustness
      try { if (window.camera) window.camera.capturedPhoto = photoBase64; } catch(e){}
      window.__lastCapturedPhoto = photoBase64;
      console.log('[takePhoto] capturedPhoto length=', photoBase64.length);

      // 顯示預覽
      this.showPhotoPreview(dataUrl);

    } catch (error) {
      console.error('拍照失敗:', error);
      ui.showNotification('error', '拍照失敗', error.message);
    }
  },

  startBarcodeDetection: function(video) {
    if (!this.barcodeDetector || !video) return;
    this.stopBarcodeDetection();

    if (!this.detectorCanvas) {
      this.detectorCanvas = document.createElement('canvas');
    }

    const canvas = this.detectorCanvas;
    const ctx = canvas.getContext('2d');

    const detectFrame = async () => {
      if (!video || video.readyState !== 4) {
        this.scannerFrameId = requestAnimationFrame(detectFrame);
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      try {
        const barcodes = await this.barcodeDetector.detect(canvas);
        if (barcodes.length) {
          const code = barcodes[0].rawValue;
          this.stopBarcodeDetection();
          this.closeCamera();
          scanner.processBarcode(code);
          return;
        }
      } catch (error) {
        console.error('條碼偵測失敗:', error);
      }

      this.scannerFrameId = requestAnimationFrame(detectFrame);
    };

    this.scannerFrameId = requestAnimationFrame(detectFrame);
  },

  stopBarcodeDetection: function() {
    if (this.scannerFrameId) {
      cancelAnimationFrame(this.scannerFrameId);
      this.scannerFrameId = null;
    }
  },

  /**
   * 顯示照片預覽（若是 data:URI，會嘗試抽出 base64 並保存到 capturedPhoto）
   */
  showPhotoPreview: function(photoDataUrl) {
    const modal = document.getElementById('photoModal');
    const preview = document.getElementById('photoPreview');
    const confirmBtn = document.getElementById('photoConfirmBtn');

    // 嘗試從 data:URI 提取 base64 並保存到 this.capturedPhoto（若尚未設定）
    try {
      if ((!this.capturedPhoto || this.capturedPhoto.length === 0) && typeof photoDataUrl === 'string' && photoDataUrl.indexOf('data:') === 0) {
        const parts = photoDataUrl.split(',');
        if (parts.length > 1) {
          this.capturedPhoto = parts[1];
          console.log('[showPhotoPreview] extracted base64 into capturedPhoto, len=', this.capturedPhoto.length);
        }
      }
    } catch (e) {
      console.warn('[showPhotoPreview] failed to extract base64 from data URI', e);
    }

    // 先禁用確認按鈕，等圖片真正載入後啟用
    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.setAttribute('aria-disabled', 'true');
    }

    preview.onload = () => {
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.removeAttribute('aria-disabled');
      }
    };
    preview.onerror = () => {
      if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.setAttribute('aria-disabled', 'true');
      }
    };

    preview.src = photoDataUrl;
    modal.style.display = 'flex';
  },


  /**
   * 輔助：把遠端圖片下載並轉為 base64 (data URI 的 base64 部分)
   */
  fetchImageAsBase64: async function(url) {
    if (!url) throw new Error('missing url');
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) throw new Error('fetch failed: ' + res.status);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('FileReader failed'));
      reader.onload = () => {
        const dataUrl = reader.result;
        const parts = String(dataUrl).split(',');
        if (parts.length > 1) resolve(parts[1]);
        else reject(new Error('invalid dataUrl'));
      };
      reader.readAsDataURL(blob);
    });
  },

  /**
   * 確認照片
   */
  confirmPhoto: async function() {
    // 防止重複送出：disable Confirm 按鈕（會在失敗路徑解除）
    const confirmBtn = document.getElementById('confirmPhotoBtn');
    if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.setAttribute('aria-disabled', 'true'); }

    // 如果 this.capturedPhoto 缺失，嘗試多處補救來源（camera 模組、preview 元素、ui.currentAsset.photos）
    if (!this.capturedPhoto) {
      console.log('[confirmPhoto] capturedPhoto missing — attempting fallbacks');
      // 1) camera module
      if (window.camera && window.camera.capturedPhoto) {
        this.capturedPhoto = window.camera.capturedPhoto;
        console.log('[confirmPhoto] recovered from window.camera.capturedPhoto, len=', this.capturedPhoto && this.capturedPhoto.length);
      }

      // 2) ui.currentAsset.photos - may be object {url:...} or string
      if ((!this.capturedPhoto || (typeof this.capturedPhoto === 'string' && this.capturedPhoto.length === 0)) && ui && ui.currentAsset && ui.currentAsset.photos && ui.currentAsset.photos[0]) {
        const first = ui.currentAsset.photos[0];
        if (typeof first === 'object' && first.url) {
          try {
            this.capturedPhoto = await this.fetchImageAsBase64(first.url);
            console.log('[confirmPhoto] fetched base64 from ui.currentAsset.photos[0].url, len=', this.capturedPhoto && this.capturedPhoto.length);
          } catch (e) {
            console.warn('[confirmPhoto] failed to fetch image from url fallback:', e);
          }
        } else if (typeof first === 'string') {
          if (first.indexOf('data:') === 0) {
            const parts = first.split(',');
            if (parts.length > 1) this.capturedPhoto = parts[1];
          } else if (first.indexOf('http') === 0) {
            try {
              this.capturedPhoto = await this.fetchImageAsBase64(first);
            } catch (e) {
              console.warn('[confirmPhoto] failed to fetch image from string URL fallback:', e);
            }
          } else {
            this.capturedPhoto = first;
          }
          console.log('[confirmPhoto] recovered from ui.currentAsset.photos[0], type=', typeof first, 'len=', this.capturedPhoto && this.capturedPhoto.length);
        }
      }

      // 3) preview <img> (data: URI)
      if ((!this.capturedPhoto || (typeof this.capturedPhoto === 'string' && this.capturedPhoto.length === 0))) {
        const preview = document.getElementById('photoPreview');
        if (preview && preview.src && typeof preview.src === 'string' && preview.src.indexOf('data:') === 0) {
          const parts = preview.src.split(',');
          if (parts.length > 1) {
            this.capturedPhoto = parts[1];
            console.log('[confirmPhoto] recovered from preview.src data URI, len=', this.capturedPhoto.length);
          }
        }
      }
    }

    if (!this.capturedPhoto || !ui.currentAsset) {
      if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.removeAttribute('aria-disabled'); }
      ui.showNotification('error', '錯誤', '缺少必需信息（請重新拍照或選擇照片）');
      return;
    }

    // 驗證 capturedPhoto 類型 — 必須是 base64 字串
    if (typeof this.capturedPhoto !== 'string') {
      ui.showNotification('error', '上傳失敗', '取得的照片格式不支援（需 base64 或 data:URI），請重新拍照或選擇照片');
      console.error('[confirmPhoto] capturedPhoto is not a string:', this.capturedPhoto);
      return;
    }

    // 關閉相機（保留預覽直到上傳結束）
    this.closeCamera();

    // 上傳照片
    ui.showLoading('正在上傳照片...');

    let uploadSucceeded = false;
    try {
      // 先 log 以便排查 capturedPhoto 在呼叫時是否存在或已被覆蓋
      console.log('[confirmPhoto] capturedPhoto present?', !!this.capturedPhoto, 'length=', this.capturedPhoto ? this.capturedPhoto.length : 0);
      console.log('[confirmPhoto] ui.currentAsset.code=', ui && ui.currentAsset ? ui.currentAsset.code : 'NO_ASSET');

      // 使用 app.uploadPhoto（支援 progress callback 與分片上傳）
      const result = await app.uploadPhoto(this.capturedPhoto, 'photo.jpg', (percent, idx, total) => {
        console.log(`upload progress: ${percent}% (${idx+1}/${total})`);
      });

      if (result && result.success) {
        uploadSucceeded = true;
        // 添加到當前資產的照片列表（放最前面以便即時看到）
        if (!ui.currentAsset.photos) ui.currentAsset.photos = [];
        ui.currentAsset.photos.unshift(result.photo);

        // 關閉預覽視窗並清除暫存（使用者期望畫面消失）
        try { this.closePhotoPreview(); } catch (e) { /* ignore */ }

        // 更新 UI
        ui.displayPhotos(ui.currentAsset.photos);

        // 顯示成功或部分成功訊息
        if (result.warning) {
          ui.showNotification('warning', '上傳部分完成', result.warning);
        } else {
          ui.showNotification('success', '上傳成功', '照片已保存');
        }
      } else {
        // 若失敗，保留預覽並允許重新按下 Confirm
        if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.removeAttribute('aria-disabled'); }
        ui.showNotification('error', '上傳失敗', (result && result.error) || '未知錯誤');
      }
    } catch (error) {
      console.error('上傳錯誤:', error);
      if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.removeAttribute('aria-disabled'); }
      ui.showNotification('error', '錯誤', error && error.message ? error.message : String(error));
    } finally {
      ui.hideLoading();
      // 只有在上傳成功時才清除 capturedPhoto（closePhotoPreview 已處理）
      if (!uploadSucceeded) {
        // 保留 this.capturedPhoto 以利使用者重試或檢查預覽
      } else {
        this.capturedPhoto = null;
      }
    }
  },

  /**
   * 取消照片
   */
  cancelPhoto: function() {
    this.closePhotoPreview();
    // 重新打開相機
    this.openCamera();
  },

  /**
   * 關閉照片預覽
   */
  closePhotoPreview: function() {
    const modal = document.getElementById('photoModal');
    modal.style.display = 'none';
    this.capturedPhoto = null;
  },

  /**
   * 添加照片（從相機或相冊）
   */
  addPhoto: async function() {
    // 顯示選擇菜單
    const choice = confirm('選擇照片源：\n確定 = 使用相機拍照\n取消 = 從相冊選擇');

    if (choice) {
      // 拍照
      this.openCamera();
    } else {
      // 從相冊選擇
      this.selectFromGallery();
    }
  },

  /**
   * 從相冊選擇照片
   */
  selectFromGallery: function() {
    // 創建隱藏的文件輸入
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = false;

    input.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      // 檢查文件大小（限制為 5MB）
      if (file.size > 5 * 1024 * 1024) {
        ui.showNotification('error', '文件過大', '請選擇小於 5MB 的圖片');
        return;
      }

      // 讀取文件
      const reader = new FileReader();

      reader.onload = async (event) => {
        const result = event.target.result;
        const parts = result.split(',');
        const photoBase64 = parts.length > 1 ? parts[1] : '';
        this.capturedPhoto = photoBase64;
        try { if (window.camera) window.camera.capturedPhoto = photoBase64; } catch(e){}
        window.__lastCapturedPhoto = photoBase64;
        console.log('[selectFromGallery] capturedPhoto length=', photoBase64.length);
        this.showPhotoPreview(result);
      };

      reader.onerror = () => {
        ui.showNotification('error', '讀取失敗', '無法讀取圖片文件');
      };

      reader.readAsDataURL(file);
    });

    // 觸發文件選擇對話框
    input.click();
  }
};
