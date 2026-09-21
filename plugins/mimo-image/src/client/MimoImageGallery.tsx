/** MiMo-style image card + gallery + lightbox for message / trajectory / tool images. */
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactElement } from 'react'
import { createPortal } from 'react-dom'
import { cssText } from './css-text.ts'

export interface ImageAttachmentRef {
  attachmentId?: string
  name?: string
  width?: number
  height?: number
}

export interface MessageImageSource {
  attachment?: ImageAttachmentRef
  preview?: { url: string; name?: string; width?: number; height?: number }
}

export type MessageImageLoader = ((attachment: ImageAttachmentRef) => Promise<string>) & {
  peek?: (attachment: ImageAttachmentRef) => string | undefined
}

export interface MessageImagesProps {
  images?: readonly MessageImageSource[]
  loadImage?: MessageImageLoader
  align?: 'start' | 'end'
  compact?: boolean
}

function injectCss(): void {
  if (typeof document === 'undefined') return
  const tagId = 'mimo-image/styles'
  if (document.querySelector(`style[data-plugin-css="${tagId}"]`)) return
  const tag = document.createElement('style')
  tag.dataset.plugin = 'mimo-image'
  tag.dataset.pluginCss = tagId
  tag.textContent = cssText
  document.head.appendChild(tag)
}

function extOf(name: string): string {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i + 1).toUpperCase().slice(0, 5) : 'IMG'
}

function displayName(image: MessageImageSource): string {
  return image.attachment?.name ?? image.preview?.name ?? 'image'
}

function dimensionsOf(image: MessageImageSource): { width: number; height: number } | undefined {
  const a = image.attachment
  if (a && typeof a.width === 'number' && typeof a.height === 'number') {
    return { width: a.width, height: a.height }
  }
  const p = image.preview
  if (p && typeof p.width === 'number' && typeof p.height === 'number') {
    return { width: p.width, height: p.height }
  }
  return undefined
}

function singleBox(dimensions?: { width: number; height: number }): {
  width: number
  height: number
} {
  if (!dimensions) return { width: 320, height: 200 }
  const natural = dimensions.width / Math.max(1, dimensions.height)
  const ratio = Math.min(3.2, Math.max(0.45, natural))
  const box = ratio >= 1
    ? { width: 320, height: Math.min(220, 320 / ratio) }
    : { width: 320 * ratio, height: 220 }
  const scale = Math.min(1, dimensions.width / box.width, dimensions.height / box.height)
  return {
    width: Math.max(1, Math.round(box.width * scale)),
    height: Math.max(1, Math.round(box.height * scale)),
  }
}

function MimoLightbox({ src, alt, onClose }: {
  src: string
  alt: string
  onClose: () => void
}): ReactElement {
  const closeRef = { current: null as HTMLButtonElement | null }
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      prev?.focus()
    }
  }, [onClose])
  return createPortal(
    <div
      className="mimo-lightbox-mask"
      role="dialog"
      aria-modal="true"
      aria-label="图片预览"
      data-mimo-image-lightbox=""
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <img src={src} alt={alt} />
      <button
        ref={closeRef}
        type="button"
        className="mimo-lightbox-close"
        aria-label="关闭预览"
        onClick={onClose}
      >×</button>
    </div>,
    document.body,
  )
}

function MimoImageCard({ image, load, variant }: {
  image: MessageImageSource
  load?: MessageImageLoader
  variant: 'single' | 'tile'
}): ReactElement {
  const preview = image.preview
  const attachment = image.attachment
  const [url, setUrl] = useState<string | null>(() => {
    if (preview) return preview.url
    if (attachment && load?.peek) return load.peek(attachment) ?? null
    return null
  })
  const [error, setError] = useState(false)
  const [open, setOpen] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const name = displayName(image)
  const fit = useMemo(
    () => (variant === 'single' ? singleBox(dimensionsOf(image)) : undefined),
    [image, variant],
  )

  useEffect(() => {
    if (!attachment || !load) return
    let live = true
    setError(false)
    if (load.peek) setUrl(load.peek(attachment) ?? null)
    Promise.resolve(load(attachment))
      .then((u) => { if (live) setUrl(u) })
      .catch(() => { if (live) setError(true) })
    return () => { live = false }
  }, [attachment, load, attempt])

  const openPreview = useCallback(() => {
    if (url) setOpen(true)
  }, [url])

  if (error) {
    return (
      <button
        type="button"
        className="mimo-img-error"
        data-variant={variant}
        data-mimo-image="error"
        onClick={() => setAttempt((a) => a + 1)}
      >图片加载失败 · 点击重试</button>
    )
  }

  return (
    <Fragment>
      <button
        type="button"
        className="mimo-img-card"
        data-variant={variant}
        data-mimo-image=""
        data-mimo-image-name={name}
        title="打开原图"
        aria-label={`打开图片 ${name}`}
        style={fit ? { width: fit.width } : undefined}
        onClick={openPreview}
      >
        <div
          className="mimo-img-frame"
          style={fit ? { width: fit.width, height: fit.height } : undefined}
        >
          {url
            ? <img src={url} alt={name} style={{ objectPosition: 'center' }} />
            : <span className="mimo-img-loading">加载中…</span>}
        </div>
        <div className="mimo-img-footer">
          <span className="mimo-img-name" title={name}>{name}</span>
          <span className="mimo-img-badge">{extOf(name)}</span>
        </div>
      </button>
      {open && url
        ? <MimoLightbox src={url} alt={name} onClose={() => setOpen(false)} />
        : null}
    </Fragment>
  )
}

/** Historical message-image slot entry (MiMo card gallery). */
export function MimoImageGallery({
  images = [],
  loadImage,
  align = 'start',
  compact = false,
}: MessageImagesProps): ReactElement | null {
  useEffect(() => { injectCss() }, [])
  if (!images.length) return null
  const variant: 'single' | 'tile' = compact || images.length > 1 ? 'tile' : 'single'
  return (
    <div
      className="mimo-img-gallery"
      data-align={align}
      data-mimo-image-gallery=""
      data-mimo-image-count={String(images.length)}
    >
      {images.map((image, index) => (
        <MimoImageCard
          key={`${image.attachment?.attachmentId ?? image.preview?.url ?? 'img'}:${index}`}
          image={image}
          load={loadImage}
          variant={variant}
        />
      ))}
    </div>
  )
}
