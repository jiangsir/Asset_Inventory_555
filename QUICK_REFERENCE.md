## 📋 快速參考指南

### 項目完成情況清單 ✅

#### Phase 1: 基礎架構 ✅
- [x] HTML5 響應式頁面框架
- [x] CSS 主樣式表 + 響應式設計
- [x] PWA 配置 (manifest.json)
- [x] Service Worker 離線支持

#### Phase 2: 後端 API ✅
- [x] HTTP API 入口點 (API.gs)
- [x] Spreadsheet 管理模塊 (SheetManager.gs)
- [x] Google Drive 文件管理 (DriveManager.gs)
- [x] 錯誤處理和驗證

#### Phase 3: 前端邏輯 ✅
- [x] 應用初始化和協調 (app.js)
- [x] UI 管理和交互 (ui.js)
- [x] 本地數據管理 (data-manager.js)
- [x] API 封裝 (sheet-api.js)
- [x] 條碼掃描 (barcode-scanner.js)
- [x] 相機和拍照 (camera.js)

#### Phase 4: 文檔 ✅
- [x] 實現計劃 (IMPLEMENTATION_PLAN.md)
- [x] 部署指南 (DEPLOYMENT_GUIDE.md)
- [x] 項目 README (README.md)
- [x] 快速參考（本文件）

---

## 🎯 核心功能實現狀態

| 功能 | 文件 | 狀態 | 備註 |
|------|------|------|------|
| 條碼掃描 | barcode-scanner.js | ✅ | 完整實現 |
| 相機控制 | camera.js | ✅ | 含多種拍照模式 |
| 數據查詢 | SheetManager.gs | ✅ | 按編號/名稱搜索 |
| 字段編輯 | app.js, ui.js | ✅ | 6 個可編輯字段 |
| 照片上傳 | DriveManager.gs | ✅ | 自動壓縮優化 |
| 本地存儲 | data-manager.js | ✅ | IndexedDB 支持 |
| 離線模式 | service-worker.js | ✅ | 完全可用 |
| 數據遷移 | SheetManager.gs | ✅ | 智能匹配遷移 |

---

## 🔑 重要 API 端點

### GET 請求

```javascript
// 查詢單個財產
GET /api?action=getAsset&code=FAA001

// 搜索財產
GET /api?action=searchAssets&query=辦公&limit=10

// 獲取最近資產
GET /api?action=getRecentAssets&limit=20
```

### POST 請求

```javascript
// 更新財產
POST /api?action=updateAsset
{
  code: 'FAA001',
  location: '辦公室 302',
  remark: '正常',
  scrappable: '否',
  photos: [...]
}

// 上傳照片
POST /api?action=uploadPhoto
{
  code: 'FAA001',
  photoBase64: '...',
  photoName: 'photo_1.jpg'
}

// 刪除照片
POST /api?action=deletePhoto
{
  photoId: 'file_id_xxx'
}
```

---

## 💾 數據結構

### 財產對象 (Asset)
```javascript
{
  rowIndex: 2,              // Spreadsheet 行號
  code: 'FAA001',          // 編號
  name: '臺式電腦',        // 名稱
  purchaseDate: '2023-01', // 購置日期
  unit: '資訊室',          // 使用單位
  model: 'Dell OptiPlex',  // 廠牌型式
  quantity: 1,             // 數量
  unitPrice: 25000,        // 單價
  totalPrice: 25000,       // 總價
  lifespan: '5 年',        // 年限
  location: '辦公室 302',  // 存放地點
  remark: '正常使用',      // 備註
  scrappable: '否',        // 可否報廢
  photos: [                // 照片列表
    {
      id: 'file_id',
      name: 'photo_1.jpg',
      url: 'https://...',
      uploadDate: '2026-01-23',
      size: 2048000
    }
  ],
  editTime: '2026-01-23T10:30:00Z' // 編輯時間
}
```

### 照片對象 (Photo)
```javascript
{
  id: 'google_drive_file_id',
  name: 'photo_1.jpg',
  url: 'https://drive.google.com/...',
  downloadUrl: 'https://drive.google.com/...',
  uploadDate: '2026-01-23T10:30:00Z',
  size: 2048000,
  mimeType: 'image/jpeg'
}
```

---

## 🎨 UI 屏幕流程

```
┌─────────────────┐
│  掃描屏幕 (Scan) │
│ - 輸入編號      │
│ - 打開相機      │
│ - 最近查詢      │
└────────┬────────┘
         │ 查詢成功
         ▼
┌─────────────────┐
│ 詳情屏幕(Detail)│
│ - 只讀欄位      │
│ - 編輯表單      │
│ - 照片管理      │
│ - 保存/返回     │
└────────┬────────┘
         │ 編輯/返回
    ┌────┴────┐
    ▼         ▼
[返回掃描] [設置屏幕]
             - Spreadsheet ID
             - API URL
             - 設置保存
```

---

## 🔄 數據流

### 掃描到保存的完整流程

```
用戶輸入條碼
    ↓
app.queryAsset()
    ↓
sheetApi.getAsset() 
    ↓
[HTTP] → GAS API
    ↓
SheetManager.getAssetByCode()
    ↓
[查詢 Spreadsheet]
    ↓
返回資產數據 (JSON)
    ↓
ui.showAssetDetail()
    ↓
用戶編輯表單
    ↓
ui.saveAsset()
    ↓
app.saveAsset()
    ↓
sheetApi.updateAsset()
    ↓
[HTTP] → GAS API
    ↓
SheetManager.updateAsset()
    ↓
[寫入 Spreadsheet]
    ↓
dataManager.updateAsset()
    ↓
[保存到 IndexedDB]
    ↓
完成 ✅
```

---

## 🔧 配置項詳解

### 應用配置 (app.config)

```javascript
{
  gasUrl: '',              // Google Apps Script API URL
  sheetName: '財產列表',   // Spreadsheet 工作表名稱
  offlineMode: false,      // 是否使用離線模式
  photoLimit: 10,          // 照片上限 (0=無限)
  debug: false             // 是否顯示調試信息
}
```

---

## 📱 響應式斷點

```css
/* 手機 */
@media (max-width: 480px) {
  /* 單欄布局 */
}

/* 平板豎屏 */
@media (480px - 768px) {
  /* 兩欄布局 */
}

/* 平板橫屏/小桌面 */
@media (768px - 1024px) {
  /* 三欄布局 */
}

/* 桌面 */
@media (1024px+) {
  /* 寬屏優化 */
}
```

---

## 🎯 常用代碼片段

### 查詢資產
```javascript
app.queryAsset('FAA001');
```

### 顯示通知
```javascript
ui.showNotification('success', '標題', '消息內容');
// 類型: success, error, warning, info
```

### 打開相機
```javascript
camera.openCamera();
```

### 導出本地數據
```javascript
dataManager.exportLocalData();
```

### 清空本地數據
```javascript
dataManager.clearLocalData();
```

### 測試 API 連接
```javascript
await sheetApi.testConnection();
```

### 同步數據
```javascript
app.syncData();
```

---

## 🐛 調試技巧

### 啟用調試模式
```javascript
// 在設置中勾選「顯示調試信息」
// 或在控制台執行：
app.config.debug = true;
```

### 查看本地存儲
```javascript
// 獲取所有快取的資產
await dataManager.loadCachedData()

// 獲取最近查詢
await dataManager.getRecentAssets()

// 查看存儲統計
await dataManager.getStorageInfo()
```

### 查看 API 日誌
```javascript
// GAS 執行日誌
// Apps Script 編輯器 → Executions

// 瀏覽器網絡日誌
// F12 → Network → 查看請求
```

### 模擬離線
```javascript
// F12 → Network → 選擇 Offline
// 應用應仍可正常使用本地數據
```

---

## ✨ 使用技巧

### 1. 快速掃描工作流
```
1. 打開應用，焦點自動在輸入框
2. 掃描條碼（或手動輸入編號）
3. 按 Enter 查詢
4. 編輯信息和照片
5. 點擊保存
6. 重複下一個財產
```

### 2. 照片管理
```
• 一次拍多張：依次確認每張照片
• 刪除照片：點擊照片上的 ✕
• 批量上傳：不支持（逐張上傳）
• 離線模式：照片不可上傳（待網絡後同步）
```

### 3. 搜索優化
```
• 搜索編號：「FAA」會匹配「FAA001」等
• 搜索名稱：「臺式」會匹配「臺式電腦」
• 實時建議：輸入時自動顯示匹配項
• 最近查詢：快速重複查詢相同財產
```

### 4. 數據遷移
```
1. 準備舊表：名稱為 「財產列表 (舊註解)」
2. 運行 Code.gs 中的「執行：註解跟比對」
3. 舊表數據自動遷移到新表
4. 檢查「新增」和「已報廢」標籤
```

---

## ⚡ 性能優化建議

1. **縮小圖片**
   - 應用自動壓縮大於 1920×1080 的圖片
   - 手動選擇相冊照片時也會壓縮

2. **快取管理**
   - 定期清空本地快取以釋放空間
   - 自動保留最多 20 項最近查詢

3. **網絡優化**
   - 使用 WiFi 上傳大照片
   - 離線模式下本地編輯，聯網時同步

4. **使用建議**
   - 一次最多 10 張照片（默認限制）
   - 大量編輯時使用桌面電腦直接編輯 Sheet

---

## 🔗 快速鏈接

- **Spreadsheet**: [打開 Sheet](https://docs.google.com/spreadsheets/d/1DT_hQlOCNr7WN8gLysO3Y9WFB8hYYroeHWMRxTzprDs/)
- **應用首頁**: [打開應用](https://yourusername.github.io/Asset_Inventory_555/)
- **實現計劃**: [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)
- **部署指南**: [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)
- **項目主頁**: [README.md](README.md)

---

*快速參考 - 最後更新: 2026-01-23*
