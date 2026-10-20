<script setup lang="ts">
import { computed, ref } from 'vue'
import { useTaskStore, type TaskView } from '../stores/tasks'
import type { TaskStatus } from '../../../shared/types'
import { formatBytes, formatDateTime, formatEta } from '../utils/format'

const tasks = useTaskStore()

function showInFolder(p: string): void {
  void window.api.showInFolder(p)
}
function openDir(p: string): void {
  void window.api.openDir(p.replace(/[^/\\]*$/, ''))
}

const shown = computed(() => tasks.tasks)

let confirmTimer: ReturnType<typeof setTimeout> | null = null
const confirmingClear = ref(false)

function statusBadge(s: TaskStatus): { cls: string; text: string } {
  switch (s) {
    case 'queued':
      return { cls: 'badge-neutral', text: '排队中' }
    case 'converting':
      return { cls: 'badge-accent', text: '转换中' }
    case 'done':
      return { cls: 'badge-ok', text: '完成' }
    case 'failed':
      return { cls: 'badge-err', text: '失败' }
    case 'cancelled':
      return { cls: 'badge-neutral', text: '已取消' }
  }
}

function savedRatio(t: TaskView): number | null {
  if (t.status !== 'done' || !t.inputSizeBytes || !t.outputSizeBytes) return null
  if (t.inputSizeBytes <= 0) return null
  const r = 1 - t.outputSizeBytes / t.inputSizeBytes
  return r > 0.001 ? r : null
}

/** 二次确认清空（第一次点击进入确认态，3s 后复原） */
async function onClear(): Promise<void> {
  if (!confirmingClear.value) {
    confirmingClear.value = true
    if (confirmTimer) clearTimeout(confirmTimer)
    confirmTimer = setTimeout(() => {
      confirmingClear.value = false
    }, 3000)
    return
  }
  confirmingClear.value = false
  if (confirmTimer) clearTimeout(confirmTimer)
  await tasks.clearAll()
}

function fileExt(p: string): string {
  return p.split('.').pop()?.toUpperCase() ?? ''
}
</script>

<template>
  <div class="task-queue card">
    <header class="q-head">
      <div class="q-title">
        <h2>任务队列</h2>
        <span v-if="tasks.activeCount > 0" class="badge badge-accent">{{ tasks.activeCount }} 个转换中</span>
        <span v-else-if="shown.length > 0" class="badge badge-neutral">共 {{ shown.length }} 条</span>
      </div>
      <div class="q-actions">
        <button v-if="shown.length" class="btn btn-sm" :class="confirmingClear ? 'btn-danger' : 'btn-ghost'" @click="onClear">
          {{ confirmingClear ? '确认清空？' : '清空记录' }}
        </button>
      </div>
    </header>

    <div class="q-body" :class="{ empty: shown.length === 0 }">
      <template v-if="shown.length">
        <div v-for="t in shown" :key="t.taskId" class="task fade-up">
          <div class="t-top">
            <div class="t-file">
              <span class="ext-chip">{{ fileExt(t.inputPath) }}</span>
              <div class="t-name-box">
                <span class="t-name ellipsis">{{ t.inputPath.split(/[\\/]/).pop() }}</span>
                <span class="t-path ellipsis">{{ t.inputPath }}</span>
              </div>
            </div>
            <div class="t-status">
              <span :class="['badge', statusBadge(t.status).cls]">{{ statusBadge(t.status).text }}</span>
            </div>
          </div>

          <!-- 进度条 -->
          <div v-if="t.status === 'converting' || t.status === 'queued'" class="t-progress">
            <div class="bar">
              <div class="bar-fill" :style="{ width: t.percent + '%' }" />
            </div>
            <div class="bar-meta num">
              <span>{{ t.percent.toFixed(0) }}%</span>
              <span v-if="t.speed">· {{ t.speed.toFixed(1) }}x</span>
              <span v-if="t.etaSec !== null">· 剩余 {{ formatEta(t.etaSec) }}</span>
            </div>
          </div>

          <!-- 完成信息 -->
          <div v-if="t.status === 'done' && t.outputPath" class="t-done">
            <span class="t-out ellipsis">{{ t.outputPath }}</span>
            <span v-if="savedRatio(t)" class="saved num">体积减少 {{ (savedRatio(t)! * 100).toFixed(0) }}%</span>
          </div>
          <div v-if="t.status === 'failed'" class="t-err ellipsis" :title="t.error">{{ t.error }}</div>

          <div class="t-actions">
            <span v-if="t.finishedAt" class="t-time">{{ formatDateTime(t.finishedAt) }}</span>
            <button
              v-if="t.status === 'converting' || t.status === 'queued'"
              class="btn btn-sm btn-danger"
              @click="tasks.cancel(t.taskId)"
            >
              取消
            </button>
            <template v-if="t.status === 'done' && t.outputPath">
              <button class="btn btn-sm" @click="showInFolder(t.outputPath)">显示文件</button>
              <button class="btn btn-sm" @click="openDir(t.outputPath)">打开目录</button>
            </template>
          </div>
        </div>
      </template>
      <div v-else class="q-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="6" width="13" height="12" rx="2" />
          <path d="m17 10 4 2-4 2" />
        </svg>
        <p>暂无任务</p>
        <span>拖入视频并点击「开始转换」</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.task-queue {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.q-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border);
}
.q-title {
  display: flex;
  align-items: center;
  gap: 10px;
}
.q-title h2 {
  font-size: 15px;
  font-weight: 600;
}
.q-actions {
  display: flex;
  gap: 8px;
}

.q-body {
  padding: 10px 18px 16px;
  overflow-y: auto;
  min-height: 120px;
  max-height: 340px;
}
.q-body.empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 120px;
}

.task {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 12px 14px;
  margin-bottom: 10px;
  transition: border-color 0.15s ease;
}
.task:hover {
  border-color: var(--border-strong);
}

.t-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.t-file {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex: 1;
}
.ext-chip {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 5px;
  background: var(--accent-soft);
  color: var(--accent-2);
  letter-spacing: 0.04em;
}
.t-name-box {
  min-width: 0;
  flex: 1;
}
.t-name {
  font-size: 13px;
  font-weight: 600;
  display: block;
}
.t-path {
  font-size: 11px;
  color: var(--text-3);
  display: block;
}
.t-status {
  flex-shrink: 0;
}

.t-progress {
  margin-top: 10px;
}
.bar {
  height: 6px;
  border-radius: 999px;
  background: var(--surface-strong);
  overflow: hidden;
}
.bar-fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--accent), var(--accent-2));
  box-shadow: 0 0 8px var(--accent-glow);
  transition: width 0.25s ease;
}
.bar-meta {
  display: flex;
  gap: 8px;
  margin-top: 5px;
  font-size: 11px;
  color: var(--text-2);
}

.t-done {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
}
.t-out {
  font-size: 11.5px;
  color: var(--text-2);
  flex: 1;
  min-width: 0;
}
.saved {
  flex-shrink: 0;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--ok);
  background: var(--ok-soft);
  padding: 2px 8px;
  border-radius: 999px;
}
.t-err {
  margin-top: 8px;
  font-size: 11.5px;
  color: #f87171;
}

.t-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
}
.t-time {
  font-size: 11px;
  color: var(--text-3);
  margin-right: auto;
}

.q-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  color: var(--text-3);
}
.q-empty svg {
  width: 30px;
  height: 30px;
  margin-bottom: 4px;
  opacity: 0.5;
}
.q-empty p {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
}
.q-empty span {
  font-size: 11.5px;
}

.btn-sm {
  padding: 5px 12px;
  font-size: 12px;
}
</style>
