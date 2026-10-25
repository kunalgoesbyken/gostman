import React from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from './ui/button'
import { EmptyState } from './ui/emptyState'
import { APP_TEXT } from '../lib/appText'

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="h-dvh overflow-y-auto bg-background">
        <EmptyState
          icon={AlertTriangle}
          title={APP_TEXT.crash.title}
          description={APP_TEXT.crash.description(String(this.state.error))}
          className="whitespace-pre-line"
          action={<Button onClick={() => window.location.reload()}>{APP_TEXT.crash.reload}</Button>}
        />
      </div>
    )
  }
}
