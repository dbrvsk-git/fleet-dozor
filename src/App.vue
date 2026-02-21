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
        <span style="color: #fff"> | </span>
        <div class="header-time">{{ clock }}</div>
      </div>
    </header>

    <!-- LAYOUT -->
    <div class="app-layout-new">
      <!-- Levý panel: Collapsible menu + detail -->
      <div class="left-sidebar" :style="{ width: leftWidth + 'px' }">
        <!-- Klikatelné menu vozidel -->
        <div class="collapsible-menu" @click="menuOpen = !menuOpen">
          <div class="menu-header">
            <span class="menu-icon">{{ menuOpen ? '▼' : '▶' }}</span>
            <span class="menu-title">SEZNAM VOZIDEL</span>
            <span class="count-badge">{{ vehicles.length }}</span>
          </div>
        </div>

        <!-- Rozbalený seznam vozidel -->
        <div v-if="menuOpen" class="vehicle-dropdown">
          <input
            v-model="search"
            class="search-box"
            type="text"
            placeholder="Hledat vozidlo nebo SPZ…"
            @click.stop
          />
          <div class="vehicle-list">
            <div
              v-for="v in filteredVehicles"
              :key="v.Code"
              class="vehicle-card-compact"
              :class="{ active: selected?.Code === v.Code }"
              @click="onSelectVehicle(v)"
            >
              <div class="vehicle-name-compact">{{ v.Name }}</div>
              <div v-if="v.SPZ" class="vehicle-spz-compact">RZ: {{ v.SPZ }}</div>

              <div class="vehicle-stats">
                <span class="speed-badge" :class="v.Speed > 3 ? 'speed-moving' : 'speed-stopped'">
                  {{ v.Speed > 3 ? `▶ ${v.Speed} km/h` : '■ stojí' }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Detail vybraného vozidla -->
        <div v-if="selected" class="vehicle-detail-panel">
          <div class="panel-title-small">
            DETAIL VOZIDLA
            <span class="vehicle-name-title">{{ selected?.Name || '—' }}</span>
          </div>
          <VehicleDetail :vehicle="selected" />
        </div>
      </div>

      <!-- Resize handle pro levý sloupec -->
      <div
        class="column-resize-handle"
        :style="{ left: leftWidth + 'px' }"
        @mousedown="startColumnResize"
        title="Přetáhněte pro změnu šířky"
      ></div>

      <!-- Pravá část: mapa + 2 panely -->
      <div class="right-content">
        <div
          class="map-wrapper"
          ref="mapWrapper"
          :style="vehicleChosen ? { height: mapHeight + 'px' } : { height: '100%' }"
        >
          <MapView
            :vehicles="vehicles"
            :selected="selected"
            :route="route"
            :mode="mapMode"
            @mode-change="onModeChange"
            @vehicle-click="onSelectVehicle"
          />
        </div>

        <!-- Resize handle -->
        <div
          v-if="vehicleChosen"
          class="resize-handle"
          @mousedown="startResize"
          title="Přetáhněte pro změnu velikosti mapy"
        ></div>

        <!-- Spodní panely (2 sloupce) -->
        <div v-if="vehicleChosen" class="bottom-panels">
          <TripBook :vehicle-code="selected?.Code" @dates-change="onDatesChange" />
          <FuelAnalysis :vehicle-code="selected?.Code" />
        </div>
      </div>
    </div>
  </template>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { getGroups, getVehicles, getVehicleHistory, formatDateForApi } from './api/gpsdozor.js'

import MapView from './components/MapView.vue'
import TripBook from './components/TripBook.vue'
import FuelAnalysis from './components/FuelAnalysis.vue'
import VehicleDetail from './components/VehicleDetail.vue'

// ─── State ────────────────────────────────────────────────
const appLoading = ref(true)
const loadingPct = ref(0)
const loadingText = ref('Připojuji se k API…')

const groupName = ref('—')
const groupCode = ref('SAGU')
const vehicles = ref([])
const selected = ref(null)
const mapMode = ref('live')
const route = ref([])
const clock = ref('')
const date = ref('')
const dates = ref({ from: null, to: null })

//nove!!!!
const vehicleChosen = ref(false)

// Menu state
const menuOpen = ref(true)
const search = ref('')

// Resize state
const mapHeight = ref(500)

const getLeftWidth = () => {
  if (window.innerWidth < 900) {
    return window.innerWidth
  }
  return Math.floor(window.innerWidth * 0.25)
}

const leftWidth = ref(getLeftWidth())

const mapWrapper = ref(null)

let isResizing = false
let isResizingColumn = false

window.addEventListener('resize', () => {
  leftWidth.value = getLeftWidth()
})
/*------------*/
let refreshInterval = null
let clockInterval = null

// ─── Filtered vehicles ────────────────────────────────────
const filteredVehicles = computed(() => {
  if (!search.value) return vehicles.value
  const q = search.value.toLowerCase()
  return vehicles.value.filter(
    (v) => v.Name.toLowerCase().includes(q) || (v.SPZ || '').toLowerCase().includes(q),
  )
})

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

// ─── Resize handlers ──────────────────────────────────────
function startResize(e) {
  isResizing = true
  document.addEventListener('mousemove', doResize)
  document.addEventListener('mouseup', stopResize)
  e.preventDefault()
}

function doResize(e) {
  if (!isResizing) return
  const containerHeight = window.innerHeight - 58
  const newMapHeight = e.clientY - 58
  if (newMapHeight > 200 && newMapHeight < containerHeight - 200) {
    mapHeight.value = newMapHeight
  }
}

function stopResize() {
  isResizing = false
  document.removeEventListener('mousemove', doResize)
  document.removeEventListener('mouseup', stopResize)
}

// ─── Column resize handlers ───────────────────────────────
function startColumnResize(e) {
  isResizingColumn = true
  document.addEventListener('mousemove', doColumnResize)
  document.addEventListener('mouseup', stopColumnResize)
  e.preventDefault()
}

function doColumnResize(e) {
  if (!isResizingColumn) return
  const newWidth = e.clientX
  const minWidth = 250
  const maxWidth = window.innerWidth * 0.4
  if (newWidth > minWidth && newWidth < maxWidth) {
    leftWidth.value = newWidth
  }
}

function stopColumnResize() {
  isResizingColumn = false
  document.removeEventListener('mousemove', doColumnResize)
  document.removeEventListener('mouseup', stopColumnResize)
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

    // Auto-výběr prvního vozidla
    // if (vehicles.value.length > 0) {
    //   selected.value = vehicles.value[0]
    // }

    loadingPct.value = 100
    loadingText.value = 'Hotovo!'

    setTimeout(() => {
      appLoading.value = false
    }, 400)

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
    if (selected.value) {
      const updated = fresh.find((v) => v.Code === selected.value.Code)
      if (updated) selected.value = updated
    }
  } catch (e) {
    console.error('Refresh selhal:', e)
  }
}

// ─── Výběr vozidla ────────────────────────────────────────
// function onSelectVehicle(vehicle) {
//  selected.value = vehicle
//  menuOpen.value = false // Zavři menu po výběru
//  if (mapMode.value === 'track' && dates.value.from) {
//    loadRoute()
//  }
// }

//nove!!!
function onSelectVehicle(vehicle) {
  selected.value = vehicle
  vehicleChosen.value = true
  menuOpen.value = false

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

// ─── Načtení trasy ────────────────────────────────────────
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

// ─── Callback z TripBook ──────────────────────────────────
function onDatesChange({ from, to }) {
  dates.value = { from, to }
  if (mapMode.value === 'track') loadRoute()
}

//jednoduchá cache
const tripbookCache = new Map()
const fuelCache = new Map()
</script>
