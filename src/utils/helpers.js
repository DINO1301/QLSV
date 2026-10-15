// Các hàm tiện ích dùng chung

import { format, parseISO, isValid } from 'date-fns'

/**
 * Format ngày tháng Việt Nam
 */
export const formatDate = (date, pattern = 'dd/MM/yyyy') => {
  if (!date) return ''
  const d = typeof date === 'string' ? parseISO(date) : date
  if (!isValid(d)) return ''
  return format(d, pattern)
}

export const formatDateTime = (date) => formatDate(date, 'dd/MM/yyyy HH:mm')

/**
 * Trả về số với 2 chữ số thập phân
 */
export const formatNumber = (n, decimals = 2) => {
  if (n === null || n === undefined || n === '') return ''
  const num = Number(n)
  if (Number.isNaN(num)) return n
  return new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num)
}

/**
 * Tạo class name dựa trên điều kiện (giống clsx đơn giản)
 */
export const cn = (...args) => {
  return args.filter(Boolean).join(' ')
}

/**
 * Debounce
 */
export const debounce = (fn, ms = 300) => {
  let t
  return (...args) => {
    clearTimeout(t)
    t = setTimeout(() => fn(...args), ms)
  }
}

/**
 * Copy văn bản vào clipboard
 */
export const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/**
 * Download file từ URL hoặc Blob
 */
export const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Lấy file extension
 */
export const getFileExt = (filename) => {
  return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2).toLowerCase()
}

/**
 * Tạo chuỗi ngẫu nhiên (id tạm)
 */
export const uid = (prefix = 'id') =>
  `${prefix}_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`

/**
 * Parse JSON an toàn
 */
export const safeJson = (value, fallback = null) => {
  if (value === null || value === undefined) return fallback
  if (typeof value !== 'string') return value
  try { return JSON.parse(value) } catch { return fallback }
}

/**
 * Giá trị ô từ JSONB (custom value). Supabase trả về giá trị kiểu gì thì giữ nguyên
 */
export const unwrapJsonbValue = (val) => {
  if (val === null || val === undefined) return null
  if (typeof val === 'object' && !Array.isArray(val)) {
    // Nếu là object thì thường đã parse sẵn, trả về luôn
    return val
  }
  return val
}
