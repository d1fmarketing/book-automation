import React, { useEffect, useState } from 'react'
import KPIs from './KPIs'
import Terminal from './Terminal'
import Preview from './Preview'
import Errors from './Errors'
import Controls from './Controls'
import RateLimitWidget from './RateLimitWidget'
import CostTrackingWidget from './CostTrackingWidget'
import UploadPane from './UploadPane'
import RefurbishQueue from './RefurbishQueue'
import { connectWebSocket, disconnectWebSocket, socket } from '../services/websocket'

function Dashboard() {
  console.log('Dashboard component rendering...')
  
  useEffect(() => {
    console.log('Dashboard useEffect running...')
    // Connect to WebSocket
    connectWebSocket()

    // Cleanup on unmount
    return () => {
      disconnectWebSocket()
    }
  }, [])

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-xl font-semibold">📚 Ebook Pipeline Admin</h1>
          </div>
        </div>
      </header>

      {/* Main Content - 3 columns */}
      <main className="flex h-[calc(100vh-4rem)]">
        {/* Column 1: KPIs + Controls + Upload + Refurbish */}
        <div className="w-1/4 bg-white border-r p-4 overflow-y-auto">
          <KPIs />
          <div className="mt-6">
            <RateLimitWidget socket={socket} />
          </div>
          <div className="mt-6">
            <CostTrackingWidget socket={socket} />
          </div>
          <div className="mt-6">
            <UploadPane socket={socket} />
          </div>
          <div className="mt-6">
            <RefurbishQueue socket={socket} />
          </div>
          <div className="mt-6">
            <Controls />
          </div>
          <div className="mt-6">
            <Errors />
          </div>
        </div>

        {/* Column 2: Terminal */}
        <div className="w-2/5 bg-black p-4">
          <Terminal />
        </div>

        {/* Column 3: Preview */}
        <div className="w-2/5 bg-gray-50">
          <Preview />
        </div>
      </main>
    </div>
  )
}

export default Dashboard