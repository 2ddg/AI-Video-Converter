import type { VideoApi } from './index'

declare global {
  interface Window {
    api: VideoApi
  }
}

export {}
