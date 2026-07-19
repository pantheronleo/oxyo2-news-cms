import { isAbsolute, resolve } from 'node:path'

export function repoRoot() {
  return process.cwd().endsWith('/apps/api') ? resolve(process.cwd(), '../..') : process.cwd()
}

export function uploadRoot(uploadDir: string) {
  return isAbsolute(uploadDir) ? resolve(uploadDir) : resolve(repoRoot(), uploadDir)
}
