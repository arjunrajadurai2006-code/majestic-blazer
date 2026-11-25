import AuthForm from '../components/common/AuthForm';
import { useDocumentSeo } from '../utils/seo';

export default function Register() {
  useDocumentSeo({
    title: 'Create Account | MAJESTIC BLAZER',
    description: 'Register for a Majestic Blazer patron account.',
    path: '/register',
    noindex: true,
  });
  return <AuthForm mode="register" />;
}
