import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, Navigate, useLocation } from 'react-router';
import Home from '../pages/Home';
import NotFound from '../pages/NotFound';
import Login from '../pages/Login';
import AuthCallback from '../pages/AuthCallback';
import RouteError from '../pages/RouteError';
import { RouteLoading } from './RouteLoading';
import { RequireAdmin, RequireAuth } from './guards';

// Member and admin screens are lazy chunks, so visitors never download them (NFR-01).
// The router module is not hot-reloaded as a component, so these consts are fine here.
/* eslint-disable react-refresh/only-export-components */
const Edit = lazy(() => import('../pages/Edit'));
const Admin = lazy(() => import('../pages/Admin'));
const Privacy = lazy(() => import('../pages/Privacy'));
const Museum = lazy(() => import('../pages/Museum'));
const Exhibit = lazy(() => import('../pages/Exhibit'));
const Mart = lazy(() => import('../pages/Mart'));
const Settings = lazy(() => import('../pages/Settings'));
const Network = lazy(() => import('../pages/Network'));
// The showcase (V2-12): the kiosk, the print page and the check-in are lazy chunks too.
const Booth = lazy(() => import('../pages/Booth'));
const Print = lazy(() => import('../pages/Print'));
const CheckIn = lazy(() => import('../pages/CheckIn'));
/** /explore became the hall's search (D-072): old links and shared searches keep working. */
function ExploreRedirect() {
  const { search } = useLocation();
  return <Navigate to={{ pathname: '/', search }} replace />;
}
/* eslint-enable react-refresh/only-export-components */

const lazyPage = (node: ReactNode) => <Suspense fallback={<RouteLoading />}>{node}</Suspense>;

// One parent route so every screen shares the error screen (offline before a chunk was cached,
// or a crash) instead of the router's default.
export const router = createBrowserRouter([
  {
    errorElement: <RouteError />,
    children: [
      // The hall stays mounted between / and /member/:username, so opening a profile is a screen
      // change inside the device (iris), not a new page.
      { path: '/', element: <Home />, children: [{ path: 'member/:username', element: null }, { path: 'passport', element: null }] },
      { path: '/login', element: <Login /> },
      { path: '/auth/callback', element: <AuthCallback /> },
      { path: '/explore', element: <ExploreRedirect /> },
      { path: '/museum', element: lazyPage(<Museum />) },
      { path: '/museum/:id', element: lazyPage(<Exhibit />) },
      { path: '/privacy', element: lazyPage(<Privacy />) },
      { path: '/network', element: lazyPage(<Network />) },
      { path: '/booth', element: lazyPage(<Booth />) },
      { path: '/print', element: lazyPage(<Print />) },
      { path: '/checkin/:key', element: lazyPage(<CheckIn />) },
      { path: '/edit', element: <RequireAuth>{lazyPage(<Edit />)}</RequireAuth> },
      { path: '/create', element: <Navigate to="/edit" replace /> },
      { path: '/mart', element: <RequireAuth>{lazyPage(<Mart />)}</RequireAuth> },
      { path: '/settings', element: <RequireAuth>{lazyPage(<Settings />)}</RequireAuth> },
      { path: '/admin', element: <RequireAdmin>{lazyPage(<Admin />)}</RequireAdmin> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);
