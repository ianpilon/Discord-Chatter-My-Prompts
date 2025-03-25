import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
  options?: {
    signal?: AbortSignal;
    timeout?: number;
  }
): Promise<Response> {
  const fetchOptions: RequestInit = {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  };
  
  // Add abort signal if provided
  if (options?.signal) {
    fetchOptions.signal = options.signal;
  }
  
  // Create a timeout if specified
  let timeoutId: NodeJS.Timeout | undefined;
  if (options?.timeout && !options.signal) {
    const controller = new AbortController();
    fetchOptions.signal = controller.signal;
    timeoutId = setTimeout(() => controller.abort(), options.timeout);
  }
  
  try {
    const res = await fetch(url, fetchOptions);
    await throwIfResNotOk(res);
    return res;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
