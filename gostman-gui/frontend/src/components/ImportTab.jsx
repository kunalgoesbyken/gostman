import React, { useState, useRef, useCallback, useEffect } from "react"
import {
    Upload, FileJson, FolderOpen,
    Check, AlertCircle, Loader2
} from "lucide-react"
import { Button } from "./ui/button"
import { Badge } from "./ui/badge"
import {
    parsePostmanCollection,
    parseOpenAPISpec,
    detectImportFormat,
    importGostman,
    MAX_FILE_SIZE
} from "../lib/importExport"

const IMPORT_FORMATS = [
    { id: 'postman', label: 'Postman', icon: FileJson, description: 'Import Postman collections' },
    { id: 'openapi', label: 'OpenAPI', icon: FileJson, description: 'Import OpenAPI 3.x specs (JSON/YAML)' },
    { id: 'gostman', label: 'Gostman', icon: FolderOpen, description: 'Import Gostman backup' }
]

// Debounce delay in milliseconds
const DEBOUNCE_DELAY = 300

export function ImportTab({ onImport, onClose }) {
    const [importJson, setImportJson] = useState('')
    const [importResult, setImportResult] = useState(null)
    const [isParsing, setIsParsing] = useState(false)
    const [isPending, setIsPending] = useState(false)
    const [processingStep, setProcessingStep] = useState(null)
    const [fileName, setFileName] = useState(null)
    const [isDropZoneFocused, setIsDropZoneFocused] = useState(false)
    const fileInputRef = useRef(null)
    const debounceTimerRef = useRef(null)
    const dropZoneRef = useRef(null)

    // Debounced process function with visual feedback
    const debouncedProcessImport = useCallback((jsonString) => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current)
        }

        // Show pending state immediately when typing starts
        setIsPending(true)
        setProcessingStep('Waiting for input to settle...')

        debounceTimerRef.current = setTimeout(() => {
            processImport(jsonString)
        }, DEBOUNCE_DELAY)
    }, [])

    // Cleanup on unmount - cancel any pending debounced operations
    useEffect(() => {
        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current)
            }
            setIsPending(false)
            setProcessingStep(null)
        }
    }, [])

    const handleDropZoneClick = () => {
        fileInputRef.current?.click()
    }

    const handleDropZoneKeyDown = (e) => {
        // Activate on Enter or Space key
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleDropZoneClick()
        }
    }

    const handleFileUpload = (e) => {
        const file = e.target.files?.[0]
        if (!file) return

        // File size validation (10MB max)
        if (file.size > MAX_FILE_SIZE) {
            const sizeInMB = (file.size / (1024 * 1024)).toFixed(2)
            setImportResult({
                success: false,
                error: `File size (${sizeInMB}MB) exceeds maximum allowed size of 10MB. Please use a smaller file.`
            })
            // Reset file input so user can retry
            if (fileInputRef.current) {
                fileInputRef.current.value = ''
            }
            return
        }

        setFileName(file.name)
        setProcessingStep('Reading file...')

        const reader = new FileReader()

        // Add error handler for FileReader
        reader.onerror = () => {
            setImportResult({
                success: false,
                error: 'Failed to read file. The file may be corrupted or in an unsupported format.'
            })
            setIsParsing(false)
            setIsPending(false)
            setProcessingStep(null)
            // Reset file input so user can retry
            if (fileInputRef.current) {
                fileInputRef.current.value = ''
            }
        }

        reader.onabort = () => {
            setImportResult({
                success: false,
                error: 'File reading was aborted.'
            })
            setIsParsing(false)
            setIsPending(false)
            setProcessingStep(null)
            // Reset file input so user can retry
            if (fileInputRef.current) {
                fileInputRef.current.value = ''
            }
        }

        reader.onload = (event) => {
            const content = event.target?.result
            if (typeof content === 'string') {
                setImportJson(content)
                processImport(content, file.name)
            } else {
                setImportResult({
                    success: false,
                    error: 'Failed to read file content. Please ensure the file is a valid text file.'
                })
                setIsParsing(false)
                setIsPending(false)
                setProcessingStep(null)
                // Reset file input so user can retry
                if (fileInputRef.current) {
                    fileInputRef.current.value = ''
                }
            }
        }

        reader.readAsText(file)
    }

    const processImport = async (jsonString, name = null) => {
        setIsParsing(true)
        setIsPending(false)
        setProcessingStep(name ? `Processing ${name}...` : 'Processing content...')

        try {
            const format = detectImportFormat(jsonString)

            if (format === 'postman') {
                setProcessingStep('Parsing Postman collection...')
                const result = parsePostmanCollection(jsonString)
                if (result.success) {
                    // Check for empty imports
                    if (result.requests.length === 0 && result.folders.length === 0) {
                        setImportResult({
                            success: false,
                            error: 'This Postman collection contains no requests or folders. Please check that the collection is not empty.'
                        })
                    } else {
                        setImportResult({
                            success: true,
                            format: 'postman',
                            requestsCount: result.requests.length,
                            foldersCount: result.folders.length,
                            warnings: result.warnings || [],
                            data: result
                        })
                    }
                } else {
                    setImportResult({
                        success: false,
                        error: result.error
                    })
                }
            } else if (format === 'openapi') {
                setProcessingStep('Validating OpenAPI spec...')
                const result = await parseOpenAPISpec(jsonString)
                if (result.success) {
                    // Check for empty imports
                    if (result.requests.length === 0 && result.folders.length === 0) {
                        setImportResult({
                            success: false,
                            error: 'This OpenAPI spec contains no paths or operations. Please check that the spec defines at least one endpoint.'
                        })
                    } else {
                        setImportResult({
                            success: true,
                            format: 'openapi',
                            requestsCount: result.requests.length,
                            foldersCount: result.folders.length,
                            warnings: result.warnings || [],
                            data: result
                        })
                    }
                } else {
                    setImportResult({
                        success: false,
                        error: result.error
                    })
                }
            } else if (format === 'gostman') {
                setProcessingStep('Parsing Gostman export...')
                try {
                    const data = JSON.parse(jsonString)
                    const result = importGostman(data)
                    if (result.success) {
                        // Check for empty imports
                        if (result.requests.length === 0 && result.folders.length === 0) {
                            setImportResult({
                                success: false,
                                error: 'This Gostman export contains no requests or folders. Please check that the export is not empty.'
                            })
                        } else {
                            setImportResult({
                                success: true,
                                format: 'gostman',
                                requestsCount: result.requests.length,
                                foldersCount: result.folders.length,
                                warnings: [],
                                data: result
                            })
                        }
                    } else {
                        setImportResult({
                            success: false,
                            error: result.error
                        })
                    }
                } catch (err) {
                    setImportResult({
                        success: false,
                        error: err?.message || 'An unexpected error occurred during import'
                    })
                }
            } else {
                setImportResult({
                    success: false,
                    error: 'Could not detect format. Please upload a valid Postman collection, OpenAPI spec, or Gostman export.'
                })
            }
        } catch (err) {
            setImportResult({
                success: false,
                error: err?.message || 'An unexpected error occurred during import'
            })
            console.error('Import error:', err)
        } finally {
            setIsParsing(false)
            setIsPending(false)
            setProcessingStep(null)
        }
    }

    const handleImport = () => {
        if (importResult?.success && onImport) {
            // Double-check we have actual content to import
            if (importResult.requestsCount > 0 || importResult.foldersCount > 0) {
                onImport(importResult.data)
                onClose()
            }
        }
    }

    const canImport = importResult?.success &&
                      (importResult.requestsCount > 0 || importResult.foldersCount > 0)

    return (
        <div className="space-y-6">
            {/* File Upload */}
            <div
                ref={dropZoneRef}
                tabIndex="0"
                role="button"
                aria-label="File upload area. Press Enter or Space to browse for files."
                onClick={handleDropZoneClick}
                onKeyDown={handleDropZoneKeyDown}
                onFocus={() => setIsDropZoneFocused(true)}
                onBlur={() => setIsDropZoneFocused(false)}
                className={`
                    border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer
                    ${isDropZoneFocused
                        ? 'border-primary bg-primary/5 ring-2 ring-ring ring-offset-2'
                        : 'border-border/50 hover:border-primary/50'
                    }
                `}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,.yaml,.yml"
                    onChange={handleFileUpload}
                    className="hidden"
                />
                <div className="flex flex-col items-center gap-3 pointer-events-none">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                        <Upload className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <p className="text-sm font-medium">Drop a file here or click to browse</p>
                        <p className="text-xs text-muted-foreground mt-1">
                            Supports Postman collections, OpenAPI specs (JSON/YAML), and Gostman exports
                            <br />
                            <span className="text-[10px] opacity-70">Maximum file size: 10MB</span>
                        </p>
                    </div>
                    <Button
                        size="sm"
                        variant="outline"
                        className="mt-2 pointer-events-auto"
                        disabled={isParsing}
                    >
                        Choose File
                    </Button>
                </div>
            </div>

            <div className="flex items-center gap-2 my-4">
                <div className="h-px bg-border/50 flex-1" />
                <span className="text-xs text-muted-foreground uppercase">Or paste content</span>
                <div className="h-px bg-border/50 flex-1" />
            </div>

            <div className="space-y-2">
                <div className="relative">
                    <textarea
                        className="flex min-h-[150px] w-full rounded-md border border-border bg-background/50 backdrop-blur-sm px-3 py-2 text-sm shadow-sm transition-all duration-200 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50 font-mono resize-none"
                        placeholder="Paste Postman collection, OpenAPI spec, or Gostman export JSON here..."
                        value={importJson}
                        disabled={isParsing}
                        onChange={(e) => {
                            setImportJson(e.target.value)
                            if (e.target.value.trim()) {
                                debouncedProcessImport(e.target.value)
                            } else {
                                // Clear input - cancel any pending debounced operations
                                if (debounceTimerRef.current) {
                                    clearTimeout(debounceTimerRef.current)
                                    debounceTimerRef.current = null
                                }
                                setImportResult(null)
                                setIsPending(false)
                                setProcessingStep(null)
                            }
                        }}
                    />
                    {/* Processing indicator overlay */}
                    {(isParsing || isPending) && (
                        <div className="absolute bottom-2 right-2 flex items-center gap-2 text-xs text-muted-foreground bg-background/90 px-2 py-1 rounded">
                            {isParsing ? (
                                <>
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    <span>{processingStep || 'Processing...'}</span>
                                </>
                            ) : (
                                <span>Waiting...</span>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Import Result */}
            {importResult && (
                <div
                    className={`
                        rounded-xl p-4 border
                        ${importResult.success
                            ? 'bg-success/10 border-success/20'
                            : 'bg-destructive/10 border-destructive/20'
                        }
                    `}
                    role={importResult.success ? 'status' : 'alert'}
                    aria-live={importResult.success ? 'polite' : 'assertive'}
                >
                    <div className="flex items-start gap-3">
                        {importResult.success ? (
                            <Check className="h-5 w-5 text-success shrink-0 mt-0.5" />
                        ) : (
                            <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                            {importResult.success ? (
                                <div>
                                    <p className="text-sm font-medium text-success">
                                        Successfully imported {importResult.format} collection
                                        {fileName && ` from ${fileName}`}
                                    </p>
                                    <div className="flex items-center gap-3 mt-2">
                                        <Badge variant="secondary" className="text-xs">
                                            {importResult.requestsCount} requests
                                        </Badge>
                                        <Badge variant="secondary" className="text-xs">
                                            {importResult.foldersCount} folders
                                        </Badge>
                                        {Array.isArray(importResult.warnings) && importResult.warnings.length > 0 && (
                                            <Badge variant="outline" className="text-xs text-warning border-warning">
                                                {importResult.warnings.length} warning{importResult.warnings.length > 1 ? 's' : ''}
                                            </Badge>
                                        )}
                                    </div>
                                    {Array.isArray(importResult.warnings) && importResult.warnings.length > 0 && (
                                        <div className="mt-2 p-2 bg-warning/10 border border-warning/20 rounded">
                                            <p className="text-xs text-warning dark:text-warning">
                                                {importResult.warnings.map((w, i) => (
                                                    <span key={i}>• {w}</span>
                                                )).reduce((acc, curr) => (
                                                    <>
                                                        {acc}<br/>{curr}
                                                    </>
                                                ))}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <p className="text-sm text-destructive whitespace-pre-wrap">{importResult.error}</p>
                            )}
                        </div>
                        {canImport && (
                            <Button size="sm" onClick={handleImport} className="shrink-0" disabled={isParsing}>
                                Confirm Import
                            </Button>
                        )}
                    </div>
                </div>
            )}

            {/* Format Info Cards */}
            <div className="grid grid-cols-2 gap-3">
            {IMPORT_FORMATS.map((format) => {
                    const Icon = format.icon
                    return (
                        <div
                            key={format.id}
                            className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-muted/20"
                        >
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                                <Icon className="h-4 w-4 text-primary" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium">{format.label}</p>
                                <p className="text-[10px] text-muted-foreground truncate">{format.description}</p>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
