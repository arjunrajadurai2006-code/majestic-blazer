/**
 * AuthLayout — bare layout for standalone authentication pages.
 * Renders only the page content with no Header, GlobalBackBar or Footer.
 * Used by: /login, /register, /access, /account-access, /admin
 */
import { Outlet } from 'react-router-dom';

export default function AuthLayout() {
  return (
    <main id="main-content" tabIndex={-1}>
      <Outlet />
    </main>
  );
}
