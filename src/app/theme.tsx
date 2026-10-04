// DAY / NIGHT / SYSTEM (D-004, FR-15). The exported theme switches on [data-theme="dark"], so the
// effective theme is always written to <html data-theme>, including when following the system.
// It is written at the moment the theme changes (not in an effect), so canvases that redraw in
// their own layout effects already read the new colours.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ThemeContext, type Theme, type ThemeChoice } from './themeContext';

const STORAGE_KEY = 'piphall-theme';
const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)');

function readChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch {
    // storage blocked: follow the system
  }
  return 'system';
}

function resolve(choice: ThemeChoice, systemDark: boolean): Theme {
  return choice === 'system' ? (systemDark ? 'dark' : 'light') : choice;
}

function apply(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.style.colorScheme = theme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoiceState] = useState<ThemeChoice>(readChoice);
  const [systemDark, setSystemDark] = useState(() => darkQuery().matches);
  const choiceRef = useRef(choice);
  const theme = resolve(choice, systemDark);

  // First paint: index.html already set the attribute; keep it in sync if it guessed differently.
  if (typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') !== theme) apply(theme);

  useEffect(() => {
    const q = darkQuery();
    const onChange = () => {
      if (choiceRef.current === 'system') apply(q.matches ? 'dark' : 'light');
      setSystemDark(q.matches);
    };
    q.addEventListener('change', onChange);
    return () => q.removeEventListener('change', onChange);
  }, []);

  const setChoice = useCallback(
    (c: ThemeChoice) => {
      choiceRef.current = c;
      apply(resolve(c, systemDark));
      setChoiceState(c);
      try {
        if (c === 'system') localStorage.removeItem(STORAGE_KEY);
        else localStorage.setItem(STORAGE_KEY, c);
      } catch {
        // storage blocked: the choice lasts for this visit only
      }
    },
    [systemDark],
  );

  const toggle = useCallback(() => setChoice(theme === 'dark' ? 'light' : 'dark'), [setChoice, theme]);

  const value = useMemo(() => ({ choice, theme, setChoice, toggle }), [choice, theme, setChoice, toggle]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
