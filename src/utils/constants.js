// Các hằng số dùng chung toàn app

export const WARNING_LEVELS = {
  NONE: 0,
  LEVEL_1: 1,
  LEVEL_2: 2,
  LEVEL_3: 3,
}

export const WARNING_LABELS = {
  0: { text: 'Bình thường', color: 'text-slate-600', bg: 'bg-slate-100', dot: 'bg-slate-400' },
  1: { text: 'Cảnh báo 1', color: 'text-green-700',    bg: 'bg-green-100',    dot: 'bg-green-500' },
  2: { text: 'Cảnh báo 2', color: 'text-amber-700',    bg: 'bg-amber-100',    dot: 'bg-amber-500' },
  3: { text: 'Cảnh báo 3', color: 'text-red-700',      bg: 'bg-red-100',      dot: 'bg-red-500' },
}

export const WARNING_OPTIONS = [
  { value: 0, label: 'Bình thường' },
  { value: 1, label: 'Cảnh báo 1' },
  { value: 2, label: 'Cảnh báo 2' },
  { value: 3, label: 'Cảnh báo 3' },
]

export const ACTION_TYPES = {
  CREATE_STUDENT: 'CREATE_STUDENT',
  UPDATE_STUDENT: 'UPDATE_STUDENT',
  DELETE_STUDENT: 'DELETE_STUDENT',
  CREATE_CLASS: 'CREATE_CLASS',
  UPDATE_CLASS: 'UPDATE_CLASS',
  DELETE_CLASS: 'DELETE_CLASS',
  CREATE_COLUMN: 'CREATE_COLUMN',
  UPDATE_COLUMN: 'UPDATE_COLUMN',
  DELETE_COLUMN: 'DELETE_COLUMN',
  UPDATE_WARNING: 'UPDATE_WARNING',
  IMPORT_EXCEL: 'IMPORT_EXCEL',
  UPDATE_PERMISSION: 'UPDATE_PERMISSION',
}

export const ACTION_LABELS = {
  CREATE_STUDENT:   'Thêm sinh viên',
  UPDATE_STUDENT:   'Cập nhật sinh viên',
  DELETE_STUDENT:   'Xóa sinh viên',
  CREATE_CLASS:     'Thêm lớp',
  UPDATE_CLASS:     'Cập nhật lớp',
  DELETE_CLASS:     'Xóa lớp',
  CREATE_COLUMN:    'Thêm cột',
  UPDATE_COLUMN:    'Cập nhật cột',
  DELETE_COLUMN:    'Xóa cột',
  UPDATE_WARNING:   'Cập nhật cảnh báo',
  IMPORT_EXCEL:     'Import Excel',
  UPDATE_PERMISSION:'Cập nhật quyền',
}

export const DATA_TYPES = {
  TEXT: 'text',
  NUMBER: 'number',
  DATE: 'date',
  CHECKBOX: 'checkbox',
  SELECT: 'select',
}

export const DATA_TYPE_LABELS = {
  text: 'Text (Chuỗi)',
  number: 'Number (Số)',
  date: 'Date (Ngày)',
  checkbox: 'Checkbox (Đúng/Sai)',
  select: 'Select (Lựa chọn)',
}

export const ROLES = {
  ADMIN: 'admin',
  USER: 'user',
}

export const ROLE_LABELS = {
  admin: 'Quản trị viên',
  user: 'Người dùng',
}

export const USER_STATUS = {
  ACTIVE: 'active',
  LOCKED: 'locked',
}

export const USER_STATUS_LABELS = {
  active: { text: 'Hoạt động', cls: 'bg-green-100 text-green-700' },
  locked: { text: 'Bị khóa',   cls: 'bg-red-100 text-red-700' },
}

/**
 * Các cột cố định (system columns) của bảng sinh viên.
 * field = tên cột trong AG Grid / field trong students table.
 * key dùng để lưu trong editable_columns (permission) và cell_styles.
 */
export const SYSTEM_COLUMNS = [
  { key: 'student_code',  label: 'Mã SV',           field: 'student_code' },
  { key: 'full_name',     label: 'Họ tên',          field: 'full_name' },
  { key: 'date_of_birth', label: 'Ngày sinh',       field: 'date_of_birth' },
  { key: 'warning_level', label: 'Cảnh báo',        field: 'warning_level' },
  { key: 'warning_reason',label: 'Lý do cảnh báo',  field: 'warning_reason' },
  { key: 'warning_date',  label: 'Ngày cảnh báo',   field: 'warning_date' },
  { key: 'warning_note',  label: 'Ghi chú cảnh báo',field: 'warning_note' },
]

/**
 * Màu sắc có sẵn để bôi ô (tùy chỉnh theo yêu cầu: vàng, đỏ, xanh + thêm xám/lam/xanh lá)
 */
export const CELL_COLOR_OPTIONS = [
  { value: 'yellow', label: 'Vàng',   bg: '#fef08a' },
  { value: 'red',    label: 'Đỏ',     bg: '#fecaca' },
  { value: 'blue',   label: 'Xanh dương', bg: '#bfdbfe' },
  { value: 'green',  label: 'Xanh lá', bg: '#bbf7d0' },
  { value: 'orange', label: 'Cam',    bg: '#fed7aa' },
  { value: 'purple', label: 'Tím',    bg: '#e9d5ff' },
  { value: 'pink',   label: 'Hồng',   bg: '#fbcfe8' },
  { value: 'gray',   label: 'Xám',    bg: '#e5e7eb' },
]

/** Map value -> bg color cho cellStyle */
export const CELL_COLOR_MAP = CELL_COLOR_OPTIONS.reduce((acc, c) => {
  acc[c.value] = c.bg
  return acc
}, {})
