import { app, BrowserWindow, net, protocol } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { existsSync } from 'fs'
import { registerIpc } from './ipc/register'
import { IPC } from './ipc/channels'
import { thumbDir } from './ffmpeg/thumbnail'
import { initNotifications } from './utils/notify'
import { loadSettings } from './store/settings'

let mainWindow: BrowserWindow | null = null

/** thumbnail:// 协议注册（渲染进程 <img> 直接用） */
function registerThumbnailProtocol(): void {
  protocol.handle('thumbnail', (req) => {
    try {
      const url = new URL(req.url)
      // thumbnail://<hash>.jpg
      const name = decodeURIComponent(url.hostname)
      const dir = thumbDir()
      const file = join(dir, name)
      // 防路径穿越：必须落在缩略图目录内
      if (!file.startsWith(dir)) return new Response('forbidden', { status: 403 })
      if (!existsSync(file)) return new Response('not found', { status: 404 })
      return net.fetch(pathToFileURL(file).toString())
    } catch {
      return new Response('bad request', { status: 400 })
    }
  })
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 920,
    minHeight: 620,
    show: false,
    title: '视频格式转换器',
    backgroundColor: '#0b0b0f',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0b0b0f',
      symbolColor: '#e8e8ec',
      height: 44
    },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

const getWindow = (): BrowserWindow | null => mainWindow

// 单实例锁：重复启动聚焦已有窗口
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  protocol.registerSchemesAsPrivileged([
    { scheme: 'thumbnail', privileges: { standard: true, secure: true, supportFetchAPI: true } }
  ])

  app.whenReady().then(() => {
    initNotifications()
    registerThumbnailProtocol()
    registerIpc(getWindow)
    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}

export { IPC }
