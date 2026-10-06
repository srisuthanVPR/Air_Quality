/**
 * Accessible confirmation dialog.
 *
 * Used for destructive actions (deleting a prediction, clearing history) where
 * a mis-click should not be recoverable. Uses a real `<dialog>`-style overlay
 * with focus trapping, Escape to cancel and `aria-modal` semantics.
 */
import { useEffect, useRef } from 'react'
import { CircleAlert, TriangleAlert, X } from 'lucide-react'

import { useEscapeKey, useScrollLock } from '../hooks/useApi.js'
import { cn } from '../utils/cn.js'
import { Button, IconButton } from './UI.jsx'

const TONES = {
  danger: {
    icon: TriangleAlert,
    ring: 'ring-red-500/20',
    iconWrap: 'bg-red-50 text-red-600 dark:bg-red-500/12 dark:text-red-400',
  },
  warning: {
    icon: CircleAlert,
    ring: 'ring-amber-500/20',
    iconWrap: 'bg-amber-50 text-amber-600 dark:bg-amber-500/12 dark:text-amber-400',
  },
}

export function ConfirmDialog({
  open,
  onCancel,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  loading = false,
  children,
}) {
  const panelRef = useRef(null)
  const confirmRef = useRef(null)
  const { icon: Icon, ring, iconWrap } = TONES[tone] ?? TONES.danger

  useScrollLock(open)
  useEscapeKey(onCancel, open && !loading)

  useEffect(() => {
    if (open) confirmRef.current?.focus()
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 backdrop-blur-sm sm:items-center animate-[fade-up_0.2s_ease-out]"
      onClick={(event) => {
        if (event.target === event.currentTarget && !loading) onCancel()
      }}
      role="presentation"
    >
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-description"
        className={cn(
          'panel w-full max-w-md animate-[scale-in_0.2s_cubic-bezier(0.22,1,0.36,1)] p-5 ring-4',
          ring,
        )}
      >
        <div className="flex items-start gap-3.5">
          <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl', iconWrap)}>
            <Icon className="size-5" aria-hidden="true" />
          </span>

          <div className="min-w-0 flex-1">
            <h2 id="confirm-title" className="text-base font-bold text-slate-900 dark:text-white">
              {title}
            </h2>
            {description ? (
              <p
                id="confirm-description"
                className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400"
              >
                {description}
              </p>
            ) : null}
            {children}
          </div>

          {!loading ? (
            <IconButton icon={X} label="Close dialog" onClick={onCancel} className="-mt-1 -mr-1" />
          ) : null}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            ref={confirmRef}
            variant={tone === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
