<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGpuStore } from '../stores/gpu'
import SettingsDialog from './SettingsDialog.vue'

const gpu = useGpuStore()

const showSettings = ref(false)

const gpuBadge = computed(() => {
  if (gpu.detecting) return { cls: 'badge-neutral', text: '检测硬件加速中…', icon: 'dot' }
  if (gpu.gpu?.available) {
    const enc = gpu.gpu.encoders[0] ?? ''
    const short = enc.replace('_nvenc', ' NVENC').replace('_amf', ' AMF').replace('_qsv', ' QSV')
    return { cls: 'badge-ok', text: `${gpu.gpu.vendor ?? 'GPU'} · ${short}`, icon: 'bolt' }
  }
  return { cls: 'badge-neutral', text: '软件编码', icon: 'cpu' }
})
</script>

<template>
  <div class="shell">
    <!-- 自绘标题栏（原生按钮由 titleBarOverlay 绘制在右上角） -->
    <header class="titlebar drag-region">
      <div class="brand">
        <svg class="logo" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2.5" y="5" width="13" height="14" rx="2.5" />
          <path d="m19.5 9.5 2 1.7-2 1.8" />
          <path d="M17 13.5h1.8" />
        </svg>
        <span class="title">视频格式转换器</span>
        <span class="ver">v1.0</span>
      </div>
      <div class="actions no-drag">
        <span :class="['badge', gpuBadge.cls]">
          <span v-if="gpuBadge.icon === 'dot'" class="pulse-dot" />
          <svg v-else-if="gpuBadge.icon === 'bolt'" class="badge-ic" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" /></svg>
          <svg v-else class="badge-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="5" width="14" height="14" rx="2.5" /><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" /></svg>
          {{ gpuBadge.text }}
        </span>
        <button class="icon-btn" title="设置" @click="showSettings = true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.09a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.09a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
        </button>
      </div>
    </header>

    <main class="content">
      <slot />
    </main>

    <SettingsDialog v-if="showSettings" @close="showSettings = false" />
  </div>
</template>

<style scoped>
.shell {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.titlebar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: var(--titlebar-h);
  padding: 0 12px 0 16px;
  background: rgba(11, 11, 15, 0.85);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.logo {
  width: 22px;
  height: 22px;
  color: var(--accent-2);
}

.title {
  font-size: 13.5px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.ver {
  font-size: 11px;
  color: var(--text-3);
  font-weight: 400;
}

.actions {
  display: flex;
  align-items: center;
  gap: 10px;
  /* 给原生窗口按钮（右上角约 140px）让位 */
  margin-right: 138px;
}

.badge-ic {
  width: 12px;
  height: 12px;
}

.pulse-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--accent-2);
  animation: pulse 1.2s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 0.35;
  }
  50% {
    opacity: 1;
  }
}

.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-2);
  cursor: pointer;
  transition: all 0.15s ease;
}
.icon-btn:hover {
  background: var(--surface-hover);
  color: var(--text-1);
}
.icon-btn svg {
  width: 17px;
  height: 17px;
}

.content {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
}
</style>
