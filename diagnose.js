// 诊断：loadVideo 后检查 UI DOM 实际渲染状态
const { app, BrowserWindow } = require('electron')
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
require('./out/main/index.js')

app.whenReady().then(async () => {
  let win = BrowserWindow.getAllWindows()[0]
  for (let i = 0; i < 30 && !win; i++) { await wait(200); win = BrowserWindow.getAllWindows()[0] }
  await new Promise((r) => { win.webContents.isLoading() ? win.webContents.once('did-finish-load', r) : r() })
  await wait(1000)

  const before = await win.webContents.executeJavaScript(`({
    hasDropZone: !!document.querySelector('.dropzone'),
    hasVideoPanel: !!document.querySelector('.video-panel'),
    storeInfo: window.__video.info ? window.__video.info.fileName : null
  })`)
  console.log('BEFORE:', JSON.stringify(before))

  await win.webContents.executeJavaScript(`window.__video.loadVideo('D:/temp/test_720p.mp4')`)
  await wait(3500)

  const after = await win.webContents.executeJavaScript(`({
    hasDropZone: !!document.querySelector('.dropzone'),
    hasVideoPanel: !!document.querySelector('.video-panel'),
    hasConvertForm: !!document.querySelector('.convert-form'),
    storeInfo: window.__video.info ? window.__video.info.fileName : null,
    storeThumb: window.__video.thumbnailUrl,
    bodyLen: document.body.innerHTML.length
  })`)
  console.log('AFTER:', JSON.stringify(after))
  app.exit(0)
})
