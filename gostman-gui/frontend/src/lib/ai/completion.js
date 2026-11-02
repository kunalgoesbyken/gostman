import { SCRIPT_API, fence, prompt } from './prompts'
import { ReplyError, parseModelObject, textField } from './reply'
import { SCHEMAS } from './schemas'
import { SCRIPT_PROMPT_KINDS } from './tasks'

export const COMPLETION_TOKENS = 256

const COMPLETION_LIMIT = 1000
const NAME_LIMIT = 200

export const completionPrompt = (scriptKind, before, after, names) => ({
  ...prompt(
    `Continue the ${SCRIPT_PROMPT_KINDS[scriptKind]} JavaScript at the cursor. Reply with {"completion": string} holding only the text to insert at the cursor, at most a few lines, or an empty string when nothing useful fits.\n${SCRIPT_API}`,
    fence('variable-names', names.slice(0, NAME_LIMIT)),
    fence('script-before-cursor', before),
    fence('script-after-cursor', after),
  ),
  schema: SCHEMAS.completion,
})

export function parseCompletion(text) {
  try {
    return textField(parseModelObject(text).completion, COMPLETION_LIMIT)
  } catch (error) {
    if (error instanceof ReplyError) return ''
    throw error
  }
}
