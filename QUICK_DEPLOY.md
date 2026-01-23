## 🚀 快速部署清單 (15 分鐘完成)

### 前置條件檢查 ✅

- [ ] 有 Google 賬號
- [ ] 有 GitHub 賬號  
- [ ] 訪問 Spreadsheet: https://docs.google.com/spreadsheets/d/1DT_hQlOCNr7WN8gLysO3Y9WFB8hYYroeHWMRxTzprDs/
- [ ] 已下載/克隆本項目文件

---

### 第一步：部署 Google Apps Script (3 分鐘) 📝

#### 1.1 打開 Apps Script 編輯器
```
1. 打開 Spreadsheet
2. 點擊 Extensions (擴充功能)
3. 選擇 Apps Script
```

#### 1.2 複製代碼文件

刪除默認代碼，然後按順序創建和複製：

**新建 4 個文件：**
- [ ] API.gs (複製 backend/API.gs 的內容)
- [ ] SheetManager.gs (複製 backend/SheetManager.gs 的內容)
- [ ] DriveManager.gs (複製 backend/DriveManager.gs 的內容)  
- [ ] Code.gs (保留原有內容)

#### 1.3 授予權限

```
選擇任一函數 → 右鍵 → Run
同意所有權限請求
```

#### 1.4 部署

```
1. 點擊 Deploy (▼)
2. 選擇 New deployment
3. Type: Web app
4. Execute as: [你的 Google 賬號]
5. Who has access: Anyone
6. Deploy

✅ 複製並保存生成的 URL
格式: https://script.google.com/macros/d/{SCRIPT_ID}/usercopy
```

---

### 第二步：部署到 GitHub Pages (3 分鐘) 🌐

#### 2.1 創建 GitHub 倉庫

```bash
# 進入項目目錄
cd Asset_Inventory_555

# 初始化 Git
git init
git add .
git commit -m "Initial commit: Asset Inventory System 555"
git branch -M main

# 添加遠程倉庫（替換成你的）
git remote add origin https://github.com/yourusername/Asset_Inventory_555.git

# 推送到 GitHub
git push -u origin main
```

#### 2.2 啟用 GitHub Pages

```
1. 進入倉庫 Settings
2. 滾動到 Pages
3. Source: main branch
4. Folder: /docs
5. Save

✅ 等待部署完成 (通常 1-2 分鐘)
訪問: https://yourusername.github.io/Asset_Inventory_555/
```

---

### 第三步：配置應用 (2 分鐘) ⚙️

#### 3.1 打開應用

訪問：https://yourusername.github.io/Asset_Inventory_555/

#### 3.2 進入設置

```
1. 點擊右上角 ⚙️ 設置
2. 找到「Spreadsheet 設置」部分
```

#### 3.3 填寫配置

**填寫以下內容：**

```
Spreadsheet ID: 
1DT_hQlOCNr7WN8gLysO3Y9WFB8hYYroeHWMRxTzprDs

API URL:
[粘貼第一步中保存的 GAS 部署 URL]

工作表名稱:
財產列表
```

**可選設置：**

```
☐ 啟用離線模式 (可勾選)
☐ 顯示調試信息 (不需要)
照片上限: 10 張 (可選)
```

#### 3.4 保存設置

```
點擊 ✓ 保存設置
看到成功提示
```

---

### 第四步：測試驗證 (2 分鐘) 🧪

#### 4.1 測試 API 連接

```
1. 回到設置頁面
2. 應該看到「連接成功」的提示
（如果失敗，檢查 API URL）
```

#### 4.2 測試掃描功能

```
1. 點擊「← 返回」返回掃描界面
2. 輸入一個已知的財產編號
   例如: FAA001
3. 按 Enter 或點擊搜索
4. 應該看到財產詳情
```

#### 4.3 測試相機功能

```
1. 點擊 📷 打開相機
2. 允許相機權限
3. 應該看到相機預覽
4. 點擊 📸 拍照測試
```

#### 4.4 測試照片上傳

```
1. 在詳情頁面點擊 ➕ 添加照片
2. 拍照或選擇相冊
3. 確認上傳
4. 應該在照片區域看到縮略圖
```

---

### 第五步：完成！ 🎉

```
✅ 所有測試都通過
✅ 應用已可使用
✅ 準備大規模盤點

🚀 現在開始使用系統進行財產盤點！
```

---

## 📋 故障排查快速指南

### API 連接失敗？

```
問題：「無法連接到服務器」

解決：
1. 檢查 API URL 是否正確複製
2. 確認 URL 中沒有多餘空格
3. 嘗試在新標籤打開 API URL 測試
4. 重新部署 GAS (Deploy → New deployment)
5. 複製新的 URL
```

### 相機不工作？

```
問題：「相機訪問失敗」或無提示

解決：
1. 允許瀏覽器訪問相機
   Chrome → Settings → Privacy → Camera
2. 確認使用 HTTPS (不是 HTTP)
3. 嘗試其他瀏覽器 (Safari, Firefox)
4. 重新啟動瀏覽器
```

### 照片無法上傳？

```
問題：「上傳失敗」

解決：
1. 檢查 Google Drive 有沒有空間
2. 確認圖片格式 (JPG/PNG)
3. 嘗試更小的圖片
4. 查看瀏覽器控制台 (F12) 的錯誤
5. 檢查網絡連接
```

### 數據查詢失敗？

```
問題：「未找到該編號」

解決：
1. 確認編號在 Spreadsheet 中存在
2. 檢查工作表名稱是否正確 (財產列表)
3. 確認編號格式一致
4. 刷新頁面重試
```

---

## 📞 快速參考

### 重要的 URL

```
Spreadsheet:
https://docs.google.com/spreadsheets/d/1DT_hQlOCNr7WN8gLysO3Y9WFB8hYYroeHWMRxTzprDs/

應用首頁:
https://yourusername.github.io/Asset_Inventory_555/

GAS 編輯器:
https://script.google.com/home/all
```

### 主要文檔

```
README.md               - 項目介紹
DEPLOYMENT_GUIDE.md     - 詳細部署指南
QUICK_REFERENCE.md      - 快速查詢
PROJECT_SUMMARY.md      - 完成總結
```

---

## ⏱️ 時間估計

```
準備工作           1 分鐘
GAS 部署           3 分鐘
GitHub Pages       2 分鐘
應用配置           2 分鐘
測試驗證           2 分鐘
────────────────────────
總計              10 分鐘

加上首次學習       + 5 分鐘
────────────────────────
實際耗時           ~15 分鐘
```

---

## ✨ 部署後步驟

```
1. 訓練使用者 (1-2 小時)
2. 開始試運營 (1 周)
3. 收集反饋和改進
4. 全面推廣使用
```

---

## 🎯 祝賀！

當你看到這個頁面時，表示：

✅ 代碼已完成  
✅ 文檔已齊全  
✅ 部署已準備  
✅ 系統已就緒  

**現在只需 15 分鐘就可以部署完成！** 🚀

---

*快速部署清單 - 2026-01-23*
