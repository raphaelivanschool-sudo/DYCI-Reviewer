import { LegalScreen } from '@/components/LegalScreen';
import { TERMS } from '@/lib/legal';

export default function Terms() {
  return <LegalScreen title="Terms of Use" sections={TERMS} />;
}
