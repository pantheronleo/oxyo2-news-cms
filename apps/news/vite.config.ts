import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins:[react()],
  server:{port:5174,proxy:{'/api':'http://localhost:4000','/media':'http://localhost:4000','/sitemap.xml':'http://localhost:4000','/rss.xml':'http://localhost:4000','/robots.txt':'http://localhost:4000','/llms.txt':'http://localhost:4000'}},
  build:{sourcemap:false}
})
