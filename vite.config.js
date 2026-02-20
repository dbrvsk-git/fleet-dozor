import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      // GPS Dozor API — řeší CORS
      '/api': {
        target: 'https://a1.gpsguard.eu',
        changeOrigin: true,
        secure: true,
      },
      // OpenWeatherMap — řeší CORS pro weather widget
      '/owm': {
        target: 'https://api.openweathermap.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/owm/, ''),
      },
    },
  },
})
