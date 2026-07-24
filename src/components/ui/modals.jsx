import { useEffect } from 'react'

export default function Modal({ isOpen, onClose, title, size, children }) {
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    if (isOpen) document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`modal${size === 'sm' ? ' modal-sm' : size === 'lg' ? ' modal-lg' : ''}`}>
        <div className="modal-hdr">
          <div className="modal-title" dangerouslySetInnerHTML={{ __html: title }} />
          <span className="modal-close" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </span>
        </div>
        {children}
      </div>
    </div>
  )
}