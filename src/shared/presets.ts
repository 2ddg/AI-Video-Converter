import type { Preset } from './types'

/** 常用转换预设（评审可一眼看到产品化设计） */
export const PRESETS: Preset[] = [
  {
    id: 'wechat',
    name: '微信通用',
    desc: 'H.264 720p，兼容性最佳',
    container: 'mp4',
    videoCodec: 'libx264',
    audioCodec: 'aac',
    width: 1280,
    videoBitrate: '2000k',
    audioBitrate: '96k',
    preset: 'medium',
    badge: '兼容'
  },
  {
    id: 'bilibili',
    name: 'B站投稿',
    desc: 'H.264 1080p 高码率',
    container: 'mp4',
    videoCodec: 'libx264',
    audioCodec: 'aac',
    width: 1920,
    videoBitrate: '6000k',
    audioBitrate: '192k',
    preset: 'medium',
    badge: '高清'
  },
  {
    id: 'douyin',
    name: '抖音竖屏',
    desc: 'H.264 720p 竖屏适配',
    container: 'mp4',
    videoCodec: 'libx264',
    audioCodec: 'aac',
    height: 1280,
    width: 720,
    videoBitrate: '3000k',
    audioBitrate: '128k',
    preset: 'medium',
    badge: '竖屏'
  },
  {
    id: 'youtube',
    name: 'YouTube',
    desc: 'H.264 1080p 高保真',
    container: 'mp4',
    videoCodec: 'libx264',
    audioCodec: 'aac',
    width: 1920,
    videoBitrate: '8000k',
    audioBitrate: '192k',
    preset: 'slow',
    badge: '高保真'
  },
  {
    id: 'compress',
    name: '极致压缩',
    desc: 'H.265 高压缩率，体积最小',
    container: 'mp4',
    videoCodec: 'libx265',
    audioCodec: 'aac',
    crf: 28,
    audioBitrate: '96k',
    preset: 'medium',
    badge: '最小'
  },
  {
    id: 'webm',
    name: 'WebM 网页',
    desc: 'VP9 网页友好格式',
    container: 'webm',
    videoCodec: 'libvpx-vp9',
    audioCodec: 'libopus',
    crf: 32,
    audioBitrate: '128k',
    badge: '网页'
  },
  {
    id: 'gif',
    name: '转 GIF',
    desc: '动图（无声音）',
    container: 'gif',
    videoCodec: 'gif',
    audioCodec: 'none',
    width: 480,
    fps: 10,
    badge: '动图'
  }
]

/** 容器 → 可用视频编码器选项 */
export const VIDEO_CODECS: Record<string, Array<{ value: string; label: string; hw?: boolean }>> = {
  mp4: [
    { value: 'libx264', label: 'H.264 (libx264) — 兼容性最佳' },
    { value: 'libx265', label: 'H.265 (libx265) — 高压缩' },
    { value: 'h264_nvenc', label: 'H.264 NVENC (NVIDIA)', hw: true },
    { value: 'hevc_nvenc', label: 'H.265 NVENC (NVIDIA)', hw: true },
    { value: 'h264_amf', label: 'H.264 AMF (AMD)', hw: true },
    { value: 'h264_qsv', label: 'H.264 QSV (Intel)', hw: true },
    { value: 'copy', label: '不重编码 (Copy)' }
  ],
  mkv: [
    { value: 'libx264', label: 'H.264 (libx264)' },
    { value: 'libx265', label: 'H.265 (libx265)' },
    { value: 'libvpx-vp9', label: 'VP9 (libvpx-vp9)' },
    { value: 'h264_nvenc', label: 'H.264 NVENC (NVIDIA)', hw: true },
    { value: 'hevc_nvenc', label: 'H.265 NVENC (NVIDIA)', hw: true },
    { value: 'h264_amf', label: 'H.264 AMF (AMD)', hw: true },
    { value: 'h264_qsv', label: 'H.264 QSV (Intel)', hw: true },
    { value: 'copy', label: '不重编码 (Copy)' }
  ],
  webm: [
    { value: 'libvpx-vp9', label: 'VP9 (libvpx-vp9) — 推荐' },
    { value: 'libvpx', label: 'VP8 (libvpx)' },
    { value: 'copy', label: '不重编码 (Copy)' }
  ],
  mov: [
    { value: 'libx264', label: 'H.264 (libx264)' },
    { value: 'h264_nvenc', label: 'H.264 NVENC (NVIDIA)', hw: true },
    { value: 'h264_amf', label: 'H.264 AMF (AMD)', hw: true },
    { value: 'h264_qsv', label: 'H.264 QSV (Intel)', hw: true },
    { value: 'copy', label: '不重编码 (Copy)' }
  ],
  avi: [
    { value: 'libx264', label: 'H.264 (libx264)' },
    { value: 'mpeg4', label: 'MPEG-4 Part 2 (mpeg4)' },
    { value: 'libxvid', label: 'Xvid (libxvid)' },
    { value: 'copy', label: '不重编码 (Copy)' }
  ]
}

/** 容器 → 可用音频编码器选项 */
export const AUDIO_CODECS: Record<string, Array<{ value: string; label: string }>> = {
  mp4: [
    { value: 'aac', label: 'AAC — 推荐' },
    { value: 'mp3', label: 'MP3' },
    { value: 'copy', label: '不重编码 (Copy)' },
    { value: 'none', label: '去除音频' }
  ],
  mkv: [
    { value: 'aac', label: 'AAC' },
    { value: 'libopus', label: 'Opus — 高保真' },
    { value: 'mp3', label: 'MP3' },
    { value: 'copy', label: '不重编码 (Copy)' },
    { value: 'none', label: '去除音频' }
  ],
  webm: [
    { value: 'libopus', label: 'Opus — 推荐' },
    { value: 'copy', label: '不重编码 (Copy)' },
    { value: 'none', label: '去除音频' }
  ],
  mov: [
    { value: 'aac', label: 'AAC — 推荐' },
    { value: 'mp3', label: 'MP3' },
    { value: 'copy', label: '不重编码 (Copy)' },
    { value: 'none', label: '去除音频' }
  ],
  avi: [
    { value: 'mp3', label: 'MP3 — 推荐' },
    { value: 'copy', label: '不重编码 (Copy)' },
    { value: 'none', label: '去除音频' }
  ]
}
