const REPOSITORY = 'AndyGuoX/sure-cli-templates'
const API = `https://api.github.com/repos/${REPOSITORY}/contents`

export async function getTemplateList({ timeout = 15_000 } = {}) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'sure-cli',
  }

  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN
  if (token) headers.Authorization = `Bearer ${token}`

  let response
  try {
    response = await fetch(API, { headers, signal: AbortSignal.timeout(timeout) })
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      throw new Error('请求模板列表超时，请检查网络连接')
    }
    throw new Error(`无法连接 GitHub：${error.message}`)
  }

  if (response.status === 403 || response.status === 429) {
    const remaining = response.headers.get('x-ratelimit-remaining')
    if (remaining === '0') {
      throw new Error(
        'GitHub API 调用次数已达上限，请稍后重试，或设置 GITHUB_TOKEN 环境变量提升额度',
      )
    }
    throw new Error(`GitHub 拒绝了请求（HTTP ${response.status}）`)
  }

  if (!response.ok) {
    throw new Error(`获取模板列表失败（HTTP ${response.status}）`)
  }

  const contents = await response.json()
  if (!Array.isArray(contents)) {
    throw new Error('GitHub 返回了非预期的数据格式')
  }

  return contents
    .filter((entry) => entry.type === 'dir'
      && /^template-[a-z0-9][a-z0-9._-]*$/i.test(entry.name)
      && entry.path === entry.name)
    .map((entry) => ({
      name: entry.name,
      directory: entry.path,
      cloneUrl: `https://github.com/${REPOSITORY}.git`,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}
