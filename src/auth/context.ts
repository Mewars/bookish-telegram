import { createContext } from 'react';
import type { AuthState, ProfileUpdate } from '../types/auth';
export interface AuthContextValue {
  state: AuthState;
  error: string | null;
  signOut: () => Promise<void>;
  updateProfile: (patch: ProfileUpdate) => Promise<boolean>;
}
export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
