import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { AppSettings, GpuInfo } from '../../shared/types'

const DEFAULT_SETTINGS: AppSettings = {
  outputDir: null,
  maxConcurrent: 2,
  theme: 'dark',
  notifyOnDone: true,
  ffmpegPath: null,
  gpu: null
}

let cache: AppSettings | null = null

function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

/** 加载设置（带默认值合并） */
export function loadSettings(): AppSettings {
  if (cache) return cache
  const p = settingsPath()
  let raw: Partial<AppSettings> = {}
  try {
    if (existsSync(p)) raw = JSON.parse(readFileSync(p, 'utf-8'))
  } catch {
    raw = {}
  }
  cache = { ...DEFAULT_SETTINGS, ...raw }
  return cache
}

/** 保存设置 */
export function saveSettings(s: AppSettings): void {
  cache = { ...s }
  const p = settingsPath()
  mkdirSync(app.getPath('userData'), { recursive: true })
  writeFileSync(p, JSON.stringify(cache, null, 2), 'utf-8')
}

/** 更新部分设置 */
export function updateSettings(patch: Partial<AppSettings>): AppSettings {
  const cur = loadSettings()
  const next = { ...cur, ...patch }
  saveSettings(next)
  return next
}

/** 获取 GPU 缓存 */
export function getGpuCache(): GpuInfo | null {
  return loadSettings().gpu ?? null
}

/** 缓存 GPU 检测结果 */
export function setGpuCache(gpu: GpuInfo): void {
  updateSettings({ gpu })
}
