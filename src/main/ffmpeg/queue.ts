import { randomUUID } from 'crypto'
import type { ConvertTask, DonePayload, ProgressPayload, TaskStatus } from '../../shared/types'
import { runTranscode, cancelTask as killFfmpeg, runningCount } from './transcode'
import { loadSettings } from '../store/settings'

interface QueueItem {
  taskId: string
  task: ConvertTask
  status: TaskStatus
  onProgress: (p: ProgressPayload) => void
  onDone: (d: DonePayload) => void
}

const queue: QueueItem[] = []
let draining = false

/** 入队并启动调度 */
export function enqueue(task: ConvertTask, cb: { onProgress: (p: ProgressPayload) => void; onDone: (d: DonePayload) => void }): string {
  const taskId = randomUUID()
  queue.push({
    taskId,
    task: { ...task, taskId },
    status: 'queued',
    onProgress: cb.onProgress,
    onDone: cb.onDone
  })
  pump()
  return taskId
}

/** 并发池主循环：有空位就启动队列中下一个 */
function pump(): void {
  if (draining) return
  draining = true
  try {
    const max = Math.max(1, loadSettings().maxConcurrent || 2)
    while (runningCount() < max) {
      const next = queue.find((q) => q.status === 'queued')
      if (!next) break
      startItem(next)
    }
  } finally {
    draining = false
  }
}

function startItem(item: QueueItem): void {
  item.status = 'converting'
  runTranscode(item.task, {
    onProgress: (p) => item.onProgress(p),
    onDone: (d) => {
      const donePayload: DonePayload = { ...d, taskId: item.taskId }
      item.status = d.ok ? 'done' : 'failed'
      item.onDone(donePayload)
      // 从队列移除已完成项（历史已由调用方持久化）
      const idx = queue.findIndex((q) => q.taskId === item.taskId)
      if (idx >= 0) queue.splice(idx, 1)
      pump() // 空位释放，继续下一个
    }
  })
}

/** 取消任务：排队中的直接移除；转换中的 kill ffmpeg */
export function cancelTask(taskId: string): boolean {
  const idx = queue.findIndex((q) => q.taskId === taskId)
  if (idx < 0) return false
  const item = queue[idx]
  if (item.status === 'queued') {
    item.status = 'cancelled'
    item.onDone({ taskId, ok: false, error: '已取消' })
    queue.splice(idx, 1)
    return true
  }
  if (item.status === 'converting') {
    item.status = 'cancelled'
    killFfmpeg(taskId)
    return true
  }
  return false
}

/** 当前队列摘要（供 IPC/UI 初始化） */
export function queueSnapshot(): Array<{ taskId: string; status: TaskStatus; inputPath: string }> {
  return queue.map((q) => ({ taskId: q.taskId, status: q.status, inputPath: q.task.inputPath }))
}

/** 取消所有排队任务（历史清空/退出时可调用） */
export function cancelAllQueued(): void {
  for (const item of queue) {
    if (item.status === 'queued') cancelTask(item.taskId)
  }
}
