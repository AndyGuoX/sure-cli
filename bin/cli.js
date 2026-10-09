#!/usr/bin/env node

// #! 符号的名称叫 Shebang，用于指定脚本的解释程序。
// 在 Linux / macOS 下需要保证此文件具有可执行权限（chmod +x bin/cli.js）。

import { run } from '../src/index.js'

await run(process.argv)
