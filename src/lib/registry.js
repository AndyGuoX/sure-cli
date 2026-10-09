const ORG = 'sure-cli-template'
const API = `https://api.github.com/orgs/${ORG}/repos?per_page=100&type=public`

/**
 * 获取可用模板列表。
 *
 * 相比旧实现：
 * - 用原生 fetch,去掉 axios 依赖
 * - 不再修改全局拦截器
 * - per_page=100，过滤 fork / archived
 * - 支持 GITHUB_TOKEN 提升限流额度(未认证时每小时仅 60 次)
 * - 带超时，避免无限等待
 */
export async function getRepoList({ timeout = 15_000 } = {}) {
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

  const repos = await response.json()
  if (!Array.isArray(repos)) {
    throw new Error('GitHub 返回了非预期的数据格式')
  }

  return repos
    .filter((repo) => !repo.fork && !repo.archived && !repo.disabled)
    .map((repo) => ({
      name: repo.name,
      description: repo.description || '',
      defaultBranch: repo.default_branch || 'main',
      cloneUrl: repo.clone_url,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}
