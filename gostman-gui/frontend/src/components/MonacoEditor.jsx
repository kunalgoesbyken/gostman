import Editor from '@monaco-editor/react'

const THEME_NAME = 'gostman-dark'

const THEME = {
    base: 'vs-dark',
    inherit: true,
    rules: [
        { token: 'string', foreground: '5eead4' },
        { token: 'number', foreground: 'fb923c' },
        { token: 'keyword', foreground: '22d3ee' },
        { token: 'comment', foreground: '6b7280', fontStyle: 'italic' },
        { token: 'type', foreground: 'a78bfa' },
        { token: 'variable', foreground: 'f0f9ff' },
    ],
    colors: {
        'editor.background': '#0c1222',
        'editor.foreground': '#f0f9ff',
        'editorLineNumber.foreground': '#475569',
        'editorLineNumber.activeForeground': '#22d3ee',
        'editor.selectionBackground': '#22d3ee40',
        'editor.lineHighlightBackground': '#1e293b',
        'editorCursor.foreground': '#22d3ee',
        'editorWhitespace.foreground': '#334155',
        'editorIndentGuide.background': '#1e293b',
        'editorIndentGuide.activeBackground': '#334155',
        'scrollbarSlider.background': '#334155',
        'scrollbarSlider.hoverBackground': '#475569',
        'scrollbarSlider.activeBackground': '#64748b',
    },
}

const defineTheme = (monaco) => monaco.editor.defineTheme(THEME_NAME, THEME)

export function MonacoEditor({ value, onChange, language = "json", path, height = "300px" }) {
    return (
        <Editor
            height={height}
            language={language}
            path={path}
            value={value}
            onChange={(next) => onChange?.({ target: { value: next || "" } })}
            beforeMount={defineTheme}
            theme={THEME_NAME}
            options={{
                minimap: { enabled: false },
                fontSize: 13,
                lineNumbers: "on",
                roundedSelection: false,
                scrollBeyondLastLine: false,
                automaticLayout: true,
                formatOnPaste: true,
                formatOnType: true,
                tabSize: 2,
                wordWrap: "on",
                suggest: {
                    showKeywords: true,
                },
                quickSuggestions: {
                    other: true,
                    strings: true,
                },
            }}
        />
    )
}
