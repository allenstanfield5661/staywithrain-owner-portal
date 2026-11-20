import type { Metadata } from "next";
import { Suspense } from "react";
import { DemoPortal } from "@/components/demo-portal";
import { PortalSkeleton } from "@/components/portal-skeleton";
import { currentInstant } from "@/lib/clock";
import { buildDemoModel, firstQuery } from "@/lib/demo-sample";

export const metadata: Metadata = {
  title: "Sample Owner Portal",
  description: "A sample Stay with Rain owner portal with two fictional Ocean Springs homes.",
};

export default function DemoPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<PortalSkeleton />}>
      <DemoContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function DemoContent({
  params,
  searchParams,
}: {
  params: Promise<{ slug?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const now = await currentInstant();
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const model = buildDemoModel({
    now,
    view: slug?.[0],
    unit: firstQuery(query.unit),
    month: firstQuery(query.month),
    channel: firstQuery(query.channel),
    stay: firstQuery(query.stay),
    scope: firstQuery(query.scope),
    statement: firstQuery(query.statement),
  });
  return <DemoPortal model={model} />;
}
