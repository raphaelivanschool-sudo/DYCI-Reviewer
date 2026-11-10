import { LegalScreen } from '@/components/LegalScreen';
import { PRIVACY } from '@/lib/legal';

export default function Privacy() {
  return <LegalScreen title="Privacy Policy" sections={PRIVACY} />;
}
