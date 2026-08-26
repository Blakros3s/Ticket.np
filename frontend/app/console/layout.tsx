import { PlatformAuthProvider } from '@/lib/platform-auth-context';

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return <PlatformAuthProvider>{children}</PlatformAuthProvider>;
}
