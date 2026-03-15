import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import type { Session } from '@supabase/supabase-js';

const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const authStorageKey = `sb-${projectId}-auth-token`;
const nativeStorageKey = 'supabase_auth_token';

const isNative = () => Capacitor.isNativePlatform();

export const hydrateSessionFromNativeStorage = async (): Promise<void> => {
  if (!isNative()) return;

  try {
    const { value } = await Preferences.get({ key: nativeStorageKey });
    if (value) {
      localStorage.setItem(authStorageKey, value);
    }
  } catch (error) {
    console.warn('[auth] unable to hydrate native session', error);
  }
};

export const syncSessionToNativeStorage = async (session: Session | null): Promise<void> => {
  if (!isNative()) return;

  try {
    if (!session) {
      await Preferences.remove({ key: nativeStorageKey });
      localStorage.removeItem(authStorageKey);
      return;
    }

    const serializedSession = localStorage.getItem(authStorageKey) ?? JSON.stringify(session);
    await Preferences.set({ key: nativeStorageKey, value: serializedSession });
  } catch (error) {
    console.warn('[auth] unable to persist native session', error);
  }
};
