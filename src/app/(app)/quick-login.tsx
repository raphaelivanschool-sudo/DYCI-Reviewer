import { router } from 'expo-router';

import { QuickLoginSetup } from '@/components/AccountGates';

/** Set up or change PIN / fingerprint from Profile. */
export default function QuickLoginRoute() {
  return <QuickLoginSetup onDone={() => router.back()} onSkip={() => router.back()} />;
}
