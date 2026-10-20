import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { VideoInfo } from '../../../shared/types'

/** 当前加载的视频状态 */
export const useVideoStore = defineStore('video', () => {
  const info = ref<VideoInfo | null>(null)
  const thumbnailUrl = ref<string>('')
  const previewUrls = ref<string[]>([])
  const probing = ref(false)
  const probeError = ref<string>('')

  /** 探测视频并生成缩略图 + 三帧预览 */
  async function loadVideo(filePath: string): Promise<boolean> {
    probing.value = true
    probeError.value = ''
    try {
      const v = await window.api.probe(filePath)
      info.value = v
      thumbnailUrl.value = await window.api.thumbnail(v)
      previewUrls.value = await window.api.preview(v)
      return true
    } catch (err) {
      probeError.value = err instanceof Error ? err.message : String(err)
      return false
    } finally {
      probing.value = false
    }
  }

  /** 追加到当前视频（批量场景：以最后一个为准进入表单） */
  async function loadExtra(path: string): Promise<void> {
    await loadVideo(path)
  }

  function reset(): void {
    info.value = null
    thumbnailUrl.value = ''
    previewUrls.value = []
    probeError.value = ''
  }

  return { info, thumbnailUrl, previewUrls, probing, probeError, loadVideo, loadExtra, reset }
})
