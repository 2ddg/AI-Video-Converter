// 自动化截图脚本：启动应用 → 驱动 UI 进入各状态 → webContents.capturePage 截图
// 用法：unset ELECTRON_RUN_AS_NODE && ./node_modules/.bin/electron screenshot.js
const { app, BrowserWindow } = require('electron')
const fs = require('fs')
const path = require('path')

const VIDEO = 'D:/temp/test_720p.mp4'
const SHOT_DIR = path.join(__dirname, 'docs', 'screenshots')
const LOG = path.join(SHOT_DIR, 'shot.log')
fs.mkdirSync(SHOT_DIR, { recursive: true })
const log = (m) => { const line = `[${new Date().toISOString()}] ${m}`; fs.appendFileSync(LOG, line + '\n'); console.log(line) }

// 总超时：90s 强制退出，防止卡死
setTimeout(() => { log('TIMEOUT-EXIT'); app.exit(2) }, 90000)

// 复用已编译主进程（注册 IPC + 协议 + 创建主窗口加载 prod renderer）
require('./out/main/index.js')

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

app.whenReady().then(async () => {
  log('app ready')
  let win = BrowserWindow.getAllWindows()[0]
  for (let i = 0; i < 30 && !win; i++) {
    await wait(200)
    win = BrowserWindow.getAllWindows()[0]
  }
  if (!win) { log('SHOT_FAIL: no window'); app.exit(1); return }
  log('got window')
  await new Promise((resolve) => {
    if (win.webContents.isLoading()) win.webContents.once('did-finish-load', resolve)
    else resolve()
  })
  await wait(1200)
  log('page loaded')

  // 确认 __video 已挂载
  const hasStore = await win.webContents.executeJavaScript(`typeof window.__video !== 'undefined' && typeof window.__video.loadVideo === 'function'`)
  log('__video mounted: ' + hasStore)
  if (!hasStore) { log('store not mounted, abort'); app.exit(3); return }

  try {
    await win.webContents.executeJavaScript(`window.__video.loadVideo(${JSON.stringify(VIDEO)})`)
    log('loadVideo done')
  } catch (e) { log('loadVideo failed: ' + String(e)) }
  await wait(3500)

  let img = await win.webContents.capturePage()
  fs.writeFileSync(path.join(SHOT_DIR, '01-loaded.png'), img.toPNG())
  log('shot 01 saved, ' + fs.statSync(path.join(SHOT_DIR, '01-loaded.png')).size + ' bytes')

  const info = await win.webContents.executeJavaScript(`window.__video.info && window.__video.info.durationSec`)
  log('info durationSec: ' + info)
  const task = { inputPath: VIDEO, container: 'mp4', videoCodec: 'libx264', audioCodec: 'aac', crf: 23, preset: 'slow', width: 1920, durationSec: info }
  try {
    await win.webContents.executeJavaScript(`window.__tasks.convert(${JSON.stringify(task)})`)
    log('convert triggered')
  } catch (e) { log('convert trigger failed: ' + String(e)) }
  await wait(2500)
  img = await win.webContents.capturePage()
  fs.writeFileSync(path.join(SHOT_DIR, '02-converting.png'), img.toPNG())
  log('shot 02 saved, ' + fs.statSync(path.join(SHOT_DIR, '02-converting.png')).size + ' bytes')

  await wait(22000)
  img = await win.webContents.capturePage()
  fs.writeFileSync(path.join(SHOT_DIR, '03-done.png'), img.toPNG())
  log('shot 03 saved, ' + fs.statSync(path.join(SHOT_DIR, '03-done.png')).size + ' bytes')

  log('ALL DONE')
  app.exit(0)
}).catch((e) => { log('whenReady error: ' + String(e)); app.exit(4) })

