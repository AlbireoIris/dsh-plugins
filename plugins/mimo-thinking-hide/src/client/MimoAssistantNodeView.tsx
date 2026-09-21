/**
 * Assistant chat row — MiMo display:
 * answers + image cards stay; thinking chains are hidden by default
 * (MiMo Desktop `qa` returns null). Chip mode only when ?mimoThinking=chip.
 */
import { Fragment, useEffect, useMemo, useState } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { MarkdownText } from '@deepseek-ai/dsh-client-ui-primitives'
import { cssText } from './css-text.ts'

export type AssistantBlock =
  | { kind: 'text'; text: string }
  | { kind: 'reasoning'; text: string }
  | { kind: 'image'; attachment: { attachmentId?: string; name?: string; width?: number; height?: number } }
  | { kind: 'tool-call'; callId?: string; name?: string; argsRaw?: string }
  | { kind: 'other'; block: unknown }

export interface MimoAssistantNodeViewProps {
  node?: {
    data?: {
      status?: 'running' | 'settled' | 'interrupted'
      blocks?: readonly AssistantBlock[]
    }
  }
  renderMessageImages?: (owner: {
    images: readonly { attachment: { attachmentId?: string; name?: string; width?: number; height?: number } }[]
    align: 'start' | 'end'
  }) => ReactNode
}

function injectCss(): void {
  if (typeof document === 'undefined') return
  const tagId = 'mimo-thinking-hide/styles'
  if (document.querySelector(`style[data-plugin-css="${tagId}"]`)) return
  const tag = document.createElement('style')
  tag.dataset.plugin = 'mimo-thinking-hide'
  tag.dataset.pluginCss = tagId
  tag.textContent = cssText
  document.head.appendChild(tag)
}

/**
 * MiMo Desktop currently hides reasoning in chat (`qa(e){return null}`).
 * Default matches that. Optional chip mode: `?mimoThinking=chip`.
 */
function thinkingMode(): 'hide' | 'chip' {
  if (typeof window === 'undefined') return 'hide'
  try {
    const q = new URLSearchParams(window.location.search).get('mimoThinking')
    if (q === 'chip' || q === 'show') return 'chip'
  } catch {
    // ignore malformed URLSearchParams
  }
  return 'hide'
}

export function MimoThinkingChip({ text, running }: {
  text: string
  running: boolean
}): ReactElement {
  const [open, setOpen] = useState(false)
  const chars = text.length
  const status = running ? '思考中…' : chars > 0 ? `已思考 · ${chars} 字` : '思考'
  return (
    <div
      className="mimo-think-chip"
      data-mimo-thinking=""
      data-mode="chip"
      data-running={running ? 'true' : 'false'}
      data-expanded={open ? 'true' : 'false'}
    >
      <button
        type="button"
        className="mimo-think-head"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title={open ? '收起思考' : '展开思考'}
      >
        <span>{open ? '▾' : '▸'}</span>
        <span>思考</span>
        <span>{` · ${status}`}</span>
      </button>
      {open ? <div className="mimo-think-body">{text}</div> : null}
    </div>
  )
}

const MARKDOWN_LABELS = {
  code: '复制代码',
  copied: '已复制',
  file: '文件',
  image: '图片',
  link: '链接',
  toggle: '展开/收起',
}

export function MimoAssistantNodeView({
  node,
  renderMessageImages,
}: MimoAssistantNodeViewProps): ReactElement | null {
  useEffect(() => { injectCss() }, [])
  const data = node?.data ?? {}
  const blocks = useMemo(() => data.blocks ?? [], [data.blocks])
  const streaming = data.status === 'running'
  const interrupted = data.status === 'interrupted'
  const mode = thinkingMode()
  const rendered: ReactNode[] = []
  let hasVisible = streaming || interrupted === true

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]
    if (!block) continue
    if (block.kind === 'reasoning') {
      const text = String(block.text ?? '')
      if (!text.trim()) continue
      // MiMo-faithful default: do not render thinking chains at all.
      if (mode === 'hide') continue
      hasVisible = true
      rendered.push(
        <MimoThinkingChip
          key={`r${i}`}
          text={text}
          running={streaming && i === blocks.length - 1}
        />,
      )
      continue
    }
    if (block.kind === 'text') {
      const text = String(block.text ?? '')
      if (!text.trim()) continue
      hasVisible = true
      rendered.push(
        <div className="mimo-assistant-text" key={`t${i}`}>
          <MarkdownText
            text={text}
            streaming={streaming && i === blocks.length - 1}
            labels={MARKDOWN_LABELS}
          />
        </div>,
      )
      continue
    }
    if (block.kind === 'image') {
      const start = i
      const group = [block]
      while (i + 1 < blocks.length) {
        const next = blocks[i + 1]
        if (!next || next.kind !== 'image') break
        group.push(next)
        i += 1
      }
      hasVisible = true
      if (typeof renderMessageImages === 'function') {
        rendered.push(
          <Fragment key={`img${start}`}>
            {renderMessageImages({
              images: group.map((b) => ({ attachment: b.attachment })),
              align: 'start',
            })}
          </Fragment>,
        )
      }
      continue
    }
    // tool-call heads render via the tool grouping pass.
  }

  if (!hasVisible) return null
  return (
    <div
      className="mimo-assistant-root"
      data-mimo-assistant=""
      data-streaming={streaming ? 'true' : undefined}
    >
      <div className="mimo-assistant-body">
        {rendered}
        {interrupted ? <span className="mimo-assistant-stopped">已停止</span> : null}
      </div>
    </div>
  )
}
