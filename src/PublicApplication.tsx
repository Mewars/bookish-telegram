import App from './App';
import { AuthProvider } from './auth/AuthProvider';
import { MusicProvider } from './music/MusicProvider';
export default function PublicApplication() {
  return <AuthProvider><MusicProvider><App/></MusicProvider></AuthProvider>;
}
