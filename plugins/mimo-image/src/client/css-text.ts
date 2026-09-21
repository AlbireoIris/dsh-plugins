/**
 * MiMo-style image gallery stylesheet as a string (tsdown has no CSS pipeline).
 * Mirrors MiMo Desktop cards: rounded frame, name footer, type badge, zoom lightbox.
 */
export const cssText = `
[data-mimo-image]{font-family:inherit}
.mimo-img-gallery{display:flex;flex-wrap:wrap;gap:10px;max-width:100%}
.mimo-img-gallery[data-align=end]{justify-content:flex-end;align-self:flex-end}
.mimo-img-gallery[data-align=start]{justify-content:flex-start;align-self:flex-start}
.mimo-img-card{position:relative;display:flex;flex-direction:column;overflow:hidden;border:1px solid var(--dsw-alias-border-l2-darkmode-thin,rgba(255,255,255,.14));border-radius:10px;background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.04));cursor:zoom-in;padding:0;text-align:left;transition:box-shadow .12s ease,border-color .12s ease}
.mimo-img-card:hover{border-color:rgba(255,255,255,.24);box-shadow:0 4px 14px rgba(0,0,0,.25)}
.mimo-img-card:focus-visible{outline:2px solid var(--dsw-alias-label-primary,#6ea8fe);outline-offset:2px}
.mimo-img-card[data-variant=single]{width:min(360px,100%)}
.mimo-img-card[data-variant=tile]{width:148px}
.mimo-img-frame{position:relative;display:grid;place-items:center;overflow:hidden;background:rgba(0,0,0,.12)}
.mimo-img-card[data-variant=single] .mimo-img-frame{width:100%;max-height:220px}
.mimo-img-card[data-variant=tile] .mimo-img-frame{width:148px;height:110px}
.mimo-img-frame img{display:block;width:100%;height:100%;object-fit:contain}
.mimo-img-footer{display:flex;align-items:center;gap:8px;min-height:30px;padding:6px 10px;border-top:1px solid rgba(255,255,255,.08);background:rgba(0,0,0,.14);color:var(--dsw-alias-label-secondary,rgba(255,255,255,.7));font-size:12px;line-height:18px}
.mimo-img-name{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mimo-img-badge{flex:none;padding:1px 6px;border-radius:999px;background:rgba(255,255,255,.08);color:var(--dsw-alias-label-tertiary,rgba(255,255,255,.5));font-size:11px;line-height:16px;text-transform:uppercase}
.mimo-img-loading,.mimo-img-error{color:var(--dsw-alias-label-tertiary,rgba(255,255,255,.5));font-size:12px}
.mimo-img-error{max-width:240px;padding:10px 12px;border:1px solid rgba(255,120,120,.35);border-radius:10px;background:rgba(255,80,80,.08);cursor:pointer}
.mimo-img-card[data-variant=tile] .mimo-img-error{width:148px;height:110px;overflow:hidden}
.mimo-lightbox-mask{position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.72);display:grid;place-items:center;padding:24px}
.mimo-lightbox-mask img{max-width:min(96vw,1200px);max-height:min(88vh,900px);object-fit:contain;border-radius:10px;box-shadow:0 12px 40px rgba(0,0,0,.45)}
.mimo-lightbox-close{position:fixed;top:16px;right:16px;width:36px;height:36px;border:0;border-radius:999px;background:rgba(255,255,255,.12);color:#fff;cursor:pointer;font-size:18px;line-height:1}
.mimo-lightbox-close:hover{background:rgba(255,255,255,.2)}
`
