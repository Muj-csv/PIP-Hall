// Admin → Affiliations → an affiliation's look (V2-22, D-135): the frame its members may wear
// (Member, Diamond or Cat-eye) and its logo, a PNG or WebP the admin uploads. The logo is printed
// in the frame's corner and is the affiliation's pin on members' bands. It lives in Storage as data;
// the code never holds a logo or a name. Taking the logo away takes the pin off every badge.

import { useId, useState } from 'react';
import { useSession } from '../../app/sessionContext';
import { martErrorMessage, martService } from '../../services/martService';
import { LOGO_MAX_BYTES, publicImageUrl, removeImage, uploadLogo } from '../../services/storageService';
import type { AffiliationFrame } from '../../types/mart';
import type { Affiliation } from '../../types/museum';
import { SelectField } from '../editor/fields';
import { FRAME_NAME } from '../../lib/looks';

const FRAMES: readonly { value: AffiliationFrame | ''; label: string }[] = [
  { value: '', label: 'No frame' },
  { value: 'member', label: 'Member (metal, prints NAME MEMBER)' },
  { value: 'diamond', label: 'Diamond (blue rails, white studs)' },
  { value: 'cateye', label: 'Cat-eye (red rails, white stepped trim)' },
];

interface Props {
  a: Affiliation;
  busy: boolean;
  /** Runs a change, shows its message, reloads the list; false when it failed (error shown above). */
  run: (move: () => Promise<void>, message: string) => Promise<boolean>;
}

export function AffiliationLook({ a, busy, run }: Props) {
  const { session } = useSession();
  const adminId = session.status === 'signed-in' ? session.user.id : null;
  const id = useId();
  const [problem, setProblem] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const logo = publicImageUrl('affiliation-logos', a.logo_path ?? null);

  const pick = async (file: File) => {
    setProblem(null);
    if (file.type !== 'image/png' && file.type !== 'image/webp') return setProblem('Use a PNG or WebP logo (a transparent background looks best).');
    if (file.size > LOGO_MAX_BYTES) return setProblem('Logos are up to 512 KB.');
    if (!adminId) return;
    setUploading(true);
    try {
      const path = await uploadLogo(adminId, file);
      const old = a.logo_path ?? null;
      const ok = await run(() => martService.setAffiliationLogo(a.key, path), `${a.name} has its logo. Its members see it on their frame and can wear it as a pin.`);
      if (ok && old) void removeImage('affiliation-logos', old).catch(() => undefined);
      if (!ok) void removeImage('affiliation-logos', path).catch(() => undefined);
    } catch (e) {
      setProblem(martErrorMessage(e));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="aff-look" role="group" aria-label={`${a.name}: frame and logo`}>
      <SelectField
        field={`aff-frame-${a.key}`}
        label="Frame for its members"
        value={(a.frame_key ?? '') as AffiliationFrame | ''}
        options={FRAMES}
        hint="Free for members with this affiliation; each chooses whether to wear it."
        onChange={(v) =>
          void run(
            () => martService.setAffiliationFrame(a.key, v || null),
            v ? `${a.name} members can now wear the ${FRAME_NAME[v]} frame.` : `${a.name} no longer gives a frame.`,
          )
        }
      />
      <div className="field">
        <span className="field-label" id={`${id}-label`}>
          Logo
        </span>
        <div className="flex flex-wrap items-center gap-space-2">
          {logo ? <img className="aff-logo" src={logo} alt={`${a.name} logo`} /> : <span className="field-hint">No logo yet.</span>}
          <label htmlFor={id} className="pixel-btn cursor-pointer" aria-busy={uploading}>
            {uploading ? 'Uploading…' : logo ? 'Change logo' : 'Upload logo'}
          </label>
          <input
            id={id}
            type="file"
            accept="image/png,image/webp"
            className="sr-only"
            aria-labelledby={`${id}-label`}
            aria-describedby={`${id}-hint`}
            disabled={busy || uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void pick(file);
            }}
          />
          {a.logo_path && (
            <button
              type="button"
              className="pixel-btn"
              disabled={busy || uploading}
              onClick={() => {
                const old = a.logo_path!;
                void run(() => martService.setAffiliationLogo(a.key, null), `${a.name}’s logo is gone from its frame and from every band.`).then((ok) => {
                  if (ok) void removeImage('affiliation-logos', old).catch(() => undefined);
                });
              }}
            >
              Remove logo
            </button>
          )}
        </div>
        <p id={`${id}-hint`} className="field-hint m-0">
          PNG or WebP, up to 512 KB, square works best. Use a logo only with its organization’s permission.
        </p>
        {problem && (
          <p className="field-error m-0" role="alert">
            <span aria-hidden="true">! </span>
            {problem}
          </p>
        )}
      </div>
    </div>
  );
}
