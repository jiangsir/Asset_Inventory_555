/**
 * 財產盤點系統 555 - 相機模塊 (擴展)
 * 此文件作為 barcode-scanner.js 中 camera 對象的補充
 * 提供更多相機和圖片處理功能
 */

// 相機模塊的擴展功能
Object.assign(camera, {

  /**
   * 圖片壓縮函數
   */
  compressImage: function(base64, maxWidth = 1920, maxHeight = 1080, quality = 0.7) {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64;

      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // 計算新尺寸
        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // 轉換為 Base64
        const compressed = canvas.toDataURL('image/jpeg', quality).split(',')[1];
        resolve(compressed);
      };
    });
  },

  /**
   * 獲取圖片尺寸
   */
  getImageDimensions: function(base64) {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64;

      img.onload = () => {
        resolve({
          width: img.width,
          height: img.height
        });
      };

      img.onerror = () => {
        resolve(null);
      };
    });
  },

  /**
   * 驗證照片格式和大小
   */
  validatePhoto: function(base64, maxSize = 5 * 1024 * 1024) {
    try {
      // 估算大小（Base64 會比二進制大約 33%）
      const estimatedSize = (base64.length * 3) / 4;

      if (estimatedSize > maxSize) {
        return {
          valid: false,
          error: `文件過大: ${(estimatedSize / 1024 / 1024).toFixed(2)}MB，限制: ${(maxSize / 1024 / 1024).toFixed(2)}MB`
        };
      }

      return { valid: true };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  },

  /**
   * 旋轉圖片（用於糾正方向）
   */
  rotateImage: function(base64, angle = 90) {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64;

      img.onload = () => {
        const canvas = document.createElement('canvas');

        if (angle === 90 || angle === 270) {
          canvas.width = img.height;
          canvas.height = img.width;
        } else {
          canvas.width = img.width;
          canvas.height = img.height;
        }

        const ctx = canvas.getContext('2d');
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((angle * Math.PI) / 180);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);

        const rotated = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
        resolve(rotated);
      };
    });
  },

  /**
   * 獲取相機權限狀態
   */
  getCameraPermission: async function() {
    try {
      const result = await navigator.permissions.query({ name: 'camera' });
      return result.state;
    } catch (error) {
      return 'unknown';
    }
  },

  /**
   * 列出所有可用相機設備
   */
  enumerateDevices: async function() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter(device => device.kind === 'videoinput');
      return cameras;
    } catch (error) {
      console.error('列舉設備失敗:', error);
      return [];
    }
  },

  /**
   * 使用特定相機打開
   */
  openCameraWithDevice: async function(deviceId) {
    try {
      const constraints = {
        video: {
          deviceId: { exact: deviceId },
          facingMode: 'environment',
          width: { max: 1920 },
          height: { max: 1080 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.currentStream = stream;

      const modal = document.getElementById('cameraModal');
      modal.style.display = 'flex';

      const video = document.getElementById('videoPreview');
      video.srcObject = stream;
      video.play();

    } catch (error) {
      console.error('打開指定相機失敗:', error);
      ui.showNotification('error', '相機錯誤', error.message);
    }
  },

  /**
   * 連續掃描模式（用於條碼掃描）
   */
  enableContinuousScan: function(onScan) {
    if (!this.currentStream) {
      ui.showNotification('error', '相機未打開', '請先打開相機');
      return;
    }

    const video = document.getElementById('videoPreview');
    const canvas = document.createElement('canvas');

    const scanLoop = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);

      // 這裡可以調用條碼掃描庫（如 Quagga）
      // 示例：Quagga.decodeSingle({...}, onScan);

      requestAnimationFrame(scanLoop);
    };

    scanLoop();
  },

  /**
   * 手電筒控制（如果支持）
   */
  toggleFlashlight: async function(enable = true) {
    try {
      if (!this.currentStream) {
        return false;
      }

      const videoTrack = this.currentStream.getVideoTracks()[0];

      if (!videoTrack) {
        return false;
      }

      const capabilities = videoTrack.getCapabilities();

      if (!capabilities.torch) {
        console.warn('設備不支持手電筒');
        return false;
      }

      await videoTrack.applyConstraints({
        advanced: [{ torch: enable }]
      });

      return true;
    } catch (error) {
      console.error('手電筒控制失敗:', error);
      return false;
    }
  },

  /**
   * 焦點自動調整
   */
  enableAutoFocus: async function() {
    try {
      if (!this.currentStream) {
        return false;
      }

      const videoTrack = this.currentStream.getVideoTracks()[0];
      const capabilities = videoTrack.getCapabilities();

      if (!capabilities.focusMode) {
        return false;
      }

      await videoTrack.applyConstraints({
        advanced: [{ focusMode: ['auto'] }]
      });

      return true;
    } catch (error) {
      console.error('自動焦點設置失敗:', error);
      return false;
    }
  },

  /**
   * 創建圖片縮略圖
   */
  createThumbnail: function(base64, width = 200, height = 200) {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64;

      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');

        // 保持寬高比並居中
        const scale = Math.min(width / img.width, height / img.height);
        const x = (width - img.width * scale) / 2;
        const y = (height - img.height * scale) / 2;

        ctx.fillStyle = '#F5F5F5';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, x, y, img.width * scale, img.height * scale);

        const thumbnail = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
        resolve(thumbnail);
      };
    });
  },

  /**
   * 提取圖片元數據（使用 Canvas）
   */
  extractImageMetadata: async function(base64) {
    const dimensions = await this.getImageDimensions(base64);
    const size = (base64.length * 3) / 4;

    return {
      dimensions: dimensions,
      size: size,
      sizeInMB: (size / 1024 / 1024).toFixed(2),
      uploadTime: new Date().toISOString(),
      quality: 'good'
    };
  },

  /**
   * 拍多張照片的連拍模式
   */
  burst: async function(count = 3, interval = 500) {
    const photos = [];

    for (let i = 0; i < count; i++) {
      this.takePhoto();

      // 等待用戶確認或自動保存
      await new Promise(resolve => setTimeout(resolve, interval));

      if (this.capturedPhoto) {
        photos.push(this.capturedPhoto);
      }
    }

    return photos;
  }
});
