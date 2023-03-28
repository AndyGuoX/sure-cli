const path = require('path')
const util = require('util')
const ora = require('ora')
const inquirer = require('inquirer')
const downloadGitRepo = util.promisify(require('download-git-repo'))
const chalk = require('chalk')
const spawn = require('cross-spawn')
const { getRepoList } = require('./http')
const { spinner } = require('../utils')

// 添加加载动画
async function wrapLoading(fn, message, ...args) {
  // 使用 ora 初始化，传入提示信息 message
  const spinner = ora(message)

  // 开始加载动画
  spinner.start()

  try {
    // 执行传入方法 fn
    const result = await fn(...args)
    // 状态为修改为成功
    spinner.succeed()
    return result
  } catch (error) {
    // 状态为修改为失败
    spinner.fail('获取模板失败，请检查网络是否正常')
    return null
  }
}

class Generator {
  constructor(name, targetDir) {
    // 目录名称
    this.name = name

    // 创建位置
    this.targetDir = targetDir
  }

  // 获取用户选择的模板
  async getRepo() {
    // 1）从远程拉取模板数据
    const repoList = await wrapLoading(getRepoList, 'waiting fetch template')
    if (!repoList) return null

    // 过滤模板名称
    const repos = repoList.map(item => item.name)

    // 2）用户选择自己新下载的模板名称
    const { repo } = await inquirer.prompt({
      name: 'repo',
      type: 'list',
      choices: repos,
      message: '请选择一个模板'
    })

    // 3）return 用户选择的名称
    return repo
  }

  // 下载远程模板
  async download(repo) {
    const requestUrl = `sure-cli-template/${repo}`

    // 调用下载方法

    return await wrapLoading(
      downloadGitRepo,
      'waiting download template', // 提示信息
      requestUrl, // 参数1：下载地址
      path.resolve(process.cwd(), this.targetDir) // 参数2：创建位置
    )
  }

  // 执行装包命令
  install() {
    const step2 = spawn.sync('yarn', ['install'], {
      cwd: this.targetDir,
      stdio: 'inherit'
    })
  }

  // 核心创建逻辑
  async create() {
    // 获取用户选择的模板名称
    const repo = await this.getRepo()

    // 下载模板到当前目录
    const result = await this.download(repo)
    if (result === null) { return null }

    console.log(chalk.cyan('[sure-cli]'), ` 📂  项目路径： `, this.targetDir)
    spinner.succeed(chalk.green(chalk.cyan('[sure-cli]'), ` 🗃  项目初始化成功！`))
    console.log(chalk.green(chalk.cyan('[sure-cli]'), ` 📦  Start installing dependencies...`))

    this.install()

    spinner.succeed(chalk.green(chalk.cyan('[sure-cli]'), `  Installed dependencies successfully!`))

    const tipsColor = chalk.hex('#ffa631')
    const cmdFlagColor = chalk.hex('#4c8dae')
    console.log('🎉  Successfully created project ', tipsColor(this.name), '.')
    console.log('👉  Get started with the following commands:')

    console.log(' ', cmdFlagColor('$ '), chalk.cyan(`cd ${this.name}`))
    console.log(' ', cmdFlagColor('$ '), chalk.cyan(`yarn start`))
  }
}

module.exports = Generator