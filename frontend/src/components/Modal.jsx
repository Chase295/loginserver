import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { HiXMark } from 'react-icons/hi2'

export default function Modal({ open, onClose, title, children, large }) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [open])

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/70"
            style={{ backdropFilter: 'blur(8px) saturate(1.2)', WebkitBackdropFilter: 'blur(8px) saturate(1.2)' }}
          />

          {/* Modal — liquid glass */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 10 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className={`relative w-full ${large ? 'max-w-4xl' : 'max-w-3xl'}
              rounded-3xl border border-white/[0.10]
              max-h-[85dvh] flex flex-col overflow-hidden
            `}
            style={{
              background: 'rgba(14, 14, 36, 0.80)',
              backdropFilter: 'blur(40px) saturate(1.5)',
              WebkitBackdropFilter: 'blur(40px) saturate(1.5)',
              boxShadow: '0 24px 64px rgba(0,0,0,0.45), 0 0 0 0.5px rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,255,255,0.08)',
            }}
          >
            {/* Top highlight — liquid glass refraction */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

            <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06] shrink-0">
              <h2 className="text-lg font-bold truncate pr-4">{title}</h2>
              <button onClick={onClose} className="w-8 h-8 shrink-0 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center active:scale-90 transition-all duration-200 hover:bg-white/[0.10]">
                <HiXMark className="w-5 h-5 text-white/60" />
              </button>
            </div>

            <div className="overflow-y-auto overscroll-contain px-5 py-4 flex-1">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  )
}
