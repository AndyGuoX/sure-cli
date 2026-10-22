import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { promisify } from 'node:util'
import { cloneTemplate } from '../src/lib/git.js'
import { getTemplateList } from '../src/lib/registry.js'

const exec = promisify(execFile)
const dir = (name) => ({ name, path: name, type: 'dir' })

function mockResponse(t, data, options) {
  t.mock.method(globalThis, 'fetch', async (url, request) => {
    assert.equal(url, 'https://api.github.com/repos/AndyGuoX/sure-cli-templates/contents')
    assert.equal(request.headers['User-Agent'], 'sure-cli')
    assert.ok(request.signal instanceof AbortSignal)
    return Response.json(data, options)
  })
}

test('从新仓库读取模板目录，排除文件、非模板目录和非法路径', async (t) => {
  mockResponse(t, [
    dir('template-z'),
    dir('docs'),
    { name: 'README.md', path: 'README.md', type: 'file' },
    { name: 'template-file', path: 'template-file', type: 'file' },
    { name: 'template-link', path: 'template-link', type: 'symlink' },
    { ...dir('template-outside'), path: '../template-outside' },
    dir('template-nest-react-admin'),
    dir('template-../outside'),
  ])

  assert.deepEqual(await getTemplateList(), [
    {
      name: 'template-nest-react-admin',
      directory: 'template-nest-react-admin',
      cloneUrl: 'https://github.com/AndyGuoX/sure-cli-templates.git',
    },
    {
      name: 'template-z',
      directory: 'template-z',
      cloneUrl: 'https://github.com/AndyGuoX/sure-cli-templates.git',
    },
  ])
})

test('每次重新获取列表，新增和删除模板不需要更新 CLI', async (t) => {
  let calls = 0
  t.mock.method(globalThis, 'fetch', async () => {
    calls += 1
    return Response.json(calls === 1 ? [dir('template-old')] : [dir('template-new')])
  })
  assert.equal((await getTemplateList())[0].name, 'template-old')
  assert.equal((await getTemplateList())[0].name, 'template-new')
  assert.equal(calls, 2)
})

test('没有模板目录时返回空列表', async (t) => {
  mockResponse(t, [dir('docs')])
  assert.deepEqual(await getTemplateList(), [])
})

test('保留 GitHub 格式、HTTP、限流和超时错误提示', async (t) => {
  await t.test('非数组响应', async (t) => {
    mockResponse(t, { message: 'unexpected' })
    await assert.rejects(getTemplateList(), /非预期的数据格式/)
  })
  await t.test('仓库不存在', async (t) => {
    mockResponse(t, { message: 'Not Found' }, { status: 404 })
    await assert.rejects(getTemplateList(), /HTTP 404/)
  })
  await t.test('调用限流', async (t) => {
    mockResponse(t, {}, { status: 403, headers: { 'x-ratelimit-remaining': '0' } })
    await assert.rejects(getTemplateList(), /GITHUB_TOKEN/)
  })
  await t.test('请求超时', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => {
      throw new DOMException('timed out', 'TimeoutError')
    })
    await assert.rejects(getTemplateList(), /超时/)
  })
})

test('克隆模板仓库后，只生成选中模板的内容', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sure-cli-test-'))
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  const repository = path.join(root, 'source')
  const selected = path.join(repository, 'template-selected')
  const other = path.join(repository, 'template-other')
  await fs.mkdir(path.join(selected, 'frontend'), { recursive: true })
  await fs.mkdir(path.join(selected, 'backend'), { recursive: true })
  await fs.mkdir(other)
  await fs.writeFile(path.join(repository, 'README.md'), 'repository readme')
  await fs.writeFile(path.join(selected, 'README.md'), 'selected template readme')
  await fs.writeFile(path.join(selected, '.gitignore'), 'node_modules\n')
  await fs.writeFile(path.join(selected, '.env.example'), 'PORT=3000\n')
  await fs.writeFile(path.join(selected, 'frontend', 'package.json'), '{"name":"frontend"}')
  await fs.writeFile(path.join(selected, 'backend', 'package.json'), '{"name":"backend"}')
  await fs.writeFile(path.join(other, 'other.txt'), 'do not copy')

  await exec('git', ['init', '-b', 'templates-main', repository])
  await exec('git', ['-C', repository, 'add', '-A'])
  await exec('git', ['-C', repository, '-c', 'user.name=Template Test',
    '-c', 'user.email=template-test@example.invalid', 'commit', '-m', 'test fixture'])

  await t.test('跟随默认分支并保留前后端和隐藏文件', async () => {
    const dest = path.join(root, 'project')
    // Windows 上 git 按 core.autocrlf 签出，断言时忽略换行差异
    const read = async (file) => (await fs.readFile(file, 'utf8')).replace(/\r\n/g, '\n')
    await cloneTemplate({ cloneUrl: repository, directory: 'template-selected', dest })
    assert.equal(await read(path.join(dest, 'README.md')), 'selected template readme')
    assert.equal(await read(path.join(dest, '.gitignore')), 'node_modules\n')
    assert.equal(await read(path.join(dest, '.env.example')), 'PORT=3000\n')
    assert.deepEqual((await fs.readdir(dest)).sort(), [
      '.env.example', '.gitignore', 'README.md', 'backend', 'frontend',
    ])
    assert.equal(JSON.parse(await fs.readFile(path.join(dest, 'backend', 'package.json'), 'utf8')).name,
      'backend')
  })

  await t.test('不存在的模板不会创建项目目录', async () => {
    const dest = path.join(root, 'missing-project')
    await assert.rejects(cloneTemplate({ cloneUrl: repository, directory: 'template-missing', dest }))
    await assert.rejects(fs.access(dest), { code: 'ENOENT' })
  })

  await t.test('拒绝越界目录', async () => {
    for (const directory of ['..', '../template-selected', '/tmp', 'template-a/b', 'template-a\\b']) {
      await assert.rejects(
        cloneTemplate({ cloneUrl: repository, directory, dest: path.join(root, 'invalid-project') }),
        /模板目录名称无效/,
      )
    }
  })
})
