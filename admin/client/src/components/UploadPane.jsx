import React, { useState, useRef } from 'react'
import { Upload, FileText, AlertCircle, CheckCircle } from 'lucide-react'

function UploadPane({ socket }) {
  const [files, setFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({})
  const fileInputRef = useRef(null)

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files)
    const validFiles = selectedFiles.filter(file => {
      // Accept markdown, text, and image files
      const validTypes = [
        'text/markdown',
        'text/plain',
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'application/pdf'
      ]
      return validTypes.includes(file.type) || file.name.endsWith('.md')
    })

    setFiles(validFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      status: 'pending',
      progress: 0,
      error: null
    })))
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    
    const droppedFiles = Array.from(e.dataTransfer.files)
    handleFileSelect({ target: { files: droppedFiles } })
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const uploadFiles = async () => {
    setUploading(true)

    for (const fileItem of files) {
      if (fileItem.status === 'completed') continue

      try {
        // Update status to uploading
        setFiles(prev => prev.map(f => 
          f.id === fileItem.id ? { ...f, status: 'uploading' } : f
        ))

        // Create FormData
        const formData = new FormData()
        formData.append('file', fileItem.file)
        formData.append('type', fileItem.file.type.startsWith('image/') ? 'image' : 'chapter')

        // Upload file
        const response = await fetch('/api/upload', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: formData
        })

        if (!response.ok) {
          throw new Error(`Upload failed: ${response.statusText}`)
        }

        const result = await response.json()

        // Update status to completed
        setFiles(prev => prev.map(f => 
          f.id === fileItem.id ? { 
            ...f, 
            status: 'completed',
            progress: 100,
            uploadedPath: result.path
          } : f
        ))

        // Emit event via socket if connected
        if (socket && socket.connected) {
          socket.emit('file-uploaded', {
            filename: fileItem.file.name,
            path: result.path,
            type: fileItem.file.type.startsWith('image/') ? 'image' : 'chapter'
          })
        }

      } catch (error) {
        console.error('Upload error:', error)
        setFiles(prev => prev.map(f => 
          f.id === fileItem.id ? { 
            ...f, 
            status: 'error',
            error: error.message
          } : f
        ))
      }
    }

    setUploading(false)
  }

  const clearFiles = () => {
    setFiles([])
    setUploadProgress({})
  }

  const getFileIcon = (file) => {
    if (file.file.type.startsWith('image/')) {
      return '🖼️'
    } else if (file.file.name.endsWith('.md')) {
      return '📝'
    } else if (file.file.type === 'application/pdf') {
      return '📄'
    }
    return '📋'
  }

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="text-lg font-semibold mb-4 flex items-center">
        <Upload className="mr-2" size={20} />
        Upload Files
      </h3>

      {/* Drop Zone */}
      <div
        className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 transition-colors"
        onClick={() => fileInputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <Upload className="mx-auto mb-4 text-gray-400" size={48} />
        <p className="text-gray-600 mb-2">
          Drag and drop files here, or click to select
        </p>
        <p className="text-sm text-gray-400">
          Supports: Markdown (.md), Images (JPG, PNG, GIF), PDFs
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".md,text/markdown,text/plain,image/*,.pdf"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="mt-4">
          <div className="flex justify-between items-center mb-2">
            <h4 className="font-medium">Selected Files ({files.length})</h4>
            <button
              onClick={clearFiles}
              className="text-sm text-red-600 hover:underline"
              disabled={uploading}
            >
              Clear All
            </button>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto">
            {files.map(fileItem => (
              <div
                key={fileItem.id}
                className="flex items-center justify-between p-2 bg-gray-50 rounded"
              >
                <div className="flex items-center flex-1">
                  <span className="mr-2">{getFileIcon(fileItem)}</span>
                  <span className="text-sm truncate flex-1">
                    {fileItem.file.name}
                  </span>
                  <span className="text-xs text-gray-500 ml-2">
                    ({(fileItem.file.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
                
                <div className="flex items-center ml-2">
                  {fileItem.status === 'pending' && (
                    <span className="text-xs text-gray-500">Pending</span>
                  )}
                  {fileItem.status === 'uploading' && (
                    <span className="text-xs text-blue-500">Uploading...</span>
                  )}
                  {fileItem.status === 'completed' && (
                    <CheckCircle className="text-green-500" size={16} />
                  )}
                  {fileItem.status === 'error' && (
                    <AlertCircle className="text-red-500" size={16} title={fileItem.error} />
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Upload Button */}
          <button
            onClick={uploadFiles}
            disabled={uploading || files.every(f => f.status === 'completed')}
            className={`mt-4 w-full py-2 px-4 rounded font-medium transition-colors ${
              uploading || files.every(f => f.status === 'completed')
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-500 text-white hover:bg-blue-600'
            }`}
          >
            {uploading ? 'Uploading...' : 'Upload Files'}
          </button>
        </div>
      )}
    </div>
  )
}

export default UploadPane