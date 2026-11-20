export function DemoBanner() {
  return (
    <div className="bg-brass-soft text-foreground">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2 text-sm sm:px-6">
        <p>
          <span className="font-medium">Sample Owner Portal</span>
          <span className="text-foreground/80"> (demo data)</span>
        </p>
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <a href="tel:2288754496" className="font-medium text-sea underline-offset-2 hover:underline">
            Call 228-875-4496
          </a>
          <a
            href="https://www.raindev.com"
            className="font-medium text-sea underline-offset-2 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            raindev.com
          </a>
        </p>
      </div>
    </div>
  );
}
