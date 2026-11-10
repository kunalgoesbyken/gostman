import { AlertTriangle, Download } from 'lucide-react'
import { CopyTextButton } from './CopyTextButton'
import { TextBody } from './TextBody'
import { Button } from './ui/button'
import { Notice, Toolbar } from './ui/panel'
import { formatBytes } from '../lib/byteSize'
import { isBase64 } from '../lib/response'
import { RESPONSE_TEXT } from '../lib/responseText'

const SENT_TEXT = RESPONSE_TEXT.sent

const byteLength = (text) => new Blob([text]).size

export function RequestBodyTab({ sent, onSave }) {
  const isBinary = isBase64(sent)
  const summary = [sent.contentType, formatBytes(sent.size)].filter(Boolean).join(' · ')
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Toolbar>
        <span dir="ltr" className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">{summary}</span>
        {!isBinary && <CopyTextButton text={sent.body} />}
        {onSave && !sent.truncated && (
          <Button variant="outline" size="sm" onClick={() => onSave(sent)}>
            <Download />
            {RESPONSE_TEXT.saveToFile}
          </Button>
        )}
      </Toolbar>
      {sent.truncated && <Notice tone="warning" icon={AlertTriangle}>{SENT_TEXT.truncated({ size: formatBytes(sent.size), shown: formatBytes(byteLength(sent.body)) })}</Notice>}
      {isBinary
        ? <Notice edge="">{SENT_TEXT.binary}</Notice>
        : <div className="min-h-0 flex-1 overflow-auto"><TextBody text={sent.body} /></div>}
    </div>
  )
}
