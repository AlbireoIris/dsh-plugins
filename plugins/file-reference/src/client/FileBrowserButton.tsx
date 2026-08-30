/**
 * NAVI (ClaudeMate) aligned file browser: floating glass panel with favorite
 * folders, lazy tree, per-type icons, row hover push, double-click open, and
 * the context menu (open / copy path / rename / delete). Every side effect
 * goes through the Host file endpoints; picks insert the `@path` mention
 * into the current session's draft.
 */
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { cssText } from './css-text.ts'

/** Inject face: endpoint paths plus the Host-backed operations. */
export interface FileBrowserInjected {
  readonly rootsPath: string
  readonly listPath: string
  readonly insertFile: (path: string, directory: boolean) => void
  readonly openPath: (path: string) => void
  readonly renamePath: (path: string, newName: string) => Promise<boolean>
  readonly deletePath: (path: string) => Promise<boolean>
}

/** Full component props: slot owner share plus this entry's injected face. */
export type FileBrowserProps = PropsRuntime<'sidebar.footer.action'> & FileBrowserInjected

interface Entry {
  readonly path: string
  readonly name: string
  readonly kind: 'file' | 'directory'
}

/** One favorite-folder row state. */
interface Favorite {
  readonly path: string
  readonly name: string
}

/** Lazy children state for the expanded folder. */
interface ChildrenState {
  readonly path: string
  readonly entries: Entry[]
  readonly loading: boolean
}

const FAVORITES_KEY = 'dsh-file-favorites'

export function FileBrowserButton(props: FileBrowserProps): JSX.Element {
  const [open, setOpen] = useState(false)
  const [favorites, setFavorites] = useState<Favorite[]>([])
  const [seeded, setSeeded] = useState(false)
  const [expanded, setExpanded] = useState<ChildrenState | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [addValue, setAddValue] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [menu, setMenu] = useState<{ x: number; y: number; entry: Entry } | null>(null)

  // Seed favorites from the host roots, then merge localStorage extras.
  useEffect(() => {
    if (!open || seeded) return
    void fetch(props.rootsPath)
      .then(response => response.ok ? response.json() as Promise<{ roots?: string[] }> : null)
      .then(body => {
        const roots = (body?.roots ?? []).map(root => ({ path: root, name: basename(root) }))
        let extras: Favorite[] = []
        try {
          extras = JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? '[]') as Favorite[]
        } catch { /* corrupt storage: keep the roots only */ }
        const seen = new Set(roots.map(f => f.path.toLowerCase()))
        const merged = [...roots, ...extras.filter(f => !seen.has(f.path.toLowerCase()))]
        setFavorites(merged)
        setSeeded(true)
      })
      .catch(() => setSeeded(true))
  }, [open, seeded, props.rootsPath])

  const expand = async (path: string): Promise<void> => {
    if (expanded?.path === path) {
      setExpanded(null)
      return
    }
    setExpanded({ path, entries: [], loading: true })
    const entries = await listDir(props.listPath, path)
    setExpanded({ path, entries, loading: false })
  }

  const importFolder = async (favorite: Favorite): Promise<void> => {
    const entries = await listDir(props.listPath, favorite.path)
    for (const entry of entries) {
      props.insertFile(entry.path, entry.kind === 'directory')
    }
  }

  const removeFavorite = (path: string): void => {
    const next = favorites.filter(f => f.path !== path)
    setFavorites(next)
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(next))
    } catch { /* storage full: keep in-memory state only */ }
  }

  const addFavorite = (): void => {
    const value = addValue.trim().replace(/^"(.*)"$/u, '$1').replace(/\\$/u, '')
    if (value === '') return
    const favorite = { path: value, name: basename(value) }
    const next = [...favorites, favorite]
    setFavorites(next)
    try {
      const extras = JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? '[]') as Favorite[]
      localStorage.setItem(FAVORITES_KEY, JSON.stringify([...extras, favorite]))
    } catch { /* storage unavailable: keep in-memory state only */ }
    setAdding(false)
    setAddValue('')
  }

  const openMenu = (event: React.MouseEvent, entry: Entry): void => {
    event.preventDefault()
    setMenu({ x: Math.min(event.clientX, window.innerWidth - 180), y: Math.min(event.clientY, window.innerHeight - 200), entry })
  }

  const runMenuAction = (entry: Entry, action: 'open' | 'copy' | 'rename' | 'delete'): void => {
    setMenu(null)
    if (action === 'open') {
      props.openPath(entry.path)
      return
    }
    if (action === 'copy') {
      void navigator.clipboard.writeText(entry.path)
      return
    }
    if (action === 'rename') {
      const name = window.prompt('新名称:', entry.name)
      if (name !== null && name !== '' && name !== entry.name) {
        void props.renamePath(entry.path, name).then(ok => {
          if (ok) setRefreshKey(key => key + 1)
        })
      }
      return
    }
    if (action === 'delete') {
      if (window.confirm(`确定删除 "${entry.name}"？`)) {
        void props.deletePath(entry.path).then(ok => {
          if (ok) setRefreshKey(key => key + 1)
        })
      }
    }
  }

  // Refresh the expanded children after rename/delete (and on first render).
  useEffect(() => {
    if (expanded === null || expanded.loading) return
    void listDir(props.listPath, expanded.path).then(entries => {
      setExpanded(last => last !== null && last.path === expanded.path && !last.loading
        ? { path: expanded.path, entries, loading: false }
        : last)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps -- refreshKey is the intended trigger
  }, [refreshKey])

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
            {favorites.map((favorite) => (
              <div key={favorite.path}>
                <div className="dsh-files-fav">
                  <span className="dsh-files-chevron">{expanded?.path === favorite.path ? '▾' : '▸'}</span>
                  <button type="button" className="dsh-files-fav-main" onClick={() => void expand(favorite.path)} title={favorite.path}>
                    <span>📂</span>
                    <span className="dsh-files-name">{favorite.name}</span>
                  </button>
                  <span className="dsh-files-row-actions">
                    <button type="button" className="dsh-files-iconbtn" title="导入全部文件到对话框"
                      onClick={() => void importFolder(favorite)}>↦</button>
                    <button type="button" className="dsh-files-iconbtn" title="打开文件夹"
                      onClick={() => props.openPath(favorite.path)}>↗</button>
                    <button type="button" className="dsh-files-iconbtn" title="移除关注"
                      onClick={() => removeFavorite(favorite.path)}>×</button>
                  </span>
                </div>
                {expanded !== null && expanded.path === favorite.path ? (
                  <div className="dsh-files-children">
                    {expanded.loading ? <div className="dsh-files-empty">加载中…</div> : null}
                    {!expanded.loading && expanded.entries.length === 0 ? <div className="dsh-files-empty">空目录</div> : null}
                    {!expanded.loading ? expanded.entries.map(entry => (
                      <FileRow key={entry.path} entry={entry}
                        selected={selected === entry.path}
                        onExpand={() => { setExpanded(null); void expand(entry.path) }}
                        onSelect={() => setSelected(value => value === entry.path ? null : entry.path)}
                        onOpen={() => props.openPath(entry.path)}
                        onPush={() => props.insertFile(entry.path, entry.kind === 'directory')}
                        onMenu={(event) => openMenu(event, entry)}
                      />
                    )) : null}
                  </div>
                ) : null}
              </div>
            ))}
            {favorites.length === 0 ? <div className="dsh-files-empty">未配置扫描目录</div> : null}
          </div>
          <div className="dsh-files-panel-foot">
            {adding ? (
              <span className="dsh-files-addrow">
                <input className="dsh-files-addinput" value={addValue} placeholder="输入文件夹路径…"
                  onChange={event => setAddValue(event.target.value)}
                  onKeyDown={event => { if (event.key === 'Enter') addFavorite() }} autoFocus />
                <button type="button" className="dsh-files-addbtn" onClick={addFavorite}>添加</button>
              </span>
            ) : (
              <button type="button" className="dsh-files-addbtn dsh-files-addbtn-full" onClick={() => setAdding(true)}>
                + 添加文件夹
              </button>
            )}
          </div>
        </div>
      ) : null}
      {menu !== null ? (
        <ContextMenu menu={menu} onAction={runMenuAction} onClose={() => setMenu(null)} />
      ) : null}
      <style>{cssText}</style>
    </>
  )
}

/** One tree row, NAVI style: icon by type, single-click select, double-click open. */
function FileRow(props: {
  readonly entry: Entry
  readonly selected: boolean
  readonly onExpand: () => void
  readonly onSelect: () => void
  readonly onOpen: () => void
  readonly onPush: () => void
  readonly onMenu: (event: React.MouseEvent) => void
}): JSX.Element {
  const { entry, selected } = props
  const [clickCount, setClickCount] = useState(0)
  const [timer, setTimer] = useState<ReturnType<typeof setTimeout> | null>(null)
  const handleClick = (): void => {
    setClickCount(count => count + 1)
    if (clickCount === 0) {
      setTimer(setTimeout(() => {
        setClickCount(0)
        if (entry.kind === 'directory') props.onExpand()
        else props.onSelect()
      }, 300))
    } else {
      setClickCount(0)
      if (timer !== null) clearTimeout(timer)
      props.onOpen()
    }
  }
  const [icon, color] = fileIcon(entry.name)
  return (
    <div className={`dsh-files-row ${selected ? 'dsh-files-row-selected' : ''}`}
      onClick={handleClick} onContextMenu={props.onMenu} title={entry.path}>
      <span className="dsh-files-chevron">{entry.kind === 'directory' ? '>' : ''}</span>
      <span style={{ color }}>{entry.kind === 'directory' ? '> ' : icon}</span>
      <span className="dsh-files-name">{entry.name}</span>
      <span className="dsh-files-row-actions">
        <button type="button" className="dsh-files-iconbtn" title="推送到对话框"
          onClick={(event) => { event.stopPropagation(); props.onPush() }}>↦</button>
      </span>
    </div>
  )
}

/** Context menu at the right-click position, NAVI styling. */
function ContextMenu(props: {
  readonly menu: { x: number; y: number; entry: Entry }
  readonly onAction: (entry: Entry, action: 'open' | 'copy' | 'rename' | 'delete') => void
  readonly onClose: () => void
}): JSX.Element {
  useEffect(() => {
    const onDown = (event: MouseEvent): void => {
      if (!(event.target as HTMLElement).closest('.dsh-files-menu')) props.onClose()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  })
  const { menu } = props
  return (
    <div className="dsh-files-menu" style={{ left: menu.x, top: menu.y }}>
      <button type="button" className="dsh-files-menu-item" onClick={() => props.onAction(menu.entry, 'open')}>打开</button>
      <div className="dsh-files-menu-sep" />
      <button type="button" className="dsh-files-menu-item" onClick={() => props.onAction(menu.entry, 'copy')}>复制路径</button>
      <button type="button" className="dsh-files-menu-item" onClick={() => props.onAction(menu.entry, 'rename')}>重命名</button>
      <button type="button" className="dsh-files-menu-item" onClick={() => props.onAction(menu.entry, 'delete')}>删除</button>
    </div>
  )
}

/** NAVI icon-by-extension map: colored glyph per type family. */
function fileIcon(name: string): [ReactNode, string] {
  const ext = extension(name)
  if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.ico'].includes(ext)) return ['▧', '#f59e0b']
  if (['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.webm'].includes(ext)) return ['▤', '#3b82f6']
  if (['.mp3', '.wav', '.flac', '.aac', '.ogg', '.wma'].includes(ext)) return ['♪', '#22c55e']
  if (['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz'].includes(ext)) return ['▣', '#a855f7']
  if (['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.c', '.cpp', '.rs', '.go', '.rb', '.php', '.swift', '.kt'].includes(ext)) return ['⌘', '#06b6d4']
  if (['.json', '.xml', '.yaml', '.yml', '.toml', '.ini', '.cfg'].includes(ext)) return ['{}', '#6b7280']
  if (['.pdf'].includes(ext)) return ['▯', '#ef4444']
  return ['■', '#6b7280']
}

function extension(name: string): string {
  const at = name.lastIndexOf('.')
  return at > 0 ? name.slice(at).toLowerCase() : ''
}

function basename(path: string): string {
  const trimmed = path.replace(/[\\/]+$/u, '')
  const atSlash = trimmed.lastIndexOf('/')
  const atBack = trimmed.lastIndexOf('\\')
  const at = Math.max(atSlash, atBack)
  return at >= 0 ? trimmed.slice(at + 1) : trimmed
}

async function listDir(listPath: string, path: string): Promise<Entry[]> {
  try {
    const response = await fetch(listPath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    })
    if (!response.ok) return []
    const body = await response.json() as { entries?: Entry[] }
    return body.entries ?? []
  } catch {
    return []
  }
}
