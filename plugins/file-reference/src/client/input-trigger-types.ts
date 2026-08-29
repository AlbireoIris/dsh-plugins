/**
 * Minimal local declaration of the input-trigger source contract. The real
 * shape lives in @deepseek-ai/dsh-client-ui-input-trigger/client; this repo
 * stays standalone by declaring only what this plugin reads.
 */
export interface InputTriggerCandidate {
  readonly name: string
  readonly description?: string
  readonly icon?: 'file' | 'folder' | 'session'
  readonly hint?: string
  readonly section?: string
  readonly value?: string
  readonly drill?: boolean
}

export interface InputTriggerPick {
  readonly candidate: InputTriggerCandidate
  readonly action: 'pick' | 'drill'
}

export type PickOutcome =
  | { readonly text: string }
  | undefined

export interface ClientSessionContext {
  readonly sessionId: string
}

export interface CandidateRequest {
  readonly query: string
  readonly signal: AbortSignal
}

export interface InputTriggerSource {
  readonly trigger: '@' | '/'
  readonly name: string
  readonly order?: number
  readonly showGroupTitle?: boolean
  candidates(
    session: ClientSessionContext,
    req: CandidateRequest,
  ): Promise<readonly InputTriggerCandidate[]>
  onPick(pick: InputTriggerPick): PickOutcome
}
