<template>
  <div class="panel-section">
    <div class="panel-title">
      Spotřeba paliva
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

    <!-- Bez vozidla -->
    <div v-if="!vehicleCode" class="empty-state">
      <span class="empty-icon">⛽</span> Vyberte vozidlo
    </div>

    <div v-else-if="loading" class="empty-state">
      <span class="empty-icon">⏳</span> Načítám data…
    </div>

    <div v-else-if="!trips.length" class="empty-state">
      <span class="empty-icon">🚫</span> Žádné jízdy v tomto období
    </div>

    <div v-else class="fuel-content">
      <!-- Upozornění na příliš velké rozpětí -->
      <div v-if="dateRangeTooLarge" class="range-warning">
        ⚠️ Zvolené období je delší než 60 dní. Pro přehlednější graf zkraťte rozsah.
      </div>

      <!-- KPI karty -->
      <div class="fuel-kpi-row">
        <div class="fuel-kpi">
          <div class="fuel-kpi-value">{{ totalFuel }}</div>
          <div class="fuel-kpi-label">Celkem litrů</div>
        </div>
        <div class="fuel-kpi">
          <div class="fuel-kpi-value">{{ avgConsumption }}</div>
          <div class="fuel-kpi-label">Průměr l/100km</div>
        </div>
        <div class="fuel-kpi">
          <div class="fuel-kpi-value">{{ totalDistance }}</div>
          <div class="fuel-kpi-label">Celkem km</div>
        </div>
        <div class="fuel-kpi" :class="{ 'kpi-warn': trendUp }">
          <div class="fuel-kpi-value">{{ trendLabel }}</div>
          <div class="fuel-kpi-label">Trend</div>
        </div>
      </div>

      <!-- Přepínač graf / dny -->
      <div class="tabs" style="margin-bottom: 8px">
        <div class="tab" :class="{ active: view === 'chart' }" @click="view = 'chart'">Graf</div>
        <div class="tab" :class="{ active: view === 'days' }" @click="view = 'days'">Dny</div>
      </div>

      <!-- GRAF -->
      <div v-if="view === 'chart'">
        <div class="fuel-chart-wrap">
          <canvas ref="chartEl"></canvas>
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
      </div>

      <!-- DNY — přehled dnů -->
      <template v-else-if="view === 'days' && !selectedDay">
        <div class="month-list">
          <div v-for="day in groupedDays" :key="day.date" class="month-day" @click="selectDay(day)">
            <div class="month-day-date">{{ day.label }}</div>
            <div class="month-day-bar-wrap">
              <div
                class="month-day-bar"
                :style="{ width: day.barPct + '%', background: day.barColor }"
              ></div>
            </div>
            <div class="month-day-stats">
              <span>{{ day.totalFuel }}</span>
              <span>{{ day.avgL100 }} l/100</span>
            </div>
            <div class="trip-chevron">▼</div>
          </div>
        </div>
      </template>

      <!-- DNY — jízdy vybraného dne -->
      <template v-else-if="view === 'days' && selectedDay">
        <div class="day-header">
          <button class="back-btn" @click="selectedDay = null">Zpět</button>
          <span
            >{{ selectedDay.label }} · Jízdy: {{ selectedDay.trips }}x ·
            {{ selectedDay.totalFuel }}</span
          >
        </div>
        <div v-for="(trip, i) in selectedDay.rawTrips" :key="i">
          <div class="trip-item" :class="{ expanded: expandedTrip === i }" @click="toggleTrip(i)">
            <div class="trip-dot"></div>
            <div class="trip-info">
              <div class="trip-route">{{ tripLabel(trip) }}</div>
              <div class="trip-meta">
                <span>{{ formatDist(trip.TotalDistance) }}</span>
                <span>{{ formatFuelShort(trip) }}</span>
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
                <div class="td-label">VZDÁLENOST</div>
                <div class="td-val">{{ formatDist(trip.TotalDistance) }}</div>
              </div>
              <div class="td-item">
                <div class="td-label">MAX RYCHLOST</div>
                <div class="td-val">{{ trip.MaxSpeed ?? '—' }} km/h</div>
              </div>
              <div class="td-item">
                <div class="td-label">SPOTŘEBA</div>
                <div class="td-val">{{ formatFuelFull(trip) }}</div>
              </div>
              <div class="td-item">
                <div class="td-label">L/100KM</div>
                <div class="td-val">{{ calcL100(trip) }}</div>
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
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Filler,
} from 'chart.js'
import { getTrips, formatDateForApi } from '../api/gpsdozor.js'

Chart.register(
  LineController,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Filler,
)

const props = defineProps({
  vehicleCode: { type: String, default: null },
})

const emit = defineEmits(['dates-change'])

// ─── State ────────────────────────────────────────────────
const trips = ref([])
const loading = ref(false)
const view = ref('chart')
const chartEl = ref(null)
const selectedDay = ref(null)
const expandedTrip = ref(null)
let chartInstance = null

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
  trips.value = []
  selectedDay.value = null
  expandedTrip.value = null

  emit('dates-change', { from: dateFrom.value, to: dateTo.value })

  try {
    const data = await getTrips(
      props.vehicleCode,
      formatDateForApi(dateFrom.value),
      formatDateForApi(dateTo.value, true),
    )
    trips.value = (Array.isArray(data) ? data : []).filter((t) => t.TotalDistance > 0.5)
  } catch (e) {
    console.error('FuelAnalysis chyba:', e)
  } finally {
    loading.value = false
    await nextTick()
    if (view.value === 'chart') renderChart()
  }
}

watch(
  () => props.vehicleCode,
  () => load(),
)
watch(view, async (v) => {
  if (v === 'chart') {
    await nextTick()
    renderChart()
  }
})

// ─── KPI ──────────────────────────────────────────────────
function calcLper100(trip) {
  const liters = trip.FuelConsumed?.Value ?? 0
  const km = trip.TotalDistance ?? 0
  if (!liters || !km) return null
  return parseFloat(((liters / km) * 100).toFixed(1))
}

const rowsWithFuel = computed(() =>
  trips.value
    .map((t) => ({ trip: t, lper100: calcLper100(t), liters: t.FuelConsumed?.Value ?? 0 }))
    .filter((r) => r.lper100 !== null && r.lper100 > 0),
)

const totalFuel = computed(() => {
  const sum = trips.value.reduce((a, t) => a + (t.FuelConsumed?.Value ?? 0), 0)
  return sum > 0 ? sum.toFixed(1) + ' l' : '—'
})

const avgConsumption = computed(() => {
  if (!rowsWithFuel.value.length) return '—'
  const avg = rowsWithFuel.value.reduce((a, r) => a + r.lper100, 0) / rowsWithFuel.value.length
  return avg.toFixed(1)
})

const totalDistance = computed(() => {
  const sum = trips.value.reduce((a, t) => a + (t.TotalDistance ?? 0), 0)
  return sum > 0 ? sum.toFixed(0) : '—'
})

const trendUp = computed(() => {
  const rows = rowsWithFuel.value
  if (rows.length < 4) return false
  const third = Math.floor(rows.length / 3)
  const avgFirst = rows.slice(0, third).reduce((a, r) => a + r.lper100, 0) / third
  const avgLast = rows.slice(-third).reduce((a, r) => a + r.lper100, 0) / third
  return avgLast > avgFirst + 0.5
})

const trendLabel = computed(() => {
  if (rowsWithFuel.value.length < 4) return '—'
  return trendUp.value ? '↑ roste' : '↓ klesá'
})

// Kontrola rozsahu data
const dateRangeTooLarge = computed(() => {
  const from = new Date(dateFrom.value)
  const to = new Date(dateTo.value)
  const days = Math.floor((to - from) / (1000 * 60 * 60 * 24))
  return days > 60
})

// ─── Seskupit po dnech ────────────────────────────────────
const groupedDays = computed(() => {
  if (!trips.value.length) return []

  const byDay = {}
  trips.value.forEach((t) => {
    const d = t.StartTime?.slice(0, 10)
    if (!d) return
    if (!byDay[d]) byDay[d] = []
    byDay[d].push(t)
  })

  const maxL = Math.max(
    ...Object.values(byDay).map((ts) => ts.reduce((a, t) => a + (t.FuelConsumed?.Value ?? 0), 0)),
    1,
  )

  return Object.entries(byDay)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, ts]) => {
      const liters = ts.reduce((a, t) => a + (t.FuelConsumed?.Value ?? 0), 0)
      const km = ts.reduce((a, t) => a + (t.TotalDistance ?? 0), 0)
      const l100 = km > 0 ? ((liters / km) * 100).toFixed(1) : null
      return {
        date,
        isToday: date === todayStr,
        label: new Date(date + 'T12:00').toLocaleDateString('cs-CZ', {
          weekday: 'short',
          day: '2-digit',
          month: '2-digit',
        }),
        trips: ts.length,
        totalFuel: liters > 0 ? liters.toFixed(1) + ' l' : '—',
        avgL100: l100 ?? '—',
        barPct: Math.round((liters / maxL) * 100),
        barColor: l100 > 11 ? '#ff6b35' : l100 > 7 ? '#ffd166' : 'var(--accent)',
        rawTrips: ts,
      }
    })
})

function selectDay(day) {
  selectedDay.value = day
  expandedTrip.value = null
}

function toggleTrip(i) {
  expandedTrip.value = expandedTrip.value === i ? null : i
}

// ─── Chart (spojnicový) — podle DNŮ, ne jízd ─────────────
function pointColor(val) {
  if (!val) return 'var(--muted)'
  if (val < 7) return '#00e5a0'
  if (val < 11) return '#ffd166'
  return '#ff6b35'
}

function renderChart() {
  if (!chartEl.value || !groupedDays.value.length) return
  if (chartInstance) chartInstance.destroy()

  // Data po dnech místo po jízdách
  const days = groupedDays.value
    .slice()
    .reverse() // chronologické pořadí (od nejstaršího)
    .filter((d) => d.avgL100 !== '—')

  if (!days.length) return

  const labels = days.map((d) => d.label)
  const values = days.map((d) => parseFloat(d.avgL100))
  const colors = values.map(pointColor)
  const avg = values.reduce((a, b) => a + b, 0) / values.length

  chartInstance = new Chart(chartEl.value, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'l/100km',
          data: values,
          borderColor: '#ffd166',
          backgroundColor: 'rgba(255, 209, 102, 0.15)',
          pointBackgroundColor: colors,
          pointBorderColor: colors,
          pointBorderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 7,
          borderWidth: 3,
          tension: 0.3,
          fill: true,
        },
        {
          label: 'průměr',
          data: values.map(() => avg),
          borderColor: 'rgba(255,255,255,0.4)',
          borderWidth: 2,
          borderDash: [6, 4],
          pointRadius: 0,
          fill: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(17, 19, 24, 0.95)',
          borderColor: '#ffd166',
          borderWidth: 2,
          titleColor: '#e8eaf2',
          bodyColor: '#e8eaf2',
          titleFont: { family: 'DM Mono', size: 12, weight: '600' },
          bodyFont: { family: 'DM Mono', size: 11 },
          padding: 10,
          callbacks: {
            label: (ctx) => {
              const val = ctx.parsed.y.toFixed(1)
              return ctx.datasetIndex === 0
                ? ` ${val} l/100km`
                : ` průměr: ${avg.toFixed(1)} l/100km`
            },
          },
        },
      },
      scales: {
        x: {
          ticks: {
            color: '#9aaabb',
            font: { family: 'DM Mono', size: 10 },
          },
          grid: { color: 'rgba(58, 68, 85, 0.3)' },
        },
        y: {
          ticks: {
            color: '#9aaabb',
            font: { family: 'DM Mono', size: 10 },
            callback: (v) => v.toFixed(1) + ' l',
          },
          grid: { color: 'rgba(58, 68, 85, 0.3)' },
        },
      },
    },
  })
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

function calcL100(trip) {
  const v = calcLper100(trip)
  return v ? v + ' l/100km' : '—'
}

function formatFuelShort(trip) {
  const v = calcLper100(trip)
  return v ? v + ' l/100' : '—'
}

function formatFuelFull(trip) {
  const liters = trip.FuelConsumed?.Value
  return liters ? liters.toFixed(1) + ' l' : '—'
}
</script>

<style scoped>
.fuel-content {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.range-warning {
  background: rgba(255, 107, 53, 0.1);
  border: 1px solid rgba(255, 107, 53, 0.3);
  border-radius: 8px;
  padding: 8px 12px;
  font-family: 'DM Mono', monospace;
  font-size: 11px;
  color: var(--warn);
  text-align: center;
}

.fuel-kpi-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}

.fuel-kpi {
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 10px;
  text-align: center;
}

.fuel-kpi-value {
  font-family: 'Syne', sans-serif;
  font-weight: 700;
  font-size: 14px;
  color: var(--accent);
  line-height: 1.2;
}

.fuel-kpi-label {
  font-family: 'DM Mono', monospace;
  font-size: 9px;
  color: var(--muted);
  margin-top: 3px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.kpi-warn .fuel-kpi-value {
  color: var(--warn);
}

.fuel-chart-wrap {
  position: relative;
  height: 120px;
}

.chart-legend {
  display: flex;
  gap: 16px;
  justify-content: center;
  margin-top: 12px;
  flex-wrap: wrap;
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
  padding: 6px 8px;
  border-radius: 7px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.12s;
}

.month-day:hover {
  background: var(--surface2);
  border-color: var(--border);
}

.month-day.today {
  background: rgba(0, 98, 255, 0.08);
  border-color: rgba(0, 98, 255, 0.3);
}

.month-day.today:hover {
  background: rgba(0, 98, 255, 0.12);
  border-color: rgba(0, 98, 255, 0.5);
}

.month-day.today .month-day-date {
  color: var(--accent2);
  font-weight: 600;
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
  font-size: 9px;
  color: var(--muted);
  margin-top: 4px;
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
