/**
 * Browser half: replace `conversation.chat.node` key `assistant-step`
 * so thinking chains are hidden (MiMo-faithful) and answers stay clean.
 * Reusing the key replaces the shipped renderer.
 */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import { MimoAssistantNodeView } from './MimoAssistantNodeView.tsx'

export const inject = ['slots']

export function apply(ctx: Context): void {
  ctx.slots.inject('conversation.chat.node', () => ctx.slots.register(
    {
      name: 'conversation.chat.node',
      key: 'assistant-step',
      locale: 'chat',
    },
    MimoAssistantNodeView,
  ))
}
