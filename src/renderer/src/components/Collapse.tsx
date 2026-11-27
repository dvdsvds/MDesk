import { AnimatePresence, motion } from 'motion/react'

/** 트리 폴더를 펼치고 접을 때 높이를 부드럽게 바꾼다 */
export function Collapse({
  open,
  children
}: {
  open: boolean
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          key="children"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
          style={{ overflow: 'hidden' }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
