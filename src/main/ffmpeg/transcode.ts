import { spawn, type ChildProcess } from 'child_process'
import { createInterface } from 'readline'
import { existsSync, mkdirSync, rmSync, statSync } from 'fs'
import { basename, dirname, extname, join } from 'path'
import { randomUUID } from 'crypto'
import { app } from 'electron'
import type { ConvertTask, DonePayload, ProgressPayload } from '../../shared/types'
import { getFfmpegPath } from './ffmpegPath'

const running = new Map<string, ChildProcess>()

// ---------- 编码 × 容器合法性 ----------
/** 非法组合校验：抛错则 UI 端已禁用，此处兜底 */
export function validateCombination(container: string, videoCodec: string, audioCodec: string): void {
  const err = (msg: string): never => {
    throw new Error(msg)
  }
  const v = videoCodec
  const a = audioCodec
  switch (container) {
    case 'mp4':
      if (v.includes('vp')) err('MP4 容器不支持 VP8/VP9 视频编码，请改用 H.264/H.265 或选择 WebM')
      if (a === 'libopus' || a === 'vorbis') err('MP4 容器不支持 Opus/Vorbis 音频，请改用 AAC')
      break
    case 'webm':
      if (!v.includes('vp') && v !== 'copy') err('WebM 容器仅支持 VP8/VP9 视频编码')
      if (!['libopus', 'vorbis', 'copy', 'none'].includes(a)) err('WebM 容器仅支持 Opus/Vorbis 音频')
      break
    case 'avi':
      if (a === 'libopus' || a === 'aac') err('AVI 容器通常不支持 Opus/AAC，请改用 MP3')
      break
    case 'gif':
      break
  }
}

/**
 * 构建 ffmpeg 命令行参数（数组形式，spawn 直接传，中文/空格路径安全）。
 */
export function buildArgs(t: ConvertTask): string[] {
  const args = ['-hide_banner', '-y', '-nostdin']

  // GIF 专用：palette 两遍法
  if (t.container === 'gif' || t.videoCodec === 'gif') {
    args.push('-i', t.inputPath)
    const fps = t.fps ?? 10
    const scale = t.width ? `scale=${t.width}:-1:flags=lanczos` : 'scale=480:-1:flags=lanczos'
    args.push(
      '-vf',
      `fps=${fps},${scale},split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`,
      '-loop', '0',
      '-an'
    )
    args.push('-progress', 'pipe:1', '-nostats')
    args.push(t.outputPath ?? t.inputPath.replace(/\.[^.]+$/, '_converted.gif'))
    return args
  }

  // 剪辑起止
  if (t.startSec != null && t.startSec > 0) args.push('-ss', String(t.startSec))
  args.push('-i', t.inputPath)

  // 视频
  if (t.videoCodec === 'copy') {
    args.push('-c:v', 'copy')
  } else {
    args.push('-c:v', t.videoCodec)
    if (t.videoCodec === 'libx264' || t.videoCodec === 'libx265') {
      args.push('-preset', t.preset ?? 'medium')
      if (t.crf != null) args.push('-crf', String(t.crf))
    }
    if (t.videoCodec === 'libvpx' || t.videoCodec === 'libvpx-vp9') {
      if (t.crf != null) args.push('-crf', String(t.crf))
      if (t.videoBitrate) args.push('-b:v', t.videoBitrate)
      if (t.videoCodec === 'libvpx-vp9') args.push('-row-mt', '1')
    }
    if (t.videoBitrate && t.videoCodec !== 'libvpx-vp9') args.push('-b:v', t.videoBitrate)
    if (t.width || t.height) {
      const w = t.width ?? -2
      const h = t.height ?? -2
      args.push('-vf', `scale=${w}:${h}:force_original_aspect_ratio=decrease,setsar=1`)
    }
    args.push('-pix_fmt', 'yuv420p') // 保证 mp4 / 硬编兼容，防 yuv444 花屏
    if (t.fps) args.push('-r', String(t.fps))
  }

  // 音频
  if (t.audioCodec === 'copy') {
    args.push('-c:a', 'copy')
  } else if (t.audioCodec && t.audioCodec !== 'none') {
    args.push('-c:a', t.audioCodec)
    if (t.audioBitrate) args.push('-b:a', t.audioBitrate)
  } else {
    args.push('-an')
  }

  // 剪辑时长
  if (t.endSec != null && t.startSec != null && t.endSec > t.startSec) {
    args.push('-t', String(t.endSec - t.startSec))
  }

  args.push('-progress', 'pipe:1', '-nostats', '-threads', '0')
  // 不显式指定 -f：让 ffmpeg 依据输出文件扩展名（.mkv/.mp4/.webm/.mov/.avi/.gif）
  // 自动选择 muxer（mkv 对应的 muxer 名是 matroska，硬写 -f mkv 会报 "not known"）
  args.push(t.outputPath ?? defaultOutputPath(t.inputPath, t.container))
  return args
}

/** 默认输出路径：输入同目录 原名_converted.ext（若设置了输出目录则用输出目录） */
export function defaultOutputPath(inputPath: string, container: string): string {
  const base = basename(inputPath).replace(/\.[^.]+$/, '')
  const outDir = join(dirname(inputPath))
  mkdirSync(outDir, { recursive: true })
  return join(outDir, `${base}_converted.${container}`)
}

/** 根据设置/用户选择生成输出路径 */
export function resolveOutputPath(inputPath: string, container: string, customDir: string | null): string {
  const base = basename(inputPath).replace(/\.[^.]+$/, '')
  const dir = customDir && customDir.trim() ? customDir : dirname(inputPath)
  mkdirSync(dir, { recursive: true })
  // 防同名覆盖：追加序号
  let out = join(dir, `${base}_converted.${container}`)
  let n = 2
  while (existsSync(out)) {
    out = join(dir, `${base}_converted_${n}.${container}`)
    n += 1
  }
  return out
}

export interface TranscodeCallbacks {
  onProgress: (p: ProgressPayload) => void
  onDone: (d: DonePayload) => void
}

/**
 * 启动一个转码任务。
 * @returns taskId
 */
export function runTranscode(task: ConvertTask, cb: TranscodeCallbacks): string {
  const taskId = task.taskId ?? randomUUID()
  const inputPath = task.inputPath
  const ffmpeg = getFfmpegPath()
  const args = buildArgs(task)
  const outputPath = task.outputPath ?? defaultOutputPath(inputPath, task.container)

  // 进度百分比基于剪辑后时长（若有剪辑）或原始时长
  const durationSec = task.endSec != null && task.startSec != null ? task.endSec - task.startSec : task.durationSec ?? null

  const child = spawn(ffmpeg, args, {
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe']
  })
  running.set(taskId, child)

  let stderrTail = ''
  const lastErr = (len = 600): string => {
    return stderrTail.slice(-len).trim()
  }

  child.stderr.on('data', (d: Buffer) => {
    stderrTail += d.toString('utf-8')
    if (stderrTail.length > 8192) stderrTail = stderrTail.slice(-8192)
  })

  // 进度解析
  const rl = createInterface({ input: child.stdout })
  let block: Record<string, string> = {}
  let lastEmit = 0

  const emitProgress = (b: Record<string, string>, force = false): void => {
    const now = Date.now()
    if (!force && now - lastEmit < 100) return
    lastEmit = now
    const rawOutUs = parseInt(b['out_time_us'] ?? b['out_time_ms'] ?? '0', 10)
    const outUs = force && durationSec ? Math.round(durationSec * 1_000_000) : rawOutUs
    const outSec = (Number.isFinite(outUs) ? outUs : 0) / 1_000_000
    const percent = durationSec && durationSec > 0 ? Math.min(100, (outSec / durationSec) * 100) : 0
    const speed = parseFloat(String(b['speed'] ?? '0').replace('x', '')) || 0
    const etaSec = speed > 0 && durationSec ? Math.max(0, (durationSec - outSec) / speed) : null
    cb.onProgress({
      taskId,
      percent,
      outTimeSec: outSec,
      speed,
      etaSec,
      frame: parseInt(b['frame'] ?? '0', 10) || 0
    })
  }

  rl.on('line', (line) => {
    const eq = line.indexOf('=')
    if (eq === -1) return
    const k = line.slice(0, eq).trim()
    const v = line.slice(eq + 1).trim()
    if (k === 'progress') {
      emitProgress(block, v === 'end')
      block = {}
    } else {
      block[k] = v
    }
  })

  child.on('error', (err) => {
    running.delete(taskId)
    cb.onDone({
      taskId,
      ok: false,
      error: `无法启动 ffmpeg: ${err.message}`
    })
  })

  child.on('close', (code) => {
    running.delete(taskId)
    if (code === 0) {
      let outSize: number | undefined
      try {
        outSize = statSync(outputPath).size
      } catch {
        /* 无输出 */
      }
      cb.onDone({
        taskId,
        ok: true,
        outputPath,
        outputSizeBytes: outSize,
        inputSizeBytes: inputSizeBytes(inputPath)
      })
    } else {
      // 失败/取消：删除不完整输出
      if (existsSync(outputPath)) {
        try {
          rmSync(outputPath, { force: true })
        } catch {
          /* 忽略 */
        }
      }
      cb.onDone({
        taskId,
        ok: false,
        error: lastErr() || `ffmpeg 退出码 ${code}`
      })
    }
  })

  return taskId
}

function inputSizeBytes(p: string): number | undefined {
  try {
    return statSync(p).size
  } catch {
    return undefined
  }
}

/** 取消任务：kill 进程并标记取消（close 事件里清理输出） */
export function cancelTask(taskId: string): boolean {
  const child = running.get(taskId)
  if (!child) return false
  child.kill()
  return true
}

export function hasRunning(taskId: string): boolean {
  return running.has(taskId)
}

/** 当前运行数（供并发池用） */
export function runningCount(): number {
  return running.size
}

/** 正在运行的所有 taskId */
export function runningIds(): string[] {
  return [...running.keys()]
}
