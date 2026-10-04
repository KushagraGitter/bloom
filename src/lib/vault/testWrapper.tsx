// Test wrapper: a fresh query client and a vault that is ready on this phone.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

import { VaultContext, type Vault } from '@/lib/vault/VaultProvider';

export function vaultWrapper(vault: Vault) {
  return function Wrapper({ children }: { children: ReactNode }) {
    const [client] = useState(
      () => new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { gcTime: Infinity } } }),
    );
    return (
      <QueryClientProvider client={client}>
        <VaultContext.Provider value={vault}>{children}</VaultContext.Provider>
      </QueryClientProvider>
    );
  };
}
