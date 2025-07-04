import React, { useState, useEffect } from 'react'
import { RefreshCw, Clock, CheckCircle, XCircle, AlertTriangle, Zap } from 'lucide-react'

function RefurbishQueue({ socket }) {
  const [queueStats, setQueueStats] = useState({
    waiting: 0,
    active: 0,
    completed: 0,
    failed: 0,
    paused: false,
    avgProcessingTime: 0
  })
  
  const [recentJobs, setRecentJobs] = useState([])
  const [selectedJob, setSelectedJob] = useState(null)

  useEffect(() => {
    // Listen for queue updates
    if (socket) {
      socket.on('refurbish-stats', (stats) => {
        setQueueStats(stats)
      })

      socket.on('refurbish-job-update', (job) => {
        setRecentJobs(prev => {
          const updated = [job, ...prev.filter(j => j.id !== job.id)]
          return updated.slice(0, 10) // Keep only 10 most recent
        })
      })

      // Request initial stats
      socket.emit('get-refurbish-stats')
    }

    return () => {
      if (socket) {
        socket.off('refurbish-stats')
        socket.off('refurbish-job-update')
      }
    }
  }, [socket])

  const pauseQueue = async () => {
    try {
      const response = await fetch('/api/queues/refurbish/pause', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      })
      if (response.ok) {
        socket?.emit('get-refurbish-stats')
      }
    } catch (error) {
      console.error('Failed to pause queue:', error)
    }
  }

  const resumeQueue = async () => {
    try {
      const response = await fetch('/api/queues/refurbish/resume', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      })
      if (response.ok) {
        socket?.emit('get-refurbish-stats')
      }
    } catch (error) {
      console.error('Failed to resume queue:', error)
    }
  }

  const retryJob = async (jobId) => {
    try {
      const response = await fetch(`/api/queues/refurbish/retry/${jobId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      })
      if (response.ok) {
        socket?.emit('get-refurbish-stats')
      }
    } catch (error) {
      console.error('Failed to retry job:', error)
    }
  }

  const getJobStatusIcon = (status) => {
    switch (status) {
      case 'waiting':
        return <Clock className="text-gray-500" size={16} />
      case 'active':
        return <RefreshCw className="text-blue-500 animate-spin" size={16} />
      case 'completed':
        return <CheckCircle className="text-green-500" size={16} />
      case 'failed':
        return <XCircle className="text-red-500" size={16} />
      default:
        return null
    }
  }

  const getOperationLabel = (operation) => {
    const labels = {
      content: '📝 Content',
      tone: '🎭 Tone',
      images: '🖼️ Images',
      format: '📐 Format',
      all: '✨ Complete'
    }
    return labels[operation] || operation
  }

  const formatDuration = (ms) => {
    if (!ms) return '-'
    const seconds = Math.floor(ms / 1000)
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}m ${remainingSeconds}s`
  }

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center">
          <Zap className="mr-2 text-yellow-500" size={20} />
          Refurbish Queue
        </h3>
        <button
          onClick={queueStats.paused ? resumeQueue : pauseQueue}
          className={`px-3 py-1 text-sm rounded ${
            queueStats.paused 
              ? 'bg-green-500 text-white hover:bg-green-600'
              : 'bg-yellow-500 text-white hover:bg-yellow-600'
          }`}
        >
          {queueStats.paused ? 'Resume' : 'Pause'}
        </button>
      </div>

      {/* Queue Stats */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="bg-gray-50 p-2 rounded">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600">Waiting</span>
            <span className="font-semibold">{queueStats.waiting}</span>
          </div>
        </div>
        <div className="bg-blue-50 p-2 rounded">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600">Active</span>
            <span className="font-semibold text-blue-600">{queueStats.active}</span>
          </div>
        </div>
        <div className="bg-green-50 p-2 rounded">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600">Completed</span>
            <span className="font-semibold text-green-600">{queueStats.completed}</span>
          </div>
        </div>
        <div className="bg-red-50 p-2 rounded">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600">Failed</span>
            <span className="font-semibold text-red-600">{queueStats.failed}</span>
          </div>
        </div>
      </div>

      {/* Average Processing Time */}
      <div className="bg-purple-50 p-2 rounded mb-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-600">Avg. Processing Time</span>
          <span className="font-semibold text-purple-600">
            {formatDuration(queueStats.avgProcessingTime)}
          </span>
        </div>
      </div>

      {/* Recent Jobs */}
      <div>
        <h4 className="text-sm font-medium mb-2">Recent Jobs</h4>
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {recentJobs.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">No jobs yet</p>
          ) : (
            recentJobs.map(job => (
              <div
                key={job.id}
                className={`p-2 rounded border cursor-pointer transition-colors ${
                  selectedJob?.id === job.id ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                }`}
                onClick={() => setSelectedJob(job)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {getJobStatusIcon(job.status)}
                    <span className="text-sm font-medium truncate max-w-[150px]">
                      {job.bookPath?.split('/').pop() || job.id}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {getOperationLabel(job.operations?.[0] || 'all')}
                  </span>
                </div>
                
                {job.status === 'failed' && (
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-xs text-red-600 truncate">
                      {job.error || 'Unknown error'}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        retryJob(job.id)
                      }}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Retry
                    </button>
                  </div>
                )}
                
                {job.status === 'active' && job.progress && (
                  <div className="mt-1">
                    <div className="w-full bg-gray-200 rounded-full h-1">
                      <div 
                        className="bg-blue-500 h-1 rounded-full transition-all"
                        style={{ width: `${job.progress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Selected Job Details */}
      {selectedJob && (
        <div className="mt-4 p-3 bg-gray-50 rounded text-sm">
          <h5 className="font-medium mb-2">Job Details</h5>
          <div className="space-y-1 text-xs">
            <div><strong>ID:</strong> {selectedJob.id}</div>
            <div><strong>Book:</strong> {selectedJob.bookPath}</div>
            <div><strong>Operations:</strong> {selectedJob.operations?.join(', ') || 'all'}</div>
            <div><strong>Status:</strong> {selectedJob.status}</div>
            {selectedJob.createdAt && (
              <div><strong>Created:</strong> {new Date(selectedJob.createdAt).toLocaleString()}</div>
            )}
            {selectedJob.completedAt && (
              <div><strong>Completed:</strong> {new Date(selectedJob.completedAt).toLocaleString()}</div>
            )}
            {selectedJob.duration && (
              <div><strong>Duration:</strong> {formatDuration(selectedJob.duration)}</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default RefurbishQueue