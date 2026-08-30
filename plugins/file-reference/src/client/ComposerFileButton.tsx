/**
 * Composer tool-row entry: one 28px icon button in the official
 * `conversation.input.left` slot that toggles the shared file-browser panel
 * (the panel itself renders from the sidebar foot entry).
 */
import { useSyncExternalStore } from 'react'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { panelOpen, subscribePanel, togglePanel } from './panel-store.ts'
import { cssText } from './css-text.ts'

/** Full component props: slot owner share alone (no injected callbacks). */
export type ComposerFileButtonProps = PropsRuntime<'conversation.input.left'>

export function ComposerFileButton(_props: ComposerFileButtonProps): JSX.Element {
  const open = useSyncExternalStore(subscribePanel, panelOpen)
  return (
    <>
      <button type="button"
        className={`dsh-files-composer ${open ? 'dsh-files-composer-on' : ''}`}
        title="文件浏览器" aria-label="文件浏览器"
        onClick={togglePanel}>
        <span className="dsh-files-composer-icon">📁</span>
      </button>
      <style>{cssText}</style>
    </>
  )
}
