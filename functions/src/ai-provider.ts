import { HttpsError } from 'firebase-functions/https';
import { defineSecret } from 'firebase-functions/params';

/**
 * THE ONLY FILE TO EDIT WHEN YOU PICK AN AI PROVIDER.
 *
 * 1. Store the key as a secret (never in the app, never in git):
 *      firebase functions:secrets:set AI_API_KEY
 * 2. Replace the body of askAI() with a call to your provider's API using AI_API_KEY.value().
 *    It must return the model's text answer. index.ts already asks for JSON and checks it.
 * 3. Deploy: firebase deploy --only functions
 * 4. In the app's .env set EXPO_PUBLIC_AI_MODE=functions and restart Expo.
 */
export const AI_API_KEY = defineSecret('AI_API_KEY');

export type Attachment = { mimeType: string; base64: string };

export async function askAI(system: string, user: string, attachment?: Attachment): Promise<string> {
  void system;
  void user;
  void attachment;
  throw new HttpsError(
    'failed-precondition',
    'No AI provider is connected yet. Edit functions/src/ai-provider.ts, or set EXPO_PUBLIC_AI_MODE=mock in the app.',
  );
}
