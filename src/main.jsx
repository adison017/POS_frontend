import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import './global.css'
import './registerSW.js'

// Test environment variables
console.log('Import meta:', import.meta)
console.log('Import meta env:', import.meta.env)
console.log('VITE_SUPABASE_URL:', import.meta.env?.VITE_SUPABASE_URL)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)