import spawn from 'cross-spawn'

const SUPPORTED = ['npm', 'yarn', 'pnpm', 'bun']

/**
 * 推断用户正在使用的包管理器。
 * npm/yarn/pnpm/bun 都会设置 npm_config_user_agent，形如 "pnpm/8.6.0 npm/? node/v20..."。
 * 旧实现写死了 yarn，未装 yarn 的机器会安装失败却仍提示成功。
 */
export function detectPackageManager() {
  const userAgent = process.env.npm_config_user_agent
  if (userAgent) {
    const name = userAgent.split('/')[0]
    if (SUPPORTED.includes(name)) return name
  }
  return 'npm'
}

/**
 * 安装依赖。与旧实现不同：检查退出码，失败时抛出错误而非谎报成功。
 *
 * 使用 cross-spawn：Windows 上 npm/yarn/pnpm 是 .cmd 批处理脚本，
 * 原生 child_process.spawn 无法直接执行（EINVAL），而 shell: true
 * 会触发 Node 24 的参数未转义安全警告。cross-spawn 正是为此而存在。
 */
export function installDependencies(packageManager, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(packageManager, ['install'], {
      cwd,
      stdio: 'inherit',
    })

    child.on('error', (error) => {
      if (error.code === 'ENOENT') {
        reject(new Error(`未找到 ${packageManager} 命令`))
        return
      }
      reject(error)
    })

    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${packageManager} install 失败（退出码 ${code}）`))
    })
  })
}

/**
 * 返回该包管理器启动开发服务器的命令，用于结尾提示。
 */
export function runCommand(packageManager, script) {
  if (packageManager === 'npm') return `npm run ${script}`
  return `${packageManager} ${script}`
}
