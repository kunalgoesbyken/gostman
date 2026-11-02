import { Prec, StateEffect, StateField } from '@codemirror/state'
import { Decoration, EditorView, ViewPlugin, WidgetType, keymap } from '@codemirror/view'

const CONTEXT_BEFORE = 4000
const CONTEXT_AFTER = 1000
const IDLE_MS = 700
const TYPED_EVENT = 'input.type'

const setSuggestion = StateEffect.define()

class GhostWidget extends WidgetType {
  constructor(text) {
    super()
    this.text = text
  }

  eq(other) {
    return other.text === this.text
  }

  toDOM() {
    const span = document.createElement('span')
    span.className = 'cm-ghost-text'
    span.setAttribute('aria-hidden', 'true')
    span.textContent = this.text
    return span
  }
}

const suggestionField = StateField.define({
  create: () => null,
  update(value, transaction) {
    const effect = transaction.effects.find((candidate) => candidate.is(setSuggestion))
    if (effect) return effect.value
    return transaction.docChanged || transaction.selection ? null : value
  },
  provide: (field) => EditorView.decorations.from(field, (value) => (
    value ? Decoration.set([Decoration.widget({ widget: new GhostWidget(value.text), side: 1 }).range(value.at)]) : Decoration.none
  )),
})

const wasTyped = (update) => update.docChanged && update.transactions.some((transaction) => transaction.isUserEvent(TYPED_EVENT))

function isAtLineEnd(state) {
  const selection = state.selection.main
  if (!selection.empty) return false
  const line = state.doc.lineAt(selection.head)
  const offset = selection.head - line.from
  return line.text.slice(0, offset).trim() !== '' && line.text.slice(offset).trim() === ''
}

function completionPlugin(complete) {
  return ViewPlugin.fromClass(class {
    constructor(view) {
      this.view = view
      this.timer = 0
      this.controller = null
    }

    update(update) {
      if (!update.docChanged && !update.selectionSet) return
      this.cancel()
      if (wasTyped(update) && isAtLineEnd(update.state)) this.timer = setTimeout(() => this.request(), IDLE_MS)
    }

    cancel() {
      clearTimeout(this.timer)
      this.controller?.abort()
      this.controller = null
    }

    async request() {
      const { state } = this.view
      const at = state.selection.main.head
      const controller = new AbortController()
      this.controller = controller
      const before = state.doc.sliceString(Math.max(0, at - CONTEXT_BEFORE), at)
      const after = state.doc.sliceString(at, Math.min(state.doc.length, at + CONTEXT_AFTER))
      const text = await complete(before, after, controller.signal)
      if (controller.signal.aborted || !text) return
      this.view.dispatch({ effects: setSuggestion.of({ at, text }) })
    }

    destroy() {
      this.cancel()
    }
  })
}

function accept(view) {
  const suggestion = view.state.field(suggestionField)
  if (!suggestion) return false
  view.dispatch({
    changes: { from: suggestion.at, insert: suggestion.text },
    selection: { anchor: suggestion.at + suggestion.text.length },
    userEvent: 'input.complete',
  })
  return true
}

function dismiss(view) {
  if (!view.state.field(suggestionField)) return false
  view.dispatch({ effects: setSuggestion.of(null) })
  return true
}

const ghostTheme = EditorView.baseTheme({
  '.cm-ghost-text': { color: 'hsl(var(--muted-foreground))', opacity: 0.7, whiteSpace: 'pre-wrap', pointerEvents: 'none' },
})

export const ghostText = (complete) => [
  suggestionField,
  completionPlugin(complete),
  Prec.highest(keymap.of([{ key: 'Tab', run: accept }, { key: 'Escape', run: dismiss }])),
  ghostTheme,
]
