import Button from '../components/common/Button';
import PageStub from '../components/common/PageStub';

export default function NotFound() {
  return (
    <div style={{ flex: '1 0 auto', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <PageStub title="Page not found" note="The page you are looking for does not exist or has moved." />
      <div className="container" style={{ paddingBottom: 'var(--space-6)' }}><Button to="/">Back to home</Button></div>
    </div>
  );
}
