export default function ExplorerLoading() {
  return (
    <div className="app-shell mx-auto max-w-[1600px] px-4 py-10 md:px-8">
      <div className="grid animate-pulse gap-4 xl:grid-cols-[320px_minmax(0,1fr)_360px]">
        <div className="panel surface-soft min-h-[420px] rounded-[28px]" />
        <div className="panel surface-soft min-h-[620px] rounded-[32px]" />
        <div className="panel surface-soft min-h-[420px] rounded-[28px]" />
      </div>
    </div>
  );
}
