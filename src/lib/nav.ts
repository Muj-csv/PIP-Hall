// Which top-bar destination a route belongs to, so the bar can mark where you are (D-079).

/** Where each top-bar destination counts as "here" (D-079): the current one is marked, not by colour alone. */
export function navSection(pathname: string): 'hall' | 'museum' | 'mart' | 'admin' | 'card' | null {
  if (pathname === '/' || pathname.startsWith('/member/')) return 'hall';
  if (pathname.startsWith('/museum')) return 'museum';
  if (pathname.startsWith('/mart')) return 'mart';
  if (pathname.startsWith('/admin')) return 'admin';
  if (pathname.startsWith('/edit') || pathname.startsWith('/login') || pathname.startsWith('/settings')) return 'card';
  return null;
}
