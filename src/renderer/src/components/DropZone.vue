<script setup lang="ts">
import { ref } from 'vue'
import { useVideoStore } from '../stores/video'
import { useTaskStore } from '../stores/tasks'

const emit = defineEmits<{ loaded: [filePath: string] }>()

const video = useVideoStore()
const tasks = useTaskStore()

const dragOver = ref(false)

/** 校验并提取拖入/选中的视频文件路径 */
function extractVideos(files: FileList | File[]): string[] {
  const exts = new Set(['mp4', 'mkv', 'mov', 'avi', 'webm', 'flv', 'wmv', 'ts', 'm4v', '3gp', 'gif'])
  const out: string[] = []
  for (const f of files) {
    // Electron 拖拽的文件是 File 对象，带 path
    const p = (f as File & { path?: string }).path
    if (!p) continue
    const ext = p.split('.').pop()?.toLowerCase() ?? ''
    if (exts.has(ext)) out.push(p)
  }
  return out
}

async function onFiles(files: FileList | File[]): Promise<void> {
  const paths = extractVideos(files)
  if (paths.length === 0) return
  // 第一个进入表单精细配置
  const ok = await video.loadVideo(paths[0])
  if (ok) emit('loaded', paths[0])
  // 其余批量入队（默认 MP4/H.264 参数立即转换）
  for (const p of paths.slice(1)) {
    try {
      const info = await window.api.probe(p)
      await tasks.enqueueDirect(p, info.durationSec ?? undefined)
    } catch {
      /* 跳过无法识别的文件 */
    }
  }
}

function onDrop(e: DragEvent): void {
  dragOver.value = false
  if (e.dataTransfer?.files) void onFiles(e.dataTransfer.files)
}

async function onPick(): Promise<void> {
  const paths = await window.api.pickVideos()
  if (paths.length > 0) {
    const ok = await video.loadVideo(paths[0])
    if (ok) emit('loaded', paths[0])
    for (const p of paths.slice(1)) {
      try {
        const info = await window.api.probe(p)
        await tasks.enqueueDirect(p, info.durationSec ?? undefined)
      } catch {
        /* 跳过 */
      }
    }
  }
}
</script>

<template>
  <div
    class="dropzone"
    :class="{ dragging: dragOver }"
    @dragenter.prevent="dragOver = true"
    @dragover.prevent="dragOver = true"
    @dragleave.prevent="dragOver = false"
    @drop.prevent="onDrop"
    @click="onPick"
  >
    <div class="inner">
      <div class="icon-wrap">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 16V4m0 0L8 8m4-4 4 4" />
          <path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />
        </svg>
      </div>
      <p class="main">将视频拖放到这里</p>
      <p class="sub">或点击选择文件 · 支持 MP4 / MKV / MOV / AVI / WebM / GIF 等</p>
    </div>
  </div>
</template>

<style scoped>
.dropzone {
  position: relative;
  border: 1.5px dashed var(--border-strong);
  border-radius: var(--radius);
  background: var(--surface);
  cursor: pointer;
  transition: all 0.25s ease;
  overflow: hidden;
}
.dropzone:hover {
  border-color: var(--accent);
  background: var(--surface-strong);
}
.dropzone.dragging {
  border-color: var(--accent-2);
  background: var(--accent-soft);
  box-shadow: 0 0 0 4px var(--accent-soft), 0 8px 40px var(--accent-glow);
  transform: scale(1.01);
}

.inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 180px;
  padding: 32px;
  pointer-events: none;
}

.icon-wrap {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent-soft);
  color: var(--accent-2);
  margin-bottom: 4px;
  transition: transform 0.25s ease;
}
.dropzone.dragging .icon-wrap {
  transform: translateY(-4px) scale(1.08);
}
.icon-wrap svg {
  width: 28px;
  height: 28px;
}

.main {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-1);
}
.sub {
  font-size: 12.5px;
  color: var(--text-3);
}
</style>
