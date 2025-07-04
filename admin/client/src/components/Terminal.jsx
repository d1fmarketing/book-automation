import React, { useEffect, useRef } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { useStore } from '../store'

function Terminal() {
  const terminalRef = useRef(null)
  const xtermRef = useRef(null)
  const fitAddonRef = useRef(null)
  const { logs } = useStore()

  useEffect(() => {
    if (!terminalRef.current) return

    // Create terminal instance
    const term = new XTerm({
      theme: {
        background: '#000000',
        foreground: '#ffffff',
        cursor: '#ffffff',
        selection: 'rgba(255, 255, 255, 0.3)'
      },
      fontSize: 13,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      cursorBlink: true,
      convertEol: true
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    
    term.open(terminalRef.current)
    fitAddon.fit()

    // Store refs
    xtermRef.current = term
    fitAddonRef.current = fitAddon

    // Handle resize
    const handleResize = () => {
      fitAddon.fit()
    }
    window.addEventListener('resize', handleResize)

    // Welcome message
    term.writeln('\x1b[1;32m📚 Ebook Pipeline Admin Terminal\x1b[0m')
    term.writeln('\x1b[90m' + '='.repeat(50) + '\x1b[0m')
    term.writeln('')

    return () => {
      window.removeEventListener('resize', handleResize)
      term.dispose()
    }
  }, [])

  // Write logs to terminal
  useEffect(() => {
    if (!xtermRef.current || logs.length === 0) return

    const lastLog = logs[logs.length - 1]
    
    // Format log with colors
    let formattedLog = lastLog
    
    // Color based on content
    if (lastLog.includes('✅') || lastLog.includes('completed')) {
      formattedLog = `\x1b[32m${lastLog}\x1b[0m` // Green
    } else if (lastLog.includes('❌') || lastLog.includes('failed') || lastLog.includes('error')) {
      formattedLog = `\x1b[31m${lastLog}\x1b[0m` // Red
    } else if (lastLog.includes('⚠️') || lastLog.includes('warning')) {
      formattedLog = `\x1b[33m${lastLog}\x1b[0m` // Yellow
    } else if (lastLog.includes('[QUEUE]')) {
      formattedLog = `\x1b[36m${lastLog}\x1b[0m` // Cyan
    } else if (lastLog.includes('[PIPELINE]')) {
      formattedLog = `\x1b[35m${lastLog}\x1b[0m` // Magenta
    }

    xtermRef.current.writeln(formattedLog)
  }, [logs])

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-2 text-white">
        <h2 className="text-sm font-medium">Terminal</h2>
        <button
          onClick={() => {
            if (xtermRef.current) {
              xtermRef.current.clear()
            }
          }}
          className="text-xs text-gray-400 hover:text-white"
        >
          Limpar
        </button>
      </div>
      <div ref={terminalRef} className="flex-1" />
    </div>
  )
}

export default Terminal