/**
 * Sidebar file-browser action: one foot button plus a portal file-tree panel
 * anchored beside the sidebar. The tree lists the Host-configured roots,
 * expands lazily on folder click, and inserts the picked file's `@path`
 * mention into the current session's draft.
 */
import { useEffect, useState } from 'react'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { cssText } from './css-text.ts'

/** Inject face: endpoint paths plus the mention-insertion callback. */
export interface FileBrowserInjected {
  readonly rootsPath: string
  readonly listPath: string
  readonly insertFile: (path: string, directory: boolean) => void
}

/** Full component props: slot owner share plus this entry's injected face. */
export type FileBrowserProps = PropsRuntime<'sidebar.footer.action'> & FileBrowserInjected

interface Entry {
  readonly path: string
  readonly name: string
  readonly kind: 'file' | 'directory'
}

/** Root-row entry shown before a root is expanded. */
interface RootRow {
  readonly path: string
  readonly name: string
}

/** Lazy children state for one expanded directory. */
interface ChildrenState {
  readonly path: string
  readonly entries: Entry[]
  readonly loading: boolean
}

export function FileBrowserButton(props: FileBrowserProps): JSX.Element {
  const [open, setOpen] = useState(false)
  const [roots, setRoots] = useState<RootRow[]>([])
  const [children, setChildren] = useState<ChildrenState | null>(null)

  useEffect(() => {
    if (!open || roots.length > 0) return
    void fetch(props.rootsPath)
      .then(response => response.ok ? response.json() as Promise<{ roots?: string[] }> : null)
      .then(body => {
        const list = body?.roots ?? []
        setRoots(list.map(root => ({ path: root, name: basename(root) })))
      })
      .catch(() => { /* panel simply stays empty; host is unreachable */ })
  }, [open, roots.length, props.rootsPath])

  const toggle = async (row: RootRow): Promise<void> => {
    if (children?.path === row.path) {
      setChildren(null)
      return
    }
    setChildren({ path: row.path, entries: [], loading: true })
    try {
      const response = await fetch(props.listPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: row.path }),
      })
      const body = response.ok ? await response.json() as { entries?: Entry[] } : null
      setChildren({ path: row.path, entries: body?.entries ?? [], loading: false })
    } catch {
      setChildren({ path: row.path, entries: [], loading: false })
    }
  }

  const enter = async (entry: Entry): Promise<void> => {
    if (entry.kind === 'directory') {
      setChildren({ path: entry.path, entries: [], loading: true })
      try {
        const response = await fetch(props.listPath, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: entry.path }),
        })
        const body = response.ok ? await response.json() as { entries?: Entry[] } : null
        setChildren({ path: entry.path, entries: body?.entries ?? [], loading: false })
      } catch {
        setChildren({ path: entry.path, entries: [], loading: false })
      }
      return
    }
    props.insertFile(entry.path, false)
    setOpen(false) // feedback: close the panel; the mention is in the draft
  }

  return (
    <>
      <button type="button" className="dsh-files-foot" onClick={() => setOpen(value => !value)}>
        <span className="dsh-files-foot-icon">📁</span>
        <span>文件</span>
      </button>
      {open ? (
        <div className="dsh-files-panel" role="dialog" aria-label="文件浏览器">
          <div className="dsh-files-panel-head">
            <span>文件浏览器</span>
            <button type="button" className="dsh-files-close" onClick={() => setOpen(false)}>×</button>
          </div>
          <div className="dsh-files-tree">
            {roots.map(row => (
              <div key={row.path}>
                <button type="button" className={`dsh-files-row dsh-files-root ${children?.path === row.path ? 'dsh-files-open' : ''}`}
                  onClick={() => void toggle(row)} title={row.path}>
                  <span className="dsh-files-chevron">{children?.path === row.path ? '▾' : '▸'}</span>
                  <span>📂</span>
                  <span className="dsh-files-name">{row.name}</span>
                </button>
                {children !== null && children.path === row.path ? (
                  <div className="dsh-files-children">
                    {children.loading ? <div className="dsh-files-empty">加载中…</div> : null}
                    {!children.loading && children.entries.length === 0 ? <div className="dsh-files-empty">空目录</div> : null}
                    {!children.loading ? children.entries.map(entry => (
                      <button type="button" key={entry.path} className="dsh-files-row dsh-files-entry"
                        onClick={() => void enter(entry)} title={entry.path}>
                        <span className="dsh-files-chevron" />
                        <span>{entry.kind === 'directory' ? '📂' : '📄'}</span>
                        <span className="dsh-files-name">{entry.name}</span>
                      </button>
                    )) : null}
                  </div>
                ) : null}
              </div>
            ))}
            {roots.length === 0 ? <div className="dsh-files-empty">未配置扫描目录</div> : null}
          </div>
        </div>
      ) : null}
      <style>{cssText}</style>
    </>
  )
}

/** Base name without an fs import (browser side). */
function basename(path: string): string {
  const trimmed = path.replace(/[\\/]+$/u, '')
  const at = trimmed.lastIndexOf('\\') > trimmed.lastIndexOf('/')
    ? trimmed.lastIndexOf('\\')
    : trimmed.lastIndexOf('/')
  return at >= 0 ? trimmed.slice(at + 1) : trimmed
}
