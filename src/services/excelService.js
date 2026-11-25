import * as XLSX from 'xlsx-js-style'
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

  // In đậm hàng tiêu đề (dòng đầu tiên) + nền xám nhạt + viền + canh giữa
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')
  const headerRow = range.s.r
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: headerRow, c })
    const cell = ws[cellRef]
    if (cell) {
      cell.s = {
        font: { bold: true, color: { rgb: '1F2937' } },
        fill: { fgColor: { rgb: 'E2E8F0' } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: {
          top: { style: 'thin', color: { rgb: 'CBD5E1' } },
          bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
          left: { style: 'thin', color: { rgb: 'CBD5E1' } },
          right: { style: 'thin', color: { rgb: 'CBD5E1' } },
        },
      }
    }
  }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)

  // Auto-fit độ rộng cột dựa trên tiêu đề và nội dung dài nhất
  const colWidths = {}
  rows.forEach((row) => {
    Object.keys(row).forEach((key) => {
      const cellValue = row[key]
      const cellLength = cellValue === null || cellValue === undefined
        ? 0
        : String(cellValue).length
      if (!colWidths[key] || cellLength > colWidths[key]) {
        colWidths[key] = cellLength
      }
    })
  })
  ws['!cols'] = Object.keys(colWidths).map((key) => {
    // +2 để có lề, giới hạn tối đa 60 ký tự cho gọn
    const width = Math.min(Math.max(colWidths[key] + 2, 10), 60)
    return { wch: width }
  })

  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  downloadBlob(blob, filename)
  return true
}
