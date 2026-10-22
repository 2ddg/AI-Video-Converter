import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { basename } from 'path'
import type { AppSettings, ConvertTask, TaskRecord } from '../../shared/types'
import { IPC } from './channels'
import { probeVideo } from '../ffmpeg/probe'
import { generateThumbnail, generatePreviewFrames } from '../ffmpeg/thumbnail'
import { detectGpuEncoders } from '../ffmpeg/gpu'
import { getFfmpegPath, getFfmpegVersion } from '../ffmpeg/ffmpegPath'
import { enqueue, cancelTask } from '../ffmpeg/queue'
import { resolveOutputPath, runningCount } from '../ffmpeg/transcode'
import { loadHistory, appendRecord, updateRecord, clearHistory } from '../store/history'
import { loadSettings, updateSettings, getGpuCache } from '../store/settings'
import { notifyTaskDone } from '../utils/notify'

export function registerIpc(getWindow: () => BrowserWindow | null): void {
  // ---------- 视频探测 ----------
  ipcMain.handle(IPC.PROBE, async (_evt, filePath: string) => {
    try {
      const info = await probeVideo(filePath)
      // 非视频文件（无视频流）报错
      if (!info.videoCodec) throw new Error('该文件不含视频流，无法转换')
      return info
    } catch (err) {
      throw err instanceof Error ? err : new Error(String(err))
    }
  })

  // ---------- 缩略图 ----------
  ipcMain.handle(IPC.THUMBNAIL, async (_evt, info) => {
    return generateThumbnail(info)
  })

  ipcMain.handle(IPC.PREVIEW, async (_evt, info) => {
    return generatePreviewFrames(info)
  })

  // ---------- 转换 ----------
  ipcMain.handle(IPC.CONVERT, async (_evt, task: ConvertTask) => {
    const win = getWindow()
    // 保证输出路径（设置里的输出目录）
    const outDir = loadSettings().outputDir
    const outputPath = task.outputPath ?? resolveOutputPath(task.inputPath, task.container, outDir)
    const finalTask: ConvertTask = { ...task, outputPath }

    // 进度百分比需要时长：任务没带就探测一次
    if (finalTask.durationSec == null) {
      try {
        const info = await probeVideo(task.inputPath)
        finalTask.durationSec = info.durationSec ?? undefined
      } catch {
        /* 探测失败则进度显示为运行中 */
      }
    }

    // 历史初始记录
    const taskId = enqueue(finalTask, {
      onProgress: (p) => {
        win?.webContents.send(IPC.PROGRESS, p)
      },
      onDone: (d) => {
        win?.webContents.send(IPC.DONE, d)
        // 更新历史
        const existing = loadHistory().find((r) => r.taskId === d.taskId)
        const rec: TaskRecord = {
          taskId: d.taskId,
          inputPath: finalTask.inputPath,
          outputPath: d.outputPath ?? null,
          container: finalTask.container,
          videoCodec: finalTask.videoCodec,
          status: d.ok ? 'done' : 'failed',
          percent: d.ok ? 100 : existing?.percent ?? 0,
          error: d.error,
          inputSizeBytes: d.inputSizeBytes,
          outputSizeBytes: d.outputSizeBytes,
          createdAt: existing?.createdAt ?? Date.now(),
          finishedAt: Date.now()
        }
        updateRecord(rec)
        // 系统通知
        const settings = loadSettings()
        if (settings.notifyOnDone) {
          notifyTaskDone({
            ok: d.ok,
            inputName: basename(finalTask.inputPath),
            outputPath: d.outputPath,
            error: d.error
          })
        }
      }
    })
    return taskId
  })

  ipcMain.handle(IPC.CANCEL, (_evt, taskId: string) => {
    return cancelTask(taskId)
  })

  // ---------- GPU 硬件编码检测 ----------
  ipcMain.handle(IPC.GPU_DETECT, async () => {
    const cached = getGpuCache()
    // 仅缓存可用结果 24h；失败结果下次重试，避免一次瞬时失败锁死一天
    if (cached?.available && cached.detectedAt && Date.now() - cached.detectedAt < 24 * 3600 * 1000) {
      return cached
    }
    const gpu = await detectGpuEncoders()
    updateSettings({ gpu })
    return gpu
  })

  // ---------- 历史 ----------
  ipcMain.handle(IPC.HISTORY_LIST, () => loadHistory())
  ipcMain.handle(IPC.HISTORY_CLEAR, () => {
    clearHistory()
    return true
  })

  // ---------- 设置 ----------
  ipcMain.handle(IPC.SETTINGS_GET, (): AppSettings => loadSettings())
  ipcMain.handle(IPC.SETTINGS_SET, (_evt, patch: Partial<AppSettings>) => updateSettings(patch))

  // ---------- 系统集成 ----------
  ipcMain.handle(IPC.SHELL_OPEN_DIR, async (_evt, dir: string) => {
    const result = await shell.openPath(dir)
    return result === '' ? true : false
  })

  ipcMain.handle(IPC.SHELL_SHOW_IN_FOLDER, (_evt, p: string) => {
    shell.showItemInFolder(p)
    return true
  })

  ipcMain.handle(IPC.APP_INFO, async () => {
    const settings = loadSettings()
    const ffmpegVersion = await getFfmpegVersion()
    return {
      version: app.getVersion(),
      platform: process.platform,
      arch: process.arch,
      ffmpegPath: settings.ffmpegPath ?? getFfmpegPath(),
      ffmpegVersion,
      appName: '视频格式转换器'
    }
  })

  // ---------- 窗口控制 ----------
  ipcMain.handle(IPC.WIN_MIN, () => getWindow()?.minimize())
  ipcMain.handle(IPC.WIN_MAX, () => {
    const win = getWindow()
    if (!win) return
    win.isMaximized() ? win.unmaximize() : win.maximize()
  })
  ipcMain.handle(IPC.WIN_CLOSE, () => getWindow()?.close())

  // ---------- 选文件（拖拽之外的备选） ----------
  ipcMain.handle(IPC.PICK_VIDEOS, async () => {
    const win = getWindow()
    const result = await dialog.showOpenDialog(win!, {
      title: '选择视频文件',
      filters: [
        {
          name: '视频文件',
          extensions: ['mp4', 'mkv', 'mov', 'avi', 'webm', 'flv', 'wmv', 'ts', 'm4v', '3gp', 'gif']
        }
      ],
      properties: ['openFile', 'multiSelections']
    })
    return result.canceled ? [] : result.filePaths
  })

  // ---------- 选目录（设置输出目录） ----------
  ipcMain.handle(IPC.PICK_DIR, async () => {
    const win = getWindow()
    const result = await dialog.showOpenDialog(win!, {
      title: '选择输出目录',
      properties: ['openDirectory', 'createDirectory']
    })
    return result.canceled ? null : result.filePaths[0] ?? null
  })

  // ---------- 运行计数（供 UI 徽标） ----------
  ipcMain.handle(IPC.RUNNING_COUNT, () => runningCount())
}
