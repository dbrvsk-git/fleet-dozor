<template>
  <div class="panel-section">
    <div class="panel-title">
      Eco Driving
      <div class="tabs">
        <div class="tab" :class="{ active: tab === 'chart' }" @click="tab = 'chart'">Graf</div>
        <div class="tab" :class="{ active: tab === 'list' }" @click="tab = 'list'">Události</div>
      </div>
    </div>

    <div v-if="loading" class="empty-state">
      <span class="empty-icon">⏳</span> Načítám…
    </div>

    <div v-else-if="!vehicleCode" class="empty-state">
      <span class="empty-icon">📊</span> Vyberte vozidlo
    </div>

    <div v-else-if="events.length === 0" class="empty-state">
      <span class="empty-icon">✅</span> Žádné eco události — výborná jízda!
    </div>

    <!-- GRAF -->
    <div v-else-if="tab === 'chart'" class="eco-chart-wrap">
      <canvas ref="chartEl"></canvas>
    </div>

    <!-- SEZNAM UDÁLOSTÍ -->
    <div v-else>
      <div v-for="(e, i) in events.slice(0, 12)" :key="i" class="trip-item">
        <div class="trip-dot" :style="{ background: ecoType(e.EventType).color }"></div>
        <div class="trip-info">
          <div class="trip-route" style="font-size: 11px">
            {{ ecoType(e.EventType).label }}
            <span v-if="e.EventSeverity > 0" :style="{ color: ecoType(e.EventType).color }">
              {{ '!'.repeat(e.EventSeverity) }}
            </span>
          </div>
          <div class="trip-meta">
            <span>{{ formatTime(e.Timestamp) }}</span>
            <span>{{ e.Speed }} km/h</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'
import { Chart, BarController, BarElement, CategoryScale, LinearScale, Tooltip } from 'chart.js'
import { getEcoDriving, formatDateForApi } from '../api/gpsdozor.js'

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip)

const props = defineProps({
  vehicleCode: { type: String, default: null },
  dateFrom: { type: String, default: null },
  dateTo: { type: String, default: null },
})

// ─── State ────────────────────────────────────────────────
const events = ref([])
const loading = ref(false)
const tab = ref('chart')
const chartEl = ref(null)
let chartInstance = null

// ─── Eco event typy ───────────────────────────────────────
const ECO_TYPES = {
  0: { label: 'Neznámá',    color: '#5a6070' },
  1: { label: 'Zatáčka L',  color: '#0062ff' },
  2: { label: 'Zatáčka P',  color: '#0062ff' },
  3: { label: 'Průjezd',    color: '#7b5ea7' },
  4: { label: 'Akcelerace', color: '#ff6b35' },
  5: { label: 'Brzdění',    color: '#e63946' },
  6: { label: 'Náraz',      color: '#ff006e' },
  7: { label: 'Spojka',     color: '#f4a261' },
  8: { label: 'Neutrál',    color: '#457b9d' },
  9: { label: 'Volnoběh',   color: '#2a9d8f' },
}

function ecoType(type) {
  return ECO_TYPES[type] ?? ECO_TYPES[0]
}

// ─── Načíst eco data ──────────────────────────────────────
async function load() {
  if (!props.vehicleCode || !props.dateFrom || !props.dateTo) return

  loading.value = true
  events.value = []

  try {
    const from = formatDateForApi(props.dateFrom)
    const to = formatDateForApi(props.dateTo, true)
    const data = await getEcoDriving(props.vehicleCode, from, to)
    events.value = Array.isArray(data) ? data : []
  } catch (e) {
    console.error('Chyba eco-driving:', e)
  } finally {
    loading.value = false
    // Počkej na DOM, pak vykresli chart
    if (tab.value === 'chart') {
      await nextTick()
      renderChart()
    }
  }
}

// ─── Vykreslit Chart.js bar chart ────────────────────────
function renderChart() {
  if (!chartEl.value || !events.value.length) return

  // Spočítej výskyty podle typu
  const counts = {}
  events.value.forEach(e => {
    counts[e.EventType] = (counts[e.EventType] || 0) + 1
  })

  const labels = Object.keys(counts).map(t => ECO_TYPES[t]?.label || 'Jiné')
  const values = Object.values(counts)
  const colors = Object.keys(counts).map(t => ECO_TYPES[t]?.color || '#5a6070')

  if (chartInstance) chartInstance.destroy()

  chartInstance = new Chart(chartEl.value, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors.map(c => c + '99'),
        borderColor: colors,
        borderWidth: 1.5,
        borderRadius: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#111318',
          borderColor: '#1e2430',
          borderWidth: 1,
          titleColor: '#e8eaf2',
          bodyColor: '#5a6070',
        },
      },
      scales: {
        x: { ticks: { color: '#5a6070', font: { size: 9 } }, grid: { color: '#1e2430' } },
        y: { ticks: { color: '#5a6070', font: { size: 9 } }, grid: { color: '#1e2430' } },
      },
    },
  })
}

// ─── Watchers ─────────────────────────────────────────────
watch(() => [props.vehicleCode, props.dateFrom, props.dateTo], load)
watch(tab, async (newTab) => {
  if (newTab === 'chart' && events.value.length) {
    await nextTick()
    renderChart()
  }
})

// ─── Helper ───────────────────────────────────────────────
function formatTime(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}
</script>
