<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import AppShell from './components/AppShell.vue'
import HomeView from './views/HomeView.vue'
import { useTaskStore } from './stores/tasks'
import { useSettingsStore } from './stores/settings'
import { useGpuStore } from './stores/gpu'

const tasks = useTaskStore()
const settings = useSettingsStore()
const gpu = useGpuStore()

let offProgress: (() => void) | null = null
let offDone: (() => void) | null = null

onMounted(async () => {
  await settings.load()
  applyTheme(settings.settings.theme)
  await tasks.loadHistory()
  // 应用启动时订阅转换进度/完成
  offProgress = window.api.onProgress((p) => tasks.applyProgress(p))
  offDone = window.api.onDone((d) => {
    tasks.applyDone(d)
    // 完成后刷新运行计数（徽标）
    void window.api.runningCount()
  })
  // 后台探测 GPU（不阻塞首屏）
  void gpu.detect()
})

function applyTheme(theme: 'dark' | 'light'): void {
  document.documentElement.classList.toggle('theme-light', theme === 'light')
}

onUnmounted(() => {
  offProgress?.()
  offDone?.()
})
</script>

<template>
  <AppShell>
    <HomeView />
  </AppShell>
</template>
