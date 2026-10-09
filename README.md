# SURE-CLI

一个简单的前端工程脚手架，从 [sure-cli-template](https://github.com/orgs/sure-cli-template/repositories) 拉取模板快速初始化项目。

## 环境要求

- Node.js >= 20.17.0
- git

## 安装

```bash
npm install -g sure-cli
```

## 使用

```bash
# 交互式选择模板创建项目
sure-cli create my-app

# 查看所有可用模板
sure-cli list

# 直接指定模板，跳过交互（适合 CI）
sure-cli create my-app -t template-react-hook

# 不自动安装依赖
sure-cli create my-app --no-install

# 创建后初始化 git 仓库并提交首次 commit
sure-cli create my-app --git

# 目标目录已存在时直接覆盖
sure-cli create my-app -f
```

### create 选项

| 选项 | 说明 |
| --- | --- |
| `-t, --template <name>` | 指定模板名称，跳过交互选择 |
| `-f, --force` | 目标目录已存在时直接覆盖 |
| `--no-install` | 创建后不自动安装依赖 |
| `--git` | 创建后初始化 git 仓库 |

## 环境变量

| 变量 | 说明 |
| --- | --- |
| `GITHUB_TOKEN` / `GH_TOKEN` | 提升 GitHub API 限流额度（未认证时每小时仅 60 次） |
| `NO_COLOR` | 禁用彩色输出 |
| `SURE_CLI_DEBUG` | 出错时打印完整堆栈 |

## 说明

- 依赖安装会自动识别当前使用的包管理器（npm / yarn / pnpm / bun）。
- 模板会先下载到临时目录，成功后才替换目标目录，因此下载失败不会破坏已有文件。

## 开发

```bash
npm install
npm test
```

## 发布

```bash
# 1. 登录 npm（只需首次，或 token 过期后）
npm login
npm whoami              # 确认当前账号

# 2. 确认打包内容无误（不会真正发布）
npm pack --dry-run      # 查看将被打包的文件
npm publish --dry-run   # 完整演练一次发布流程

# 3. 升级版本号（会自动创建 git commit 和 tag）
npm version patch       # 修订号：2.0.0 -> 2.0.1
npm version minor       # 次版本：2.0.0 -> 2.1.0
npm version major       # 主版本：2.0.0 -> 3.0.0

# 4. 发布
npm publish

# 5. 推送提交和 tag 到远端
git push --follow-tags
```

发布前会自动执行 `npm test`（`prepublishOnly` 钩子），测试不通过则中止发布。

实际发布的文件由 `package.json` 的 `files` 字段控制，仅包含 `bin`、`src`、`README.md`。

### 其他常用命令

```bash
# 发布预览版本，不会覆盖用户 npm install 拿到的 latest
npm publish --tag beta

# 查看已发布的版本列表
npm view sure-cli versions

# 发布 72 小时内可撤回（谨慎使用）
npm unpublish sure-cli@2.0.0

# 废弃某个版本，给安装者一条提示信息
npm deprecate sure-cli@1.0.0 "请升级到 2.x"
```

### 本地验证

正式发布前建议先在本地装一次，确认产物可用：

```bash
npm pack                                # 生成 sure-cli-<version>.tgz
npm install -g ./sure-cli-<version>.tgz
sure-cli -v
npm uninstall -g sure-cli
```

## License

MIT
