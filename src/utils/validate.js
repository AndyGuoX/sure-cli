import path from 'node:path'

// 合法的目录名：字母数字开头，可含 - _ . ~
// 注意不接受 @scope/name 形式——带分隔符的名称在上面已被拒绝，
// 作为目录名也没有意义。
const VALID_NAME = /^[a-z0-9~][a-z0-9-._~]*$/i

// Windows 保留设备名，作为目录名会出问题
const WINDOWS_RESERVED = new Set([
  'con', 'prn', 'aux', 'nul',
  ...Array.from({ length: 9 }, (_, i) => `com${i + 1}`),
  ...Array.from({ length: 9 }, (_, i) => `lpt${i + 1}`),
])

/**
 * 校验项目名称并解析目标目录。
 *
 * 这里是防止误删用户目录的关键一环：旧版本直接 path.join(cwd, name)，
 * 传入 "." / ".." / "/etc" 时配合 --force 会删掉 cwd 或任意目录。
 *
 * @returns {{ ok: true, targetDir: string } | { ok: false, reason: string }}
 */
export function resolveProjectTarget(name, cwd = process.cwd()) {
  if (typeof name !== 'string' || name.trim() === '') {
    return { ok: false, reason: '项目名称不能为空' }
  }

  const trimmed = name.trim()

  if (trimmed === '.' || trimmed === '..') {
    return { ok: false, reason: `不能使用 "${trimmed}" 作为项目名称` }
  }

  if (path.isAbsolute(trimmed)) {
    return { ok: false, reason: '项目名称不能是绝对路径' }
  }

  if (trimmed.includes('/') || trimmed.includes('\\')) {
    return { ok: false, reason: '项目名称不能包含路径分隔符' }
  }

  if (!VALID_NAME.test(trimmed)) {
    return {
      ok: false,
      reason: '项目名称只能包含字母、数字以及 - _ . ~ ，且不能以 . 或 _ 开头',
    }
  }

  if (WINDOWS_RESERVED.has(trimmed.toLowerCase())) {
    return { ok: false, reason: `"${trimmed}" 是系统保留名称` }
  }

  if (Buffer.byteLength(trimmed) > 214) {
    return { ok: false, reason: '项目名称过长' }
  }

  const targetDir = path.join(cwd, trimmed)

  // 双保险：确保解析结果确实在 cwd 之内
  const relative = path.relative(cwd, targetDir)
  if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
    return { ok: false, reason: '项目目录必须位于当前目录之内' }
  }

  return { ok: true, targetDir, name: trimmed }
}
