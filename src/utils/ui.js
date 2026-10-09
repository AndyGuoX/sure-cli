import ora from 'ora'

// 是否输出颜色：遵循 NO_COLOR / FORCE_COLOR 约定，默认只在 TTY 下着色。
// 自己实现而不用 chalk，是为了零依赖且支持 hex 真彩色（util.styleText 不支持 hex）。
const colorEnabled = (() => {
  if (process.env.NO_COLOR) return false
  if (process.env.FORCE_COLOR && process.env.FORCE_COLOR !== '0') return true
  return Boolean(process.stdout.isTTY)
})()

const wrap = (open, close) => (text) =>
  colorEnabled ? `\u001B[${open}m${text}\u001B[${close}m` : String(text)

export const colors = {
  bold: wrap(1, 22),
  dim: wrap(2, 22),
  red: wrap(31, 39),
  green: wrap(32, 39),
  yellow: wrap(33, 39),
  cyan: wrap(36, 39),
  gray: wrap(90, 39),
  hex(value) {
    const hex = value.replace('#', '')
    const int = Number.parseInt(hex, 16)
    // eslint-disable-next-line no-bitwise
    return wrap(`38;2;${(int >> 16) & 255};${(int >> 8) & 255};${int & 255}`, 39)
  },
}

const prefix = colors.cyan('[sure-cli]')

export const log = {
  info: (message) => console.log(`${prefix} ${message}`),
  warn: (message) => console.warn(`${prefix} ${colors.yellow(message)}`),
  error: (message) => console.error(`${prefix} ${colors.red('error')} ${message}`),
  plain: (message = '') => console.log(message),
}

/**
 * 包装一个异步任务，附带 loading 动画。
 * 与旧实现不同：失败时不吞掉错误，交给调用方处理，保留原始信息。
 */
export async function withSpinner(message, fn) {
  const spinner = ora({
    text: message,
    spinner: 'dots2',
    color: 'cyan',
    stream: process.stderr,
  }).start()

  try {
    const result = await fn()
    spinner.succeed()
    return result
  } catch (error) {
    spinner.fail()
    throw error
  }
}
