/**
 * Text of the Terms of Use and Privacy Policy shown from the sign-up screen.
 * DRAFT written for a student project: have your school or an adviser review it before public release,
 * and fill in CONTACT_EMAIL.
 */
export const CONTACT_EMAIL = 'support@example.com';
export const LEGAL_UPDATED = 'November 10, 2026';

export type LegalSection = { title: string; body: string[] };

export const TERMS: LegalSection[] = [
  {
    title: '1. About METAKNOWIA',
    body: [
      'METAKNOWIA is a study app. You add your lessons, the app makes review quizzes from them, and a study buddy (METANOIA) answers your questions. It also keeps your class and exam schedule.',
      'By creating an account you agree to these Terms. If you do not agree, please do not use the app.',
    ],
  },
  {
    title: '2. Your account',
    body: [
      'Give correct information when you sign up and keep your password private. You are responsible for what happens under your account.',
      'If you are under 18, use the app with the knowledge of a parent or guardian.',
      'You must verify your email by tapping the link we send you before you can use the app.',
    ],
  },
  {
    title: '3. Your lessons and content',
    body: [
      'You keep ownership of the notes, files and photos you add. You give the app permission to process them (including with AI) only to make your reviewers, answer your questions and read your schedule.',
      'Only add material you have the right to use. Do not upload anything unlawful, harmful or that belongs to someone else without permission.',
    ],
  },
  {
    title: '4. AI-made content',
    body: [
      'Reviewers, summaries, quiz questions and chat answers are made by AI and can be wrong or incomplete. Always check important facts against your textbook or your teacher.',
      'The app is a study aid. It does not replace your teacher and we do not promise any grade or result.',
    ],
  },
  {
    title: '5. Acceptable use',
    body: [
      'Do not try to break, overload or reverse-engineer the app, share your account, or use the app to harass or cheat others.',
      'We may limit or close an account that breaks these rules.',
    ],
  },
  {
    title: '6. Availability and changes',
    body: [
      'The app is provided “as is”. It may be unavailable at times and features may change. We are not liable for lost data or for decisions you make based on AI answers, to the extent the law allows.',
      'We may update these Terms. We will show the new date above; continuing to use the app means you accept the update.',
    ],
  },
  {
    title: '7. Contact',
    body: [`Questions about these Terms? Email ${CONTACT_EMAIL}.`],
  },
];

export const PRIVACY: LegalSection[] = [
  {
    title: '1. What we collect',
    body: [
      'Account details: your name, email, grade level and avatar.',
      'Your study content: lessons you paste or upload (text, PDF, photos), the reviewers and quiz results made from them, your chat with METANOIA, your class schedule and exams, and your progress (XP, streak, badges).',
      'Device settings that make the app work, such as your reminder times, chat language and, if you turn them on, your PIN or fingerprint lock (stored only on your phone).',
    ],
  },
  {
    title: '2. How we use it',
    body: [
      'To run your account, make reviewers and quizzes, answer your questions, show your schedule, send the reminders you turn on, and keep the app secure.',
      'We do not sell your data and we do not show ads.',
    ],
  },
  {
    title: '3. Services we use',
    body: [
      'Your data is stored with Google Firebase (sign-in, database and file storage). To make reviewers and chat answers, the text or files you send are processed by Google’s Gemini AI. Firebase also uses your email address to send the verification and password-reset emails.',
      'These providers process data on our behalf and may store it outside the Philippines.',
    ],
  },
  {
    title: '4. Who can see your data',
    body: [
      'Your lessons, reviewers, chats and schedule are private to your account. Our security rules stop other students from reading them. Only the people who maintain the app can access the database for support and security reasons.',
    ],
  },
  {
    title: '5. How long we keep it',
    body: ['We keep your data while your account is open. When you ask us to delete your account we delete your data, except what we must keep by law or for security.'],
  },
  {
    title: '6. Your rights',
    body: [
      'Under the Philippine Data Privacy Act of 2012 (RA 10173) you can ask to see, correct or delete your personal data, and object to how it is used.',
      `To use these rights, email ${CONTACT_EMAIL}.`,
    ],
  },
  {
    title: '7. Children',
    body: ['Students under 18 should have a parent or guardian’s permission to use the app.'],
  },
  {
    title: '8. Changes and contact',
    body: [`We may update this policy and will show the new date above. Questions? Email ${CONTACT_EMAIL}.`],
  },
];
