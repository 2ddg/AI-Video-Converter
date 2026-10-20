// e2e 集成测试：加载真实应用，通过 window.api 走完整 IPC 链路
// 用法（项目根目录）：unset ELECTRON_RUN_AS_NODE && ./node_modules/.bin/electron e2e-test.js
const { app, BrowserWindow } = require('electron')
const fs = require('fs')

const VIDEO = 'D:/temp/test_720p.mp4'
const OUT_DIR = 'D:/temp/e2e_output'
fs.mkdirSync(OUT_DIR, { recursive: true })

// 复用已编译的主进程：require 会执行 index.ts 编译产物
// （注册单实例锁、thumbnail 协议、所有 ipcMain.handle、创建主窗口加载 prod renderer）
require('./out/main/index.js')

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

app.whenReady().then(async () => {
  let win = BrowserWindow.getAllWindows()[0]
  for (let i = 0; i < 30 && !win; i++) {
    await wait(200)
    win = BrowserWindow.getAllWindows()[0]
  }
  if (!win) {
    console.log('E2E_FAIL: no window')
    app.exit(1)
    return
  }
  await new Promise((resolve) => {
    if (win.webContents.isLoading()) {
      win.webContents.once('did-finish-load', resolve)
    } else {
      resolve()
    }
  })
  await wait(600)

  // 把输出目录设到临时目录，避免污染
  try {
    await win.webContents.executeJavaScript(
      `window.api.setSettings(${JSON.stringify({ outputDir: OUT_DIR })})`
    )
  } catch (e) {
    console.log('setSettings failed (非致命):', String(e))
  }

  const script = `
(async () => {
  const r = {}
  const V = ${JSON.stringify(VIDEO)}
  let info
  try { info = await window.api.probe(V); r.probe = { ok: true, durationSec: info.durationSec, w: info.width, h: info.height, vcodec: info.videoCodec, acodec: info.audioCodec, hasAudio: info.hasAudio, size: info.sizeBytes } }
  catch (e) { r.probe = { ok: false, err: String(e && e.message || e) } }
  try { const u = await window.api.thumbnail(info); r.thumb = { ok: typeof u === 'string' && u.startsWith('thumbnail://'), url: u } }
  catch (e) { r.thumb = { ok: false, err: String(e && e.message || e) } }
  try { const g = await window.api.detectGpu(); r.gpu = { available: g.available, vendor: g.vendor, encoders: g.encoders } }
  catch (e) { r.gpu = { err: String(e && e.message || e) } }
  try {
    const taskId = await window.api.convert({ inputPath: V, container: 'mkv', videoCodec: 'libx264', audioCodec: 'aac', crf: 23, preset: 'fast', durationSec: info && info.durationSec })
    r.taskId = taskId
    const samples = []
    const unsubP = window.api.onProgress((p) => samples.push(Math.round(p.percent)))
    const done = await new Promise((resolve) => {
      const unsub = window.api.onDone((d) => { if (d.taskId === taskId) { unsub(); resolve(d) } })
      setTimeout(() => resolve({ ok: false, error: 'timeout-60s' }), 60000)
    })
    unsubP()
    r.convert = { ok: done.ok, outputPath: done.outputPath, outputSize: done.outputSizeBytes, inputSize: done.inputSizeBytes, error: done.error, progressSamples: samples.length, lastProgress: samples[samples.length-1] }
  } catch (e) { r.convert = { ok: false, err: String(e && e.message || e) } }
  return r
})()`

  let result
  try {
    result = await win.webContents.executeJavaScript(script, true)
  } catch (e) {
    console.log('E2E_EXEC_FAIL:', String(e && e.message || e))
    app.exit(2)
    return
  }

  console.log('===E2E_RESULT_START===')
  console.log(JSON.stringify(result, null, 2))
  console.log('===E2E_RESULT_END===')

  if (result.convert && result.convert.ok && result.convert.outputPath) {
    console.log('OUTPUT_FILE_EXISTS:', fs.existsSync(result.convert.outputPath))
  }
  const allOk = result.probe?.ok && result.thumb?.ok && result.convert?.ok
  console.log('ALL_OK:', !!allOk)
  app.exit(allOk ? 0 : 1)
})
