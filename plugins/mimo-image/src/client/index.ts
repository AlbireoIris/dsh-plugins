/**
 * Browser half: MiMo-style image cards for
 * conversation.message.images / conversation.trajectory.images / tool.call.images.
 * A registration replaces the shipped gallery (slot kind is `single`).
 */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import { MimoImageGallery } from './MimoImageGallery.tsx'

export const inject = ['slots']

const SLOTS = [
  'conversation.message.images',
  'conversation.trajectory.images',
  'tool.call.images',
] as const

export function apply(ctx: Context): void {
  for (const name of SLOTS) {
    ctx.slots.inject(name, () => ctx.slots.register(
      { name, locale: 'conversation' },
      MimoImageGallery,
    ))
  }
}
