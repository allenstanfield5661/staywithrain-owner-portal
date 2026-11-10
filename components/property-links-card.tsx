"use client";

import { useEffect, useState } from "react";
import { BookOpen, Check, Copy, ExternalLink, MessageSquare, Share2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PropertyLinksCard({
  bookingUrl,
  welcomeGuideUrl,
  propertyName,
}: {
  bookingUrl: string | null;
  welcomeGuideUrl: string | null;
  propertyName: string;
}) {
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  if (!bookingUrl && !welcomeGuideUrl) return null;

  async function copyLink() {
    if (!bookingUrl) return;
    try {
      await navigator.clipboard.writeText(bookingUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  async function shareLink() {
    if (!bookingUrl || !navigator.share) return;
    try {
      await navigator.share({ title: propertyName, text: `Book ${propertyName} directly`, url: bookingUrl });
    } catch {
      // The guest cancelled the share sheet.
    }
  }

  const smsHref = bookingUrl ? `sms:?&body=${encodeURIComponent(bookingUrl)}` : null;

  return (
    <section className="rounded-2xl bg-card px-5 py-5 ring-1 ring-foreground/10">
      <h2 className="font-heading text-2xl tracking-tight text-sea sm:text-3xl">
        {bookingUrl ? "Book direct" : "Welcome guide"}
      </h2>
      {bookingUrl ? <p className="mt-2 break-all text-sm text-muted-foreground">{bookingUrl}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {bookingUrl ? (
          <a
            href={bookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: "default" }))}
          >
            <ExternalLink data-icon="inline-start" />
            Book direct
          </a>
        ) : null}
        {bookingUrl ? (
          <Button type="button" variant="outline" onClick={() => void copyLink()}>
            {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
            {copied ? "Copied" : "Copy link"}
          </Button>
        ) : null}
        {bookingUrl && canShare ? (
          <Button type="button" variant="outline" onClick={() => void shareLink()}>
            <Share2 data-icon="inline-start" />
            Share
          </Button>
        ) : null}
        {smsHref ? (
          <a href={smsHref} className={cn(buttonVariants({ variant: "outline" }))}>
            <MessageSquare data-icon="inline-start" />
            Text
          </a>
        ) : null}
        {welcomeGuideUrl ? (
          <a
            href={welcomeGuideUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            <BookOpen data-icon="inline-start" />
            Welcome guide
          </a>
        ) : null}
      </div>
    </section>
  );
}
