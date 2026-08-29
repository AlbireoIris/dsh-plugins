/**
 * File-browser panel stylesheet as a string (tsdown has no CSS pipeline
 * here). Tokens come from the dsh theme CSS variables; geometry matches the
 * sidebar shell footprint.
 */
export const cssText = '.dsh-files-foot{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;' +
  'border:1px solid var(--dsw-alias-border-l2);border-radius:14px;background:transparent;cursor:pointer;' +
  'color:var(--dsw-alias-label-primary);font-family:var(--dsw-font-family);font-size:12px;white-space:nowrap}' +
  '.dsh-files-foot:hover{background:var(--dsw-alias-interactive-bg-hover)}' +
  '.dsh-files-foot-icon{font-size:14px;line-height:1}' +
  '.dsh-files-panel{position:fixed;top:64px;left:var(--dsw-sizes-sidebar,272px);z-index:200;' +
  'width:260px;max-height:60vh;display:flex;flex-direction:column;' +
  'background:var(--dsw-surface-panel,var(--dsw-alias-surface-2,var(--dsw-alias-bg-primary,#fff)));' +
  'border:1px solid var(--dsw-alias-border-l2);border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.18);' +
  'font-family:var(--dsw-font-family);color:var(--dsw-alias-label-primary);overflow:hidden}' +
  '.dsh-files-panel-head{display:flex;align-items:center;justify-content:space-between;padding:8px 10px;' +
  'border-bottom:1px solid var(--dsw-alias-border-l2);font-size:12px;font-weight:600}' +
  '.dsh-files-close{border:0;background:transparent;cursor:pointer;font-size:14px;' +
  'color:var(--dsw-alias-label-secondary);padding:0 4px}' +
  '.dsh-files-tree{overflow:auto;padding:6px 4px;display:flex;flex-direction:column;gap:2px}' +
  '.dsh-files-row{display:flex;align-items:center;gap:6px;width:100%;text-align:left;padding:6px 8px;' +
  'border:0;border-radius:8px;background:transparent;cursor:pointer;color:inherit;font-size:12px}' +
  '.dsh-files-row:hover{background:var(--dsw-alias-interactive-bg-hover)}' +
  '.dsh-files-chevron{width:10px;font-size:10px;color:var(--dsw-alias-label-secondary);flex:none}' +
  '.dsh-files-name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
  '.dsh-files-children{margin-left:14px;padding-left:8px;border-left:1px solid var(--dsw-alias-border-l2);' +
  'display:flex;flex-direction:column;gap:2px}' +
  '.dsh-files-empty{padding:8px 10px;font-size:11px;color:var(--dsw-alias-label-secondary)}'
