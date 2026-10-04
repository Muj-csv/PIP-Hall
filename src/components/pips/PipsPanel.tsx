// Settings → PIPs (FR-E1-08): the member's private balance and newest ledger entries.

import { useEffect, useState } from 'react';
import { formatPips, reasonLabel } from '../../lib/pips';
import { pipService } from '../../services/pipService';
import type { Achievement, LedgerEntry, PipSummary } from '../../types/pips';
import { DialogueBox } from '../dialogue/DialogueBox';
import { Panel } from '../shell/MenuPage';

type Load = { status: 'loading' } | { status: 'error' } | { status: 'ready'; summary: PipSummary; history: LedgerEntry[]; catalog: Achievement[] };

export function PipsPanel() {
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let on = true;
    Promise.all([pipService.summary(), pipService.history(), pipService.catalog()])
      .then(([summary, history, catalog]) => on && setLoad({ status: 'ready', summary, history, catalog }))
      .catch(() => on && setLoad({ status: 'error' }));
    return () => {
      on = false;
    };
  }, [attempt]);

  return (
    <Panel label="PIPs">
      <h2 className="panel-title">PIPs</h2>
      {load.status === 'loading' && <DialogueBox text="Counting your PIPs…" emote="pending" />}
      {load.status === 'error' && (
        <DialogueBox text="Can’t load your PIPs right now. Check your connection and try again." emote="attention">
          <button
            type="button"
            className="hw-btn"
            data-variant="small"
            onClick={() => {
              setLoad({ status: 'loading' });
              setAttempt((a) => a + 1);
            }}
          >
            RETRY
          </button>
        </DialogueBox>
      )}
      {load.status === 'ready' && (
        <>
          <p className="m-0 font-display text-h3 tracking-[0.04em]">
            <span aria-hidden="true">● </span>
            {formatPips(load.summary.balance)} PIPs
          </p>
          <p className="m-0 text-caption text-text-secondary">Only you can see this. You earn PIPs by discovering members and when your projects go live.</p>
          {!load.summary.eligible && (
            <DialogueBox text="PIPs start once an admin approves your card into the hall. Until then you can still browse." emote="pending" />
          )}
          {load.history.length === 0
            ? load.summary.eligible && <DialogueBox text="No PIPs yet: open another member’s profile to earn your first." />
            : (
              <ol className="pip-history" aria-label="PIP history">
                {load.history.map((e) => (
                  <li key={e.id}>
                    <span>{reasonLabel(e, load.catalog)}</span>
                    <time className="text-caption text-text-secondary" dateTime={e.created_at}>
                      {new Date(e.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </time>
                    <b className="font-mono">{e.amount > 0 ? `+${e.amount}` : e.amount}</b>
                  </li>
                ))}
              </ol>
            )}
        </>
      )}
    </Panel>
  );
}
