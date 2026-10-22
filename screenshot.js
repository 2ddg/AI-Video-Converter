const { app, BrowserWindow } = require('electron')
const fs = require('fs')
const path = require('path')

const VIDEO = 'D:/temp/test_720p.mp4'
const SHOT_DIR = path.join(__dirname, 'docs', 'screenshots')
const LOG = path.join(SHOT_DIR, 'shot.log')
fs.mkdirSync(SHOT_DIR, { recursive: true })
fs.writeFileSync(LOG, '')
const log = (m) => {
  const line = `[${new Date().toISOString()}] ${m}`
  fs.appendFileSync(LOG, line + '\n')
  console.log(line)
}

setTimeout(() => {
  log('TIMEOUT-EXIT')
  app.exit(2)
}, 180000)

require('./out/main/index.js')

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function evaluate(win, expr) {
  return win.webContents.executeJavaScript(expr)
}

async function waitFor(win, expr, timeoutMs, intervalMs = 200) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      if (await evaluate(win, expr)) return true
    } catch {
      /* transient evaluate errors are expected while the UI re-renders */
    }
    await wait(intervalMs)
  }
  return false
}

async function shot(win, name) {
  const img = await win.webContents.capturePage()
  const file = path.join(SHOT_DIR, name)
  fs.writeFileSync(file, img.toPNG())
  log(`shot ${name} saved, ${fs.statSync(file).size} bytes`)
}

async function scrollToQueue(win) {
  const ok = await evaluate(
    win,
    `(() => {
      const el = document.querySelector('.queue-col .task') || document.querySelector('.queue-col')
      if (!el) return false
      el.scrollIntoView({ block: 'center' })
      return true
    })()`
  )
  await wait(700)
  return ok
}

app
  .whenReady()
  .then(async () => {
    log('app ready')
    let win = BrowserWindow.getAllWindows()[0]
    for (let i = 0; i < 30 && !win; i++) {
      await wait(200)
      win = BrowserWindow.getAllWindows()[0]
    }
    if (!win) {
      log('SHOT_FAIL: no window')
      app.exit(1)
      return
    }
    log('got window')
    await new Promise((resolve) => {
      if (win.webContents.isLoading()) win.webContents.once('did-finish-load', resolve)
      else resolve()
    })
    await evaluate(win, 'document.fonts.ready.then(() => true)')
    await wait(1200)
    log('page loaded')

    const hasStore = await evaluate(
      win,
      `typeof window.__video?.loadVideo === 'function' && typeof window.__tasks?.convert === 'function'`
    )
    log('stores mounted: ' + hasStore)
    if (!hasStore) {
      log('stores not mounted, abort')
      app.exit(3)
      return
    }

    try {
      const ok = await evaluate(win, `window.__video.loadVideo(${JSON.stringify(VIDEO)})`)
      log('loadVideo done: ' + ok)
    } catch (e) {
      log('loadVideo failed: ' + String(e))
      app.exit(4)
      return
    }

    const ready = await waitFor(
      win,
      `!!(window.__video.info && window.__video.thumbnailUrl && window.__video.previewUrls.length === 3)`,
      30000
    )
    log('video ready: ' + ready)
    try {
      await evaluate(win, `window.__tasks.clearAll()`)
      log('history cleared')
    } catch (e) {
      log('history clear failed: ' + String(e))
    }
    await wait(1200)
    await shot(win, '01-loaded.png')

    const duration = await evaluate(win, `window.__video.info && window.__video.info.durationSec`)
    const task = {
      inputPath: VIDEO,
      container: 'mp4',
      videoCodec: 'libx264',
      audioCodec: 'aac',
      crf: 18,
      preset: 'veryslow',
      width: 1920,
      durationSec: duration
    }
    try {
      await evaluate(win, `window.__tasks.convert(${JSON.stringify(task)})`)
      log('convert triggered')
    } catch (e) {
      log('convert trigger failed: ' + String(e))
      app.exit(5)
      return
    }

    const started = await waitFor(
      win,
      `(() => {
        const t = window.__tasks.tasks[0]
        return !!t && (t.status === 'converting' || t.percent > 0)
      })()`,
      45000,
      100
    )
    log('converting observed: ' + started)
    const progressed = await waitFor(
      win,
      `window.__tasks.tasks[0] && window.__tasks.tasks[0].percent >= 5`,
      20000,
      100
    )
    log('progress >=5%: ' + progressed)
    const queued = await scrollToQueue(win)
    log('scrolled to queue: ' + queued)
    await wait(500)
    await shot(win, '02-converting.png')

    await waitFor(
      win,
      `(() => {
        const t = window.__tasks.tasks[0]
        return !!t && (t.status === 'done' || t.status === 'failed')
      })()`,
      150000,
      300
    )
    const result = await evaluate(
      win,
      `(() => {
        const t = window.__tasks.tasks[0] || {}
        return {
          status: t.status,
          percent: t.percent,
          outputPath: t.outputPath,
          outputSizeBytes: t.outputSizeBytes,
          error: t.error
        }
      })()`
    )
    log('finished: ' + JSON.stringify(result))
    if (result.status !== 'done') {
      log('CONVERT_FAILED')
      app.exit(6)
      return
    }
    if (!result.outputPath || !fs.existsSync(result.outputPath)) {
      log('OUTPUT_MISSING: ' + result.outputPath)
      app.exit(7)
      return
    }
    await wait(600)
    await shot(win, '03-done.png')
    log('ALL DONE')
    app.exit(0)
  })
  .catch((e) => {
    log('whenReady error: ' + String(e))
    app.exit(8)
  })
