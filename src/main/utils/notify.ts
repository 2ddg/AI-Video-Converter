import { app, Notification } from 'electron'
import { basename } from 'path'

/** Windows toast 通知需要 AppUserModelId */
export function initNotifications(): void {
  app.setAppUserModelId('com.aivideoconverter.app')
}

/** 任务完成/失败通知 */
export function notifyTaskDone(args: {
  ok: boolean
  inputName: string
  outputPath?: string
  error?: string
}): void {
  if (!Notification.isSupported()) return
  const title = args.ok ? '转换完成 ✓' : '转换失败 ✗'
  const body = args.ok
    ? `${args.inputName} 已成功转换为 ${basename(args.outputPath ?? '')}`
    : `${args.inputName} 转换失败：${args.error ?? '未知错误'}`
  const n = new Notification({ title, body })
  n.on('click', () => {
    if (args.outputPath) app.focus()
  })
  n.show()
}
