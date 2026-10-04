import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import '@fontsource/jersey-10/400.css';
import '@fontsource/atkinson-hyperlegible-next/400.css';
import '@fontsource/atkinson-hyperlegible-next/700.css';
import '@fontsource/atkinson-hyperlegible-mono/400.css';
import '@fontsource/atkinson-hyperlegible-mono/600.css';
import './styles/base.css';
import { ThemeProvider } from './app/theme';
import { router } from './app/router';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>
  </StrictMode>,
);
