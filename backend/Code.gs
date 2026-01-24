/**
 * 財產管理系統 - 雙模式 (動態 sheet 名稱版)
 * * 1. 【僅執行：單純擴展 (原地複寫)】：
 * - 行為：將目前工作表的數量炸開，清空原內容並覆寫。
 * * 2. 【執行：註解跟比對 (原地修改)】：
 * - 行為：直接修改當前工作表的 K/L 欄。
 * - 動態讀取：【當前工作表名稱 + " (舊註解)"】作為比對來源。
 * - 標記新增與報廢。
 */

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('財產管理工具')
    .addItem('僅執行：單純擴展 (原地複寫)', 'runSimpleExpansion')
    .addSeparator() 
    .addItem('執行：註解跟比對 (原地修改)', 'runCompareOnly')
    .addToUi();
}

// === 1. 單純擴展 (直接複寫原表) ===
function runSimpleExpansion() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    '確認執行擴展？',
    '這將會直接「複寫」目前的工作表內容，且無法復原。\n確定要繼續嗎？',
    ui.ButtonSet.YES_NO
  );

  if (response == ui.Button.YES) {
    processExpansionInPlace(); 
  }
}

// === 2. 註解比對 (直接修改原表) ===
function runCompareOnly() {
  processComparisonInPlace(); 
}

// ==========================================
// 邏輯 A：擴展功能 (原地複寫)
// ==========================================
function processExpansionInPlace() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getActiveSheet();
  const data = sheet.getDataRange().getValues();

  // 欄位設定
  const COL_ID = 1;         // B欄
  const COL_QTY = 6;        // G欄
  const COL_UNIT_PRICE = 7; // H欄
  const COL_TOTAL_PRICE = 8;// I欄
  const COL_LOCATION = 9;   // J欄

  let newData = [];
  
  // 處理標題
  let header = [...data[0]];
  newData.push(header);

  // 處理資料
  for (let i = 1; i < data.length; i++) {
    let row = data[i];
    let qty = row[COL_QTY];
    let rawId = String(row[COL_ID] || '');
    let assetId = rawId.replace(/[\s-]+/g, '');

    if (qty > 1 && assetId) {
      let match = assetId.match(/^(.*?)(\d+)$/);
      if (match) {
        let prefix = match[1];
        let numberStr = match[2];
        let startNum = parseInt(numberStr, 10);
        let numLength = numberStr.length;

        for (let j = 0; j < qty; j++) {
          let newRow = [...row];
          let newNum = startNum + j;
          let newNumStr = String(newNum).padStart(numLength, '0'); 
          let fullNewId = prefix + newNumStr;
          
          newRow[COL_ID] = fullNewId;
          newRow[COL_QTY] = 1;
          newRow[COL_TOTAL_PRICE] = newRow[COL_UNIT_PRICE];
          let originalLoc = newRow[COL_LOCATION] || "";
          newRow[COL_LOCATION] = `${originalLoc} (擴展 ${j + 1}/${qty})`;
          newData.push(newRow);
        }
      } else {
        // 無法解析數字，僅拆分
        for (let j = 0; j < qty; j++) {
           let newRow = [...row];
           newRow[COL_ID] = assetId;
           newRow[COL_QTY] = 1;
           newRow[COL_TOTAL_PRICE] = newRow[COL_UNIT_PRICE];
           let originalLoc = newRow[COL_LOCATION] || "";
           newRow[COL_LOCATION] = `${originalLoc} (擴展 ${j + 1}/${qty})`;
           newData.push(newRow);
        }
      }
    } else {
      let sanitizedRow = [...row];
      sanitizedRow[COL_ID] = assetId;
      newData.push(sanitizedRow);
    }
  }

  if (newData.length > 0) {
    sheet.clearContents(); // 清除內容但保留格式

    let numRows = newData.length;
    let numCols = newData[0].length;
    sheet.getRange(1, 1, numRows, numCols).setValues(newData);
    
    sheet.setFrozenRows(1);
    SpreadsheetApp.getUi().alert('✅ 擴展完成！已更新目前工作表。');
  }
}

// ==========================================
// 邏輯 B：比對功能 (直接修改當前 Sheet)
// ==========================================
function processComparisonInPlace() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getActiveSheet();
  const currentSheetName = sheet.getName(); // 取得目前工作表名稱
  const data = sheet.getDataRange().getValues();
  
  // === 1. 動態設定舊註解工作表名稱 ===
  // 規則：目前工作表名稱 + "(舊註解)"
  const noteSheetName = currentSheetName + "(舊註解)"; 
  const noteSheet = ss.getSheetByName(noteSheetName);
  let noteMap = {}; 

  if (noteSheet) {
    const noteData = noteSheet.getDataRange().getValues();
    for (let r = 1; r < noteData.length; r++) {
      let key = String(noteData[r][1]).trim(); 
      let valK = (noteData[r].length > 10) ? noteData[r][10] : "";
      let valL = (noteData[r].length > 11) ? noteData[r][11] : "";
      if (key) {
        noteMap[key] = { k: valK, l: valL, rowIndex: r + 1 };
      }
    }
  } else {
    SpreadsheetApp.getUi().alert('⚠️ 找不到工作表：「' + noteSheetName + '」\n\n請確認您已建立該工作表，名稱必須完全符合規則。');
    return;
  }

  // 2. 準備更新資料 (只針對 K, L 欄)
  // K欄 Index = 10 (第11欄), L欄 Index = 11 (第12欄)
  let updateData = []; 
  let processedIds = new Set();
  const COL_ID = 1; // B欄

  for (let i = 0; i < data.length; i++) {
    // 標題列
    if (i === 0) {
      updateData.push(["移植備註(K)", "移植備註(L)"]);
      continue;
    }

    let assetId = String(data[i][COL_ID]).trim();
    processedIds.add(assetId);

    let valK = "";
    let valL = "";

    if (assetId && noteMap[assetId]) {
      // 舊表有：移植
      valK = noteMap[assetId].k;
      valL = noteMap[assetId].l;
    } else if (assetId) {
      // 舊表沒有：新增
      valL = "新增";
    }

    updateData.push([valK, valL]);
  }

  // 3. 寫回當前工作表 (Column 11, 12)
  if (updateData.length > 0) {
    let currentMaxCols = sheet.getMaxColumns();
    if (currentMaxCols < 12) {
      sheet.insertColumnsAfter(currentMaxCols, 12 - currentMaxCols);
    }

    sheet.getRange(1, 11, updateData.length, 2).setValues(updateData);
    
    // 設定顏色
    if (updateData.length > 1) {
      sheet.getRange(2, 11, updateData.length - 1, 1).setFontColor("blue");
      sheet.getRange(2, 12, updateData.length - 1, 1).setFontColor("red");
    }
    
    // 補一個欄寬設定
    sheet.setColumnWidth(11, 150);
    sheet.setColumnWidth(12, 150);
  }

  // 4. 回寫舊表 (報廢邏輯)
  let missingIds = [];
  for (let id in noteMap) {
    if (!processedIds.has(id)) {
      missingIds.push(id);
    }
  }

  let updateMsg = "";
  if (missingIds.length > 0) {
    let lastRow = noteSheet.getLastRow();
    if (lastRow > 1) {
      let lColumnRange = noteSheet.getRange(2, 12, lastRow - 1, 1);
      let lValues = lColumnRange.getValues(); 
      let updateCount = 0;

      missingIds.forEach(id => {
        let rowIndexZeroBased = noteMap[id].rowIndex - 2;
        if (rowIndexZeroBased >= 0 && rowIndexZeroBased < lValues.length) {
          let currentVal = String(lValues[rowIndexZeroBased][0]);
          if (!currentVal.includes("(已報廢)")) {
            lValues[rowIndexZeroBased][0] = currentVal + " (已報廢)";
            updateCount++;
          }
        }
      });

      if (updateCount > 0) {
        lColumnRange.setValues(lValues);
        updateMsg = '\n舊註解表 (' + noteSheetName + ') 已同步標記 ' + updateCount + ' 筆 (已報廢)。';
      }
    }
  }

  SpreadsheetApp.getUi().alert('✅ 比對完成！\n已更新目前工作表的 K/L 欄。' + updateMsg);
}