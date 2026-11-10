import { useEffect, useMemo, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

/** Account transitions must not reuse queries, pending mutations, or page state. */
export default function AccountQueryProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const identity = user?.id ?? "anonymous";
  const client = useMemo(() => new QueryClient(), [identity]);

  useEffect(() => () => client.clear(), [client]);

  return (
    <QueryClientProvider key={identity} client={client}>
      {children}
    </QueryClientProvider>
  );
}
