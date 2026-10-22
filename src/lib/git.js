import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

/**
 * 以 Promise 方式执行命令，捕获 stderr 用于错误提示。
 */
function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'ignore', 'pipe'],
      ...options,
    })

    let stderr = ''
    child.stderr?.on('data', (chunk) => {
      stderr += chunk
    })

    child.on('error', (error) => {
      if (error.code === 'ENOENT') {
        reject(new Error(`未找到 ${command} 命令，请先安装`))
        return
      }
      reject(error)
    })

    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(stderr.trim() || `${command} 退出码 ${code}`))
    })
  })
}

export async function isGitAvailable() {
  try {
    await run('git', ['--version'])
    return true
  } catch {
    return false
  }
}

export async function cloneTemplate({ cloneUrl, directory, dest }) {
  if (typeof directory !== 'string' || !/^template-[a-z0-9][a-z0-9._-]*$/i.test(directory)) {
    throw new Error('模板目录名称无效')
  }

  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'sure-cli-repo-'))
  const checkout = path.join(temporaryRoot, 'repository')

  try {
    await run('git', ['clone', '--depth', '1', '--single-branch', '--', cloneUrl, checkout])

    const source = path.join(checkout, directory)
    const stat = await fs.lstat(source)
    if (!stat.isDirectory()) {
      throw new Error(`模板目录不存在：${directory}`)
    }

    await fs.cp(source, dest, {
      recursive: true,
      verbatimSymlinks: true,
      filter: (file) => path.basename(file) !== '.git',
    })
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true })
  }
}

/**
 * 在项目目录初始化一个全新的 git 仓库。失败不影响主流程。
 */
export async function initGitRepo(cwd) {
  try {
    await run('git', ['init', '--quiet'], { cwd })
    await run('git', ['add', '-A'], { cwd })
    await run('git', ['commit', '-m', 'chore: init from sure-cli', '--quiet'], { cwd })
    return true
  } catch {
    return false
  }
}
