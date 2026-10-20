import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { AppSettings } from '../../../shared/types'

const DEFAULT: AppSettings = {
  outputDir: null,
  maxConcurrent: 2,
  theme: 'dark',
  notifyOnDone: true,
  ffmpegPath: null,
  gpu: null
}

/** 应用设置（读主进程持久化） */
export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<AppSettings>({ ...DEFAULT })

  async function load(): Promise<void> {
    settings.value = await window.api.getSettings()
  }

  async function update(patch: Partial<AppSettings>): Promise<void> {
    settings.value = await window.api.setSettings(patch)
  }

  return { settings, load, update }
})
