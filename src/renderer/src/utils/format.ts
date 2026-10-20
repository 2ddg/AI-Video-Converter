/** 格式化工具（渲染进程共用） */

export function formatDuration(sec: number | null | undefined): string {
  if (!sec || !isFinite(sec) || sec <= 0) return '--:--'
  const s = Math.floor(sec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = s % 60
  const mm = String(m).padStart(2, '0')
  const sss = String(ss).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${sss}` : `${m}:${sss}`
}

export function formatBytes(bytes: number | undefined | null): string {
  if (!bytes || bytes <= 0) return '--'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let v = bytes
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i += 1
  }
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1)} ${units[i]}`
}

export function formatBitrate(kbps: number | null | undefined): string {
  if (!kbps || kbps <= 0) return '--'
  if (kbps >= 1000) return `${(kbps / 1000).toFixed(2)} Mbps`
  return `${kbps.toFixed(0)} kbps`
}

const CODEC_NAMES: Record<string, string> = {
  h264: 'H.264 (AVC)',
  hevc: 'H.265 (HEVC)',
  av1: 'AV1',
  vp9: 'VP9',
  vp8: 'VP8',
  mpeg4: 'MPEG-4 Part 2',
  mjpeg: 'MJPEG',
  aac: 'AAC',
  mp3: 'MP3',
  opus: 'Opus',
  vorbis: 'Vorbis',
  flac: 'FLAC',
  pcm_s16le: 'PCM',
  ac3: 'AC-3',
  libx264: 'H.264 (libx264)',
  libx265: 'H.265 (libx265)',
  libvpx: 'VP8 (libvpx)',
  'libvpx-vp9': 'VP9 (libvpx-vp9)',
  libopus: 'Opus',
  libmp3lame: 'MP3',
  h264_nvenc: 'H.264 NVENC',
  hevc_nvenc: 'H.265 NVENC',
  h264_amf: 'H.264 AMF',
  hevc_amf: 'H.265 AMF',
  h264_qsv: 'H.264 QSV',
  hevc_qsv: 'H.265 QSV'
}

export function codecName(codec: string | null | undefined): string {
  if (!codec) return '--'
  return CODEC_NAMES[codec] ?? codec
}

export function formatEta(sec: number | null | undefined): string {
  if (!sec || sec <= 0 || !isFinite(sec)) return '--'
  if (sec < 60) return `${Math.ceil(sec)}s`
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${Math.ceil(sec % 60)}s`
  return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`
}

export function formatPercent(p: number): string {
  return `${Math.min(99, Math.floor(p))}%`
}

export function formatDateTime(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
