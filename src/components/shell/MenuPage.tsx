import { useEffect, type ReactNode } from 'react';
import { TopBar } from './TopBar';

/** A menu screen outside the level (brief §3): one column of pixel panels. */
export function MenuPage({ title, children, wide = false }: { title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    document.title = `${title} · PIP-Hall`;
  }, [title]);
  return (
    <div className="mx-auto max-w-[1080px] px-space-4 pb-space-8">
      <TopBar />
      <main className={`mx-auto mt-space-6 grid gap-space-4 ${wide ? 'max-w-[1040px]' : 'max-w-[640px]'}`}>
        <h1 className="m-0 font-display text-h1 font-normal">{title}</h1>
        {children}
      </main>
    </div>
  );
}

/** A bordered pixel panel for menu content. */
export function Panel({ children, label, id }: { children: ReactNode; label?: string; id?: string }) {
  return (
    <section className="menu-panel" aria-label={label} id={id}>
      {children}
    </section>
  );
}
