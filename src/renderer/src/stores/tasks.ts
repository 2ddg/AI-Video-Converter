import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { ConvertTask, DonePayload, ProgressPayload, TaskRecord, TaskStatus } from '../../../shared/types'

export interface TaskView extends TaskRecord {
  percent: number
  speed: number
  etaSec: number | null
}

/** 转换任务队列/历史状态（UI 视图层） */
export const useTaskStore = defineStore('tasks', () => {
  const tasks = ref<TaskView[]>([])

  const activeCount = computed(() => tasks.value.filter((t) => t.status === 'converting').length)
  const queuedCount = computed(() => tasks.value.filter((t) => t.status === 'queued').length)
  const doneCount = computed(() => tasks.value.filter((t) => t.status === 'done').length)

  /** 从主进程历史加载（应用启动 / 历史面板打开） */
  async function loadHistory(): Promise<void> {
    const records = await window.api.getHistory()
    // 启动时的历史全部视为完成/失败（进程内运行的早已结束）
    const views: TaskView[] = records.map((r) => ({
      ...r,
      percent: r.status === 'done' ? 100 : r.percent ?? 0,
      speed: 0,
      etaSec: null
    }))
    // 去重：与现有队列合并（保留进行中的）
    const existingIds = new Set(tasks.value.map((t) => t.taskId))
    tasks.value = [...tasks.value, ...views.filter((v) => !existingIds.has(v.taskId))]
  }

  function applyProgress(p: ProgressPayload): void {
    const t = tasks.value.find((x) => x.taskId === p.taskId)
    if (!t) {
      // 未知任务（可能刚入队历史未同步）：忽略
      return
    }
    if (t.status === 'queued') t.status = 'converting'
    t.percent = p.percent
    t.speed = p.speed
    t.etaSec = p.etaSec
  }

  function applyDone(d: DonePayload): void {
    const t = tasks.value.find((x) => x.taskId === d.taskId)
    if (t) {
      t.status = d.ok ? 'done' : 'failed'
      t.percent = d.ok ? 100 : t.percent
      t.outputPath = d.outputPath ?? t.outputPath
      t.outputSizeBytes = d.outputSizeBytes
      t.error = d.error
      t.finishedAt = Date.now()
      t.speed = 0
      t.etaSec = null
    }
  }

  async function cancel(taskId: string): Promise<void> {
    await window.api.cancel(taskId)
    const t = tasks.value.find((x) => x.taskId === taskId)
    if (t && (t.status === 'queued' || t.status === 'converting')) {
      t.status = 'cancelled'
    }
  }

  /** 以默认参数直接入队一个视频（批量拖入场景），返回 taskId 并加入本地队列 */
  async function enqueueDirect(inputPath: string, durationSec: number | undefined): Promise<string> {
    const task: ConvertTask = {
      inputPath,
      container: 'mp4',
      videoCodec: 'libx264',
      audioCodec: 'aac',
      crf: 23,
      preset: 'medium',
      durationSec
    }
    const taskId = await window.api.convert(task)
    tasks.value.unshift({
      taskId,
      inputPath,
      outputPath: null,
      container: 'mp4',
      videoCodec: 'libx264',
      status: 'queued',
      percent: 0,
      speed: 0,
      etaSec: null,
      createdAt: Date.now()
    })
    return taskId
  }

  /** 显式转换（表单配置） */
  async function convert(task: ConvertTask): Promise<string> {
    const taskId = await window.api.convert(task)
    tasks.value.unshift({
      taskId,
      inputPath: task.inputPath,
      outputPath: task.outputPath ?? null,
      container: task.container,
      videoCodec: task.videoCodec,
      status: 'queued',
      percent: 0,
      speed: 0,
      etaSec: null,
      createdAt: Date.now()
    })
    return taskId
  }

  async function clearAll(): Promise<void> {
    await window.api.clearHistory()
    tasks.value = []
  }

  return {
    tasks,
    activeCount,
    queuedCount,
    doneCount,
    loadHistory,
    applyProgress,
    applyDone,
    cancel,
    clearAll,
    enqueueDirect,
    convert
  }
})
