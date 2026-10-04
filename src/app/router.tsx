import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, Navigate } from 'react-router';
import Home from '../pages/Home';
import NotFound from '../pages/NotFound';
import Login from '../pages/Login';
import AuthCallback from '../pages/AuthCallback';
import { RequireAdmin, RequireAuth } from './guards';

// Member and admin screens are lazy chunks, so visitors never download them (NFR-01).
// The router module is not hot-reloaded as a component, so these consts are fine here.
/* eslint-disable react-refresh/only-export-components */
const Edit = lazy(() => import('../pages/Edit'));
const Admin = lazy(() => import('../pages/Admin'));
const Member = lazy(() => import('../pages/Member'));
const Privacy = lazy(() => import('../pages/Privacy'));
/* eslint-enable react-refresh/only-export-components */

const lazyPage = (node: ReactNode) => <Suspense fallback={null}>{node}</Suspense>;

// /explore and /settings arrive in Phase 5 (ARCHITECTURE §7).
export const router = createBrowserRouter([
  { path: '/', element: <Home /> },
  { path: '/login', element: <Login /> },
  { path: '/auth/callback', element: <AuthCallback /> },
  { path: '/member/:username', element: lazyPage(<Member />) },
  { path: '/privacy', element: lazyPage(<Privacy />) },
  { path: '/edit', element: <RequireAuth>{lazyPage(<Edit />)}</RequireAuth> },
  { path: '/create', element: <Navigate to="/edit" replace /> },
  { path: '/admin', element: <RequireAdmin>{lazyPage(<Admin />)}</RequireAdmin> },
  { path: '*', element: <NotFound /> },
]);
