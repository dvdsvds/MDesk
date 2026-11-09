import { useMemo } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { TreeNode } from '../../types/workspace'
import { FileTypeIcon } from '../../components/FileTypeIcon'
import { splitName, fileNameOf } from '@renderer/utils/path'
import ChevronIcon from '../../icons/chevron.svg?react'
import { useSettingsStore } from '../../stores/settingsStore'
import { useNotePropsStore } from '../../stores/notePropsStore'
import { PROPERTY_COLORS, STATUS_OPTIONS, statusOf } from '../../utils/noteProperties'
import { isMarkdownPath } from '../../utils/fileKind'

const ROW_BASE =
  'flex h-7 w-full items-center gap-2 rounded-md pr-2 text-left text-[13px] text-text transition-colors hover:bg-bg-mute/60 focus:outline-none'

function collectNotes(nodes: TreeNode[], out: string[]): string[] {
  for (const node of nodes) {
    if (node.type === 'file') {
      if (isMarkdownPath(node.path)) out.push(node.path)
    } else if (node.children) collectNotes(node.children, out)
  }
  return out
}

export function TagSection({
  tree,
  activeFilePath,
  onOpenFile
}: {
  tree: TreeNode[]
  activeFilePath: string | null
  onOpenFile: (filePath: string) => void
}): React.JSX.Element {
  const byPath = useNotePropsStore((s) => s.byPath)
  const collapsed = useSettingsStore((s) => s.tagCollapsedGroups)
  const toggleTagGroup = useSettingsStore((s) => s.toggleTagGroup)

  const groups = useMemo(() => {
    // 상태를 정하지 않은 노트는 진행으로 묶는다
    const notes = collectNotes(tree, [])
      .map((path) => [path, statusOf(byPath[path]?.status).label] as const)
      .sort(([a], [b]) => fileNameOf(a).localeCompare(fileNameOf(b), 'ko', { numeric: true }))
    return STATUS_OPTIONS.map((option) => ({
      option,
      notes: notes.filter(([, status]) => status === option.label)
    })).filter((g) => g.notes.length > 0)
  }, [tree, byPath])

  return (
    <div
      className="flex flex-col"
      onKeyDown={(e) => e.stopPropagation()}
      onDragOver={(e) => e.stopPropagation()}
    >
      {groups.length === 0 && (
        <p className="px-4 py-2 text-[12px] text-text-tertiary">
          탭의 점을 눌러 상태를 정한 노트가 여기 모여요
        </p>
      )}
      <div className="px-2">
        {groups.map(({ option, notes }) => {
          const open = !collapsed.includes(option.label)
          return (
            <div key={option.label}>
              <button
                type="button"
                onClick={() => toggleTagGroup(option.label)}
                className={ROW_BASE}
                style={{ paddingLeft: 8 }}
              >
                <ChevronIcon
                  width={12}
                  height={12}
                  className="shrink-0 text-text-secondary transition-transform"
                  style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}
                />
                <span className="font-medium" style={{ color: PROPERTY_COLORS[option.color] }}>
                  {option.label}
                </span>
                <span className="text-[12px] text-text-tertiary">{notes.length}</span>
              </button>
              <AnimatePresence initial={false}>
                {open && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
                    style={{ overflow: 'hidden' }}
                  >
                    {notes.map(([path]) => (
                      <button
                        key={path}
                        type="button"
                        onClick={() => onOpenFile(path)}
                        title={path}
                        className={`${ROW_BASE} ${path === activeFilePath ? 'bg-bg-mute' : ''}`}
                        style={{ paddingLeft: 8 + 12 + 20 }}
                      >
                        <FileTypeIcon name={fileNameOf(path)} kind="file" />
                        <span className="truncate">{splitName(fileNameOf(path)).base}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>
    </div>
  )
}
