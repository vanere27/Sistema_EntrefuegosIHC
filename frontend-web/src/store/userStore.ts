import { create } from 'zustand';

// Definimos qué datos vamos a guardar del usuario
interface User {
  id: number;
  name: string;
  role: string;
  sessionToken: string;
  startedAt?: string;
}

interface UserStore {
  user: User | null;
  login: (userData: User) => void;
  logout: () => void;
}

// Creamos la "memoria" global
export const useUserStore = create<UserStore>((set, get) => ({
  user: null,
  login: (userData) => set({ user: userData }),
  logout: () => {
    const sessionToken = get().user?.sessionToken;
    if (sessionToken && process.env.NEXT_PUBLIC_API_URL) {
      void fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/session`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${sessionToken}` },
        keepalive: true,
      }).catch(() => undefined);
    }
    set({ user: null });
  },
}));
