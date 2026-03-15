import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import type { Session } from '@supabase/supabase-js';

const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

const deriveProjectRef = () => {
  if (projectId) return projectId;

  try {
    return new URL(supabaseUrl).hostname.split('.')[0];
  } catch {
    return 'unknown';
  }
};

const authStorageKey = `sb-${deriveProjectRef()}-auth-token`;
const nativeStorageKey = 'supabase_auth_token';

const isNative = () => Capacitor.isNativePlatform();

let authBootstrapResolved = false;
let resolveAuthBootstrap: (() => void) | null = null;

const authBootstrapReady = new Promise<void>((resolve) => {
  resolveAuthBootstrap = resolve;
});

const resolveBootstrap = () => {
  if (authBootstrapResolved) return;
  authBootstrapResolved = true;
  resolveAuthBootstrap?.();
};

export const markAuthBootstrapReady = () => {
  resolveBootstrap();
};

export const waitForAuthBootstrapReady = async (timeoutMs = 2500): Promise<void> => {
  if (authBootstrapResolved) return;

  await Promise.race([
    authBootstrapReady,
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
};

export const getSessionFromNativeStorage = async (): Promise<Session | null> => {
  if (!isNative()) return null;

  try {
    const { value } = await Preferences.get({ key: nativeStorageKey });
    if (!value) return null;

    return JSON.parse(value) as Session;
  } catch (error) {
    console.warn('[auth] unable to read native session', error);
    return null;
  }
};

export const hydrateSessionFromNativeStorage = async (): Promise<void> => {
  if (!isNative()) return;

  try {
    const { value } = await Preferences.get({ key: nativeStorageKey });
    if (!value) return;

    const currentStorageValue = localStorage.getItem(authStorageKey);
    if (currentStorageValue !== value) {
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

    const serializedSession = JSON.stringify(session);
    localStorage.setItem(authStorageKey, serializedSession);
    await Preferences.set({ key: nativeStorageKey, value: serializedSession });
  } catch (error) {
    console.warn('[auth] unable to persist native session', error);
  }
};
