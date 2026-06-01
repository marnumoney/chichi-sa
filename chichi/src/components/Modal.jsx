import { useEffect } from 'react'
import { X } from 'lucide-react'

export default function Modal({ open, onClose, title, children, maxWidth = 'max-w-md' }) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-espresso/60 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-cream w-full ${maxWidth} shadow-2xl max-h-[92vh] flex flex-col`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-divider">
          <h2 className="font-display text-xl font-semibold text-espresso">{title}</h2>
          <button onClick={onClose} className="text-muted hover:text-espresso transition-colors p-1">
            <X className="w-5 h-5" />
          </button>
        </div>
        {/* Body */}
        <div className="px-4 sm:px-6 py-5 overflow-y-auto flex-1">
          {children}
        </div>
      </div>
    </div>
  )
}
