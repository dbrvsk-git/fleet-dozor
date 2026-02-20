<template>
  <div v-if="!vehicle" class="empty-state">
    <span class="empty-icon">🚗</span> Vyberte vozidlo ze seznamu
  </div>

  <div v-else>
    <!-- Meta bar -->
    <div class="vehicle-meta-bar">
      Poslední aktivita: <strong>{{ lastSeen }}</strong>
      <template v-if="vehicle.BranchName">
        <br />
        Pobočka: <strong>{{ vehicle.BranchName }}</strong>
      </template>
      <template v-if="todayDriver">
        <br />
        Řidič: <strong>{{ todayDriver }}</strong>
      </template>
    </div>

    <div class="detail-grid">
      <!-- Rychlost -->
      <div class="detail-item">
        <div class="detail-label">RYCHLOST</div>
        <div class="detail-value" :class="{ accent: vehicle.Speed > 3 }">
          {{ vehicle.Speed }}
          <small style="font-size: 10px; font-weight: 400; font-family: 'DM Mono', monospace"
            >km/h</small
          >
        </div>
      </div>

      <!-- Stav -->
      <div class="detail-item">
        <div class="detail-label">STAV</div>
        <div
          class="detail-value"
          :style="{ fontSize: '13px', color: vehicle.Speed > 3 ? 'var(--accent)' : 'var(--muted)' }"
        >
          {{ vehicle.Speed > 3 ? '▶ Jede' : '■ Stojí' }}
        </div>
      </div>

      <!-- Odometr -->
      <div class="detail-item">
        <div class="detail-label">STAV TACHOMETRU</div>
        <div class="detail-value" style="font-size: 13px">{{ odometer }}</div>
      </div>

      <!-- Palivo -->
      <div class="detail-item">
        <div class="detail-label">PALIVO</div>
        <div class="detail-value" style="font-size: 13px">{{ fuel }}</div>
      </div>

      <!-- Max rychlost dnes -->
      <div class="detail-item">
        <div class="detail-label">MAX RYCHLOST DNES</div>
        <div class="detail-value" style="font-size: 13px">
          {{ maxSpeed }}
          <small
            v-if="maxSpeed !== '—'"
            style="font-size: 10px; font-weight: 400; font-family: 'DM Mono', monospace"
            >km/h</small
          >
        </div>
      </div>

      <!-- Počet jízd dnes -->
      <div class="detail-item">
        <div class="detail-label">JÍZDY DNES</div>
        <div class="detail-value" style="font-size: 13px">{{ tripsToday }}</div>
      </div>

      <!-- Ujeto dnes -->
      <div class="detail-item">
        <div class="detail-label">UJETO DNES</div>
        <div class="detail-value" style="font-size: 13px">{{ distanceToday }}</div>
      </div>

      <!-- Stav motoru / relay -->
      <div class="detail-item">
        <div class="detail-label">STAV MOTORU</div>
        <div class="detail-value" style="font-size: 12px">
          {{ relayLabel }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { getSensors, getTrips, formatDateForApi } from '../api/gpsdozor.js'

const props = defineProps({
  vehicle: { type: Object, default: null },
})

const RELAY_LABELS = [
  'Normální',
  'Žádost odeslána',
  'Potvrzeno',
  'Rušení…',
  'Rušení potvrzeno',
  'Zamítnuto',
]

// ─── Základní computed ────────────────────────────────────
const odometer = computed(() => {
  if (!props.vehicle?.Odometer) return '—'
  return props.vehicle.Odometer + ' km'
})

const lastSeen = computed(() => {
  const ts = props.vehicle?.LastPositionTimestamp
  if (!ts) return '—'
  return new Date(ts).toLocaleString('cs-CZ', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
})

const relayLabel = computed(() => RELAY_LABELS[props.vehicle?.EngineRelayState ?? 0] ?? '—')

// ─── Fuel (sensor) ────────────────────────────────────────
const fuel = ref('—')

async function loadFuel(code) {
  fuel.value = '—'
  try {
    const to = new Date()
    const from = new Date(to.getTime() - 24 * 60 * 60 * 1000)
    const fmt = (d) => d.toISOString().slice(0, 16)
    const data = await getSensors(code, 'FuelActualVolume', fmt(from), fmt(to))
    const item = data.items?.find((i) => i.name === 'FuelActualVolume')
    const last = item?.data?.at(-1)?.v
    fuel.value = last != null ? last.toFixed(1) + ' l' : '—'
  } catch {
    fuel.value = '—'
  }
}

// ─── Dnešní statistiky z trips ────────────────────────────
const maxSpeed = ref('—')
const tripsToday = ref('—')
const distanceToday = ref('—')
const todayDriver = ref(null)

async function loadTodayStats(code) {
  maxSpeed.value = '—'
  tripsToday.value = '—'
  distanceToday.value = '—'
  todayDriver.value = null
  try {
    const now = new Date()
    const start = new Date(now)
    start.setHours(0, 0, 0, 0)
    const from = formatDateForApi(start)
    const to = formatDateForApi(now, true)
    const trips = await getTrips(code, from, to)
    if (!Array.isArray(trips) || !trips.length) return

    tripsToday.value = trips.length
    const totalKm = trips.reduce((a, t) => a + (t.TotalDistance ?? 0), 0)
    distanceToday.value = totalKm.toFixed(1) + ' km'
    maxSpeed.value = Math.max(...trips.map((t) => t.MaxSpeed ?? 0))

    // Poslední řidič dne
    const last = [...trips].reverse().find((t) => t.DriverName)
    if (last) todayDriver.value = last.DriverName
  } catch {
    // tiché selhání — stats zůstanou '—'
  }
}

// ─── Watch — načti při změně vozidla ─────────────────────
watch(
  () => props.vehicle?.Code,
  (code) => {
    if (!code) return
    loadFuel(code)
    loadTodayStats(code)
  },
  { immediate: true },
)
</script>
