import { Component, type ReactNode } from 'react';
import { RotateCcw, ShieldAlert } from 'lucide-react';

interface State { error: Error | null }

/**
 * Last line of defence for live demos: a render throw anywhere inside would
 * otherwise blank the entire app. The fallback explains, offers recovery, and
 * never touches the simulation or stored sessions.
 */
export class ErrorBoundary extends Component<{ children: ReactNode; area: string }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State { return { error }; }

  componentDidCatch(error: Error): void {
    // Local-only diagnostic; no telemetry leaves the machine.
    console.error(`[AVLON-DRISHTI:${this.props.area}]`, error);
  }

  private recover = () => {
    try { sessionStorage.removeItem('drishti.crash-loop-guard'); } catch { /* storage unavailable */ }
    this.setState({ error: null });
    window.location.hash = '#mission';
    window.location.reload();
  };

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return <div className="panel empty-inline large-empty crash-fallback" role="alert">
      <ShieldAlert size={35} />
      <p>Something broke on screen — your exercise data is safe.</p>
      <span>Saved sessions, the event log, and scores live in the local database, untouched by display errors. Reload to continue exactly where the server left off.</span>
      <button className="button primary" onClick={this.recover}><RotateCcw size={14} /> Reload training station</button>
      <code className="mono muted">{this.state.error.message}</code>
    </div>;
  }
}
