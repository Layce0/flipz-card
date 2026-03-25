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

type ParsedEdgeError = {
  error?: string;
  retryAfter?: number;
  detail?: string;
  [key: string]: unknown;
};

const parseEdgeInvokeError = async (error: any): Promise<{ status?: number; parsed: ParsedEdgeError | null }> => {
  const context = error?.context;
  let status: number | undefined;
  let parsed: ParsedEdgeError | null = null;

  try {
    if (context && typeof context.text === 'function') {
      status = context.status;
      const rawBody = await context.text();
      if (rawBody) {
        try {
          parsed = JSON.parse(rawBody);
        } catch {
          parsed = { error: rawBody };
        }
      }
    }
  } catch {
    // no-op: fallback parsing below
  }

  if (!parsed && typeof error?.message === 'string') {
    const jsonStart = error.message.indexOf('{');
    if (jsonStart >= 0) {
      try {
        parsed = JSON.parse(error.message.slice(jsonStart));
      } catch {
        parsed = null;
      }
    }
  }

  if (!parsed && typeof error?.message === 'string') {
    parsed = { error: error.message };
  }

  return { status, parsed };
};

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

  try {
    return await supabase.functions.invoke<T>(functionName, {
      ...options,
      headers,
    });
  } catch (error: any) {
    const { status, parsed } = await parseEdgeInvokeError(error);

    return {
      data: (parsed as T) ?? null,
      error: {
        ...(typeof error === 'object' && error !== null ? error : {}),
        status,
        parsed,
        message: parsed?.error ?? error?.message ?? 'Edge function request failed',
      },
    };
  }
};
