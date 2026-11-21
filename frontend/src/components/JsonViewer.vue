<script setup lang="ts">
import { computed, ref } from 'vue';
import { highlightJson } from '../utils/json';

const props = defineProps<{ value: unknown }>();
const copied = ref(false);
const html = computed(() => highlightJson(props.value));

async function copy() {
  await navigator.clipboard.writeText(JSON.stringify(props.value, null, 2));
  copied.value = true;
  setTimeout(() => (copied.value = false), 1500);
}
</script>

<template>
  <div class="viewer">
    <button class="btn btn-sm copy" type="button" @click="copy">{{ copied ? 'Copiado ✓' : 'Copiar' }}</button>
    <!-- highlightJson escapa el contenido antes de envolverlo en <span> -->
    <pre class="json-view" v-html="html"></pre>
  </div>
</template>

<style scoped>
.viewer { position: relative; }
.copy { position: absolute; top: 8px; right: 8px; background: rgb(255 255 255 / 8%); color: #e2e8f0; border-color: rgb(255 255 255 / 15%); }
</style>
