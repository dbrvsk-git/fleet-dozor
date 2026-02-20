// ─────────────────────────────────────────────────────────
// GPS Dozor API
// Dokumentace: https://www.gpsdozor.cz/documentation/api
// ─────────────────────────────────────────────────────────

// Lokálně jde přes Vite proxy (/api → https://a1.gpsguard.eu)
// viz vite.config.js → server.proxy

//lokal API
const API_BASE = '/api/v1'

// Přihlašovací údaje — čte z .env, fallback na demo přístupy
const API_USER = import.meta.env.VITE_API_USER || 'api_gpsdozor'
const API_PASS = import.meta.env.VITE_API_PASS || 'yakmwlARdn'

const AUTH_HEADER = 'Basic ' + btoa(`${API_USER}:${API_PASS}`)

// ─── Základní fetch helper ────────────────────────────────
async function apiFetch(path) {
  const response = await fetch(API_BASE + path, {
    headers: {
      Authorization: AUTH_HEADER,
      'Content-Type': 'application/json',
    },
  })
  if (!response.ok) {
    throw new Error(`API chyba ${response.status} na cestě: ${path}`)
  }
  return response.json()
}

// ─── Endpoint 1: Skupiny ──────────────────────────────────
export async function getGroups() {
  return apiFetch('/groups')
}

// ─── Endpoint 2: Vozidla ve skupině ──────────────────────
export async function getVehicles(groupCode) {
  return apiFetch(`/vehicles/group/${groupCode}`)
}

// ─── Endpoint 3: Detail vozidla ──────────────────────────
export async function getVehicle(vehicleCode) {
  return apiFetch(`/vehicle/${vehicleCode}`)
}

// ─── Endpoint 4: Historie pozic (trasa na mapě) ──────────
export async function getVehicleHistory(vehicleCodes, from, to) {
  const codes = Array.isArray(vehicleCodes) ? vehicleCodes.join(',') : vehicleCodes
  return apiFetch(`/vehicles/history/${codes}?from=${from}&to=${to}`)
}

// ─── Endpoint 5: Kniha jízd ──────────────────────────────
export async function getTrips(vehicleCode, from, to) {
  return apiFetch(`/vehicle/${vehicleCode}/trips?from=${from}&to=${to}`)
}

// ─── Endpoint 6: Data ze senzorů ─────────────────────────
// sensors = čárkou oddělené typy, např. 'FuelActualVolume,Speed'
// Dostupné typy: FuelActualVolume, FuelActualVolumeFromPercentage,
//   FuelConsumedTotal, FuelConsumptionActual, Speed, Rpm, Odometer,
//   Temperature1-4, Altitude, ThrottlePercentage, ...
export async function getSensors(vehicleCode, sensors, from, to) {
  return apiFetch(`/vehicle/${vehicleCode}/sensors/${sensors}?from=${from}&to=${to}`)
}

// ─── Endpoint 7: Eco driving (zachováno pro budoucí použití) ─
export async function getEcoDriving(vehicleCode, from, to) {
  return apiFetch(`/vehicle/${vehicleCode}/eco-driving-events?from=${from}&to=${to}`)
}

// ─── Endpoint 8: Stav motoru / relay ─────────────────────
export async function getEngineRelayState(vehicleCode) {
  return apiFetch(`/vehicle/${vehicleCode}/getEngineRelayState`)
}

// ─── Helper: formátování data pro API ────────────────────
// Vstup: JS Date nebo string "YYYY-MM-DD"
// Výstup: "2024-01-15T00:00" (formát co API očekává)
export function formatDateForApi(date, endOfDay = false) {
  const d = typeof date === 'string' ? new Date(date) : date
  const pad = (n) => String(n).padStart(2, '0')
  const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const timeStr = endOfDay ? 'T23:59' : 'T00:00'
  return dateStr + timeStr
}
