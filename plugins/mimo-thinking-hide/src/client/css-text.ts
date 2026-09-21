/**
 * MiMo-style thinking-hide stylesheet as a string (tsdown has no CSS pipeline).
 * Default mode renders reasoning as nothing (matches MiMo Desktop `qa` → null).
 * Chip mode is an ultra-quiet expandable row.
 */
export const cssText = `
[data-mimo-thinking]{font-family:inherit}
.mimo-think-hidden{display:none}
.mimo-think-chip{display:flex;flex-direction:column;margin:2px 0 6px;border:1px solid rgba(255,255,255,.06);border-radius:8px;background:transparent;overflow:hidden}
.mimo-think-head{display:flex;align-items:center;gap:6px;width:100%;min-height:22px;padding:2px 8px;border:0;background:transparent;color:var(--dsw-alias-label-tertiary,rgba(255,255,255,.36));font-size:11px;line-height:16px;cursor:pointer;text-align:left;opacity:.75}
.mimo-think-head:hover{opacity:1;color:var(--dsw-alias-label-secondary,rgba(255,255,255,.65))}
.mimo-think-body{padding:2px 10px 8px 22px;color:var(--dsw-alias-label-tertiary,rgba(255,255,255,.42));font-size:12px;line-height:1.5;white-space:pre-wrap;word-break:break-word;max-height:240px;overflow:auto}
.mimo-assistant-root{display:flex;flex-direction:column;gap:2px}
.mimo-assistant-body{display:flex;flex-direction:column;gap:6px}
.mimo-assistant-text{color:inherit;font-size:inherit;line-height:inherit}
.mimo-assistant-stopped{color:var(--dsw-alias-label-tertiary,rgba(255,255,255,.42));font-size:12px}
`
