import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AVATAR_SIZE, avatarSpec, drawAvatar } from '../../lib/avatar';
import { cssVarReader } from '../../lib/sprites';
import { publicImageUrl } from '../../services/storageService';

interface Props {
  username: string;
  name: string;
  avatarPath: string | null;
  /** Overrides the stored photo (the editor's unsaved pick). */
  photoUrl?: string | null;
}

/** The member's photo, or a generated sprite when there is none or it fails to load. */
export function PixelAvatar({ username, name, avatarPath, photoUrl }: Props) {
  const url = photoUrl ?? publicImageUrl('avatars', avatarPath);
  const [failed, setFailed] = useState<string | null>(null);

  if (url && failed !== url) {
    return <img className="photo" src={url} alt={`Photo of ${name}`} loading="lazy" decoding="async" onError={() => setFailed(url)} />;
  }
  return <GeneratedAvatar username={username} name={name} />;
}

function GeneratedAvatar({ username, name }: { username: string; name: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const spec = useMemo(() => avatarSpec(username), [username]);

  // The badge looks the same in DAY and NIGHT, so this never needs a theme redraw.
  useLayoutEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const read = cssVarReader(c);
    drawAvatar(ctx, spec, { ink: read('--color-card-ink'), body: read(spec.bodyToken), eye: read('--color-card-face') });
  }, [spec]);

  return (
    <canvas
      ref={ref}
      width={AVATAR_SIZE}
      height={AVATAR_SIZE}
      className="avatar pixelated"
      role="img"
      aria-label={`Generated avatar for ${name}`}
    />
  );
}
