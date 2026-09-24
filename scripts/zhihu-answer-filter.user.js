// ==UserScript==
// @name         知乎回答过滤（关键词 / 精选评论）
// @namespace    local.zhihu-answer-filter
// @version      1.0.0
// @description  按关键词与「作者开启精选评论」过滤知乎回答，可临时显示、命中计数
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
    scope: 'answers', // answers | all（all 会连同专栏正文块一起过滤）
  }

  // ---------- 配置 ----------
  function loadCfg() {
    try {
      const raw = JSON.parse(GM_getValue(STORE_KEY, 'null') || 'null')
      return {
        keywords: Array.isArray(raw?.keywords)
          ? raw.keywords.filter((k) => typeof k === 'string' && k.trim())
          : [...DEFAULT_CFG.keywords],
        blockFeaturedComments: raw?.blockFeaturedComments !== false,
        scope: raw?.scope === 'all' ? 'all' : 'answers',
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

  // ---------- DOM 选择器（知乎会改版，多备几套）----------
  const ANSWER_SEL = [
    '.List-item',
    '.AnswerItem',
    '[class*="AnswerItem"]',
    'div[itemprop="zhihu:answer"]',
    '.TopstoryItem',
  ].join(',')

  // 「精选评论」特征文案（作者开启后评论区/答主栏会出现）
  const FEATURED_PATTERNS = [
    /作者开启[了]?精选评论/,
    /开启[了]?精选评论/,
    /评论精选/,
    /仅显示精选评论/,
    /只显示作者认可的评论/,
  ]

  const normalize = (s) => (s || '').normalize('NFC').toLowerCase()

  function textOf(el) {
    return normalize(el?.innerText || el?.textContent || '')
  }

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
    const t = textOf(el)
    return FEATURED_PATTERNS.some((re) => re.test(el?.innerText || '') || re.test(t))
  }

  function cardOf(node) {
    return node?.closest?.(ANSWER_SEL) || node
  }

  function markHidden(card, reason) {
    if (!card || card.dataset.zhFilter === 'hidden') return
    card.dataset.zhFilter = 'hidden'
    card.dataset.zhFilterReason = reason
    card.style.setProperty('display', 'none', 'important')
    hiddenCount += 1
    updateBadge()
  }

  function markShown(card) {
    if (!card || card.dataset.zhFilter !== 'hidden') return
    delete card.dataset.zhFilter
    delete card.dataset.zhFilterReason
    card.style.removeProperty('display')
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
    const nodes = root.querySelectorAll?.(ANSWER_SEL) || []
    nodes.forEach(evaluate)
  }

  // ---------- 调试 / 面板 ----------
  function ensureBadge() {
    let el = document.getElementById('zh-filter-badge')
    if (el) return el
    el = document.createElement('div')
    el.id = 'zh-filter-badge'
    el.style.cssText = [
      'position:fixed',
      'right:12px',
      'bottom:12px',
      'z-index:2147483000',
      'background:rgba(15,23,42,.88)',
      'color:#e2e8f0',
      'font:12px/1.4 system-ui,sans-serif',
      'padding:6px 10px',
      'border-radius:999px',
      'cursor:pointer',
      'box-shadow:0 4px 14px rgba(0,0,0,.25)',
      'user-select:none',
    ].join(';')
    el.title = '点击切换「临时显示已隐藏回答」'
    el.addEventListener('click', () => {
      const showing = el.dataset.peek === '1'
      el.dataset.peek = showing ? '0' : '1'
      document.querySelectorAll('[data-zh-filter="hidden"]').forEach((card) => {
        if (showing) card.style.setProperty('display', 'none', 'important')
        else card.style.setProperty('display', '', 'important')
      })
      updateBadge()
    })
    document.documentElement.appendChild(el)
    return el
  }

  function updateBadge() {
    const el = ensureBadge()
    const peek = el.dataset.peek === '1'
    el.textContent = peek
      ? `知乎过滤 · 临时显示 ${hiddenCount}`
      : `知乎过滤 · 已隐藏 ${hiddenCount}（点击预览）`
  }

  function promptKeywords() {
    const raw = window.prompt(
      '屏蔽关键词（逗号 / 换行分隔，留空清空）\n当前：' +
        (cfg.keywords.join('、') || '（无）'),
      cfg.keywords.join(', '),
    )
    if (raw === null) return
    cfg.keywords = raw
      .split(/[,，\n]/)
      .map((s) => s.trim())
      .filter(Boolean)
    saveCfg()
    hiddenCount = 0
    document.querySelectorAll('[data-zh-filter]').forEach((c) => {
      delete c.dataset.zhFilter
      delete c.dataset.zhFilterReason
      c.style.removeProperty('display')
    })
    scan()
  }

  function toggleFeatured() {
    cfg.blockFeaturedComments = !cfg.blockFeaturedComments
    saveCfg()
    hiddenCount = 0
    document.querySelectorAll('[data-zh-filter]').forEach((c) => {
      delete c.dataset.zhFilter
      delete c.dataset.zhFilterReason
      c.style.removeProperty('display')
    })
    scan()
    window.alert(
      cfg.blockFeaturedComments ? '已开启：过滤「精选评论」回答' : '已关闭：不再按精选评论过滤',
    )
  }

  // ---------- 启动 ----------
  function boot() {
    ensureBadge()
    scan()
    const mo = new MutationObserver((muts) => {
      for (const m of muts) {
        for (const n of m.addedNodes) {
          if (n.nodeType !== 1) continue
          if (n.matches?.(ANSWER_SEL)) evaluate(n)
          scan(n)
        }
      }
    })
    mo.observe(document.documentElement, { childList: true, subtree: true })

    // SPA 路由切换后重扫
    let last = location.href
    setInterval(() => {
      if (location.href !== last) {
        last = location.href
        setTimeout(scan, 400)
      }
    }, 800)
  }

  if (typeof GM_registerMenuCommand === 'function') {
    GM_registerMenuCommand('设置屏蔽关键词…', promptKeywords)
    GM_registerMenuCommand('切换：过滤「精选评论」回答', toggleFeatured)
    GM_registerMenuCommand('立即重新扫描', () => scan())
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true })
  } else {
    boot()
  }
})()
