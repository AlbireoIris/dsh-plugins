/**
 * Newest-first subagent catalog.
 *
 * Shadowing, not wrapping: `conversation.session.header.lineage` is a `single`
 * session-scoped cell, and slot composition replaces rather than decorates, so
 * the only way to change the catalog's row order is to answer the same cell
 * with a lower priority than the shipped owner. ui-subagent registers at the
 * default 0; -1 wins the cell and the shipped registration renders nothing.
 *
 * Keep this in step with ui-subagent's own registration: the component, its
 * dictionaries, and the injected catalog actions are copies of that plugin's,
 * and the single intentional difference is the `toReversed()` in
 * SubagentHeaderLineage.tsx's CatalogRows.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { SubagentAddress } from '@deepseek-ai/dsh-subagent/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { SubagentHeaderLineage, type SubagentCatalogInjected } from './SubagentHeaderLineage.tsx'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import { en, NS, zh, type SubagentKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Newest-first subagent catalog copy. */
    'subagent-newest-first': SubagentKey
  }
}

/** Required services for the lineage header seat. */
export const inject = ['sessions', 'slots', 'locale']

/**
 * Client plugin body: claim the lineage header cell for the newest-first
 * catalog.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'subagent-newest-first: dictionaries')
  const sessions = ctx.sessions
  const catalogActions = (_parentSessionId: SessionId): SubagentCatalogInjected => ({
    openChild(address: SubagentAddress) {
      sessions.openSubagent(address)
    },
    refresh(parentSessionId: SessionId) {
      void sessions.refreshSubagents(parentSessionId)
    },
    setCatalogOpen(parentSessionId: SessionId, open: boolean) {
      sessions.setSubagentCatalogOpen(parentSessionId, open)
    },
  })
  ctx.slots.inject(
    'conversation.session.header.lineage',
    () => ctx.slots.register({
      name: 'conversation.session.header.lineage',
      priority: -1,
      locale: NS,
      inject: catalogActions,
    }, SubagentHeaderLineage),
  )
}
