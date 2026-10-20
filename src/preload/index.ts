import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../main/ipc/channels'
import type {
  AppInfo,
  AppSettings,
  ConvertTask,
  DonePayload,
  GpuInfo,
  ProgressPayload,
  TaskRecord,
  VideoInfo
} from '../shared/types'

const api = {
  // 视频
  probe: (filePath: string): Promise<VideoInfo> => ipcRenderer.invoke(IPC.PROBE, filePath),
  thumbnail: (info: VideoInfo): Promise<string> => ipcRenderer.invoke(IPC.THUMBNAIL, info),
  preview: (info: VideoInfo): Promise<string[]> => ipcRenderer.invoke(IPC.PREVIEW, info),
  pickVideos: (): Promise<string[]> => ipcRenderer.invoke(IPC.PICK_VIDEOS),
  pickDir: (): Promise<string | null> => ipcRenderer.invoke(IPC.PICK_DIR),

  // 转换
  convert: (task: ConvertTask): Promise<string> => ipcRenderer.invoke(IPC.CONVERT, task),
  cancel: (taskId: string): Promise<boolean> => ipcRenderer.invoke(IPC.CANCEL, taskId),
  runningCount: (): Promise<number> => ipcRenderer.invoke(IPC.RUNNING_COUNT),
  onProgress: (cb: (p: ProgressPayload) => void): (() => void) => {
    const handler = (_: unknown, p: ProgressPayload): void => cb(p)
    ipcRenderer.on(IPC.PROGRESS, handler)
    return () => ipcRenderer.removeListener(IPC.PROGRESS, handler)
  },
  onDone: (cb: (d: DonePayload) => void): (() => void) => {
    const handler = (_: unknown, d: DonePayload): void => cb(d)
    ipcRenderer.on(IPC.DONE, handler)
    return () => ipcRenderer.removeListener(IPC.DONE, handler)
  },

  // GPU
  detectGpu: (): Promise<GpuInfo> => ipcRenderer.invoke(IPC.GPU_DETECT),

  // 历史 / 设置
  getHistory: (): Promise<TaskRecord[]> => ipcRenderer.invoke(IPC.HISTORY_LIST),
  clearHistory: (): Promise<boolean> => ipcRenderer.invoke(IPC.HISTORY_CLEAR),
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke(IPC.SETTINGS_GET),
  setSettings: (patch: Partial<AppSettings>): Promise<AppSettings> =>
    ipcRenderer.invoke(IPC.SETTINGS_SET, patch),

  // 系统
  openDir: (dir: string): Promise<boolean> => ipcRenderer.invoke(IPC.SHELL_OPEN_DIR, dir),
  showInFolder: (p: string): Promise<boolean> => ipcRenderer.invoke(IPC.SHELL_SHOW_IN_FOLDER, p),
  getAppInfo: (): Promise<AppInfo> => ipcRenderer.invoke(IPC.APP_INFO),

  // 窗口
  winMin: (): Promise<void> => ipcRenderer.invoke(IPC.WIN_MIN),
  winMax: (): Promise<void> => ipcRenderer.invoke(IPC.WIN_MAX),
  winClose: (): Promise<void> => ipcRenderer.invoke(IPC.WIN_CLOSE)
}

export type VideoApi = typeof api

contextBridge.exposeInMainWorld('api', api)
