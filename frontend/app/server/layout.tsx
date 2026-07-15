import { PlatformAuthProvider } from '@/lib/platform-auth-context';

export default function ServerLayout({ children }: { children: React.ReactNode }) {
  return <PlatformAuthProvider>{children}</PlatformAuthProvider>;
}
