<script setup lang="ts">
import { ref } from 'vue'
import DropZone from '../components/DropZone.vue'
import VideoPanel from '../components/VideoPanel.vue'
import ConvertForm from '../components/ConvertForm.vue'
import TaskQueue from '../components/TaskQueue.vue'
import { useVideoStore } from '../stores/video'

const video = useVideoStore()
const loadedFile = ref('')

function onLoaded(path: string): void {
  loadedFile.value = path
}
</script>

<template>
  <div class="home">
    <DropZone v-if="!video.info" class="drop" @loaded="onLoaded" />

    <template v-else>
      <div class="stage fade-up" :key="loadedFile">
        <section class="panel-col">
          <VideoPanel />
        </section>
        <section class="form-col">
          <ConvertForm />
        </section>
      </div>
      <section class="queue-col fade-up">
        <TaskQueue />
      </section>
    </template>
  </div>
</template>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.drop {
  margin: 4vh auto 0;
  max-width: 720px;
  width: 100%;
}

.stage {
  display: grid;
  grid-template-columns: minmax(300px, 380px) 1fr;
  gap: 16px;
  align-items: stretch;
}

.panel-col {
  min-width: 0;
}
.form-col {
  min-width: 0;
}

.queue-col {
  flex-shrink: 0;
}
</style>
