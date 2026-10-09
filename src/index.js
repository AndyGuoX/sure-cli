import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Command } from 'commander'
import figlet from 'figlet'
import { create } from './lib/create.js'
import { getRepoList } from './lib/registry.js'
import { colors, log } from './utils/ui.js'

const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'),
)

export function buildProgram() {
  const program = new Command()

  program
    .name('sure-cli')
    .version(`v${pkg.version}`, '-v, --version')
    .usage('<command> [options]')
    .description('快速创建前端工程的脚手架')

  program
    .command('create')
    .argument('<app-name>', '项目名称')
    .description('创建一个新项目')
    .option('-f, --force', '目标目录已存在时直接覆盖')
    .option('-t, --template <name>', '指定模板名称，跳过交互选择')
    .option('--no-install', '创建后不自动安装依赖')
    .option('--git', '创建后初始化 git 仓库并提交首次 commit')
    .action(async (name, options) => {
      await create(name, options)
    })

  program
    .command('list')
    .alias('ls')
    .description('查看所有可用模板')
    .action(async () => {
      const repos = await getRepoList()
      if (repos.length === 0) {
        log.info('暂无可用模板')
        return
      }
      log.plain()
      for (const repo of repos) {
        log.plain(`  ${colors.cyan(repo.name)}`)
        if (repo.description) log.plain(`    ${colors.gray(repo.description)}`)
      }
      log.plain()
    })

  program.addHelpText('before', () => {
    const banner = figlet.textSync('sure-cli', {
      font: 'Flower Power',
      width: 100,
      whitespaceBreak: true,
    })
    return `\n${colors.cyan(banner)}\n`
  })

  program.addHelpText(
    'after',
    `\n运行 ${colors.cyan('sure-cli <command> --help')} 查看具体命令的用法\n`,
  )

  return program
}

export async function run(argv = process.argv) {
  const program = buildProgram()

  try {
    await program.parseAsync(argv)
  } catch (error) {
    // 用户按 Ctrl+C 取消交互时 @inquirer 抛出 ExitPromptError
    if (error?.name === 'ExitPromptError') {
      log.plain()
      log.info('已取消')
      process.exitCode = 130
      return
    }

    log.error(error?.message || String(error))
    if (process.env.SURE_CLI_DEBUG && error?.stack) {
      console.error(colors.gray(error.stack))
    }

    // 这里只设置 exitCode 而不调用 process.exit()：
    // 立即退出会在 ora 的句柄尚未关闭时触发 libuv 断言崩溃。
    process.exitCode = 1
  }
}
