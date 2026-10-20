<script setup lang="ts">
import { ref } from 'vue'
import { useVideoStore } from '../stores/video'
import { codecName, formatBitrate, formatBytes, formatDuration } from '../utils/format'

const video = useVideoStore()

const hoverFrame = ref(-1)

function showFrame(idx: number): void {
  if (video.previewUrls[idx]) hoverFrame.value = idx
}
function clearFrame(): void {
  hoverFrame.value = -1
}
</script>

<template>
  <div class="video-panel card" v-if="video.info">
    <div class="thumb-area">
      <img
        class="main-thumb"
        :src="hoverFrame >= 0 && video.previewUrls[hoverFrame] ? video.previewUrls[hoverFrame] : video.thumbnailUrl"
        :alt="video.info.fileName"
        draggable="false"
      />
      <div class="frames">
        <template v-for="(u, i) in video.previewUrls" :key="i">
          <img
            v-if="u"
            :src="u"
            class="frame"
            :class="{ active: hoverFrame === i }"
            :alt="`第${i + 1}帧`"
            draggable="false"
            @mouseenter="showFrame(i)"
            @mouseleave="clearFrame"
          />
        </template>
      </div>
      <span class="file-chip ellipsis">{{ video.info.fileName }}</span>
    </div>

    <div class="meta">
      <div class="grid">
        <div class="tile">
          <span class="k">时长</span>
          <span class="v num">{{ formatDuration(video.info.durationSec) }}</span>
        </div>
        <div class="tile">
          <span class="k">分辨率</span>
          <span class="v num">{{ video.info.width }}×{{ video.info.height }}</span>
        </div>
        <div class="tile">
          <span class="k">大小</span>
          <span class="v num">{{ formatBytes(video.info.sizeBytes) }}</span>
        </div>
        <div class="tile">
          <span class="k">帧率</span>
          <span class="v num">{{ video.info.fps ? `${video.info.fps} fps` : '--' }}</span>
        </div>
        <div class="tile">
          <span class="k">总码率</span>
          <span class="v num">{{ formatBitrate(video.info.bitrateKbps) }}</span>
        </div>
        <div class="tile">
          <span class="k">格式</span>
          <span class="v">{{ video.info.format ? video.info.format.toUpperCase() : '--' }}</span>
        </div>
        <div class="tile">
          <span class="k">视频编码</span>
          <span class="v">{{ codecName(video.info.videoCodec) }}</span>
        </div>
        <div class="tile">
          <span class="k">音频编码</span>
          <span class="v">{{ codecName(video.info.audioCodec) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.video-panel {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: 100%;
}

.thumb-area {
  position: relative;
  padding: 16px 16px 0;
}

.main-thumb {
  width: 100%;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: #000;
  aspect-ratio: 16 / 9;
  object-fit: cover;
}

.frames {
  display: flex;
  gap: 6px;
  margin-top: 8px;
}

.frame {
  width: 76px;
  height: 44px;
  object-fit: cover;
  border-radius: 5px;
  border: 1.5px solid var(--border);
  opacity: 0.75;
  cursor: pointer;
  transition: all 0.15s ease;
}
.frame:hover {
  opacity: 1;
  transform: translateY(-2px);
}
.frame.active {
  border-color: var(--accent-2);
  opacity: 1;
  box-shadow: 0 0 0 2px var(--accent-soft);
}

.file-chip {
  position: absolute;
  left: 24px;
  bottom: 12px;
  max-width: 60%;
  padding: 3px 10px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.65);
  color: #fff;
  font-size: 11px;
  backdrop-filter: blur(6px);
}

.meta {
  padding: 14px 16px 16px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.tile {
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  min-height: 58px;
}
.k {
  font-size: 11px;
  color: var(--text-3);
  letter-spacing: 0.03em;
}
.v {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
