import AuthForm from '../components/common/AuthForm';
import { useDocumentSeo } from '../utils/seo';

export default function Login() {
  useDocumentSeo({
    title: 'Sign In | MAJESTIC BLAZER',
    description: 'Sign in to your Majestic Blazer patron account.',
    path: '/login',
    noindex: true,
  });
  return <AuthForm mode="login" />;
}
