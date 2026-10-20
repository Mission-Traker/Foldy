import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'
import { installErrorLog, report } from './lib/errorlog.js'

installErrorLog()

// 화면을 그리다 오류가 나면 흰 화면 대신 안내 + 오류 기록
class ErrorBoundary extends React.Component {
  constructor(p) { super(p); this.state = { err: null } }
  static getDerivedStateFromError(err) { return { err } }
  componentDidCatch(err) { report(err, 'render') }
  render() {
    if (!this.state.err) return this.props.children
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, textAlign: 'center', fontFamily: 'sans-serif', background: '#FBF6EC' }}>
        <p style={{ fontSize: 40 }}>🙈</p>
        <p style={{ fontSize: 18, fontWeight: 700, color: '#2E3F66', wordBreak: 'keep-all' }}>앗, 잠깐 문제가 생겼어요</p>
        <p style={{ fontSize: 14, color: '#8A7F72', wordBreak: 'keep-all' }}>자동으로 기록했어요. 다시 열면 대부분 괜찮아져요.</p>
        <button onClick={() => { location.hash = '#/'; location.reload() }} style={{ marginTop: 8, padding: '10px 24px', borderRadius: 999, border: 0, background: '#2E3F66', color: '#fff', fontSize: 16 }}>다시 열기</button>
      </div>
    )
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <HashRouter>
        <App />
      </HashRouter>
    </ErrorBoundary>
  </React.StrictMode>,
)

// 오프라인으로 열기·알림을 위한 서비스워커(배포된 사이트에서만)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}) })
}
