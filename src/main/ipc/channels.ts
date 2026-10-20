/** IPC 通道常量 —— 单一真源，main / preload / renderer 共享 */
export const IPC = {
  // 功能调用（renderer -> main，invoke/handle）
  PROBE: 'ffmpeg:probe',
  THUMBNAIL: 'ffmpeg:thumbnail',
  PREVIEW: 'ffmpeg:preview',
  CONVERT: 'ffmpeg:convert',
  CANCEL: 'ffmpeg:cancel',
  GPU_DETECT: 'gpu:detect',
  PICK_VIDEOS: 'dialog:pickVideos',
  PICK_DIR: 'dialog:pickDir',
  RUNNING_COUNT: 'task:runningCount',
  // 事件推送（main -> renderer，webContents.send）
  PROGRESS: 'ffmpeg:progress',
  DONE: 'ffmpeg:done',
  // 历史 / 设置
  HISTORY_LIST: 'history:list',
  HISTORY_CLEAR: 'history:clear',
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  // 系统集成
  SHELL_OPEN_DIR: 'shell:openDir',
  SHELL_SHOW_IN_FOLDER: 'shell:showInFolder',
  APP_INFO: 'app:info',
  // 窗口控制
  WIN_MIN: 'win:min',
  WIN_MAX: 'win:max',
  WIN_CLOSE: 'win:close'
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]
