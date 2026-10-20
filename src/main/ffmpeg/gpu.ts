import { spawn } from 'child_process'
import type { GpuInfo } from '../../shared/types'
import { getFfmpegPath } from './ffmpegPath'

/** 候选硬件编码器（按品牌分组） */
const HW_ENCODERS: Array<{ encoder: string; vendor: string }> = [
  { encoder: 'h264_nvenc', vendor: 'NVIDIA' },
  { encoder: 'hevc_nvenc', vendor: 'NVIDIA' },
  { encoder: 'h264_amf', vendor: 'AMD' },
  { encoder: 'hevc_amf', vendor: 'AMD' },
  { encoder: 'h264_qsv', vendor: 'Intel' },
  { encoder: 'hevc_qsv', vendor: 'Intel' }
]

const ENCODER_TIMEOUT_MS = 6_000

/**
 * 运行时探测硬件编码器是否真正可用。
 * 不能只看编译开关（build 里编了 nvenc 不等于机器有 N 卡）：
 * 用零输入（lavfi testsrc）+ 零落盘（-f null -）做一次试编码，退出码 0 即可用。
 */
export function detectGpuEncoders(): Promise<GpuInfo> {
  return new Promise((resolve) => {
    const ffmpeg = getFfmpegPath()
    const results: string[] = []
    const vendors = new Set<string>()
    let pending = HW_ENCODERS.length

    const test = (item: { encoder: string; vendor: string }): void => {
      const child = spawn(
        ffmpeg,
        [
          '-hide_banner',
          '-f', 'lavfi',
          '-i', 'testsrc=duration=0.2:size=64x64:rate=5',
          '-frames:v', '1',
          '-c:v', item.encoder,
          '-f', 'null',
          '-'
        ],
        { windowsHide: true }
      )
      const timer = setTimeout(() => {
        child.kill()
        done(item, false)
      }, ENCODER_TIMEOUT_MS)
      child.on('error', () => {
        clearTimeout(timer)
        done(item, false)
      })
      child.on('close', (code) => {
        clearTimeout(timer)
        done(item, code === 0)
      })
    }

    const done = (item: { encoder: string; vendor: string }, ok: boolean): void => {
      if (ok) {
        results.push(item.encoder)
        vendors.add(item.vendor)
      }
      pending -= 1
      if (pending <= 0) finish()
    }

    const finish = (): void => {
      const gpu: GpuInfo = {
        encoders: results,
        vendor: results.length > 0 ? [...vendors].join(' + ') : null,
        detectedAt: Date.now(),
        available: results.length > 0
      }
      resolve(gpu)
    }

    // 全部启动
    for (const item of HW_ENCODERS) test(item)
  })
}

/** 是否为硬件编码器 */
export function isHwEncoder(codec: string): boolean {
  return codec.includes('nvenc') || codec.includes('amf') || codec.includes('qsv')
}

/** 选择该容器下可用的首选硬件视频编码器（若检测到） */
export function pickHwVideoCodec(
  container: string,
  gpu: GpuInfo | null,
  preferHevc = false
): string | null {
  if (!gpu || !gpu.available) return null
  const codecs = preferHevc ? gpu.encoders.filter((c) => c.includes('hevc')) : gpu.encoders
  const pool = codecs.length > 0 ? codecs : gpu.encoders
  // mp4/mov 需要 mp4 兼容的硬编；h264 家族最稳
  if (container === 'mp4' || container === 'mov') {
    return pool.find((c) => c.includes('h264')) ?? pool[0] ?? null
  }
  return pool[0] ?? null
}
