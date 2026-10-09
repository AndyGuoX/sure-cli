import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { select, confirm } from '@inquirer/prompts'
import { getRepoList } from './registry.js'
import { cloneTemplate, isGitAvailable, initGitRepo } from './git.js'
import {
  detectPackageManager,
  installDependencies,
  runCommand,
} from './package-manager.js'
import { colors, log, withSpinner } from '../utils/ui.js'
import { resolveProjectTarget } from '../utils/validate.js'

async function pathExists(target) {
  try {
    await fs.access(target)
    return true
  } catch {
    return false
  }
}

/**
 * 读取模板的 package.json，推断启动脚本（start / dev / serve)。
 * 旧实现写死提示 "yarn start"。
 */
async function detectStartScript(dir) {
  try {
    const raw = await fs.readFile(path.join(dir, 'package.json'), 'utf8')
    const scripts = JSON.parse(raw).scripts || {}
    return ['dev', 'start', 'serve'].find((name) => scripts[name]) || null
  } catch {
    return null
  }
}

async function resolveTemplate(requested) {
  const repos = await withSpinner('正在获取模板列表', () => getRepoList())

  if (repos.length === 0) {
    throw new Error('远端没有可用模板')
  }

  if (requested) {
    const matched = repos.find((repo) => repo.name === requested)
    if (!matched) {
      throw new Error(
        `未找到模板 "${requested}"。可用模板：${repos.map((r) => r.name).join(', ')}`,
      )
    }
    return matched
  }

  return select({
    message: '请选择一个模板',
    choices: repos.map((repo) => ({
      name: repo.description ? `${repo.name} - ${colors.gray(repo.description)}` : repo.name,
      value: repo,
      short: repo.name,
    })),
  })
}

export async function create(rawName, options = {}) {
  const resolved = resolveProjectTarget(rawName)
  if (!resolved.ok) {
    throw new Error(resolved.reason)
  }

  const { name, targetDir } = resolved

  if (!(await isGitAvailable())) {
    throw new Error('未检测到 git，请先安装 git 后重试')
  }

  // 目标已存在：确认是否覆盖。注意此处仅记录意图，实际删除推迟到下载成功之后。
  const exists = await pathExists(targetDir)
  if (exists) {
    if (!options.force) {
      const overwrite = await confirm({
        message: `目录 ${colors.cyan(name)} 已存在，是否覆盖？`,
        default: false,
      })
      if (!overwrite) {
        log.info('已取消')
        return
      }
    } else {
      log.warn(`目录 ${name} 已存在，将被覆盖`)
    }
  }

  const template = await resolveTemplate(options.template)

  // 关键修复：先下载到临时目录，成功后再替换目标目录。
  // 旧实现先 fs.remove(targetDir) 再下载，网络失败会导致原目录丢失且项目未创建。
  const stagingRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'sure-cli-'))
  const staging = path.join(stagingRoot, name)

  try {
    await withSpinner(`正在下载模板 ${template.name}`, () =>
      cloneTemplate({
        cloneUrl: template.cloneUrl,
        branch: template.defaultBranch,
        dest: staging,
      }),
    )

    if (exists) {
      await fs.rm(targetDir, { recursive: true, force: true })
    }

    await fs.mkdir(path.dirname(targetDir), { recursive: true })
    await fs.rename(staging, targetDir).catch(async (error) => {
      // 跨磁盘分区时 rename 会失败（EXDEV），退化为复制
      if (error.code !== 'EXDEV') throw error
      await fs.cp(staging, targetDir, { recursive: true })
    })
  } finally {
    await fs.rm(stagingRoot, { recursive: true, force: true })
  }

  log.info(`📂 项目路径：${colors.cyan(targetDir)}`)
  log.info(colors.green('🗃  项目初始化成功'))

  const packageManager = detectPackageManager()

  if (options.install === false) {
    log.info(`已跳过依赖安装`)
  } else {
    log.info(`📦 正在使用 ${colors.cyan(packageManager)} 安装依赖...`)
    try {
      await installDependencies(packageManager, targetDir)
      log.info(colors.green('✅ 依赖安装完成'))
    } catch (error) {
      // 安装失败不算致命：项目已创建，提示用户手动安装即可
      log.warn(`依赖安装失败：${error.message}`)
      log.warn(`请进入项目目录后手动执行 ${packageManager} install`)
    }
  }

  if (options.git) {
    const ok = await initGitRepo(targetDir)
    if (ok) log.info(colors.green('🔖 已初始化 git 仓库'))
    else log.warn('git 仓库初始化失败，已跳过')
  }

  const startScript = await detectStartScript(targetDir)
  const highlight = colors.hex('#ffa631')

  log.plain()
  log.plain(`🎉 项目 ${highlight(name)} 创建成功！`)
  log.plain('👉 接下来：')
  log.plain()
  log.plain(`   ${colors.dim('$')} ${colors.cyan(`cd ${name}`)}`)
  if (options.install === false) {
    log.plain(`   ${colors.dim('$')} ${colors.cyan(`${packageManager} install`)}`)
  }
  if (startScript) {
    log.plain(`   ${colors.dim('$')} ${colors.cyan(runCommand(packageManager, startScript))}`)
  }
  log.plain()
}
