/**
 * NAVI-aligned file-browser stylesheet as a string (tsdown has no CSS
 * pipeline here). Tokens come from the dsh theme CSS variables; geometry
 * mirrors ClaudeMate's floating panel (rounded-xl, subtle border hover,
 * glass blur, row actions on hover).
 */
export const cssText = '.dsh-files-composer{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border:0;background:transparent;border-radius:6px;cursor:pointer;color:var(--dsw-alias-label-secondary)}' +
  '.dsh-files-composer:hover{background:var(--dsw-alias-interactive-bg-hover)}' +
  '.dsh-files-composer-on{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}' +
  '.dsh-files-composer-icon{font-size:15px;line-height:1}' +
  '.dsh-files-foot{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;' +
  'border:1px solid var(--dsw-alias-border-l2);border-radius:14px;background:transparent;cursor:pointer;' +
  'color:var(--dsw-alias-label-primary);font-family:var(--dsw-font-family);font-size:12px;white-space:nowrap}' +
  '.dsh-files-foot:hover{background:var(--dsw-alias-interactive-bg-hover)}' +
  '.dsh-files-foot-icon{font-size:14px;line-height:1}' +
  '.dsh-files-panel{position:fixed;top:64px;left:var(--dsw-sizes-sidebar,272px);z-index:200;' +
  'width:270px;max-height:62vh;display:flex;flex-direction:column;' +
  'background:var(--dsw-surface-panel,var(--dsw-alias-surface-2,var(--dsw-alias-bg-primary,#fff)));' +
  '-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);' +
  'border:1px solid var(--dsw-alias-border-l2);border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.18);' +
  'font-family:var(--dsw-font-family);color:var(--dsw-alias-label-primary);overflow:hidden}' +
  '.dsh-files-panel-head{display:flex;align-items:center;justify-content:space-between;padding:9px 12px;' +
  'border-bottom:1px solid var(--dsw-alias-border-l2);font-size:12px;font-weight:600}' +
  '.dsh-files-close{border:0;background:transparent;cursor:pointer;font-size:14px;' +
  'color:var(--dsw-alias-label-secondary);padding:0 4px;border-radius:6px}' +
  '.dsh-files-close:hover{background:var(--dsw-alias-interactive-bg-hover)}' +
  '.dsh-files-tree{overflow:auto;padding:6px 6px;display:flex;flex-direction:column;gap:2px;flex:1}' +
  '.dsh-files-fav{display:flex;align-items:center;gap:6px;padding:6px 8px;border-radius:10px;cursor:pointer}' +
  '.dsh-files-fav:hover{background:var(--dsw-alias-interactive-bg-hover)}' +
  '.dsh-files-fav-main{display:flex;align-items:center;gap:6px;flex:1;min-width:0;border:0;background:transparent;' +
  'color:inherit;font-size:12px;padding:0;cursor:pointer;text-align:left}' +
  '.dsh-files-chevron{width:10px;font-size:10px;color:var(--dsw-alias-label-secondary);flex:none;text-align:center}' +
  '.dsh-files-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
  '.dsh-files-row-actions{display:none;align-items:center;gap:2px;flex:none;padding:0 2px}' +
  '.dsh-files-fav:hover .dsh-files-row-actions,.dsh-files-row:hover .dsh-files-row-actions{display:inline-flex}' +
  '.dsh-files-iconbtn{border:0;background:transparent;cursor:pointer;font-size:11px;line-height:1;' +
  'color:var(--dsw-alias-label-secondary);padding:3px 5px;border-radius:6px}' +
  '.dsh-files-iconbtn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}' +
  '.dsh-files-children{margin-left:12px;padding-left:8px;border-left:1px solid var(--dsw-alias-border-l2);' +
  'display:flex;flex-direction:column;gap:2px}' +
  '.dsh-files-row{display:flex;align-items:center;gap:6px;padding:5px 8px;border-radius:8px;cursor:default;' +
  'font-size:12px;color:var(--dsw-alias-label-secondary)}' +
  '.dsh-files-row:hover{background:var(--dsw-alias-interactive-bg-hover)}' +
  '.dsh-files-row-selected{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}' +
  '.dsh-files-empty{padding:8px 10px;font-size:11px;color:var(--dsw-alias-label-secondary)}' +
  '.dsh-files-panel-foot{padding:6px 8px;border-top:1px solid var(--dsw-alias-border-l2)}' +
  '.dsh-files-addbtn{border:1px dashed var(--dsw-alias-border-l2);background:transparent;cursor:pointer;' +
  'color:var(--dsw-alias-label-secondary);font-size:12px;padding:6px 10px;border-radius:10px;white-space:nowrap}' +
  '.dsh-files-addbtn:hover{background:var(--dsw-alias-interactive-bg-hover)}' +
  '.dsh-files-addbtn-full{display:flex;align-items:center;justify-content:center;width:100%;gap:4px}' +
  '.dsh-files-addrow{display:flex;align-items:center;gap:6px}' +
  '.dsh-files-addinput{flex:1;min-width:0;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;' +
  'background:transparent;color:var(--dsw-alias-label-primary);font-size:12px;padding:5px 10px;outline:none}' +
  '.dsh-files-menu{position:fixed;z-index:250;min-width:150px;padding:4px;border-radius:10px;' +
  'background:var(--dsw-surface-panel,var(--dsw-alias-surface-2,var(--dsw-alias-bg-primary,#fff)));' +
  '-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);' +
  'border:1px solid var(--dsw-alias-border-l2);box-shadow:0 10px 30px rgba(0,0,0,.22);' +
  'font-family:var(--dsw-font-family);font-size:12px}' +
  '.dsh-files-menu-item{display:flex;align-items:center;gap:8px;width:100%;padding:6px 10px;border:0;' +
  'background:transparent;color:var(--dsw-alias-label-primary);cursor:pointer;border-radius:6px;text-align:left}' +
  '.dsh-files-menu-item:hover{background:var(--dsw-alias-interactive-bg-hover)}' +
  '.dsh-files-menu-sep{height:1px;margin:3px 6px;background:var(--dsw-alias-border-l2)}'
