<template>
  <aside class="sidebar">
    <div class="sidebar-header">
      <div class="sidebar-label">
        Vozidla
        <span class="count-badge">{{ vehicles.length }}</span>
      </div>
      <input
        v-model="search"
        class="search-box"
        type="text"
        placeholder="Hledat vozidlo nebo SPZ…"
      />
    </div>

    <div class="vehicle-list">
      <!-- Loading state -->
      <div v-if="loading" class="empty-state">
        <span class="empty-icon">⏳</span>
        Načítám vozidla…
      </div>

      <!-- Empty search result -->
      <div v-else-if="filtered.length === 0" class="empty-state">
        <span class="empty-icon">🔍</span>
        Žádné výsledky pro „{{ search }}"
      </div>

      <!-- Vehicle cards -->
      <div
        v-else
        v-for="v in filtered"
        :key="v.Code"
        class="vehicle-card"
        :class="{ active: selected?.Code === v.Code }"
        @click="$emit('select', v)"
      >
        <div class="vehicle-card-top">
          <div class="vehicle-name">{{ v.Name }}</div>
          <div v-if="v.SPZ" class="vehicle-spz">{{ v.SPZ }}</div>
        </div>

        <div class="vehicle-stats">
          <span class="speed-badge" :class="v.Speed > 3 ? 'speed-moving' : 'speed-stopped'">
            {{ v.Speed > 3 ? `▶ ${v.Speed} km/h` : '■ stojí' }}
          </span>
        </div>

        <div class="vehicle-time">
          {{ formatTime(v.LastPositionTimestamp) }}
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  vehicles: { type: Array, default: () => [] },
  selected: { type: Object, default: null },
  loading: { type: Boolean, default: false },
})

defineEmits(['select'])

const search = ref('')

const filtered = computed(() => {
  if (!search.value) return props.vehicles
  const q = search.value.toLowerCase()
  return props.vehicles.filter(
    v => v.Name.toLowerCase().includes(q) || (v.SPZ || '').toLowerCase().includes(q)
  )
})

function formatTime(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })
}
</script>
