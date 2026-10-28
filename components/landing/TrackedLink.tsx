"use client";

import Link from "next/link";
import type { ComponentProps } from "react";

import { trackEvent, type GymwikiEvent } from "@/lib/analytics/track";

/** <Link> die bij een klik een (privacyvriendelijk, lokaal) landing-event afgeeft; zie lib/analytics/track.ts. */
export function TrackedLink({ event, where, ...props }: ComponentProps<typeof Link> & { event: GymwikiEvent; where?: string }) {
  return <Link {...props} onClick={(e) => { props.onClick?.(e); trackEvent(event, where ? { plek: where } : {}); }} />;
}
