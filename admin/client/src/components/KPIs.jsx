import React, { useEffect } from 'react'
import { useStore } from '../store'
import axios from 'axios'

function KPIs() {
  const { status, setStatus, token } = useStore()

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await axios.get('/api/status', {
          headers: { Authorization: `Bearer ${token}` }
        })
        setStatus(response.data)
      } catch (error) {
        console.error('Error fetching status:', error)
      }
    }

    // Fetch initial status
    fetchStatus()

    // Refresh every 5 seconds
    const interval = setInterval(fetchStatus, 5000)

    return () => clearInterval(interval)
  }, [token, setStatus])

  const getTotalJobs = (queues) => {
    if (!queues || typeof queues !== 'object') return 0
    return Object.values(queues).reduce((total, queue) => {
      if (!queue || typeof queue !== 'object') return total
      const waiting = queue.waiting || 0
      const active = queue.active || 0
      const delayed = queue.delayed || 0
      return total + waiting + active + delayed
    }, 0)
  }

  const getFailedJobs = (queues) => {
    if (!queues || typeof queues !== 'object') return 0
    return Object.values(queues).reduce((total, queue) => {
      if (!queue || typeof queue !== 'object') return total
      return total + (queue.failed || 0)
    }, 0)
  }

  const getActiveWorkers = (workers) => {
    if (!workers || typeof workers !== 'object') return 0
    return Object.values(workers).reduce((total, worker) => {
      if (!worker || typeof worker !== 'object') return total
      return total + (worker.active || 0)
    }, 0)
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Status do Sistema</h2>
      
      <div className="space-y-3">
        {/* Jobs Pendentes */}
        <div className="bg-blue-50 p-3 rounded-lg">
          <div className="text-sm text-blue-600">Jobs Pendentes</div>
          <div className="text-2xl font-bold text-blue-900">
            {getTotalJobs(status.queues || {})}
          </div>
        </div>

        {/* Jobs com Erro */}
        <div className="bg-red-50 p-3 rounded-lg">
          <div className="text-sm text-red-600">Jobs com Erro</div>
          <div className="text-2xl font-bold text-red-900">
            {getFailedJobs(status.queues || {})}
          </div>
        </div>

        {/* Workers Ativos */}
        <div className="bg-green-50 p-3 rounded-lg">
          <div className="text-sm text-green-600">Workers Ativos</div>
          <div className="text-2xl font-bold text-green-900">
            {getActiveWorkers(status.workers || {})}
          </div>
        </div>

        {/* Conexões WebSocket */}
        <div className="bg-purple-50 p-3 rounded-lg">
          <div className="text-sm text-purple-600">Conexões WS</div>
          <div className="text-2xl font-bold text-purple-900">
            {status.connections || 0}
          </div>
        </div>
      </div>

      {/* Queue Details */}
      <div className="mt-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Filas</h3>
        <div className="space-y-2">
          {Object.entries(status.queues || {}).map(([name, queue]) => (
            <div key={name} className="text-xs">
              <div className="flex justify-between items-center">
                <span className="font-medium">{name}</span>
                <span className="text-gray-500">
                  {queue.active > 0 && <span className="text-green-600">{queue.active} ativo</span>}
                  {queue.waiting > 0 && <span className="text-blue-600 ml-2">{queue.waiting} esperando</span>}
                  {queue.failed > 0 && <span className="text-red-600 ml-2">{queue.failed} falhou</span>}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default KPIs