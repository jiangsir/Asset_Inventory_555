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

    const normalized = this.normalizeBarcode(code);

    const input = document.getElementById('assetCodeInput');
    if (input) {
      input.value = normalized;
    }

    // 查詢財產
    app.queryAsset(normalized);
  },

  normalizeBarcode: function(code) {
    const trimmed = String(code).trim();
    if (/^\d{14}$/.test(trimmed)) {
      return `${trimmed.slice(0, 9)}-${trimmed.slice(9)}`;
    }
    return trimmed;
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
      const photoBase64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
      this.capturedPhoto = photoBase64;

      // 顯示預覽
      this.showPhotoPreview(canvas.toDataURL('image/jpeg', 0.8));

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
   * 顯示照片預覽
   */
  showPhotoPreview: function(photoDataUrl) {
    const modal = document.getElementById('photoModal');
    const preview = document.getElementById('photoPreview');

    preview.src = photoDataUrl;
    modal.style.display = 'flex';
  },

  /**
   * 確認照片
   */
  confirmPhoto: async function() {
    if (!this.capturedPhoto || !ui.currentAsset) {
      ui.showNotification('error', '錯誤', '缺少必需信息');
      return;
    }

    // 關閉預覽
    this.closePhotoPreview();

    // 關閉相機
    this.closeCamera();

    // 上傳照片
    ui.showLoading('正在上傳照片...');

    try {
      const result = await sheetApi.uploadPhoto({
        code: ui.currentAsset.code,
        photoBase64: this.capturedPhoto
      });

      if (result.success) {
        // 添加到當前資產的照片列表
        if (!ui.currentAsset.photos) {
          ui.currentAsset.photos = [];
        }

        ui.currentAsset.photos.push(result.photo);

        // 更新 UI
        ui.displayPhotos(ui.currentAsset.photos);
        ui.showNotification('success', '上傳成功', '照片已保存');
      } else {
        ui.showNotification('error', '上傳失敗', result.error);
      }
    } catch (error) {
      console.error('上傳錯誤:', error);
      ui.showNotification('error', '錯誤', error.message);
    } finally {
      ui.hideLoading();
      this.capturedPhoto = null;
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
        const photoBase64 = result.split(',')[1];

        this.capturedPhoto = photoBase64;
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
