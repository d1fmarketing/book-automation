import React from 'react'
import { useStore } from '../store'
import axios from 'axios'

function Errors() {
  const { errors, removeError, token } = useStore()

  const handleRetry = async (error) => {
    if (!error.queue || !error.jobId) return

    try {
      await axios.post(
        `/api/jobs/${error.jobId}/retry`,
        { queue: error.queue },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      removeError(error.id)
    } catch (err) {
      console.error('Error retrying job:', err)
    }
  }

  if (errors.length === 0) {
    return null
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-2">
        Erros Recentes ({errors.length})
      </h3>
      
      <div className="space-y-2 max-h-60 overflow-y-auto">
        {errors.map((error) => (
          <div key={error.id} className="bg-red-50 p-2 rounded text-xs">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="font-medium text-red-900">
                  {error.queue || error.type || 'Error'}
                </div>
                <div className="text-red-700 mt-1">
                  {error.error || error.message || 'Unknown error'}
                </div>
              </div>
              
              <div className="flex items-center ml-2 space-x-1">
                {error.jobId && (
                  <button
                    onClick={() => handleRetry(error)}
                    className="text-red-600 hover:text-red-800"
                    title="Retry"
                  >
                    🔄
                  </button>
                )}
                <button
                  onClick={() => removeError(error.id)}
                  className="text-red-600 hover:text-red-800"
                  title="Dismiss"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Errors