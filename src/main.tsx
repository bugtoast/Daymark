import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// The SQLite database is the sole source of truth. Remove keys written by older
// Daymark versions so stale browser data cannot be mistaken for current state.
try {
  for (const key of ['daymark_habits_v1', 'daymark_settings_v1', 'daymark_completion_goal', 'daymark_active_page', 'daymark_dark']) {
    window.localStorage.removeItem(key)
  }
} catch {
  // Browser storage may be disabled; the SQLite app remains usable.
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
