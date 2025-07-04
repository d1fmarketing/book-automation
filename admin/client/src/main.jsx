import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

console.log('main.jsx carregando...')

const rootElement = document.getElementById('root')
console.log('Root element:', rootElement)

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
  console.log('React app renderizado!')
} else {
  console.error('Root element não encontrado!')
}