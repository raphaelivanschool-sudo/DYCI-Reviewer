import { Redirect } from 'expo-router';

import { useAuth } from '@/lib/auth-context';

/** App start: logged-in students go to Home, everyone else to Log in. */
export default function Index() {
  const { user } = useAuth();
  return <Redirect href={user ? '/home' : '/login'} />;
}
