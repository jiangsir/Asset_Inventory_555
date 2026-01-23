# 財產盤點系統 555 - 部署和配置指南

## 📋 目錄

1. [快速開始](#快速開始)
2. [環境要求](#環境要求)
3. [Google Apps Script 部署](#google-apps-script-部署)
4. [GitHub Pages 部署](#github-pages-部署)
5. [配置步驟](#配置步驟)
6. [使用指南](#使用指南)
7. [常見問題](#常見問題)
8. [故障排查](#故障排查)

---

## 快速開始

### 1️⃣ 準備工作

```bash
# 克隆或下載項目
git clone https://github.com/yourusername/Asset_Inventory_555.git
cd Asset_Inventory_555
```

### 2️⃣ Google Apps Script 部署

1. 打開 Google Spreadsheet：
   - https://docs.google.com/spreadsheets/d/1DT_hQlOCNr7WN8gLysO3Y9WFB8hYYroeHWMRxTzprDs/edit

2. 進入 **Extensions** → **Apps Script**

3. 複製本項目 `backend/` 中的所有 `.gs` 文件內容到 GAS 編輯器

4. 部署為網頁應用：
   - 點擊 **Deploy** → **New deployment**
   - 選擇 **Type**: Web app
   - 設置 **Execute as**: 你的 Google 賬號
   - 設置 **Who has access**: Anyone
   - 點擊 **Deploy**

5. 複製部署 URL（形式：`https://script.google.com/macros/d/{SCRIPT_ID}/usercopy`）

### 3️⃣ GitHub Pages 部署

```bash
# 推送項目到 GitHub
git push origin main

# 在 GitHub 倉庫設置中
# Settings → Pages → Source: main branch /docs folder
```

前端將自動部署到：`https://yourusername.github.io/Asset_Inventory_555/`

### 4️⃣ 配置應用

1. 在 Web 應用中打開設置 ⚙️
2. 填寫以下信息：
   - **Spreadsheet ID**: `1DT_hQlOCNr7WN8gLysO3Y9WFB8hYYroeHWMRxTzprDs`
   - **API URL**: (粘貼步驟 2 中的部署 URL)
3. 點擊 **保存設置**

---

## 環境要求

### 客戶端要求
- ✅ 現代 Web 瀏覽器（Chrome, Safari, Firefox）
- ✅ 支持 WebGL 的設備（用於條碼掃描）
- ✅ 訪問相機和文件存儲的權限

### 服務器要求
- ✅ Google 賬號（用於 Spreadsheet 和 Drive）
- ✅ GitHub 賬號（用於託管前端）
- ✅ Google Spreadsheet 編輯權限
- ✅ Google Drive 存儲空間（用於照片）

---

## Google Apps Script 部署

### 詳細步驟

#### 步驟 1: 訪問 Apps Script

```
1. 打開 Spreadsheet
2. 點擊 Extensions → Apps Script
3. 這會打開 Google Apps Script 編輯器
```

#### 步驟 2: 複製代碼

在 GAS 編輯器中：

1. **刪除默認代碼**（如果有）

2. **創建新文件**：
   - Code.gs (保留原有代碼，添加新內容)
   - API.gs
   - SheetManager.gs
   - DriveManager.gs

3. **複製文件內容**：
   - 從本項目 `backend/` 文件夾複製每個文件的內容

#### 步驟 3: 設置權限

```javascript
// 在任何函數上右鍵 → Run
// 選擇一個簡單函數，系統會要求授予權限
// 同意所有請求
```

#### 步驟 4: 部署

```
1. 點擊 Deploy 按鈕 (▼)
2. 選擇 New deployment
3. 選擇 Type: Web app
4. 設置：
   - Execute as: [你的 Google 賬號]
   - Who has access: Anyone
5. 點擊 Deploy
6. 複製生成的 URL
```

#### 步驟 5: 驗證部署

在瀏覽器測試 API URL：
```
https://script.google.com/macros/d/{SCRIPT_ID}/usercopy?action=getRecentAssets&limit=1
```

應該返回類似：
```json
{
  "success": true,
  "assets": [...]
}
```

---

## GitHub Pages 部署

### 詳細步驟

#### 步驟 1: 創建 GitHub 倉庫

```bash
# 如果還沒有倉庫
git init
git add .
git commit -m "Initial commit: Asset Inventory System 555"
git branch -M main
git remote add origin https://github.com/yourusername/Asset_Inventory_555.git
git push -u origin main
```

#### 步驟 2: 啟用 GitHub Pages

1. 進入倉庫 **Settings**
2. 滾動到 **Pages** 部分
3. 設置：
   - **Source**: Deploy from a branch
   - **Branch**: main
   - **Folder**: /docs
4. 點擊 **Save**

#### 步驟 3: 驗證部署

- 檢查 Actions 選項卡，確保部署成功
- 訪問 `https://yourusername.github.io/Asset_Inventory_555/`

---

## 配置步驟

### 步驟 1: 配置 Spreadsheet

打開 Google Sheet，確保列結構如下：

| 欄 | 名稱 | 欄 | 名稱 |
|----|------|----|----|
| A | 購置日期 | J | 存放地點 |
| B | 財產編號 | K | 備註 |
| C | 財產名稱 | L | 可否報廢 |
| D | 年限 | M | 實物照片 (JSON) |
| E | 使用單位 | N | 編輯時間 |
| F | 型式廠牌 | | |
| G | 數量 | | |
| H | 單價 | | |
| I | 總價 | | |

### 步驟 2: 配置應用設置

1. 打開應用 URL
2. 點擊右上角 ⚙️ **設置**
3. 填寫以下內容：

**Spreadsheet 設置**
- **Spreadsheet ID**: `1DT_hQlOCNr7WN8gLysO3Y9WFB8hYYroeHWMRxTzprDs`
- **工作表名稱**: `財產列表`

**應用設置**
- ☑️ 啟用離線模式（可選）
- ☑️ 顯示調試信息（可選）
- **照片上限**: 10 張（或 0 = 無限制）

4. 點擊 **保存設置**

### 步驟 3: 測試連接

1. 在設置界面中，測試 API 連接
2. 應該看到 "連接成功" 消息

---

## 使用指南

### 基本工作流

#### 1. 掃描條碼

```
1. 打開應用首頁
2. 點擊 "📷 打開相機" 或直接輸入編號
3. 掃描財產標籤上的條碼
4. 應用會自動查詢該財產的信息
```

#### 2. 查看詳情

```
查詢後，應用顯示：
- 只讀欄位：編號、名稱、單位、廠牌等
- 可編輯欄位：存放地點、備註、可否報廢、照片
```

#### 3. 編輯和保存

```
1. 修改可編輯欄位
2. 點擊 "💾 保存" 按鈕
3. 等待同步確認
```

#### 4. 上傳照片

```
1. 在詳情界面點擊 "➕ 添加照片"
2. 選擇：
   - 拍照：使用設備相機
   - 相冊：選擇已存在的圖片
3. 確認上傳
```

#### 5. 搜索功能

```
- 按編號搜索：輸入財產編號
- 按名稱搜索：輸入財產名稱的部分文字
- 實時建議：輸入時會顯示匹配結果
```

---

## 常見問題

### Q1: API 連接失敗

**可能原因：**
- API URL 配置錯誤
- GAS 部署未完成或已過期

**解決方案：**
1. 重新檢查 API URL 是否正確
2. 重新部署 GAS：
   - 打開 Spreadsheet
   - Extensions → Apps Script
   - 點擊 Deploy → Deploy 新版本
3. 複製新的 URL

### Q2: 相機不工作

**可能原因：**
- 瀏覽器未授予相機權限
- 設備沒有相機

**解決方案：**
1. 檢查瀏覽器設置中的權限
2. 嘗試 HTTPS 連接（HTTP 不支持相機）
3. 使用其他瀏覽器測試

### Q3: 照片無法上傳

**可能原因：**
- Google Drive 空間不足
- 照片格式不支持
- 網絡中斷

**解決方案：**
1. 檢查 Google Drive 可用空間
2. 確保上傳的是 JPG/PNG 格式
3. 檢查網絡連接
4. 查看瀏覽器控制台錯誤信息

### Q4: 數據遷移失敗

**可能原因：**
- 舊表名稱不正確
- 編號格式不匹配

**解決方案：**
1. 確保舊表名稱為：`[當前表名] (舊註解)`
2. 確保編號格式一致
3. 查看 Spreadsheet 的編輯歷史

### Q5: 離線模式無法使用

**可能原因：**
- Service Worker 未註冊
- 瀏覽器不支持

**解決方案：**
1. 使用最新版瀏覽器
2. 確保使用 HTTPS
3. 打開瀏覽器開發者工具 → Application → Service Workers 檢查

---

## 故障排查

### 檢查清單

- [ ] Spreadsheet 可訪問並有數據
- [ ] GAS 代碼已部署
- [ ] GitHub Pages 已啟用
- [ ] API URL 正確配置
- [ ] 瀏覽器允許相機訪問
- [ ] 網絡連接正常
- [ ] Google Drive 有可用空間

### 調試方法

#### 打開調試信息

1. 進入設置 ⚙️
2. ☑️ 顯示調試信息
3. 打開瀏覽器開發者工具 (F12)
4. 查看 Console 標籤的錯誤信息

#### 檢查 API 調用

```javascript
// 在 Console 中執行
await sheetApi.testConnection();
```

#### 查看本地存儲

```javascript
// 在 Console 中執行
await dataManager.loadCachedData().then(data => console.log(data));
```

### 聯繫支持

如果問題持續存在：
1. 檢查 GitHub Issues
2. 查看 GAS 執行日誌：
   - Apps Script 編輯器 → Executions
3. 提供錯誤截圖和控制台日誌

---

## 更新和維護

### 更新前端

```bash
# 編輯文件
# ...

# 提交並推送
git add .
git commit -m "Update: [描述變更]"
git push origin main

# GitHub Pages 會自動部署
```

### 更新後端 (GAS)

```
1. 打開 Spreadsheet
2. Extensions → Apps Script
3. 修改代碼
4. Deploy → 新的部署版本
5. 複製新的 URL 並在應用設置中更新
```

### 備份數據

```javascript
// 在應用中導出數據
// 設置 → 數據管理 → 導出本地數據
```

---

## 性能優化建議

1. **圖片優化**
   - 上傳前自動壓縮
   - 限制單張圖片大小

2. **網絡優化**
   - 使用本地快取
   - 離線模式支持

3. **數據庫優化**
   - 定期清理舊數據
   - 索引常用搜索字段

---

## 安全建議

1. ✅ 使用 HTTPS（GitHub Pages 自動）
2. ✅ 限制 GAS API 的誰有訪問權限
3. ✅ 定期備份 Spreadsheet 數據
4. ✅ 監控 Google Drive 存儲使用

---

*最後更新：2026-01-23*
