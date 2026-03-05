/**
 * 가드레일(최저판매가이드)만 동기화
 * 
 * 참고: 띄어쓰기 차이로 중복이 발생할 수 있으므로
 * CSV 업로드를 권장합니다!
 */

const CONFIG = {
  SUPABASE_URL: 'https://ttohmprndoenrxfywmkf.supabase.co',
  SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0b2htcHJuZG9lbnJ4Znl3bWtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxODMyMzcsImV4cCI6MjA4Nzc1OTIzN30.gHh62pUigjne-WiF-A5AiDswnD2cBIJS2b4oDJuNT6U',
  SHEET_NAME: '최저판매가이드'
}

function SYNC_PRICE_GUIDE() {
  const ui = SpreadsheetApp.getUi()
  
  const result = ui.alert(
    '⚠️ 가드레일 동기화',
    'Apps Script보다 CSV 업로드를 권장합니다.\n\n계속하시겠습니까?',
    ui.ButtonSet.YES_NO
  )
  
  if (result !== ui.Button.YES) {
    return
  }
  
  try {
    Logger.log('=== 가드레일 동기화 시작 ===')
    
    // 1. 기존 데이터 삭제
    deleteAllData('price_guide')
    Logger.log('기존 가드레일 데이터 삭제 완료')
    
    // 2. 새 데이터 가져오기
    const ss = SpreadsheetApp.getActiveSpreadsheet()
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAME)
    
    if (!sheet) {
      throw new Error('시트를 찾을 수 없습니다: ' + CONFIG.SHEET_NAME)
    }
    
    const lastRow = sheet.getLastRow()
    if (lastRow < 2) {
      throw new Error('데이터가 없습니다')
    }
    
    const values = sheet.getRange(2, 1, lastRow - 1, 4).getValues()
    
    const seen = {}
    const data = []
    
    for (let i = 0; i < values.length; i++) {
      const row = values[i]
      
      const date = row[0]
      let branchName = String(row[1] || '').trim()
      let roomType = String(row[2] || '').trim()
      const price = row[3]
      
      if (!date) continue
      if (!branchName || branchName === '-') continue
      if (!roomType || roomType === '-') continue
      if (!price || price === '-' || price === 0 || price === '') continue
      
      // 띄어쓰기 제거
      branchName = branchName.replace(/\s+/g, '')
      roomType = roomType.replace(/\s+/g, '')
      
      const dateStr = formatDate(date)
      const key = dateStr + '|||' + branchName + '|||' + roomType
      
      if (seen[key]) continue
      seen[key] = true
      
      data.push({
        date: dateStr,
        branch_name: branchName,
        room_type: roomType,
        min_price: price
      })
    }
    
    Logger.log('가드레일 데이터: ' + data.length + '개')
    
    // 3. 한 번에 업로드
    insertData('price_guide', data)
    
    Logger.log('=== 가드레일 동기화 완료 ===')
    ui.alert('✅ 가드레일 동기화 완료!\n\n총 ' + data.length + '개 업로드')
    
  } catch (error) {
    Logger.log('❌ 에러: ' + error.message)
    ui.alert('❌ 가드레일 동기화 실패!\n\n' + error.message)
  }
}

function deleteAllData(tableName) {
  const url = CONFIG.SUPABASE_URL + '/rest/v1/' + tableName + '?branch_name=neq.IMPOSSIBLE_VALUE'
  
  const options = {
    method: 'delete',
    headers: {
      'apikey': CONFIG.SUPABASE_KEY,
      'Authorization': 'Bearer ' + CONFIG.SUPABASE_KEY
    },
    muteHttpExceptions: true
  }
  
  const response = UrlFetchApp.fetch(url, options)
  const statusCode = response.getResponseCode()
  
  if (statusCode !== 204 && statusCode !== 200) {
    throw new Error('삭제 실패 (' + statusCode + '): ' + response.getContentText())
  }
}

function insertData(tableName, data) {
  const url = CONFIG.SUPABASE_URL + '/rest/v1/' + tableName
  
  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'apikey': CONFIG.SUPABASE_KEY,
      'Authorization': 'Bearer ' + CONFIG.SUPABASE_KEY
    },
    payload: JSON.stringify(data),
    muteHttpExceptions: true
  }
  
  const response = UrlFetchApp.fetch(url, options)
  const statusCode = response.getResponseCode()
  
  if (statusCode !== 201 && statusCode !== 200) {
    throw new Error('업로드 실패 (' + statusCode + '): ' + response.getContentText())
  }
}

function formatDate(date) {
  if (!date) return null
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return year + '-' + month + '-' + day
}
