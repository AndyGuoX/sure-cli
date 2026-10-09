import assert from 'node:assert/strict'
import path from 'node:path'
import { test } from 'node:test'
import { resolveProjectTarget } from '../src/utils/validate.js'

const CWD = path.resolve('/tmp/workspace')

test('接受合法的项目名称', () => {
  for (const name of ['my-app', 'app2', 'my_app', 'a.b', 'App']) {
    const result = resolveProjectTarget(name, CWD)
    assert.equal(result.ok, true, `${name} 应该合法`)
  }
})

test('解析出的目录位于 cwd 之内', () => {
  const result = resolveProjectTarget('my-app', CWD)
  assert.equal(result.ok, true)
  assert.equal(result.targetDir, path.join(CWD, 'my-app'))
})

// 以下为旧版本会导致误删目录的输入
test('拒绝 . 和 ..，避免删除当前目录', () => {
  for (const name of ['.', '..']) {
    const result = resolveProjectTarget(name, CWD)
    assert.equal(result.ok, false, `${name} 必须被拒绝`)
  }
})

test('拒绝绝对路径', () => {
  for (const name of ['/etc', '/tmp/other', 'C:\\Windows']) {
    const result = resolveProjectTarget(name, CWD)
    assert.equal(result.ok, false, `${name} 必须被拒绝`)
  }
})

test('拒绝包含路径分隔符的名称', () => {
  for (const name of ['../sibling', 'a/b', 'a\\b', '../../etc']) {
    const result = resolveProjectTarget(name, CWD)
    assert.equal(result.ok, false, `${name} 必须被拒绝`)
  }
})

test('拒绝空名称', () => {
  for (const name of ['', '   ', null, undefined]) {
    const result = resolveProjectTarget(name, CWD)
    assert.equal(result.ok, false)
  }
})

test('拒绝 Windows 保留名称', () => {
  for (const name of ['con', 'NUL', 'com1', 'LPT3']) {
    const result = resolveProjectTarget(name, CWD)
    assert.equal(result.ok, false, `${name} 必须被拒绝`)
  }
})

test('拒绝过长的名称', () => {
  const result = resolveProjectTarget('a'.repeat(215), CWD)
  assert.equal(result.ok, false)
})

test('去除首尾空格', () => {
  const result = resolveProjectTarget('  my-app  ', CWD)
  assert.equal(result.ok, true)
  assert.equal(result.name, 'my-app')
})
