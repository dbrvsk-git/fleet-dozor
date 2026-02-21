<template>
  <div class="panel-section">
    <div class="panel-title">
      Kniha jízd
      <div class="date-range">
        <input v-model="dateFrom" class="date-input" type="date" :max="todayStr" @change="load" />
        <input
          v-model="dateTo"
          class="date-input"
          type="date"
          :max="todayStr"
          :min="dateFrom"
          @change="load"
        />
        <button class="load-btn" @click="load">→</button>
      </div>
    </div>

    <div class="chart-legend">
      <div class="legend-item">
        <span class="legend-dot" style="background: #00e5a0"></span>
        <span>Úsporné (&lt; 7 l/100km)</span>
      </div>
      <div class="legend-item">
        <span class="legend-dot" style="background: #ffd166"></span>
        <span>Normální (7–11 l/100km)</span>
      </div>
      <div class="legend-item">
        <span class="legend-dot" style="background: #ff6b35"></span>
        <span>Vysoká (&gt; 11 l/100km)</span>
      </div>
    </div>

    <!-- Bez vozidla -->
    <div v-if="!vehicleCode" class="empty-state">
      <span class="empty-icon">📋</span> Vyberte vozidlo ze seznamu vlevo
    </div>

    <div v-else-if="loading" class="empty-state"><span class="empty-icon">⏳</span> Načítám…</div>

    <!-- Vybraný den → seznam jízd -->
    <template v-else-if="selectedDay">
      <div class="day-header">
        <button class="back-btn" @click="selectedDay = null">Zpět</button>
        <span> {{ selectedDayLabel }} · Jízdy: {{ dayTrips.length }}x · {{ dayDistance }}</span>
      </div>
      <div v-if="!dayTrips.length" class="empty-state" style="min-height: 60px">
        <span class="empty-icon">🚫</span> Žádné jízdy
      </div>
      <div v-for="(trip, i) in dayTrips" :key="i">
        <div class="trip-item" :class="{ expanded: expandedTrip === i }" @click="toggleTrip(i)">
          <div class="trip-dot"></div>
          <div class="trip-info">
            <div class="trip-route">{{ tripLabel(trip) }}</div>
            <div class="trip-meta">
              <span>{{ formatDist(trip.TotalDistance) }}</span>
              <span>{{ trip.TripLength?.trim() || '—' }}</span>
              <span>⌀ {{ trip.AverageSpeed }} km/h</span>
              <span v-if="trip.DriverName" style="color: var(--accent)"
                >👤 {{ trip.DriverName }}</span
              >
            </div>
          </div>
          <div class="trip-chevron">{{ expandedTrip === i ? '▲' : '▼' }}</div>
        </div>
        <div v-if="expandedTrip === i" class="trip-detail">
          <div class="trip-detail-grid">
            <div class="td-item">
              <div class="td-label">START</div>
              <div class="td-val">{{ formatTime(trip.StartTime) }}</div>
            </div>
            <div class="td-item">
              <div class="td-label">KONEC</div>
              <div class="td-val">{{ formatTime(trip.FinishTime) }}</div>
            </div>
            <div class="td-item">
              <div class="td-label">MAX RYCHLOST</div>
              <div class="td-val">{{ trip.MaxSpeed ?? '—' }} km/h</div>
            </div>
            <div class="td-item">
              <div class="td-label">ČAS STÁNÍ</div>
              <div class="td-val">{{ trip.TripWaitingTime?.trim() || '—' }}</div>
            </div>
            <div class="td-item">
              <div class="td-label">VZDÁLENOST</div>
              <div class="td-val">{{ formatDist(trip.TotalDistance) }}</div>
            </div>
            <div class="td-item">
              <div class="td-label">SPOTŘEBA</div>
              <div class="td-val">{{ formatFuel(trip) }}</div>
            </div>
            <div v-if="trip.Purpose" class="td-item td-full">
              <div class="td-label">ÚČEL</div>
              <div class="td-val">{{ trip.Purpose }}</div>
            </div>
            <div v-if="trip.StartAddress" class="td-item td-full">
              <div class="td-label">ODKUD</div>
              <div class="td-val">{{ trip.StartAddress }}</div>
            </div>
            <div v-if="trip.FinishAddress" class="td-item td-full">
              <div class="td-label">KAM</div>
              <div class="td-val">{{ trip.FinishAddress }}</div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Přehled dnů -->
    <template v-else>
      <div v-if="!allTrips.length" class="empty-state">
        <span class="empty-icon">🚫</span> Žádné jízdy v tomto období
      </div>
      <div v-else class="month-list">
        <div v-for="day in groupedDays" :key="day.date" class="month-day" @click="selectDay(day)">
          <div class="month-day-date">{{ day.label }}</div>
          <div class="month-day-bar-wrap">
            <div
              class="month-day-bar"
              :style="{ width: day.barPct + '%', background: day.barColor }"
            ></div>
          </div>
          <div class="month-day-stats">
            <span>Jízdy: {{ day.trips }}x</span> |
            <span>{{ day.distance }} km</span>
          </div>
          <div class="trip-chevron">▼</div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { getTrips, formatDateForApi } from '../api/gpsdozor.js'

const props = defineProps({
  vehicleCode: { type: String, default: null },
})

const emit = defineEmits(['dates-change'])

// ─── State ────────────────────────────────────────────────
const loading = ref(false)
const allTrips = ref([])
const expandedTrip = ref(null)
const selectedDay = ref(null)

const today = new Date()
const todayStr = today.toISOString().split('T')[0]

// Defaultně posledních 7 dní
const weekAgo = new Date(today)
weekAgo.setDate(today.getDate() - 7)
const dateFrom = ref(weekAgo.toISOString().split('T')[0])
const dateTo = ref(todayStr)

// ─── Načíst jízdy ─────────────────────────────────────────
async function load() {
  if (!props.vehicleCode) return

  // Validace — pokud "od" > "do", oprav "do"
  if (dateFrom.value > dateTo.value) {
    dateTo.value = dateFrom.value
  }

  loading.value = true
  allTrips.value = []
  selectedDay.value = null
  expandedTrip.value = null

  emit('dates-change', { from: dateFrom.value, to: dateTo.value })

  try {
    const data = await getTrips(
      props.vehicleCode,
      formatDateForApi(dateFrom.value),
      formatDateForApi(dateTo.value, true),
    )
    allTrips.value = Array.isArray(data) ? data : []
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

watch(
  () => props.vehicleCode,
  () => load(),
)

// ─── Seskupit jízdy po dnech ──────────────────────────────
const groupedDays = computed(() => {
  if (!allTrips.value.length) return []

  const byDay = {}
  allTrips.value.forEach((t) => {
    const d = t.StartTime?.slice(0, 10)
    if (!d) return
    if (!byDay[d]) byDay[d] = []
    byDay[d].push(t)
  })

  const maxKm = Math.max(
    ...Object.values(byDay).map((ts) => ts.reduce((a, t) => a + (t.TotalDistance ?? 0), 0)),
    1,
  )

  return Object.entries(byDay)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, ts]) => {
      const km = ts.reduce((a, t) => a + (t.TotalDistance ?? 0), 0)
      return {
        date,
        isToday: date === todayStr,
        label: new Date(date + 'T12:00').toLocaleDateString('cs-CZ', {
          weekday: 'short',
          day: '2-digit',
          month: '2-digit',
        }),
        trips: ts.length,
        distance: km.toFixed(0),
        barPct: Math.round((km / maxKm) * 100),
        barColor: km > 200 ? '#ff6b35' : km > 80 ? '#ffd166' : 'var(--accent)',
        rawTrips: ts,
      }
    })
})

// ─── Výběr dne ────────────────────────────────────────────
function selectDay(day) {
  selectedDay.value = day
  expandedTrip.value = null
}

const dayTrips = computed(() => selectedDay.value?.rawTrips ?? [])
const selectedDayLabel = computed(() => selectedDay.value?.label ?? '')
const dayDistance = computed(() => {
  const km = dayTrips.value.reduce((a, t) => a + (t.TotalDistance ?? 0), 0)
  return km.toFixed(1) + ' km'
})

function toggleTrip(i) {
  expandedTrip.value = expandedTrip.value === i ? null : i
}

// ─── Helpers ──────────────────────────────────────────────
function tripLabel(trip) {
  if (trip.StartAddress || trip.FinishAddress)
    return `${trip.StartAddress || '?'} → ${trip.FinishAddress || '?'}`
  return `${formatTime(trip.StartTime)} → ${formatTime(trip.FinishTime)}`
}

function formatTime(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })
}

function formatDist(km) {
  return km ? km.toFixed(1) + ' km' : '—'
}

function formatFuel(trip) {
  const liters = trip.FuelConsumed?.Value
  if (!liters) return '—'
  const lp100 = trip.TotalDistance
    ? ((liters / trip.TotalDistance) * 100).toFixed(1) + ' l/100km'
    : ''
  return `${liters.toFixed(1)} l /  ⌀ ${lp100}`
}
</script>

<style scoped>
.month-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.month-day {
  display: grid;
  grid-template-columns: 80px 1fr auto auto;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: 7px;
  cursor: pointer;
  transition: all 0.12s;
  margin: 3px 0;
}

.month-day:hover {
  background: var(--surface);
}
.month-day.expanded {
  background: var(--surface2);
  border-color: var(--accent);
}

.month-day-date {
  font-family: 'DM Mono', monospace;
  font-size: 12px;
  color: var(--muted);
}

.month-day-bar-wrap {
  height: 5px;
  background: var(--surface2);
  border-radius: 3px;
  overflow: hidden;
}

.month-day-bar {
  height: 100%;
  border-radius: 3px;
  transition: width 0.4s;
}

.month-day-stats {
  display: flex;
  gap: 8px;
  font-family: 'DM Mono', monospace;
  font-size: 12px;
  color: var(--muted);
  white-space: nowrap;
}

.day-header {
  font-family: 'DM Mono', monospace;
  font-size: 12px;
  font-weight: bold;
  color: var(--accent);
  padding: 4px 0 10px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.back-btn {
  background: var(--accent);
  color: #ffffff;
  border: none;
  padding: 4px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-family: 'DM Mono', monospace;
  font-size: 11px;
  font-weight: 600;
  transition: all 0.15s;
}

.back-btn:hover {
  background: #00b347;
  transform: translateX(-2px);
}

.chart-legend {
  display: flex;
  gap: 16px;
  justify-content: center;
  margin-top: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
  display: none;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: 'DM Mono', monospace;
  font-size: 12px;
  color: var(--text);
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.trip-item {
  display: flex;
  gap: 10px;
  padding: 8px 4px;
  border-bottom: 1px solid var(--border);
  align-items: flex-start;
  cursor: pointer;
  border-radius: 4px;
  transition: background 0.1s;
}

.trip-item:hover {
  background: var(--surface);
}
.trip-item.expanded {
  border-color: var(--accent);
  border-bottom-left-radius: 0px;
  border-bottom-right-radius: 0px;
}

.trip-item:last-child {
  border-bottom: none;
}

.trip-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
  margin-top: 5px;
  flex-shrink: 0;
}

.trip-info {
  flex: 1;
}

.trip-route {
  font-size: 12px;
  font-weight: 500;
  margin-bottom: 3px;
}

.trip-meta {
  font-family: 'DM Mono', monospace;
  font-size: 12px;
  color: var(--muted);
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.trip-chevron {
  font-size: 11px;
  color: var(--muted);
  margin-top: 0px;
  flex-shrink: 0;
}

.trip-detail {
  background: var(--surface);
  border: 1px solid var(--border);
  border-top: none;
  border-radius: 0 0 8px 8px;
  padding: 10px 12px;
  margin-bottom: 4px;
}

.trip-detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.td-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 7px;
}
.td-full {
  grid-column: 1 / -1;
}

.td-label {
  font-family: 'DM Mono', monospace;
  font-size: 12px;
  color: var(--muted);
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.td-val {
  font-size: 12px;
  color: var(--text);
  font-family: 'DM Sans', sans-serif;
}
</style>
