const path = require('path')
const fs = require('fs-extra')
const inquirer = require('inquirer')
const Generator = require('./Generator')

module.exports = async function (name, options) {
  // 当前命令行选择的目录
  const cwd = process.cwd()

  // 需要创建的目录地址
  const targetDir = path.join(cwd, name)

  // 目录是否已经存在？
  if (fs.existsSync(targetDir)) {

    // 是否为强制创建？
    if (options.force) {
      await fs.remove(targetDir)
    } else {
      // 询问用户是否确定要覆盖
      let { action } = await inquirer.prompt([
        {
          name: 'action',
          type: 'list',
          message: `${name} 文件夹已存在，是否强制覆盖？`,
          choices: [
            {
              name: '覆盖',
              value: true
            }, {
              name: '取消',
              value: false
            }
          ]
        }
      ])

      if (!action) {
        return null
      } else if (action === true) {
        // 移除已存在的目录
        console.log(`\r\nRemoving ${name} ...`)
        await fs.remove(targetDir)
      }
    }
  }

  // 创建项目
  const generator = new Generator(name, targetDir)

  // 开始创建项目
  generator.create().catch()
}