import { spawn } from 'child_process'
import { statSync } from 'fs'
import { basename } from 'path'
import type { VideoInfo } from '../../shared/types'
import { getFfmpegPath } from './ffmpegPath'

// ---------- 解析正则（基于 ffmpeg -i 实测输出格式） ----------
const RE_DURATION = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/
const RE_BITRATE = /bitrate:\s*(\d+(?:\.\d+)?)\s*kb\/s/
const RE_VIDEO = /:\s*Video:\s*([\w-]+).*?,\s*(\d{2,5})x(\d{2,5}).*?,?\s*(\d+(?:\.\d+)?)\s*fps/
const RE_VIDEO_NO_FPS = /:\s*Video:\s*([\w-]+).*?,\s*(\d{2,5})x(\d{2,5})/
const RE_AUDIO = /:\s*Audio:\s*([\w-]+)/
const RE_AUDIO_SR = /(\d+)\s*Hz/

const PROBE_TIMEOUT_MS = 15_000

/**
 * 用 `ffmpeg -i` 探测视频信息（无 ffprobe 的替代方案）。
 * ffmpeg 把探测信息写到 stderr，随后以退出码 1 结束（At least one output file...）。
 * 退出码 1 + 解析到数据 视为成功。
 */
export function probeVideo(filePath: string): Promise<VideoInfo> {
  return new Promise((resolve, reject) => {
    const ffmpeg = getFfmpegPath()
    const child = spawn(ffmpeg, ['-hide_banner', '-i', filePath], {
      windowsHide: true
    })

    let stderr = ''
    child.stderr.on('data', (d: Buffer) => {
      stderr += d.toString('utf-8')
    })

    const timer = setTimeout(() => {
      child.kill()
      reject(new Error('视频探测超时（可能文件损坏或格式异常）'))
    }, PROBE_TIMEOUT_MS)

    child.on('error', (err) => {
      clearTimeout(timer)
      reject(new Error(`无法启动 ffmpeg: ${err.message}`))
    })

    child.on('close', () => {
      clearTimeout(timer)
      try {
        const info = parseProbeOutput(filePath, stderr)
        resolve(info)
      } catch (err) {
        reject(err as Error)
      }
    })
  })
}

export function parseProbeOutput(filePath: string, stderr: string): VideoInfo {
  const lines = stderr.split(/\r?\n/)

  let format: string | null = null
  let durationSec: number | null = null
  let bitrateKbps: number | null = null
  let videoCodec: string | null = null
  let width: number | null = null
  let height: number | null = null
  let fps: number | null = null
  let audioCodec: string | null = null
  let audioSampleRate: number | null = null

  for (const line of lines) {
    // 容器格式：Input #0, mov,mp4,m4a,3gp,3g2,mj2, from '...'
    const inputMatch = line.match(/^Input #\d+,\s*([^,]+),/)
    if (inputMatch) {
      const fmt = inputMatch[1].trim()
      if (fmt && fmt !== 'mov,mp4,m4a,3gp,3g2,mj2') format = fmt
      else format = 'mp4'
    }
    // 时长
    const durMatch = line.match(RE_DURATION)
    if (durMatch && durationSec === null) {
      const h = parseInt(durMatch[1], 10)
      const m = parseInt(durMatch[2], 10)
      const s = parseFloat(durMatch[3])
      durationSec = h * 3600 + m * 60 + s
    }
    // 总码率（首个 bitrate: 行）
    const brMatch = line.match(RE_BITRATE)
    if (brMatch && bitrateKbps === null) {
      bitrateKbps = parseFloat(brMatch[1])
    }
    // 视频流
    if (videoCodec === null && /:\s*Video:/.test(line)) {
      const v = line.match(RE_VIDEO) ?? line.match(RE_VIDEO_NO_FPS)
      if (v) {
        videoCodec = v[1]
        width = parseInt(v[2], 10)
        height = parseInt(v[3], 10)
        if (v.length > 4) fps = parseFloat(v[4])
      }
    }
    // 音频流
    if (audioCodec === null && /:\s*Audio:/.test(line)) {
      const a = line.match(RE_AUDIO)
      if (a) {
        audioCodec = a[1]
        const sr = line.match(RE_AUDIO_SR)
        if (sr) audioSampleRate = parseInt(sr[1], 10)
      }
    }
  }

  if (!videoCodec && !format && durationSec === null && bitrateKbps === null) {
    throw new Error('无法识别该视频文件（ffmpeg 未探测到有效流信息）')
  }

  let sizeBytes = 0
  try {
    sizeBytes = statSync(filePath).size
  } catch {
    /* 文件已被删除等 */
  }

  // 兜底：Duration: N/A 时按文件大小 / 码率估算
  if (durationSec === null && bitrateKbps && sizeBytes > 0) {
    durationSec = sizeBytes / ((bitrateKbps * 1000) / 8)
  }

  const info: VideoInfo = {
    path: filePath,
    fileName: basename(filePath),
    format,
    durationSec,
    bitrateKbps,
    width,
    height,
    fps,
    videoCodec,
    audioCodec,
    audioSampleRate,
    sizeBytes,
    hasAudio: audioCodec !== null
  }
  return info
}
