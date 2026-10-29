"use client";

import { Component, type ReactNode } from "react";

/**
 * Vangt een model dat niet te laden is (404, netwerk, kapotte GLB) op: de plattegrond blijft werken en het item toont de
 * fallback (het grijze "onbekend"-vakje) in plaats van de hele editor te laten crashen. Een nieuwe `resetKey` (bijv. een andere
 * model-URL) probeert het opnieuw.
 */
export class ModelErrorBoundary extends Component<{ fallback: ReactNode; resetKey: string; children: ReactNode }, { failedKey: string | null }> {
  state = { failedKey: null as string | null };

  static getDerivedStateFromError() {
    return { failedKey: "__failed__" };
  }

  componentDidCatch(error: unknown) {
    console.warn(`Model kon niet geladen worden (${this.props.resetKey}):`, error);
  }

  componentDidUpdate(previous: { resetKey: string }) {
    if (previous.resetKey !== this.props.resetKey && this.state.failedKey) this.setState({ failedKey: null });
  }

  render() {
    return this.state.failedKey ? this.props.fallback : this.props.children;
  }
}
