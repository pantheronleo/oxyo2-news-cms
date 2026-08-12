import { config } from '../config.js'

/** Notifies IndexNow-participating engines (Bing feeds ChatGPT Search) about new/updated URLs. Advisory only, never throws. */
export async function pingIndexNow(paths: string[]) {
  if (!config.INDEXNOW_KEY) return
  try {
    const host = new URL(config.PUBLIC_BASE_URL).host
    await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host, key: config.INDEXNOW_KEY, keyLocation: new URL(`/${config.INDEXNOW_KEY}.txt`, config.PUBLIC_BASE_URL).toString(), urlList: paths.map(path => new URL(path, config.PUBLIC_BASE_URL).toString()) }),
      signal: AbortSignal.timeout(10_000)
    })
  } catch (error) { console.warn('[indexnow] ping failed', error) }
}
