import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      // 开发期：/api 请求转发到后端 3000，前端无跨域问题
      '/api': { target: 'http://localhost:3000', changeOrigin: true }
    }
  }
})
