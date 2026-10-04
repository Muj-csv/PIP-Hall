import { createBrowserRouter } from 'react-router';
import Home from '../pages/Home';
import NotFound from '../pages/NotFound';

// Phase 1 routes. /explore, /member/:username, /login, /edit, /admin and /settings arrive in
// Phases 2–5 (ARCHITECTURE §7); until then they fall through to NotFound.
export const router = createBrowserRouter([
  { path: '/', element: <Home /> },
  { path: '*', element: <NotFound /> },
]);
