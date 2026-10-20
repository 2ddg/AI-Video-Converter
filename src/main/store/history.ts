import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { TaskRecord } from '../../shared/types'

const MAX_HISTORY = 200

function historyPath(): string {
  return join(app.getPath('userData'), 'history.json')
}

export function loadHistory(): TaskRecord[] {
  try {
    const p = historyPath()
    if (!existsSync(p)) return []
    const arr = JSON.parse(readFileSync(p, 'utf-8'))
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

export function appendRecord(record: TaskRecord): TaskRecord[] {
  const list = loadHistory()
  const idx = list.findIndex((r) => r.taskId === record.taskId)
  if (idx >= 0) list[idx] = record
  else list.unshift(record)
  const trimmed = list.slice(0, MAX_HISTORY)
  saveHistory(trimmed)
  return trimmed
}

export function updateRecord(record: TaskRecord): TaskRecord[] {
  return appendRecord(record)
}

export function clearHistory(): void {
  try {
    writeFileSync(historyPath(), '[]', 'utf-8')
  } catch {
    /* 忽略 */
  }
}

function saveHistory(list: TaskRecord[]): void {
  try {
    mkdirSync(app.getPath('userData'), { recursive: true })
    writeFileSync(historyPath(), JSON.stringify(list, null, 2), 'utf-8')
  } catch {
    /* 忽略 */
  }
}
