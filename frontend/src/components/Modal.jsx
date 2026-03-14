import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { HiXMark } from 'react-icons/hi2'

export default function Modal({ open, onClose, title, children, large }) {
  // Lock body scroll when modal is open
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
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 z-[60]"
          />

          {/* Mobile: bottom sheet, Desktop: centered */}
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            transition={{ type: 'spring', damping: 30, stiffness: 400 }}
            className={`fixed z-[60]
              inset-x-0 bottom-0
              md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2
              md:w-full ${large ? 'md:max-w-2xl' : 'md:max-w-lg'}
              md:rounded-2xl rounded-t-2xl
              bg-[#12122e] border border-white/[0.1]
              max-h-[90dvh] md:max-h-[85vh]
              flex flex-col
            `}
            style={{
              boxShadow: '0 -8px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)',
            }}
          >
            {/* Drag handle (mobile) */}
            <div className="md:hidden flex justify-center pt-2 pb-1">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>

            {/* Header - sticky within modal */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06] shrink-0">
              <h2 className="text-lg font-bold">{title}</h2>
              <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center active:scale-90 transition-transform">
                <HiXMark className="w-5 h-5" />
              </button>
            </div>

            {/* Content - scrollable */}
            <div className="overflow-y-auto overscroll-contain px-5 py-4 flex-1">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
