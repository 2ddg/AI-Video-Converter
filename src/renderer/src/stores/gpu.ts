import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { GpuInfo } from '../../../shared/types'

/** GPU 硬件编码检测状态（启动时自动探测一次） */
export const useGpuStore = defineStore('gpu', () => {
  const gpu = ref<GpuInfo | null>(null)
  const detecting = ref(false)

  async function detect(force = false): Promise<void> {
    if (gpu.value && !force) return
    detecting.value = true
    try {
      gpu.value = await window.api.detectGpu()
    } catch {
      gpu.value = null
    } finally {
      detecting.value = false
    }
  }

  return { gpu, detecting, detect }
})
