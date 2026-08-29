/**
 * Pill stylesheet as a string: the browser client is built by tsdown without
 * a CSS pipeline, so the style travels with the component and is injected by
 * the pill itself. Tokens come from the dsh theme CSS variables.
 */
export const cssText = '.dsh-restart-harness-wrap{align-items:center;gap:8px;display:inline-flex}' +
  '.dsh-restart-harness-pill{border:1px solid var(--dsw-alias-border-l2);min-width:72px;height:32px;' +
  'color:var(--dsw-alias-label-primary);font-family:var(--dsw-font-family);cursor:pointer;background:0 0;' +
  'border-radius:18px;justify-content:center;align-items:center;padding:6px 12px;font-size:13px;' +
  'font-weight:400;line-height:20px;display:inline-flex}' +
  '.dsh-restart-harness-pill:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}' +
  '.dsh-restart-harness-pill:disabled{color:var(--dsw-alias-label-dimmed);cursor:wait}' +
  '.dsh-restart-harness-pill span{white-space:nowrap}' +
  '.dsh-restart-harness-status{color:var(--dsw-alias-label-secondary);white-space:nowrap;font-size:12px}'
