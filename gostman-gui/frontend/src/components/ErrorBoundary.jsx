import React from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from './ui/button'
import { EmptyState } from './ui/emptyState'

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
      <div className="h-screen overflow-y-auto bg-background">
        <EmptyState
          icon={AlertTriangle}
          title="Something went wrong"
          description={String(this.state.error)}
          action={<Button onClick={() => window.location.reload()}>Reload</Button>}
        />
      </div>
    )
  }
}
