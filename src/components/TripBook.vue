<template>
  <div class="panel-section">
    <div class="panel-title">
      Kniha jízd

      <!-- Date range picker + tlačítko načíst -->
      <div class="date-range">
        <input v-model="dateFrom" class="date-input" type="date" />
        <input v-model="dateTo" class="date-input" type="date" />
        <button class="load-btn" @click="load">→</button>
      </div>
    </div>

    <!-- Načítání -->
    <div v-if="loading" class="empty-state">
      <span class="empty-icon">⏳</span> Načítám jízdy…
    </div>

    <!-- Bez výběru vozidla -->
    <div v-else-if="!vehicleCode" class="empty-state">
      <span class="empty-icon">📋</span> Vyberte vozidlo
    </div>

    <!-- Žádné jízdy -->
    <div v-else-if="trips.length === 0" class="empty-state">
      <span class="empty-icon">🚫</span> Žádné jízdy v tomto období
    </div>

    <!-- Seznam jízd -->
    <div v-else>
      <div v-for="(trip, i) in trips" :key="i" class="trip-item">
        <div class="trip-dot"></div>
        <div class="trip-info">
          <div class="trip-route">
            {{ tripLabel(trip) }}
          </div>
          <div class="trip-meta">
            <span>{{ formatDist(trip.TotalDistance) }}</span>
            <span>{{ trip.TripLength?.trim() || '—' }}</span>
            <span>⌀ {{ trip.AverageSpeed }} km/h</span>
            <span v-if="trip.DriverName" style="color: var(--accent)">
              👤 {{ trip.DriverName }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { getTrips, formatDateForApi } from '../api/gpsdozor.js'

const props = defineProps({
  vehicleCode: { type: String, default: null },
})

// Emitujeme datum ven (MapView potřebuje vědět od-do pro trasu)
const emit = defineEmits(['dates-change'])

// ─── State ────────────────────────────────────────────────
const trips = ref([])
const loading = ref(false)

// Defaultní datum: včera → dnes
const today = new Date()
const yesterday = new Date(today)
yesterday.setDate(yesterday.getDate() - 1)
const dateFrom = ref(yesterday.toISOString().split('T')[0])
const dateTo = ref(today.toISOString().split('T')[0])

// ─── Načíst jízdy ─────────────────────────────────────────
async function load() {
  if (!props.vehicleCode) return

  loading.value = true
  trips.value = []

  // Informujeme rodiče o zvoleném datu (pro trasu na mapě)
  emit('dates-change', { from: dateFrom.value, to: dateTo.value })

  try {
    const from = formatDateForApi(dateFrom.value)
    const to = formatDateForApi(dateTo.value, true)
    const data = await getTrips(props.vehicleCode, from, to)
    trips.value = Array.isArray(data) ? data.slice(0, 10) : []
  } catch (e) {
    console.error('Chyba při načítání jízd:', e)
    trips.value = []
  } finally {
    loading.value = false
  }
}

// Auto-načíst při změně vozidla
watch(() => props.vehicleCode, () => load(), { immediate: false })

// ─── Helpers ──────────────────────────────────────────────
function tripLabel(trip) {
  if (trip.StartAddress || trip.FinishAddress) {
    return `${trip.StartAddress || '?'} → ${trip.FinishAddress || '?'}`
  }
  const start = formatTime(trip.StartTime)
  const finish = formatTime(trip.FinishTime)
  return `${start} → ${finish}`
}

function formatTime(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })
}

function formatDist(km) {
  if (!km) return '—'
  return km.toFixed(1) + ' km'
}
</script>
