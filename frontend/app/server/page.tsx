import { redirect } from 'next/navigation';

export default function ServerIndexPage() {
  redirect('/server/dashboard');
}
