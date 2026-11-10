import { createFolder, replaceClasses, saveReviewer } from './db';
import { SAMPLE_QUESTIONS, SAMPLE_WEEK } from './sample-data';

/** Fills a new account with demo folders, one reviewer and a weekly schedule (for testing and defense demos). */
export async function seedSampleData(uid: string) {
  const pe = await createFolder(uid, 'PE', 'dumbbell', 'green');
  await createFolder(uid, 'Music', 'music', 'purple');
  await createFolder(uid, 'Science', 'flask', 'teal');
  await saveReviewer(
    uid,
    {
      title: 'PE Reviewer · Lessons 1–2',
      folderId: pe.id,
      sourceType: 'text',
      sourcePath: null,
      difficulty: 'Medium',
      summary: [
        'Warm up and stretch before any sport to prevent injury.',
        'Wear the right protective gear and follow the rules.',
        'Fair play means respecting teammates, opponents and officials.',
        'Drink water and rest so your body can recover.',
      ],
    },
    SAMPLE_QUESTIONS.map((q, i) => ({ ...q, order: i })),
  );
  await replaceClasses(uid, SAMPLE_WEEK);
}
