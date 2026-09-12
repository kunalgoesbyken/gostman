import React, { useState, useEffect, useCallback } from "react"
import {
    Download, FileJson, FileText, FolderOpen,
    Check, Copy, FileCode
} from "lucide-react"
import { Button } from "./ui/button"
import {
    exportToOpenAPIJSON,
    exportToOpenAPIYAML,
    exportToPostman,
    exportToGostman,
    exportToMarkdown
} from "../lib/importExport"

const EXPORT_FORMATS = [
    { id: 'openapi-json', label: 'OpenAPI JSON', icon: FileCode, description: 'OpenAPI 3.0 spec (JSON)' },
    { id: 'openapi-yaml', label: 'OpenAPI YAML', icon: FileCode, description: 'OpenAPI 3.0 spec (YAML)' },
    { id: 'postman', label: 'Postman', icon: FileJson, description: 'Postman collection v2.1' },
    { id: 'markdown', label: 'Markdown', icon: FileText, description: 'API documentation' },
    { id: 'gostman', label: 'Gostman', icon: FolderOpen, description: 'Gostman backup (JSON)' }
]

// MIME types for each export format
const MIME_TYPES = {
    'openapi-json': 'application/json',
    'openapi-yaml': 'text/yaml',
    'postman': 'application/json',
    'markdown': 'text/markdown',
    'gostman': 'application/json'
}

export function ExportTab({ requests, folders, variables }) {
    const [selectedExportFormat, setSelectedExportFormat] = useState('openapi-json')
    const [exportPreview, setExportPreview] = useState('')
    const [copied, setCopied] = useState(false)

    // Memoize generateExport to avoid recreating on every render
    const generateExport = useCallback(() => {
        try {
            switch (selectedExportFormat) {
                case 'openapi-json':
                    setExportPreview(exportToOpenAPIJSON(requests || [], {
                        title: 'Gostman API Collection',
                        version: '1.0.0'
                    }))
                    break
                case 'openapi-yaml':
                    setExportPreview(exportToOpenAPIYAML(requests || [], {
                        title: 'Gostman API Collection',
                        version: '1.0.0'
                    }))
                    break
                case 'postman':
                    setExportPreview(JSON.stringify(exportToPostman(requests || [], folders || [], {
                        name: 'Gostman Collection'
                    }), null, 2))
                    break
                case 'markdown':
                    setExportPreview(exportToMarkdown(requests || [], {
                        title: 'API Documentation'
                    }))
                    break
                case 'gostman':
                    setExportPreview(JSON.stringify(exportToGostman(requests || [], folders || [], variables || {}), null, 2))
                    break
                default:
                    setExportPreview('')
            }
        } catch (err) {
            setExportPreview(`Error generating export: ${err.message}`)
        }
    }, [selectedExportFormat, requests, folders, variables])

    // Update export preview when format changes or data changes
    useEffect(() => {
        generateExport()
    }, [generateExport])

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(exportPreview)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch (err) {
            console.error('Copy failed:', err)
        }
    }

    const handleDownload = () => {
        const mimeType = MIME_TYPES[selectedExportFormat] || 'text/plain'
        const blob = new Blob([exportPreview], { type: mimeType })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url

        const extensions = {
            'openapi-json': 'json',
            'openapi-yaml': 'yaml',
            'postman': 'json',
            'markdown': 'md',
            'gostman': 'json'
        }
        a.download = `gostman-export.${extensions[selectedExportFormat] || 'txt'}`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    return (
        <div className="space-y-4">
            {/* Stats */}
            <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/20 border border-border/50">
                <div className="flex items-center gap-2">
                    <FileJson className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{requests?.length || 0} requests</span>
                </div>
                <div className="w-px h-4 bg-border/50" />
                <div className="flex items-center gap-2">
                    <FolderOpen className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{folders?.length || 0} folders</span>
                </div>
            </div>

            {/* Format Selection */}
            <div className="grid grid-cols-5 gap-2">
                {EXPORT_FORMATS.map((format) => {
                    const Icon = format.icon
                    const isActive = selectedExportFormat === format.id
                    return (
                        <button
                            key={format.id}
                            onClick={() => setSelectedExportFormat(format.id)}
                            className={`
                          flex flex-col items-center gap-2 p-3 rounded-lg border transition-all
                          ${isActive
                                    ? 'bg-primary/10 border-primary/30 shadow-sm'
                                    : 'bg-muted/10 border-border/30 hover:border-border/50'
                                }
                        `}
                        >
                            <Icon className={`h-4 w-4 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                            <span className={`text-[10px] font-medium text-center ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
                                {format.label}
                            </span>
                        </button>
                    )
                })}
            </div>

            {/* Preview */}
            <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-background via-card to-background rounded-xl" />
                <pre className="relative overflow-x-auto rounded-xl p-4 text-sm leading-relaxed border border-white/5 shadow-xl max-h-80">
                    <code className="font-mono text-foreground whitespace-pre-wrap">{exportPreview || '// Export preview will appear here'}</code>
                </pre>

                {/* Action buttons */}
                <div className="absolute right-3 top-3 flex items-center gap-2">
                    <Button
                        size="sm"
                        onClick={handleCopy}
                        variant="secondary"
                        className="gap-1.5 shadow-lg bg-muted/80 backdrop-blur-sm"
                    >
                        {copied ? (
                            <>
                                <Check className="h-3.5 w-3.5" />
                                <span className="text-xs">Copied</span>
                            </>
                        ) : (
                            <>
                                <Copy className="h-3.5 w-3.5" />
                                <span className="text-xs">Copy</span>
                            </>
                        )}
                    </Button>
                    <Button
                        size="sm"
                        onClick={handleDownload}
                        className="gap-1.5 shadow-lg bg-primary hover:bg-primary/90"
                    >
                        <Download className="h-3.5 w-3.5" />
                        <span className="text-xs">Download</span>
                    </Button>
                </div>
            </div>
        </div>
    )
}
