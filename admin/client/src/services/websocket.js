import { io } from 'socket.io-client'
import { useStore } from '../store'

let socket = null

export function connectWebSocket() {
  socket = io('http://localhost:4000', {
    transports: ['websocket']
  })

  socket.on('connect', () => {
    console.log('WebSocket connected')
  })

  socket.on('disconnect', () => {
    console.log('WebSocket disconnected')
  })

  // Log events
  socket.on('log', (message) => {
    if (message) {
      useStore.getState().addLog(message)
    }
  })

  // Error events
  socket.on('error', (error) => {
    if (error) {
      useStore.getState().addError(error)
    }
  })

  // Ebook ready
  socket.on('ebook', (path) => {
    if (path) {
      useStore.getState().setEbookPath(path)
    }
  })

  // Pipeline events
  socket.on('pipeline:started', (data) => {
    if (data) {
      useStore.getState().setCurrentPipeline(data)
      useStore.getState().setEbookPath(null) // Clear previous
    }
  })

  socket.on('pipeline:completed', (data) => {
    useStore.getState().setCurrentPipeline(null)
  })

  socket.on('pipeline:failed', (data) => {
    useStore.getState().setCurrentPipeline(null)
  })

  // Job events
  socket.on('job:created', (data) => {
    // Could update UI if needed
  })

  socket.on('job:completed', (data) => {
    // Could update UI if needed
  })

  socket.on('job:failed', (data) => {
    // Already handled by error event
  })
  
  // Status updates
  socket.on('status:update', (data) => {
    if (data && typeof data === 'object') {
      const store = useStore.getState()
      
      // Ensure data has expected structure
      const status = {
        queues: data.queues || {},
        workers: data.workers || {},
        connections: data.connections || 0,
        rateLimits: data.rateLimits || {},
        costs: data.costs || {}
      }
      
      store.setStatus(status)
    }
  })

  return socket
}

export function disconnectWebSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}

export function sendCommand(action, payload) {
  if (socket && socket.connected) {
    socket.emit('command', { action, payload })
  }
}

export { socket }