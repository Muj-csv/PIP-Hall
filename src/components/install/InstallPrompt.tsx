// "Install PIP-Hall" (FR-14, brief §10 InstallPrompt: android · ios-instructions). Android and
// desktop Chrome get the browser's own dialog; iPhone and iPad get the Add to Home Screen steps.
// Hidden once installed, and in browsers that can't install.

import { useEffect, useRef, useState } from 'react';
import { promptInstall, useInstallMode } from '../../lib/install';

export function InstallPrompt({ compact = false }: { compact?: boolean }) {
  const mode = useInstallMode();
  const [steps, setSteps] = useState(false);
  if (mode === 'installed' || mode === 'unsupported') return null;

  return (
    <div className={compact ? 'flex flex-wrap items-center justify-center gap-space-3' : 'grid gap-space-2'}>
      {!compact && <p className="m-0">Add PIP-Hall to your home screen: it opens full screen, like an app, and works offline.</p>}
      <button type="button" className="pixel-btn justify-self-start" onClick={() => (mode === 'prompt' ? void promptInstall() : setSteps(true))}>
        <span aria-hidden="true">▼ </span>Install PIP-Hall
      </button>
      {steps && <IosSteps onClose={() => setSteps(false)} />}
    </div>
  );
}

function IosSteps({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [opener] = useState(() => document.activeElement as HTMLElement | null);

  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => {
      d?.close();
      window.setTimeout(() => opener?.focus(), 0);
    };
  }, [opener]);

  return (
    <dialog
      ref={ref}
      className="install-sheet"
      aria-labelledby="install-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="menu-panel max-w-[420px]">
        <h2 id="install-title" className="panel-title">
          Install on iPhone or iPad
        </h2>
        <ol className="m-0 grid gap-space-2 pl-space-5">
          <li>
            Open this page in <strong>Safari</strong>.
          </li>
          <li>
            Tap <strong>Share</strong> <span aria-hidden="true">(the square with an arrow pointing up)</span>.
          </li>
          <li>
            Scroll down and tap <strong>Add to Home Screen</strong>.
          </li>
          <li>
            Tap <strong>Add</strong>. PIP-Hall appears on your home screen and opens full screen.
          </li>
        </ol>
        <button type="button" className="pixel-btn justify-self-start" data-variant="primary" onClick={onClose} autoFocus>
          Got it
        </button>
      </div>
    </dialog>
  );
}
