import { spawn } from 'child_process'
import { app } from 'electron'
import { createHash } from 'crypto'
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import type { VideoInfo } from '../../shared/types'
import { getFfmpegPath } from './ffmpegPath'

/** 缩略图缓存目录 */
export function thumbDir(): string {
  const dir = join(app.getPath('userData'), 'thumbnails')
  mkdirSync(dir, { recursive: true })
  return dir
}

/** 由输入路径生成稳定 hash 文件名 */
function hashName(inputPath: string, suffix = ''): string {
  return createHash('sha1').update(inputPath + suffix).digest('hex').slice(0, 20)
}

/** 计算取帧时间点：取时长的比例，夹在 [0.5s, 时长-0.5s] 之间避开首尾 */
function frameTime(info: VideoInfo, ratio: number): number {
  if (!info.durationSec || info.durationSec <= 0) return 1
  const t = info.durationSec * ratio
  return Math.min(Math.max(t, 0.5), Math.max(info.durationSec - 0.5, 0.5))
}

/** 生成单张缩略图（10% 处）。返回 thumbnail:// URL */
export function generateThumbnail(info: VideoInfo): Promise<string> {
  return generateThumbnailAt(info, 0.1)
}

/**
 * 在指定比例处生成缩略图。
 * 返回 thumbnail://<hash>.jpg 形式的 URL（经 protocol.handle 服务）。
 */
export function generateThumbnailAt(info: VideoInfo, ratio: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const t = frameTime(info, ratio)
    const name = `${hashName(info.path, `@${ratio}`)}.jpg`
    const out = join(thumbDir(), name)
    // 已缓存直接返回
    if (existsSync(out)) return resolve(`thumbnail://${name}`)

    const ffmpeg = getFfmpegPath()
    const child = spawn(
      ffmpeg,
      [
        '-hide_banner', '-y',
        '-ss', String(t),
        '-i', info.path,
        '-frames:v', '1',
        '-vf', 'scale=320:-2',
        '-q:v', '3',
        out
      ],
      { windowsHide: true }
    )

    const timer = setTimeout(() => {
      child.kill()
      reject(new Error('缩略图生成超时'))
    }, 20_000)

    child.on('error', (err) => {
      clearTimeout(timer)
      reject(new Error(`缩略图生成失败: ${err.message}`))
    })

    child.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0 && existsSync(out)) {
        resolve(`thumbnail://${name}`)
      } else {
        reject(new Error('缩略图生成失败'))
      }
    })
  })
}

/** 生成三帧预览（10% / 50% / 90%），供 hover 预览。 */
export async function generatePreviewFrames(info: VideoInfo): Promise<string[]> {
  const ratios = [0.1, 0.5, 0.9]
  const urls: string[] = []
  for (const r of ratios) {
    try {
      urls.push(await generateThumbnailAt(info, r))
    } catch {
      urls.push('')
    }
  }
  return urls
}
