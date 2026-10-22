<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useVideoStore } from '../stores/video'
import { useTaskStore } from '../stores/tasks'
import { useGpuStore } from '../stores/gpu'
import { AUDIO_CODECS, PRESETS, VIDEO_CODECS } from '@shared/presets'
import type { ConvertTask } from '../../../shared/types'
import { formatBytes } from '../utils/format'

const video = useVideoStore()
const tasks = useTaskStore()
const gpu = useGpuStore()

const activePreset = ref<string | null>(null)
const container = ref('mp4')
const videoCodec = ref('libx264')
const audioCodec = ref('aac')
const resolution = ref('original')
const customW = ref(1920)
const customH = ref(1080)
const fps = ref<number>(0) // 0 = 保持原帧率
const rateMode = ref<'crf' | 'bitrate'>('crf')
const crf = ref(23)
const bitrate = ref('3000k')
const x264Preset = ref('medium')
const audioBitrate = ref('128k')
const startSec = ref<number | null>(null)
const endSec = ref<number | null>(null)

const converting = ref(false)

const RES_OPTIONS = [
  { label: '原始大小', w: 0, h: 0 },
  { label: '4K (3840)', w: 3840, h: 0 },
  { label: '2K (2560)', w: 2560, h: 0 },
  { label: '1080p', w: 1920, h: 0 },
  { label: '720p', w: 1280, h: 0 },
  { label: '480p', w: 854, h: 0 },
  { label: '自定义…', w: -1, h: -1 }
]

const FPS_OPTIONS = [
  { label: '保持原帧率', v: 0 },
  { label: '24 fps', v: 24 },
  { label: '25 fps', v: 25 },
  { label: '30 fps', v: 30 },
  { label: '60 fps', v: 60 }
]

const isHw = computed(() => videoCodec.value.includes('nvenc') || videoCodec.value.includes('amf') || videoCodec.value.includes('qsv'))
const isGif = computed(() => container.value === 'gif')
const isCopyVideo = computed(() => videoCodec.value === 'copy')

const gpuHint = computed(() => {
  if (!gpu.gpu?.available) return ''
  const available = new Set(gpu.gpu.encoders)
  const hwOptions = VIDEO_CODECS[container.value].filter((c) => c.hw && available.has(c.value))
  if (hwOptions.length === 0) return ''
  const names = [...new Set(hwOptions.map((c) => c.label.replace(/\s*\(.*\)$/, '')))]
  return `本机检测到 ${gpu.gpu.vendor} 硬件编码，可选 ${names.join(' / ')} 提升速度`
})

/** 容器变更：重置为合法编码组合 */
function onContainerChange(): void {
  activePreset.value = null
  const vc = VIDEO_CODECS[container.value] ?? []
  const ac = AUDIO_CODECS[container.value] ?? []
  // 优先选硬件编码（GPU 可用时）
  const gpuAvail = gpu.gpu?.available
  const hwOpt = gpuAvail ? vc.find((c) => c.hw) : undefined
  videoCodec.value = hwOpt?.value ?? (vc.find((c) => c.value === 'libx264')?.value ?? vc[0]?.value ?? 'libx264')
  audioCodec.value = ac.find((c) => c.value === 'aac')?.value ?? ac[0]?.value ?? 'none'
  if (videoCodec.value === 'libvpx-vp9') rateMode.value = 'crf'
}

/** 应用预设 */
function applyPreset(id: string): void {
  const p = PRESETS.find((x) => x.id === id)
  if (!p) return
  activePreset.value = id
  container.value = p.container
  videoCodec.value = p.videoCodec
  audioCodec.value = p.audioCodec
  rateMode.value = p.crf != null ? 'crf' : p.videoBitrate ? 'bitrate' : 'crf'
  crf.value = p.crf ?? 23
  bitrate.value = p.videoBitrate ?? '3000k'
  x264Preset.value = p.preset ?? 'medium'
  audioBitrate.value = p.audioBitrate ?? '128k'
  fps.value = p.fps ?? 0
  if (p.width && p.height) {
    resolution.value = 'custom'
    customW.value = p.width
    customH.value = p.height
  } else if (p.width) {
    resolution.value = String(p.width)
  } else {
    resolution.value = 'original'
  }
}

// 预设卡片在分辨率行展示匹配
const presetsShow = PRESETS

/** 用户手动改任意字段即取消预设选中态 */
function touch(): void {
  activePreset.value = null
}

/** 目标宽高（构建任务） */
function targetSize(): { width?: number; height?: number } {
  const opt = RES_OPTIONS.find((r) => r.label === resolution.value || String(r.w) === resolution.value)
  if (!opt || opt.w === 0) return {}
  if (opt.w === -1) {
    if (customW.value > 0) return { width: customW.value }
    if (customH.value > 0) return { height: customH.value }
    return {}
  }
  return { width: opt.w }
}

/** 输出体积预估（固定码率模式） */
const estSize = computed(() => {
  if (rateMode.value !== 'bitrate' || !video.info?.durationSec) return null
  const v = parseInt(bitrate.value, 10) || 0
  const a = parseInt(audioBitrate.value, 10) || 0
  if (v <= 0) return null
  return (video.info.durationSec * (v + a)) / 8 / 1024
})

async function startConvert(): Promise<void> {
  if (!video.info || converting.value) return
  const size = targetSize()
  const task: ConvertTask = {
    inputPath: video.info.path,
    container: container.value,
    videoCodec: videoCodec.value,
    audioCodec: audioCodec.value,
    videoBitrate: rateMode.value === 'bitrate' ? bitrate.value : undefined,
    crf: rateMode.value === 'crf' ? crf.value : undefined,
    preset: x264Preset.value,
    width: size.width,
    height: size.height,
    fps: fps.value > 0 ? fps.value : undefined,
    audioBitrate: audioBitrate.value,
    startSec: startSec.value ?? undefined,
    endSec: endSec.value ?? undefined,
    durationSec: video.info.durationSec ?? undefined
  }
  converting.value = true
  try {
    await tasks.convert(task)
  } finally {
    converting.value = false
  }
  await nextTick()
  document.querySelector('.queue-col')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// GPU 检测完成后，若当前仍是软件编码且硬编可用，给出一次默认切换（不覆盖用户手动选择）
let gpuAutoApplied = false
watch(
  () => gpu.gpu?.available,
  (avail) => {
    if (!avail || gpuAutoApplied || activePreset.value) return
    const available = gpu.gpu?.encoders ?? []
    const opt = VIDEO_CODECS[container.value].find((c) => c.hw && available.includes(c.value))
    if (opt) {
      videoCodec.value = opt.value
      gpuAutoApplied = true
    }
  },
  { immediate: true }
)
</script>

<template>
  <div class="convert-form card">
    <header class="form-head">
      <div>
        <h2>转换设置</h2>
        <p class="sub">选择目标格式与质量，点击开始转换</p>
      </div>
      <span v-if="gpuHint" class="badge badge-ok">⚡ GPU 加速可用</span>
    </header>

    <!-- 预设 -->
    <section class="presets">
      <div class="preset-row">
        <button
          v-for="p in presetsShow"
          :key="p.id"
          class="preset"
          :class="{ active: activePreset === p.id }"
          @click="applyPreset(p.id)"
        >
          <span class="p-name">{{ p.name }}</span>
          <span class="p-desc">{{ p.desc }}</span>
          <span v-if="p.badge" class="p-badge">{{ p.badge }}</span>
        </button>
      </div>
      <div class="gpu-tip" v-if="gpuHint">{{ gpuHint }}</div>
    </section>

    <!-- 表单 -->
    <section class="fields">
      <div class="f-grid">
        <label class="field">
          <span class="f-label">输出格式</span>
          <select v-model="container" class="select" @change="onContainerChange">
            <option value="mp4">MP4 — 最通用</option>
            <option value="mkv">MKV — 高保真</option>
            <option value="webm">WebM — 网页</option>
            <option value="mov">MOV — Apple</option>
            <option value="avi">AVI — 老设备</option>
            <option value="gif">GIF — 动图</option>
          </select>
        </label>

        <label class="field">
          <span class="f-label">视频编码</span>
          <select v-model="videoCodec" class="select" @change="touch">
            <option v-for="c in VIDEO_CODECS[container]" :key="c.value" :value="c.value">
              {{ c.label }}{{ c.hw ? ' ⚡' : '' }}
            </option>
          </select>
        </label>

        <label class="field">
          <span class="f-label">音频编码</span>
          <select v-model="audioCodec" class="select" @change="touch">
            <option v-for="c in AUDIO_CODECS[container]" :key="c.value" :value="c.value">{{ c.label }}</option>
          </select>
        </label>

        <label class="field">
          <span class="f-label">分辨率</span>
          <div class="inline-row">
            <select v-model="resolution" class="select" @change="touch">
              <option v-for="r in RES_OPTIONS" :key="r.label" :value="String(r.w)">{{ r.label }}</option>
            </select>
            <template v-if="resolution === '-1'">
              <input v-model.number="customW" type="number" min="1" class="input num w-custom" placeholder="宽" />
              <span class="x">×</span>
              <input v-model.number="customH" type="number" min="1" class="input num w-custom" placeholder="高" />
            </template>
          </div>
        </label>

        <label class="field">
          <span class="f-label">帧率</span>
          <select v-model.number="fps" class="select" @change="touch">
            <option v-for="f in FPS_OPTIONS" :key="f.v" :value="f.v">{{ f.label }}</option>
          </select>
        </label>

        <!-- 质量 -->
        <label class="field">
          <span class="f-label">画质模式</span>
          <div class="seg">
            <button class="seg-btn" :class="{ active: rateMode === 'crf' }" :disabled="isHw || isCopyVideo" @click="rateMode = 'crf'; touch()">质量 (CRF)</button>
            <button class="seg-btn" :class="{ active: rateMode === 'bitrate' }" :disabled="isCopyVideo" @click="rateMode = 'bitrate'; touch()">码率</button>
          </div>
        </label>

        <div class="field" v-if="rateMode === 'crf' && !isHw && !isCopyVideo">
          <span class="f-label">CRF 质量：{{ crf }}（小=质量高）</span>
          <input v-model.number="crf" type="range" min="0" max="51" @change="touch" />
          <div class="range-labels"><span>高质量</span><span>高压缩</span></div>
        </div>

        <label class="field" v-else-if="rateMode === 'bitrate' && !isCopyVideo">
          <span class="f-label">视频码率</span>
          <div class="inline-row">
            <input v-model="bitrate" class="input mono" placeholder="3000k" @change="touch" />
            <span class="unit">kbps</span>
          </div>
        </label>

        <label class="field" v-if="videoCodec === 'libx264' || videoCodec === 'libx265'">
          <span class="f-label">编码速度</span>
          <select v-model="x264Preset" class="select" @change="touch">
            <option value="ultrafast">ultrafast · 最快</option>
            <option value="veryfast">veryfast</option>
            <option value="fast">fast</option>
            <option value="medium">medium · 平衡</option>
            <option value="slow">slow</option>
            <option value="veryslow">veryslow · 最慢压缩</option>
          </select>
        </label>

        <label class="field">
          <span class="f-label">音频码率</span>
          <div class="inline-row">
            <input v-model="audioBitrate" class="input mono" placeholder="128k" @change="touch" />
            <span class="unit">kbps</span>
          </div>
        </label>

        <!-- 剪辑 -->
        <div class="field span-2">
          <span class="f-label">片段剪辑（可选）</span>
          <div class="inline-row">
            <input v-model.number="startSec" type="number" min="0" step="1" class="input num" placeholder="开始 (秒)" />
            <span class="x">→</span>
            <input v-model.number="endSec" type="number" min="0" step="1" class="input num" placeholder="结束 (秒)" />
            <span class="hint-inline">留空 = 完整视频</span>
          </div>
        </div>
      </div>
    </section>

    <!-- 底部动作 -->
    <footer class="form-foot">
      <div class="est" v-if="isGif">
        <span class="hint-inline">GIF 动图不含音频，转换体积较大请控制时长</span>
      </div>
      <div class="est" v-else-if="estSize">
        <span class="est-label">预计输出</span>
        <span class="est-value num">{{ formatBytes(estSize * 1024 * 1024) }}</span>
        <span class="hint-inline">（固定码率估算，实际以编码结果为准）</span>
      </div>
      <div class="est" v-else-if="rateMode === 'crf'">
        <span class="hint-inline">CRF 质量模式：体积取决于画面复杂度，压缩率通常更高</span>
      </div>
      <button class="btn btn-primary btn-lg" :disabled="converting || !video.info" @click="startConvert">
        <svg class="btn-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 4 14 8-14 8V4z" /></svg>
        开始转换
      </button>
    </footer>
  </div>
</template>

<style scoped>
.convert-form {
  display: flex;
  flex-direction: column;
  padding: 18px 20px;
  height: 100%;
}

.form-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 14px;
}
.form-head h2 {
  font-size: 16px;
  font-weight: 600;
}
.sub {
  font-size: 12px;
  color: var(--text-3);
  margin-top: 2px;
}

.presets {
  margin-bottom: 16px;
}
.preset-row {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
}
.preset {
  flex-shrink: 0;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 10px 14px;
  min-width: 128px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-1);
  cursor: pointer;
  transition: all 0.18s ease;
  text-align: left;
}
.preset:hover {
  border-color: var(--border-strong);
  background: var(--surface-hover);
}
.preset.active {
  border-color: var(--accent);
  background: var(--accent-soft);
  box-shadow: 0 0 0 2px var(--accent-soft);
}
.p-name {
  font-size: 13px;
  font-weight: 600;
}
.p-desc {
  font-size: 11px;
  color: var(--text-3);
}
.p-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent-2);
}
.gpu-tip {
  margin-top: 8px;
  font-size: 12px;
  color: var(--ok);
  background: var(--ok-soft);
  border-radius: 6px;
  padding: 6px 10px;
}

.fields {
  flex: 1;
}
.f-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px 14px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.span-2 {
  grid-column: span 2;
}
.f-label {
  font-size: 12px;
  color: var(--text-2);
}
.inline-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.x {
  color: var(--text-3);
}
.unit {
  font-size: 12px;
  color: var(--text-3);
}
.w-custom {
  width: 76px;
}
.range-labels {
  display: flex;
  justify-content: space-between;
  font-size: 10.5px;
  color: var(--text-3);
}
.seg {
  display: inline-flex;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 3px;
  align-self: flex-start;
}
.seg-btn {
  padding: 5px 14px;
  border: none;
  background: transparent;
  color: var(--text-2);
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.15s ease;
}
.seg-btn.active {
  background: var(--accent-soft);
  color: var(--accent-2);
  font-weight: 500;
}
.seg-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.hint-inline {
  font-size: 11.5px;
  color: var(--text-3);
}

.form-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid var(--border);
}
.est {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.est-label {
  font-size: 12px;
  color: var(--text-2);
}
.est-value {
  font-size: 15px;
  font-weight: 700;
  color: var(--accent-2);
}
.btn-lg {
  padding: 11px 26px;
  font-size: 14px;
  flex-shrink: 0;
  white-space: nowrap;
}
.btn-ic {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}
</style>
