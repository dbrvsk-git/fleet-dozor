<template>
  <div v-if="!vehicle" class="empty-state">
    <span class="empty-icon">🚗</span> Vyberte vozidlo ze seznamu
  </div>

  <div v-else>
    <div class="detail-grid">
      <div class="detail-item">
        <div class="detail-label">RYCHLOST</div>
        <div class="detail-value" :class="{ accent: vehicle.Speed > 3 }">
          {{ vehicle.Speed }}
          <small style="font-size: 10px; font-weight: 400; font-family: 'DM Mono', monospace">km/h</small>
        </div>
      </div>

      <div class="detail-item">
        <div class="detail-label">STAV</div>
        <div class="detail-value" :style="{ fontSize: '13px', color: vehicle.Speed > 3 ? 'var(--accent)' : 'var(--muted)' }">
          {{ vehicle.Speed > 3 ? '▶ Jede' : '■ Stojí' }}
        </div>
      </div>

      <div class="detail-item">
        <div class="detail-label">ODOMETR</div>
        <div class="detail-value" style="font-size: 13px">{{ odometer }}</div>
      </div>

      <div class="detail-item">
        <div class="detail-label">BATERIE</div>
        <div class="detail-value" style="font-size: 13px">{{ battery }}</div>
      </div>
    </div>

    <div class="vehicle-meta-bar">
      Poslední aktivita: <strong>{{ lastSeen }}</strong>
      <template v-if="vehicle.BranchName">
        &nbsp;·&nbsp; Pobočka: <strong>{{ vehicle.BranchName }}</strong>
      </template>
      &nbsp;·&nbsp; Relay: <strong>{{ relayLabel }}</strong>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  vehicle: { type: Object, default: null },
})

const RELAY_LABELS = ['Normální', 'Žádost odeslána', 'Potvrzeno', 'Rušení…', 'Rušení potvrzeno', 'Zamítnuto']

const odometer = computed(() => {
  if (!props.vehicle?.Odometer) return '—'
  return (props.vehicle.Odometer / 1000).toFixed(0) + ' km'
})

const battery = computed(() => {
  const b = props.vehicle?.BatteryPercentage
  return b > 0 ? b + '%' : '—'
})

const lastSeen = computed(() => {
  const ts = props.vehicle?.LastPositionTimestamp
  if (!ts) return '—'
  return new Date(ts).toLocaleString('cs-CZ', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
  })
})

const relayLabel = computed(() => {
  return RELAY_LABELS[props.vehicle?.EngineRelayState ?? 0] ?? '—'
})
</script>
