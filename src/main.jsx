import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

const rootElement = document.getElementById('root')

const showStartupError = (message) => {
  if (!rootElement) return
  rootElement.innerHTML = `
    <main style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f8fafc;color:#111827;font-family:Inter,Arial,sans-serif;padding:24px;">
      <section style="max-width:720px;border:1px solid #dbe2ea;border-left:5px solid #607a4e;border-radius:10px;background:#fff;padding:28px;box-shadow:0 20px 60px rgba(15,23,42,.08);">
        <p style="margin:0 0 8px;color:#607a4e;font-size:12px;font-weight:900;letter-spacing:1.5px;text-transform:uppercase;">KONSTRUCTZ app did not start</p>
        <h1 style="margin:0 0 12px;font-size:28px;line-height:1.15;color:#111827;">The site hit a React startup error.</h1>
        <p style="margin:0;color:#475569;font-size:15px;line-height:1.6;">${message}</p>
      </section>
    </main>
  `
}

try {
  if (!rootElement) {
    throw new Error('Root element #root was not found.')
  }

  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
} catch (err) {
  showStartupError(err?.message || 'Unknown startup error.')
}
