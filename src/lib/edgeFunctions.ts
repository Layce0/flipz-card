import { supabase } from '@/integrations/supabase/client';
import {
  getSessionFromNativeStorage,
  hydrateSessionFromNativeStorage,
  syncSessionToNativeStorage,
  waitForAuthBootstrapReady,
} from '@/lib/capacitorSession';

type EdgeInvokeOptions = {
  body?: unknown;
  headers?: Record<string, string>;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getSessionForEdgeInvocation = async () => {
  await waitForAuthBootstrapReady();
  await hydrateSessionFromNativeStorage();

  let { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    return session;
  }

  const nativeSession = await getSessionFromNativeStorage();
  if (nativeSession?.refresh_token) {
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: nativeSession.refresh_token,
    });

    if (!error && data.session) {
      await syncSessionToNativeStorage(data.session);
      return data.session;
    }
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    await sleep(120);
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) {
      return data.session;
    }
  }

  return null;
};

export const invokeEdgeFunction = async <T = any>(
  functionName: string,
  options: EdgeInvokeOptions = {}
) => {
  const session = await getSessionForEdgeInvocation();

  const headers = {
    ...(options.headers ?? {}),
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
  };

  return supabase.functions.invoke<T>(functionName, {
    ...options,
    headers,
  });
};
