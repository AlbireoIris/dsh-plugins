/**
 * Restart Harness action component: a compact header utility pill matching the
 * Session-log export button. Pure presentation plus component-local busy
 * state. The inject callback drives the whole restart flow and reports each
 * observable status back, so the pill reflects whether the restart really
 * happened (success shows briefly, then the page reloads itself; a failed
 * deadlock shows a failure message and unlocks the pill for retry).
 */
import { useState } from 'react'
import { cssText } from './css-text.ts'

/** Observable statuses of one restart request flow. */
export type RestartStatus =
  | 'pending'
  | 'triggered'
  | 'dying'
  | 'duplicate'
  | 'success'
  | 'request-failed'
  | 'restart-failed'

/** Inject face: run the restart flow, reporting each status transition. */
export interface RestartButtonInjected {
  /** Run the restart flow; `onStatus` reports the observable stage. */
  restart: (onStatus: (status: RestartStatus) => void) => Promise<void>
}

export interface RestartButtonProps {
  /** Inject face: run the restart flow, reporting each status transition. */
  readonly restart: RestartButtonInjected['restart']
}

/** Statuses that end the flow in failure and must unlock the pill. */
const FAILING: readonly RestartStatus[] = ['request-failed', 'restart-failed']

/** User-facing text for every status. */
const STATUS_TEXT: Record<RestartStatus, string> = {
  pending: '正在发起重启…',
  triggered: '重启准备中…',
  dying: '服务已停止，正在重新启动…',
  duplicate: '重启已经在进行中，请稍候',
  success: '重启成功，页面即将自动刷新…',
  'request-failed': '请求失败，请重试',
  'restart-failed': '重启未生效，请重试',
}

export function RestartButton(props: RestartButtonProps): JSX.Element {
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  return (
    <>
      {/* Inject the pill stylesheet once (idempotent: same cssText so the tag is
          de-duplicated by the browser if it ever re-runs). */}
      <div className="dsh-restart-harness-wrap">
        <button
          type="button"
          className="dsh-restart-harness-pill"
          disabled={busy}
          aria-busy={busy}
          onClick={() => {
            if (busy) return
            setBusy(true)
            void props.restart((next) => {
              setStatus(STATUS_TEXT[next])
              if (FAILING.includes(next)) setBusy(false)
            })
          }}
          title="重启当前服务（约 30 秒后恢复，成功后页面会自动刷新）"
        >
          <span>{busy ? '重启中…' : '重启'}</span>
        </button>
        {status === '' ? null : <span className="dsh-restart-harness-status">{status}</span>}
      </div>
      <style>{cssText}</style>
    </>
  )
}
