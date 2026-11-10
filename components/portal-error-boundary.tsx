"use client";

import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

type Props = { children: ReactNode; title?: string };
type State = { error: string | null };

export class PortalErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error: error instanceof Error ? error.message : "Something went wrong." };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="rounded-2xl bg-card px-5 py-8 ring-1 ring-foreground/10">
        <h1 className="font-heading text-3xl tracking-tight text-sea">{this.props.title ?? "This section could not be shown"}</h1>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground">
          Your booking data was not changed. Try again, or go back to the previous page.
        </p>
        <Button type="button" className="mt-6 w-fit" onClick={() => this.setState({ error: null })}>
          Try again
        </Button>
      </div>
    );
  }
}
