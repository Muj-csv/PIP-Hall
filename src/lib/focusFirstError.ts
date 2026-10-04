/** Moves focus to the first invalid field, in page order (Phase 3: "focus moves to the first error"). */
export function focusFirstError(root: HTMLElement | null, errors: Record<string, string>): void {
  if (!root) return;
  for (const el of root.querySelectorAll<HTMLElement>('[data-field]')) {
    if (errors[el.dataset.field!]) {
      const control = el.querySelector<HTMLElement>('input, textarea, select, button') ?? el;
      control.focus();
      control.scrollIntoView?.({ block: 'center' });
      return;
    }
  }
}
