/** 主进程 / 渲染进程共享类型定义 */

/** ffmpeg -i 探测出的视频信息 */
export interface VideoInfo {
  path: string
  fileName: string
  /** 容器格式，如 mp4 / mkv / mov */
  format: string | null
  /** 时长（秒） */
  durationSec: number | null
  /** 总码率 kb/s */
  bitrateKbps: number | null
  /** 视频宽高 */
  width: number | null
  height: number | null
  /** 帧率 */
  fps: number | null
  /** 视频编码（原始 ffmpeg 名） */
  videoCodec: string | null
  /** 音频编码（原始 ffmpeg 名） */
  audioCodec: string | null
  /** 音频采样率 Hz */
  audioSampleRate: number | null
  /** 文件大小（字节） */
  sizeBytes: number
  /** 是否包含音频流 */
  hasAudio: boolean
}

/** 转换任务参数（由 UI 表单组装） */
export interface ConvertTask {
  taskId?: string
  inputPath: string
  /** 输出路径（主进程计算） */
  outputPath?: string
  /** 容器格式 mp4/mkv/webm/mov/avi/gif */
  container: string
  /** 视频编码器名（ffmpeg 名），'copy' 表示不重编码 */
  videoCodec: string
  /** 音频编码器名，'copy' 表示不重编码，'none' 表示去除 */
  audioCodec: string
  /** 视频目标码率，如 '3000k'（可选，与 crf 二选一） */
  videoBitrate?: string
  /** CRF 质量值 0-51（libx264/libx265/vp9） */
  crf?: number
  /** 编码预设 ultrafast..veryslow */
  preset?: string
  /** 目标宽度（可选） */
  width?: number
  /** 目标高度（可选） */
  height?: number
  /** 目标帧率（可选） */
  fps?: number
  /** 音频码率，如 '128k' */
  audioBitrate?: string
  /** 剪辑开始秒（可选） */
  startSec?: number
  /** 剪辑结束秒（可选） */
  endSec?: number
  /** 输入视频时长（秒，仅进度百分比计算用，非持久字段） */
  durationSec?: number
}

/** 进度推送 payload */
export interface ProgressPayload {
  taskId: string
  percent: number
  outTimeSec: number
  speed: number
  etaSec: number | null
  frame: number
}

/** 任务完成推送 payload */
export interface DonePayload {
  taskId: string
  ok: boolean
  outputPath?: string
  outputSizeBytes?: number
  inputSizeBytes?: number
  durationMs?: number
  error?: string
}

/** 任务状态 */
export type TaskStatus = 'queued' | 'converting' | 'done' | 'failed' | 'cancelled'

/** 历史任务记录（持久化到 userData/history.json） */
export interface TaskRecord {
  taskId: string
  inputPath: string
  outputPath: string | null
  container: string
  videoCodec: string
  status: TaskStatus
  percent: number
  error?: string
  inputSizeBytes?: number
  outputSizeBytes?: number
  createdAt: number
  finishedAt?: number
}

/** GPU 硬件编码检测结果 */
export interface GpuInfo {
  /** 当前可用的硬件编码器列表（ffmpeg 名） */
  encoders: string[]
  /** 品牌描述，如 NVIDIA / AMD / Intel */
  vendor: string | null
  /** 检测时间戳 */
  detectedAt: number | null
  /** 是否检测到任意可用硬件编码 */
  available: boolean
}

/** 应用设置 */
export interface AppSettings {
  /** 输出目录（默认输入同目录） */
  outputDir: string | null
  /** 并发任务数 */
  maxConcurrent: number
  /** 主题 dark/light */
  theme: 'dark' | 'light'
  /** 完成后系统通知 */
  notifyOnDone: boolean
  /** 自定义 ffmpeg 路径（可选覆盖） */
  ffmpegPath: string | null
  /** GPU 检测结果缓存 */
  gpu: GpuInfo | null
}

/** 预设定义 */
export interface Preset {
  id: string
  name: string
  desc: string
  container: string
  videoCodec: string
  audioCodec: string
  width?: number
  height?: number
  videoBitrate?: string
  crf?: number
  preset?: string
  audioBitrate?: string
  fps?: number
  /** 徽标文字（可选） */
  badge?: string
}

/** 应用信息 */
export interface AppInfo {
  version: string
  platform: string
  arch: string
  ffmpegPath: string
  ffmpegVersion: string | null
  appName: string
}
