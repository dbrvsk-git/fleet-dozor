<template>
  <!-- Loading overlay -->
  <div v-if="appLoading" class="loading-overlay">
    <div class="loading-logo">Fleet <span style="color: var(--accent)">Dozor</span></div>
    <div class="loading-bar-wrap">
      <div class="loading-bar" :style="{ width: loadingPct + '%' }"></div>
    </div>
    <div class="loading-text">{{ loadingText }}</div>
  </div>

  <!-- Hlavní aplikace -->
  <template v-else>
    <!-- HEADER -->
    <header>
      <div class="header-car">🚗</div>
      <div class="logo">
        <div class="logo-dot"></div>
        Fleet Dozor
      </div>
      <div class="header-status">
        <span class="status-live">LIVE</span>
        <span>{{ groupName }}</span>
      </div>
      <div class="header-datetime">
        <div class="header-date">{{ date }}</div>
        <span style="color: white">|</span>
        <div class="header-time">{{ clock }}</div>
      </div>
    </header>

    <!-- LAYOUT -->
    <div class="app-layout">
      <!-- Sidebar se seznamem vozidel -->
      <VehicleList
        :vehicles="vehicles"
        :selected="selected"
        :loading="vehiclesLoading"
        @select="onSelectVehicle"
      />

      <!-- Pravá část: mapa + spodní panel -->
      <div class="main-content">
        <div class="map-wrapper">
          <MapView
            :vehicles="vehicles"
            :selected="selected"
            :route="route"
            :mode="mapMode"
            @mode-change="onModeChange"
            @vehicle-click="onSelectVehicle"
          />
        </div>

        <div class="bottom-panel">
          <!-- Detail vybraného vozidla -->
          <div class="panel-section">
            <div class="panel-title">
              Detail vozidla
              <span class="vehicle-name-title">{{ selected?.Name || '—' }}</span>
            </div>
            <VehicleDetail :vehicle="selected" />
          </div>

          <!-- Kniha jízd -->
          <TripBook :vehicle-code="selected?.Code" @dates-change="onDatesChange" />

          <!-- Spotřeba paliva -->
          <FuelAnalysis :vehicle-code="selected?.Code" />
        </div>
      </div>
    </div>
  </template>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { getGroups, getVehicles, getVehicleHistory, formatDateForApi } from './api/gpsdozor.js'

import VehicleList from './components/VehicleList.vue'
import MapView from './components/MapView.vue'
import TripBook from './components/TripBook.vue'
import FuelAnalysis from './components/FuelAnalysis.vue'
import VehicleDetail from './components/VehicleDetail.vue'

// ─── State ────────────────────────────────────────────────
const appLoading = ref(true)
const loadingPct = ref(0)
const loadingText = ref('Připojuji se k API…')
const vehiclesLoading = ref(false)

const groupName = ref('—')
const groupCode = ref('SAGU')
const vehicles = ref([])
const selected = ref(null)
const mapMode = ref('live')
const route = ref([])
const clock = ref('')
const date = ref('')
const dates = ref({ from: null, to: null })

let refreshInterval = null
let clockInterval = null

// ─── Clock + Date ─────────────────────────────────────────
function updateClock() {
  const now = new Date()
  clock.value = now.toLocaleTimeString('cs-CZ', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  date.value = now.toLocaleDateString('cs-CZ', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

// ─── Inicializace ─────────────────────────────────────────
onMounted(async () => {
  updateClock()
  clockInterval = setInterval(updateClock, 1000)

  try {
    loadingPct.value = 20
    loadingText.value = 'Načítám skupiny…'
    const groups = await getGroups()
    const group = groups[0]
    groupCode.value = group.Code
    groupName.value = group.Name

    loadingPct.value = 55
    loadingText.value = 'Načítám vozidla…'
    vehicles.value = await getVehicles(group.Code)

    loadingPct.value = 100
    loadingText.value = 'Hotovo!'

    setTimeout(() => {
      appLoading.value = false
    }, 400)

    // Auto-refresh každých 30 sekund
    refreshInterval = setInterval(refreshVehicles, 30_000)
  } catch (e) {
    loadingText.value = 'Chyba připojení: ' + e.message
  }
})

onUnmounted(() => {
  clearInterval(refreshInterval)
  clearInterval(clockInterval)
})

// ─── Refresh live dat ─────────────────────────────────────
async function refreshVehicles() {
  try {
    const fresh = await getVehicles(groupCode.value)
    vehicles.value = fresh

    // Aktualizuj selected vehicle pokud je vybrané
    if (selected.value) {
      const updated = fresh.find((v) => v.Code === selected.value.Code)
      if (updated) selected.value = updated
    }
  } catch (e) {
    console.error('Refresh selhal:', e)
  }
}

// ─── Výběr vozidla ────────────────────────────────────────
function onSelectVehicle(vehicle) {
  selected.value = vehicle
  if (mapMode.value === 'track' && dates.value.from) {
    loadRoute()
  }
}

// ─── Změna módu mapy ─────────────────────────────────────
async function onModeChange(mode) {
  mapMode.value = mode
  if (mode === 'track' && selected.value && dates.value.from) {
    await loadRoute()
  } else {
    route.value = []
  }
}

// ─── Načtení trasy z history endpointu ───────────────────
async function loadRoute() {
  if (!selected.value || !dates.value.from || !dates.value.to) return
  try {
    const from = formatDateForApi(dates.value.from)
    const to = formatDateForApi(dates.value.to, true)
    const data = await getVehicleHistory(selected.value.Code, from, to)
    route.value = data[0]?.Positions || []
  } catch (e) {
    console.error('Chyba trasy:', e)
    route.value = []
  }
}

// ─── Callback z TripBook — jen pro mapu ──────────────────
function onDatesChange({ from, to }) {
  dates.value = { from, to }
  if (mapMode.value === 'track') loadRoute()
}
</script>
