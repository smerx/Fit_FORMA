import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = {
  name: string
  children: ReactNode
  fallback?: ReactNode
}

type State = { crashed: boolean }

export class ToolsBoundary extends Component<Props, State> {
  state: State = { crashed: false }

  static getDerivedStateFromError(): State {
    return { crashed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn(`[tools:${this.props.name}]`, error, info.componentStack)
  }

  render() {
    if (this.state.crashed) {
      return (
        this.props.fallback ?? (
          <div className="rounded-2xl bg-white/5 px-4 py-3 text-sm text-white/40">
            Блок «{this.props.name}» отключился. Дневник еды работает как раньше.
          </div>
        )
      )
    }
    return this.props.children
  }
}
