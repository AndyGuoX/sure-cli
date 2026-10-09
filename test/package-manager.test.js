import assert from 'node:assert/strict'
import { test } from 'node:test'
import { detectPackageManager, runCommand } from '../src/lib/package-manager.js'

function withUserAgent(value, fn) {
  const original = process.env.npm_config_user_agent
  if (value === undefined) delete process.env.npm_config_user_agent
  else process.env.npm_config_user_agent = value
  try {
    return fn()
  } finally {
    if (original === undefined) delete process.env.npm_config_user_agent
    else process.env.npm_config_user_agent = original
  }
}

test('从 user agent 识别包管理器', () => {
  const cases = [
    ['pnpm/8.6.0 npm/? node/v20.0.0 linux x64', 'pnpm'],
    ['yarn/1.22.19 npm/? node/v20.0.0 darwin arm64', 'yarn'],
    ['npm/10.2.0 node/v20.0.0 linux x64', 'npm'],
    ['bun/1.0.0 npm/? node/v20.0.0', 'bun'],
  ]
  for (const [ua, expected] of cases) {
    assert.equal(withUserAgent(ua, detectPackageManager), expected)
  }
})

test('缺省或无法识别时回退到 npm', () => {
  assert.equal(withUserAgent(undefined, detectPackageManager), 'npm')
  assert.equal(withUserAgent('deno/1.0.0', detectPackageManager), 'npm')
})

test('生成正确的运行命令', () => {
  assert.equal(runCommand('npm', 'dev'), 'npm run dev')
  assert.equal(runCommand('pnpm', 'dev'), 'pnpm dev')
  assert.equal(runCommand('yarn', 'start'), 'yarn start')
})
