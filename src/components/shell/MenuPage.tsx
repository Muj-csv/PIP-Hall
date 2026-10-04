import { useEffect, type ReactNode } from 'react';
import { TopBar } from './TopBar';

/** A menu screen outside the level (brief §3): one column of pixel panels. */
export function MenuPage({ title, children }: { title: string; children: ReactNode }) {
  useEffect(() => {
    document.title = `${title} · PIP-Hall`;
  }, [title]);
  return (
    <div className="mx-auto max-w-[1080px] px-space-4 pb-space-8">
      <TopBar />
      <main className="mx-auto mt-space-6 grid max-w-[640px] gap-space-4">
        <h1 className="m-0 font-display text-h1 font-normal">{title}</h1>
        {children}
      </main>
    </div>
  );
}

/** A bordered pixel panel for menu content. */
export function Panel({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <section className="menu-panel" aria-label={label}>
      {children}
    </section>
  );
}
