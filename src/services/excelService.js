import * as XLSX from 'xlsx'
import { downloadBlob } from '../utils/helpers'

/** Đọc file Excel và trả về danh sách sheets + rows */
export const parseExcelFile = async (file) => {
  const data = await file.arrayBuffer()
  const wb = XLSX.read(data, { type: 'array', cellDates: true })
  const sheets = {}
  wb.SheetNames.forEach((name) => {
    const ws = wb.Sheets[name]
    // defval: '' để cell trống = '' thay vì undefined
    const json = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false })
    sheets[name] = {
      name,
      headers: json.length ? Object.keys(json[0]) : [],
      rows: json,
    }
  })
  return {
    sheetNames: wb.SheetNames,
    sheets,
  }
}

/**
 * Export dữ liệu ra file Excel
 * @param {Array} rows - mảng các object (flat)
 * @param {string} sheetName
 * @param {string} filename
 */
export const exportToExcel = (rows, sheetName = 'Data', filename = 'export.xlsx') => {
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  downloadBlob(blob, filename)
  return true
}
