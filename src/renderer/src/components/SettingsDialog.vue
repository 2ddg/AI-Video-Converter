<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useSettingsStore } from '../stores/settings'
import type { AppInfo } from '../../../shared/types'

const emit = defineEmits<{ close: [] }>()

const settings = useSettingsStore()
const appInfo = ref<AppInfo | null>(null)

onMounted(async () => {
  appInfo.value = await window.api.getAppInfo()
})

async function pickDir(): Promise<void> {
  const dir = await window.api.pickDir()
  if (dir) await settings.update({ outputDir: dir })
}

async function resetDir(): Promise<void> {
  await settings.update({ outputDir: null })
}

async function setTheme(theme: 'dark' | 'light'): Promise<void> {
  await settings.update({ theme })
  applyThemeClass(theme)
}

function applyThemeClass(theme: 'dark' | 'light'): void {
  document.documentElement.classList.toggle('theme-light', theme === 'light')
}

onMounted(() => {
  void settings.load().then(() => applyThemeClass(settings.settings.theme))
})
</script>

<template>
  <div class="overlay" @click.self="emit('close')">
    <div class="dialog card fade-up">
      <header class="dialog-head">
        <h2>设置</h2>
        <button class="icon-btn" @click="emit('close')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </header>

      <div class="body">
        <!-- 输出目录 -->
        <div class="row">
          <label>输出目录</label>
          <div class="row-content">
            <div class="dir-line ellipsis">{{ settings.settings.outputDir || '视频所在目录（默认）' }}</div>
            <div class="row-actions">
              <button class="btn btn-sm" @click="pickDir">选择…</button>
              <button class="btn btn-sm btn-ghost" @click="resetDir">默认</button>
            </div>
          </div>
        </div>

        <!-- 并发数 -->
        <div class="row">
          <label>同时转换任务数</label>
          <div class="row-content">
            <select v-model.number="settings.settings.maxConcurrent" class="select num" style="max-width: 120px" @change="settings.update({ maxConcurrent: Number(settings.settings.maxConcurrent) })">
              <option :value="1">1</option>
              <option :value="2">2</option>
              <option :value="3">3</option>
              <option :value="4">4</option>
            </select>
          </div>
        </div>

        <!-- 通知 -->
        <div class="row">
          <label>完成系统通知</label>
          <div class="row-content">
            <button class="switch" :class="{ on: settings.settings.notifyOnDone }" @click="settings.update({ notifyOnDone: !settings.settings.notifyOnDone })">
              <span class="knob" />
            </button>
          </div>
        </div>

        <!-- 主题 -->
        <div class="row">
          <label>界面主题</label>
          <div class="row-content seg">
            <button class="seg-btn" :class="{ active: settings.settings.theme === 'dark' }" @click="setTheme('dark')">深色</button>
            <button class="seg-btn" :class="{ active: settings.settings.theme === 'light' }" @click="setTheme('light')">浅色</button>
          </div>
        </div>

        <!-- ffmpeg -->
        <div class="row">
          <label>FFmpeg</label>
          <div class="row-content">
            <div class="dir-line mono ellipsis" :title="appInfo?.ffmpegPath">{{ appInfo?.ffmpegPath }}</div>
            <div class="hint">版本：{{ appInfo?.ffmpegVersion || '未知' }} · 内置，无需安装</div>
          </div>
        </div>
      </div>

      <footer class="dialog-foot">
        <span class="about">视频格式转换器 v{{ appInfo?.version }} · Electron {{ appInfo?.platform }}/{{ appInfo?.arch }}</span>
        <button class="btn btn-primary" @click="emit('close')">完成</button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.dialog {
  width: 520px;
  max-width: 92vw;
  background: var(--bg-raised);
  box-shadow: var(--shadow);
}

.dialog-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 22px;
  border-bottom: 1px solid var(--border);
}
.dialog-head h2 {
  font-size: 16px;
  font-weight: 600;
}
.icon-btn {
  display: inline-flex;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--text-2);
  cursor: pointer;
  border-radius: 6px;
}
.icon-btn:hover {
  background: var(--surface-hover);
  color: var(--text-1);
}
.icon-btn svg {
  width: 16px;
  height: 16px;
}

.body {
  padding: 8px 22px;
  max-height: 60vh;
  overflow-y: auto;
}

.row {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 14px 0;
  border-bottom: 1px solid var(--border);
}
.row:last-child {
  border-bottom: none;
}
.row > label {
  width: 110px;
  flex-shrink: 0;
  font-size: 13px;
  color: var(--text-2);
  padding-top: 6px;
}
.row-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.row-actions {
  display: flex;
  gap: 8px;
}
.dir-line {
  font-size: 12px;
  color: var(--text-2);
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid var(--border);
  padding: 7px 10px;
  border-radius: 6px;
  max-width: 100%;
}
.hint {
  font-size: 11px;
  color: var(--text-3);
}

.btn-sm {
  padding: 5px 12px;
  font-size: 12px;
}

.switch {
  width: 42px;
  height: 24px;
  border-radius: 999px;
  border: none;
  background: var(--surface-strong);
  cursor: pointer;
  position: relative;
  transition: background 0.2s ease;
  padding: 0;
}
.switch.on {
  background: var(--accent);
}
.knob {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.2s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}
.switch.on .knob {
  transform: translateX(18px);
}

.seg {
  display: inline-flex;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 3px;
  align-self: flex-start;
}
.seg-btn {
  padding: 5px 16px;
  border: none;
  background: transparent;
  color: var(--text-2);
  border-radius: 6px;
  cursor: pointer;
  font-size: 12.5px;
  transition: all 0.15s ease;
}
.seg-btn.active {
  background: var(--accent-soft);
  color: var(--accent-2);
  font-weight: 500;
}

.dialog-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 22px;
  border-top: 1px solid var(--border);
}
.about {
  font-size: 11px;
  color: var(--text-3);
}
</style>
