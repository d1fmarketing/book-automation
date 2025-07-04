import React, { useState } from 'react'
import axios from 'axios'
import { useStore } from '../store'

function Controls() {
  const [topic, setTopic] = useState('')
  const [chapters, setChapters] = useState(1)
  const [loading, setLoading] = useState(false)
  const { token } = useStore()

  const handleRunPipeline = async () => {
    if (!topic.trim()) return

    setLoading(true)
    try {
      await axios.post(
        '/api/pipeline/run',
        { 
          topic: topic.trim(),
          options: { chapters }
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setTopic('')
    } catch (error) {
      console.error('Error running pipeline:', error)
      alert('Erro ao iniciar pipeline: ' + (error.response?.data?.error || error.message))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Controles</h3>
      
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Tópico do Ebook
          </label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Ex: AI Tools for Business"
            className="w-full px-3 py-2 text-sm border rounded focus:outline-none focus:border-blue-500"
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Número de Capítulos (teste)
          </label>
          <select
            value={chapters}
            onChange={(e) => setChapters(Number(e.target.value))}
            className="w-full px-3 py-2 text-sm border rounded focus:outline-none focus:border-blue-500"
            disabled={loading}
          >
            <option value={1}>1 capítulo (rápido)</option>
            <option value={3}>3 capítulos</option>
            <option value={5}>5 capítulos</option>
            <option value={10}>10 capítulos (completo)</option>
          </select>
        </div>

        <button
          onClick={handleRunPipeline}
          disabled={loading || !topic.trim()}
          className="w-full bg-blue-500 text-white py-2 rounded text-sm hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? '🔄 Executando...' : '🚀 Iniciar Pipeline'}
        </button>

        <div className="pt-3 space-y-2">
          <button
            onClick={() => {
              if (window.confirm('Limpar todos os jobs com falha?')) {
                // TODO: Implement clear failed jobs
              }
            }}
            className="w-full bg-red-500 text-white py-1.5 rounded text-xs hover:bg-red-600"
          >
            🗑️ Limpar Falhas
          </button>
          
          <button
            onClick={() => window.open('/metrics', '_blank')}
            className="w-full bg-gray-500 text-white py-1.5 rounded text-xs hover:bg-gray-600"
          >
            📊 Ver Métricas
          </button>
        </div>
      </div>
    </div>
  )
}

export default Controls