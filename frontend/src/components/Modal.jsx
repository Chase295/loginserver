import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { HiXMark } from 'react-icons/hi2'

export default function Modal({ open, onClose, title, children, large }) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 z-[60]"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className={`fixed z-[60]
              inset-x-3 top-1/2 -translate-y-1/2
              mx-auto ${large ? 'max-w-2xl' : 'max-w-lg'}
              rounded-2xl
              bg-[#12122e] border border-white/[0.1]
              max-h-[85dvh]
              flex flex-col
            `}
            style={{
              boxShadow: '0 24px 48px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
            }}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06] shrink-0">
              <h2 className="text-lg font-bold truncate pr-4">{title}</h2>
              <button onClick={onClose} className="w-8 h-8 shrink-0 rounded-lg bg-white/10 flex items-center justify-center active:scale-90 transition-transform">
                <HiXMark className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto overscroll-contain px-5 py-4 flex-1">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
