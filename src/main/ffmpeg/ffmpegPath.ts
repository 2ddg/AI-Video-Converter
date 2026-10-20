import { app } from 'electron'
import { existsSync } from 'fs'
import { join } from 'path'
import { loadSettings } from '../store/settings'

/** 定位 ffmpeg.exe：打包后走 extraResources(process.resourcesPath)，开发走 resources/，设置可覆盖 */
export function getFfmpegPath(): string {
  // 1. 用户显式指定
  const custom = loadSettings().ffmpegPath
  if (custom && existsSync(custom)) return custom
  // 2. 打包后（extraResources 复制到 resources/ffmpeg/ffmpeg.exe）
  if (app.isPackaged) {
    const p = join(process.resourcesPath, 'ffmpeg', 'ffmpeg.exe')
    if (existsSync(p)) return p
  }
  // 3. 开发模式
  return join(app.getAppPath(), 'resources', 'ffmpeg', 'ffmpeg.exe')
}

/** 获取 ffmpeg 版本号（首行），失败返回 null */
export async function getFfmpegVersion(): Promise<string | null> {
  const { execFile } = await import('child_process')
  return new Promise((resolve) => {
    execFile(
      getFfmpegPath(),
      ['-hide_banner', '-version'],
      { windowsHide: true, timeout: 8000 },
      (err, stdout) => {
        if (err || !stdout) return resolve(null)
        const m = stdout.match(/ffmpeg version\s+([\w.\-]+)/i)
        resolve(m ? m[1] : null)
      }
    )
  })
}
