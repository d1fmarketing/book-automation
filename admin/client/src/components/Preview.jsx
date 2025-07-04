import React from 'react'
import { useStore } from '../store'

function Preview() {
  const { ebookPath } = useStore()

  return (
    <div className="h-full flex flex-col">
      <div className="bg-white border-b px-4 py-3">
        <h2 className="text-sm font-semibold">Preview do Ebook</h2>
      </div>
      
      <div className="flex-1 bg-white">
        {ebookPath ? (
          <iframe
            src={`/api/ebook/preview?path=${encodeURIComponent(ebookPath)}`}
            className="w-full h-full border-0"
            title="Ebook Preview"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            <div className="text-center">
              <div className="text-6xl mb-4">📖</div>
              <p>Aguardando geração do ebook...</p>
              <p className="text-sm mt-2">O preview aparecerá aqui quando disponível</p>
            </div>
          </div>
        )}
      </div>

      {ebookPath && (
        <div className="bg-gray-50 border-t px-4 py-2 flex items-center justify-between">
          <span className="text-xs text-gray-600">{ebookPath}</span>
          <button
            onClick={() => window.open(`/api/ebook/download?path=${encodeURIComponent(ebookPath)}`, '_blank')}
            className="text-xs bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
          >
            Download
          </button>
        </div>
      )}
    </div>
  )
}

export default Preview