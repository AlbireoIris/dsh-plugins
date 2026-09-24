// ==UserScript==
// @name         知乎回答过滤（关键词 / 精选评论）
// @namespace    local.zhihu-answer-filter
// @version      1.1.0
// @description  按关键词与「作者开启精选评论」过滤知乎回答；消息左侧灰色计数，点开可配置关键字
// @match        https://www.zhihu.com/*
// @match        https://zhihu.com/*
// @run-at       document-idle
// @grant        GM_registerMenuCommand
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(() => {
  'use strict'

  const STORE_KEY = 'zhihu-answer-filter-v1'
  const DEFAULT_CFG = {
    keywords: [],
    blockFeaturedComments: true,
  }

  function loadCfg() {
    try {
      const raw = JSON.parse(GM_getValue(STORE_KEY, 'null') || 'null')
      return {
        keywords: Array.isArray(raw?.keywords)
          ? raw.keywords.filter((k) => typeof k === 'string' && k.trim())
          : [],
        blockFeaturedComments: raw?.blockFeaturedComments !== false,
      }
    } catch {
      return { ...DEFAULT_CFG, keywords: [] }
    }
  }
  function saveCfg() {
    GM_setValue(STORE_KEY, JSON.stringify(cfg))
  }

  let cfg = loadCfg()
  let hiddenCount = 0
  let peek = false

  const ANSWER_SEL = [
    '.List-item',
    '.AnswerItem',
    '[class*="AnswerItem"]',
    'div[itemprop="zhihu:answer"]',
    '.TopstoryItem',
  ].join(',')

  const FEATURED_PATTERNS = [
    /作者开启[了]?精选评论/,
    /开启[了]?精选评论/,
    /评论精选/,
    /仅显示精选评论/,
    /只显示作者认可的评论/,
  ]

  const normalize = (s) => (s || '').normalize('NFC').toLowerCase()
  const textOf = (el) => normalize(el?.innerText || el?.textContent || '')

  function matchKeyword(el) {
    if (!cfg.keywords.length) return null
    const t = textOf(el)
    for (const k of cfg.keywords) {
      const nk = normalize(k)
      if (nk && t.includes(nk)) return k
    }
    return null
  }

  function matchFeaturedComments(el) {
    if (!cfg.blockFeaturedComments) return false
    const raw = el?.innerText || ''
    return FEATURED_PATTERNS.some((re) => re.test(raw))
  }

  function markHidden(card, reason) {
    if (!card || card.dataset.zhFilter === 'hidden') return
    card.dataset.zhFilter = 'hidden'
    card.dataset.zhFilterReason = reason
    if (!peek) card.style.setProperty('display', 'none', 'important')
    else card.style.setProperty('opacity', '0.35', 'important')
    hiddenCount += 1
    updateBadge()
  }

  function markShown(card) {
    if (!card || card.dataset.zhFilter !== 'hidden') return
    delete card.dataset.zhFilter
    delete card.dataset.zhFilterReason
    card.style.removeProperty('display')
    card.style.removeProperty('opacity')
    hiddenCount = Math.max(0, hiddenCount - 1)
    updateBadge()
  }

  function evaluate(card) {
    if (!(card instanceof Element)) return
    const kw = matchKeyword(card)
    if (kw) {
      markHidden(card, `keyword:${kw}`)
      return
    }
    if (matchFeaturedComments(card)) {
      markHidden(card, 'featured-comments')
      return
    }
    markShown(card)
  }

  function scan(root = document) {
    root.querySelectorAll?.(ANSWER_SEL)?.forEach(evaluate)
    // recount after full scan of document
    if (root === document) {
      hiddenCount = document.querySelectorAll('[data-zh-filter="hidden"]').length
      updateBadge()
    }
  }

  // ---------- UI：消息流左侧灰色计数 + 配置面板 ----------
  function ensureUi() {
    if (document.getElementById('zh-filter-root')) return

    const root = document.createElement('div')
    root.id = 'zh-filter-root'
    root.innerHTML = `
      <div id="zh-filter-badge" title="点击配置关键字 / 筛选项">
        <span class="zhf-dot"></span>
        <span class="zhf-num">0</span>
        <span class="zhf-label">已过滤</span>
      </div>
      <div id="zh-filter-panel" hidden>
        <div class="zhf-title">回答过滤</div>
        <label class="zhf-row">
          <input type="checkbox" id="zhf-featured" />
          <span>过滤「精选评论」回答</span>
        </label>
        <div class="zhf-label2">屏蔽关键字（逗号分隔）</div>
        <textarea id="zhf-kw" rows="3" placeholder="广告, 引流, 恰饭…"></textarea>
        <div class="zhf-btns">
          <button type="button" id="zhf-save">保存并筛选</button>
          <button type="button" id="zhf-peek">临时显示已隐藏</button>
        </div>
        <div class="zhf-hint">右下角计数点击也可打开本面板</div>
      </div>
    `

    const style = document.createElement('style')
    style.textContent = `
#zh-filter-root {
  position: fixed; left: 12px; top: 50%; transform: translateY(-50%);
  z-index: 2147483000; font: 12px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif;
  color: #64748b;
}
#zh-filter-badge {
  display: flex; align-items: center; gap: 6px;
  background: #f1f5f9; color: #6b7280;
  border: 1px solid #e5e7eb; border-radius: 999px;
  padding: 6px 12px 6px 10px; cursor: pointer;
  box-shadow: 0 2px 8px rgba(15, 23, 42, .06);
  user-select: none; opacity: .92;
}
#zh-filter-badge:hover { opacity: 1; background: #e5e7eb; }
#zh-filter-badge .zhf-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: #9ca3af;
}
#zh-filter-badge .zhf-num {
  font-weight: 700; font-size: 13px; color: #4b5563;
  min-width: 1.2em; text-align: center;
}
#zh-filter-badge .zhf-label { color: #9ca3af; }
#zh-filter-panel {
  position: absolute; left: 0; top: calc(100% + 8px);
  width: 260px; background: #fff; color: #374151;
  border: 1px solid #e5e7eb; border-radius: 12px;
  padding: 12px; box-shadow: 0 8px 24px rgba(15,23,42,.12);
}
#zh-filter-panel .zhf-title {
  font-weight: 650; font-size: 13px; margin-bottom: 8px; color: #111827;
}
#zh-filter-panel .zhf-row {
  display: flex; align-items: center; gap: 8px; margin-bottom: 10px; cursor: pointer;
}
#zh-filter-panel .zhf-label2 {
  font-size: 11px; color: #9ca3af; margin-bottom: 4px;
}
#zh-filter-panel textarea {
  width: 100%; box-sizing: border-box; resize: vertical;
  border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px;
  font: inherit; color: #374151; background: #f9fafb;
}
#zh-filter-panel textarea:focus {
  outline: none; border-color: #9ca3af; background: #fff;
}
#zh-filter-panel .zhf-btns {
  display: flex; gap: 8px; margin-top: 10px;
}
#zh-filter-panel button {
  flex: 1; height: 32px; border: none; border-radius: 8px;
  font: inherit; font-weight: 600; cursor: pointer;
}
#zhf-save { background: #6b7280; color: #fff; }
#zhf-save:hover { background: #4b5563; }
#zhf-peek { background: #f3f4f6; color: #4b5563; border: 1px solid #e5e7eb !important; }
#zhf-peek:hover { background: #e5e7eb; }
#zh-filter-panel .zhf-hint {
  margin-top: 8px; font-size: 11px; color: #9ca3af;
}
`

    document.documentElement.appendChild(style)
    document.documentElement.appendChild(root)

    const badge = root.querySelector('#zh-filter-badge')
    const panel = root.querySelector('#zh-filter-panel')
    const kw = root.querySelector('#zhf-kw')
    const featured = root.querySelector('#zhf-featured')

    function openPanel() {
      kw.value = cfg.keywords.join(', ')
      featured.checked = !!cfg.blockFeaturedComments
      panel.hidden = false
    }
    function closePanel() {
      panel.hidden = true
    }

    badge.addEventListener('click', (e) => {
      e.stopPropagation()
      if (panel.hidden) openPanel()
      else closePanel()
    })
    panel.addEventListener('click', (e) => e.stopPropagation())
    document.addEventListener('click', closePanel)

    root.querySelector('#zhf-save').addEventListener('click', () => {
      cfg.keywords = kw.value
        .split(/[,，\n]/)
        .map((s) => s.trim())
        .filter(Boolean)
      cfg.blockFeaturedComments = featured.checked
      saveCfg()
      // 重新评估全部
      document.querySelectorAll('[data-zh-filter]').forEach((c) => {
        delete c.dataset.zhFilter
        delete c.dataset.zhFilterReason
        c.style.removeProperty('display')
        c.style.removeProperty('opacity')
      })
      hiddenCount = 0
      scan()
      closePanel()
    })

    root.querySelector('#zhf-peek').addEventListener('click', () => {
      peek = !peek
      document.querySelectorAll('[data-zh-filter="hidden"]').forEach((c) => {
        if (peek) {
          c.style.removeProperty('display')
          c.style.setProperty('opacity', '0.35', 'important')
        } else {
          c.style.setProperty('display', 'none', 'important')
        }
      })
      root.querySelector('#zhf-peek').textContent = peek ? '恢复隐藏' : '临时显示已隐藏'
      updateBadge()
    })
  }

  function updateBadge() {
    const num = document.querySelector('#zh-filter-badge .zhf-num')
    const label = document.querySelector('#zh-filter-badge .zhf-label')
    if (num) num.textContent = String(hiddenCount)
    if (label) label.textContent = peek ? '显示中' : '已过滤'
  }

  // ---------- 启动 ----------
  function boot() {
    ensureUi()
    scan()

    const mo = new MutationObserver((muts) => {
      for (const m of muts) {
        for (const n of m.addedNodes) {
          if (n.nodeType !== 1) continue
          if (n.matches?.(ANSWER_SEL)) evaluate(n)
          else scan(n)
        }
      }
    })
    mo.observe(document.documentElement, { childList: true, subtree: true })

    let last = location.href
    setInterval(() => {
      if (location.href !== last) {
        last = location.href
        setTimeout(() => scan(), 400)
      }
    }, 800)
  }

  if (typeof GM_registerMenuCommand === 'function') {
    GM_registerMenuCommand('打开过滤面板', () => {
      ensureUi()
      document.querySelector('#zh-filter-badge')?.click()
    })
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true })
  } else {
    boot()
  }
})()
