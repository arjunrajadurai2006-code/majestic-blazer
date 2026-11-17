import { Outlet } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import GlobalBackBar from '../common/GlobalBackBar';
import { BackNavigationProvider } from '../../context/BackNavigationContext';

export default function Layout() {
  return (
    <BackNavigationProvider>
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Header />
        <GlobalBackBar />
        <main style={{ flex: 1 }}><Outlet /></main>
        <Footer />
      </div>
    </BackNavigationProvider>
  );
}
