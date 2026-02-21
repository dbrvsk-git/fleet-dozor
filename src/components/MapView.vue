<template>
  <div class="map-section">
    <div id="map" ref="mapEl"></div>

    <!-- Přepínač LIVE / TRASA -->
    <div class="map-overlay">
      <button
        class="map-btn"
        :class="{ active: mode === 'live' }"
        @click="$emit('mode-change', 'live')"
      >
        LIVE
      </button>
      <button
        class="map-btn"
        :class="{ active: mode === 'track' }"
        @click="$emit('mode-change', 'track')"
      >
        TRASA
      </button>
    </div>

    <!-- Weather widget — zobrazí se po výběru vozidla (pokud existuje VITE_OWM_KEY) -->
    <transition name="fade">
      <div v-if="weather" class="weather-widget">
        <span class="weather-icon">{{ weatherIcon(weather.weather[0].id) }}</span>
        <span class="weather-temp">{{ Math.round(weather.main.temp) }}°C</span>
        <!--  <span class="weather-desc">{{ weather.weather[0].description }}</span> -->
        <span class="weather-wind">💨 {{ Math.round(weather.wind.speed) }} m/s</span>
        <span class="weather-loc">{{ weather.name }}</span>
      </div>
      <div v-else-if="weatherLoading" class="weather-widget weather-skeleton">
        ⏳ Načítám počasí…
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const props = defineProps({
  vehicles: { type: Array, default: () => [] },
  selected: { type: Object, default: null },
  route: { type: Array, default: () => [] },
  mode: { type: String, default: 'live' },
})

const emit = defineEmits(['mode-change', 'vehicle-click'])

// ─── Map state ────────────────────────────────────────────
const mapEl = ref(null)
let map = null
const markerMap = {}
let routeLayer = null

// ─── Weather state ────────────────────────────────────────
const weather = ref(null)
const weatherLoading = ref(false)
let weatherTimer = null

// ─── Init Leaflet ─────────────────────────────────────────
onMounted(() => {
  map = L.map(mapEl.value, {
    zoomControl: false,
    attributionControl: false,
  }).setView([50.05, 14.4], 7)

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
  }).addTo(map)

  L.control.zoom({ position: 'bottomright' }).addTo(map)

  if (props.vehicles.length) updateMarkers(props.vehicles)
})

onUnmounted(() => {
  if (weatherTimer) clearTimeout(weatherTimer)
})

// ─── Ikona markeru — původní barvy ───────────────────────
function makeIcon(speed, isActive) {
  const moving = speed > 3
  const color = isActive ? 'red' : moving ? 'orange' : '#5a6070'
  const size = isActive ? 16 : 12
  const svg = `
    <svg width="${size * 2}" height="${size * 2}" viewBox="0 0 ${size * 2} ${size * 2}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${size}" cy="${size}" r="${size - 2}" fill="${color}" opacity="0.2"/>
      <circle cx="${size}" cy="${size}" r="${size / 2}" fill="${color}"/>
      ${
        isActive
          ? `<circle cx="${size}" cy="${size}" r="${size - 1}" fill="none" stroke="${color}" stroke-width="1.5" opacity="0.6"/>`
          : ''
      }
    </svg>`
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [size * 2, size * 2],
    iconAnchor: [size, size],
  })
}

// ─── Aktualizace markerů ──────────────────────────────────
function updateMarkers(vehicles) {
  if (!map) return
  vehicles.forEach((v) => {
    const lat = parseFloat(v.LastPosition?.Latitude)
    const lng = parseFloat(v.LastPosition?.Longitude)
    if (lat == null || lng == null) return

    const isActive = props.selected?.Code === v.Code
    const icon = makeIcon(v.Speed, isActive)

    if (markerMap[v.Code]) {
      markerMap[v.Code].setLatLng([lat, lng]).setIcon(icon)
    } else {
      const marker = L.marker([lat, lng], { icon }).addTo(map)
      marker.bindTooltip(`<b>${v.Name}</b><br>${v.Speed} km/h`)
      marker.on('click', () => emit('vehicle-click', v))
      markerMap[v.Code] = marker
    }
  })
}

// ─── Kreslení trasy ───────────────────────────────────────
function drawRoute(positions) {
  if (routeLayer) {
    map.removeLayer(routeLayer)
    routeLayer = null
  }
  if (!positions?.length) return

  const latlngs = positions.map((p) => [parseFloat(p.Lat), parseFloat(p.Lng)])
  routeLayer = L.polyline(latlngs, {
    color: 'blue',
    weight: 2.5,
    opacity: 0.8,
  }).addTo(map)
  map.fitBounds(routeLayer.getBounds(), { padding: [40, 40] })
}

// ─── Počasí (OpenWeatherMap) ──────────────────────────────
async function fetchWeather(lat, lon) {
  // Počasí funguje pouze pokud je nastaven VITE_OWM_KEY v .env
  const key = import.meta.env.VITE_OWM_KEY
  if (!key) return

  weatherLoading.value = true
  weather.value = null

  try {
    // Vite proxy /owm → https://api.openweathermap.org (viz vite.config.js)
    const res = await fetch(
      `/owm/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${key}&units=metric&lang=cs`,
    )
    if (res.ok) weather.value = await res.json()
  } catch (e) {
    console.warn('Počasí nelze načíst:', e)
  } finally {
    weatherLoading.value = false
  }
}

function weatherIcon(id) {
  if (id >= 200 && id < 300) return '⛈'
  if (id >= 300 && id < 400) return '🌦'
  if (id >= 500 && id < 600) return '🌧'
  if (id >= 600 && id < 700) return '❄️'
  if (id >= 700 && id < 800) return '🌫'
  if (id === 800) return '☀️'
  if (id > 800) return '☁️'
  return '🌡'
}

// ─── Watchers ─────────────────────────────────────────────
watch(
  () => props.vehicles,
  (v) => updateMarkers(v),
  { deep: true },
)

watch(
  () => props.selected,
  (v) => {
    if (!v || !map) return
    updateMarkers(props.vehicles)

    const lat = parseFloat(v.LastPosition?.Latitude)
    const lng = parseFloat(v.LastPosition?.Longitude)

    if (props.mode === 'live' && lat && lng) {
      map.flyTo([lat, lng], 13, {
        animate: true,
      })

      // posun mapy aby auto nebylo pod panely
      setTimeout(() => {
        map.panBy([0, -window.innerHeight * 0.2])
      }, 250)
    }

    // Načti počasí na poloze vozidla (s drobným debounce)
    if (lat && lng) {
      if (weatherTimer) clearTimeout(weatherTimer)
      weatherTimer = setTimeout(() => fetchWeather(lat, lng), 600)
    }
  },
)

watch(() => props.route, drawRoute, { deep: true })
</script>

<style scoped>
.map-section {
  position: relative;
  overflow: hidden;
  height: 100%;
}

.map-wrapper {
  flex: 1;
  overflow: hidden;
}

#map {
  width: 100%;
  height: 100%;
}

:deep(.leaflet-tile) {
}
:deep(.leaflet-control-attribution) {
  display: none !important;
}

/* ─── Tlačítka — původní styl ───────────────────────────── */
.map-overlay {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 500;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.map-btn {
  background: rgba(10, 12, 16, 0.85);
  border: 1px solid #3a4455;
  color: #e8eaf2;
  padding: 8px 14px;
  border-radius: 8px;
  cursor: pointer;
  font-family: 'DM Mono', monospace;
  font-size: 11px;
  letter-spacing: 0.5px;
  transition: all 0.15s;
  backdrop-filter: blur(6px);
}

.map-btn:hover {
  border-color: #ffd166;
  color: #ffd166;
}

.map-btn.active {
  background: rgba(255, 107, 53, 0.2);
  border-color: #ff6b35;
  color: #ff6b35;
}

/* ─── Weather widget ────────────────────────────────────── */
.weather-widget {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 500;
  background: rgba(17, 19, 24, 0.9);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 8px 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  backdrop-filter: blur(8px);
}

.weather-icon {
  font-size: 20px;
  line-height: 1;
}

.weather-temp {
  font-family: 'Syne', sans-serif;
  font-weight: 700;
  font-size: 15px;
  color: #fff;
}

.weather-desc {
  font-family: 'DM Mono', monospace;
  font-size: 10px;
  color: #fff;
  text-transform: capitalize;
}

.weather-wind {
  font-family: 'DM Mono', monospace;
  font-size: 10px;
  color: #fff;
}

.weather-loc {
  font-family: 'DM Mono', monospace;
  font-size: 10px;
  color: #fff;
  border-left: 1px solid var(--border);
  padding-left: 10px;
}

.weather-skeleton {
  font-family: 'DM Mono', monospace;
  font-size: 11px;
  color: var(--muted);
}

/* Fade transition pro weather widget */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.4s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
