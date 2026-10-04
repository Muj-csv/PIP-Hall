import { useEffect, useState } from 'react';

/** While a screen's code downloads. Waits a beat so fast loads don't flash a message. */
export function RouteLoading() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setShow(true), 400);
    return () => window.clearTimeout(id);
  }, []);
  return (
    <p className="m-0 p-space-6 text-center font-display tracking-[0.06em]" role="status">
      {show ? 'LOADING…' : ''}
    </p>
  );
}
