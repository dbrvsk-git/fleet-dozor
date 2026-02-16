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
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const props = defineProps({
  vehicles: { type: Array, default: () => [] },
  selected: { type: Object, default: null },
  route: { type: Array, default: () => [] }, // pole { Lat, Lng } bodů
  mode: { type: String, default: 'live' },   // 'live' | 'track'
})

defineEmits(['mode-change', 'vehicle-click'])

// ─── Map instance + layers ────────────────────────────────
const mapEl = ref(null)
let map = null
const markerMap = {}   // { vehicleCode: L.Marker }
let routeLayer = null

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

  // Vykresli vozidla pokud přišla dřív než mapa
  if (props.vehicles.length) updateMarkers(props.vehicles)
})

// ─── Ikona markeru ────────────────────────────────────────
function makeIcon(speed, isActive) {
  const moving = speed > 3
  const color = isActive ? '#00e5a0' : moving ? '#0062ff' : '#5a6070'
  const size = isActive ? 16 : 12
  const svg = `
    <svg width="${size * 2}" height="${size * 2}" viewBox="0 0 ${size * 2} ${size * 2}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${size}" cy="${size}" r="${size - 2}" fill="${color}" opacity="0.2"/>
      <circle cx="${size}" cy="${size}" r="${size / 2}" fill="${color}"/>
      ${isActive ? `<circle cx="${size}" cy="${size}" r="${size - 1}" fill="none" stroke="${color}" stroke-width="1.5" opacity="0.6"/>` : ''}
    </svg>`
  return L.divIcon({ html: svg, className: '', iconSize: [size * 2, size * 2], iconAnchor: [size, size] })
}

// ─── Aktualizace markerů ──────────────────────────────────
function updateMarkers(vehicles) {
  if (!map) return

  vehicles.forEach(v => {
    const lat = parseFloat(v.LastPosition?.Latitude)
    const lng = parseFloat(v.LastPosition?.Longitude)
    if (!lat || !lng) return

    const isActive = props.selected?.Code === v.Code
    const icon = makeIcon(v.Speed, isActive)

    if (markerMap[v.Code]) {
      markerMap[v.Code].setLatLng([lat, lng]).setIcon(icon)
    } else {
      const marker = L.marker([lat, lng], { icon }).addTo(map)
      marker.bindTooltip(`<b>${v.Name}</b><br>${v.Speed} km/h`)
      // Emit click na rodiče
      marker.on('click', () => emit('vehicle-click', v))
      markerMap[v.Code] = marker
    }
  })
}

// ─── Kreslení trasy ───────────────────────────────────────
function drawRoute(positions) {
  if (routeLayer) { map.removeLayer(routeLayer); routeLayer = null }
  if (!positions?.length) return

  const latlngs = positions.map(p => [parseFloat(p.Lat), parseFloat(p.Lng)])
  routeLayer = L.polyline(latlngs, { color: '#00e5a0', weight: 3, opacity: 0.85 }).addTo(map)
  map.fitBounds(routeLayer.getBounds(), { padding: [40, 40] })
}

// ─── Watchers ─────────────────────────────────────────────

// Vozidla se změnila → obnov markery
watch(() => props.vehicles, (vehicles) => updateMarkers(vehicles), { deep: true })

// Vybrané vozidlo → přesuň mapu k němu (v live módu)
watch(() => props.selected, (v) => {
  if (!v || !map || props.mode !== 'live') return
  updateMarkers(props.vehicles) // obnov ikonky (zvýrazni aktivní)
  const lat = parseFloat(v.LastPosition?.Latitude)
  const lng = parseFloat(v.LastPosition?.Longitude)
  if (lat && lng) map.setView([lat, lng], 13, { animate: true })
})

// Trasa se změnila → nakresli ji
watch(() => props.route, drawRoute, { deep: true })
</script>
