import App from './App';
import { AuthProvider } from './auth/AuthProvider';
export default function PublicApplication() {
  return <AuthProvider><App/></AuthProvider>;
}
