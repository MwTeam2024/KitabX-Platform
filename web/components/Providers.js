'use client';

import StoreProvider from '@/store/StoreProvider';
import SessionGate from '@/components/auth/SessionGate';
import { AppDataProvider } from '@/contexts/AppDataContext';
import { ToastProvider } from '@/components/ui/ToastProvider';
import { SheetProvider } from '@/components/ui/SheetProvider';

export default function Providers({ children }) {
  return (
    <StoreProvider>
      <SessionGate>
        <AppDataProvider>
          <ToastProvider>
            <SheetProvider>{children}</SheetProvider>
          </ToastProvider>
        </AppDataProvider>
      </SessionGate>
    </StoreProvider>
  );
}
