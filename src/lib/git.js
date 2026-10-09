import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
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

/**
 * 浅克隆模板到指定目录。
 *
 * 替代 download-git-repo（已多年无人维护，且默认拉 master 分支，
 * 而模板仓库默认分支为 main，目前仅靠 GitHub 的重定向侥幸可用）。
 * 不传 --branch 时 git 会自动使用远端默认分支。
 */
export async function cloneTemplate({ cloneUrl, branch, dest }) {
  const args = ['clone', '--depth', '1', '--single-branch']
  if (branch) args.push('--branch', branch)
  args.push(cloneUrl, dest)

  await run('git', args)

  // 移除模板自带的 git 历史，让用户得到一个干净的起点
  await fs.rm(path.join(dest, '.git'), { recursive: true, force: true })
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
