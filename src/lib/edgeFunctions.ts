import { supabase } from '@/integrations/supabase/client';

type EdgeInvokeOptions = {
  body?: unknown;
  headers?: Record<string, string>;
};

export const invokeEdgeFunction = async <T = unknown>(
  functionName: string,
  options: EdgeInvokeOptions = {}
) => {
  const { data: { session } } = await supabase.auth.getSession();

  const headers = {
    ...(options.headers ?? {}),
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
  };

  return supabase.functions.invoke<T>(functionName, {
    ...options,
    headers,
  });
};
