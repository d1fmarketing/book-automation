import { create } from 'zustand'

export const useStore = create((set) => ({
  // Auth
  token: null,
  setToken: (token) => {
    if (token) {
      localStorage.setItem('admin_token', token)
    } else {
      localStorage.removeItem('admin_token')
    }
    set({ token })
  },
  
  // Status
  status: {
    queues: {},
    workers: {},
    rateLimits: {},
    connections: 0
  },
  setStatus: (status) => set({ status }),
  
  // Errors
  errors: [],
  addError: (error) => set((state) => ({
    errors: [...state.errors, { ...error, id: Date.now() }]
  })),
  clearErrors: () => set({ errors: [] }),
  removeError: (id) => set((state) => ({
    errors: state.errors.filter(e => e.id !== id)
  })),
  
  // Pipeline
  currentPipeline: null,
  setCurrentPipeline: (pipeline) => set({ currentPipeline: pipeline }),
  
  // Logs
  logs: [],
  addLog: (log) => set((state) => ({
    logs: [...state.logs.slice(-500), log] // Keep last 500 logs
  })),
  clearLogs: () => set({ logs: [] }),
  
  // Ebook preview
  ebookPath: null,
  setEbookPath: (path) => set({ ebookPath: path })
}))