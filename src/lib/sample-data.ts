import { SUBJECT_COLORS } from '@/theme';

import type { ClassItem, Question } from './types';

export const SUBJECTS: { code: string; subject: string; color: string }[] = [
  { code: 'ENG', subject: 'English', color: SUBJECT_COLORS[0] },
  { code: 'SCI', subject: 'Science', color: SUBJECT_COLORS[1] },
  { code: 'FIL', subject: 'Filipino', color: SUBJECT_COLORS[2] },
  { code: 'MATH', subject: 'Mathematics', color: SUBJECT_COLORS[3] },
  { code: 'MAPEH', subject: 'MAPEH', color: SUBJECT_COLORS[4] },
  { code: 'AP', subject: 'Araling Panlipunan', color: SUBJECT_COLORS[5] },
  { code: 'TLE', subject: 'TLE', color: SUBJECT_COLORS[6] },
  { code: 'ESP', subject: 'ESP', color: SUBJECT_COLORS[7] },
];

const subj = (code: string) => SUBJECTS.find((s) => s.code === code)!;
const mk = (code: string, day: number, start: number, end: number, room: string, teacher = ''): Omit<ClassItem, 'id'> => ({
  ...subj(code),
  day,
  start,
  end,
  room,
  teacher,
});

const MWF = (d: number) => [mk('ENG', d, 7.5, 8.5, 'Rm 201'), mk('SCI', d, 8.5, 9.5, 'Lab 1'), mk('FIL', d, 10, 11, 'Rm 201'), mk('MATH', d, 13, 14, 'Rm 204', 'Mr. Garcia'), mk('MAPEH', d, 14, 15, 'Gym')];
const TTH = (d: number) => [mk('AP', d, 7.5, 8.5, 'Rm 203'), mk('TLE', d, 8.5, 9.5, 'Rm 105'), mk('ESP', d, 10, 11, 'Rm 201'), mk('MATH', d, 13, 14, 'Rm 204', 'Mr. Garcia'), mk('ENG', d, 14, 15, 'Rm 201')];

/** Typical Grade 10 week (Mon–Sat), used by the mock schedule scanner and sample data. */
export const SAMPLE_WEEK: Omit<ClassItem, 'id'>[] = [...MWF(1), ...TTH(2), ...MWF(3), ...TTH(4), ...MWF(5), mk('TLE', 6, 8, 10, 'Rm 105')];

const q = (topic: string, prompt: string, choices: string[], answerIndex: number, explanation: string): Omit<Question, 'id'> => ({
  order: 0,
  topic,
  prompt,
  choices,
  answerIndex,
  explanation,
});

/** Question bank the mock AI uses when it cannot read the uploaded file. */
export const SAMPLE_QUESTIONS: Omit<Question, 'id'>[] = [
  q('Sports safety', 'What should you do before playing any sport?', ['Eat a heavy meal', 'Warm up and stretch', 'Skip drinking water', 'Run as fast as you can'], 1, 'Warming up prepares your muscles and lowers the risk of injury.'),
  q('Sports safety', 'Why do players wear helmets in some sports?', ['To look cool', 'To protect the head from injury', 'To run faster', 'To hear the coach better'], 1, 'Helmets absorb impact and protect the head.'),
  q('Sports safety', 'What is the first thing to do if a teammate gets hurt?', ['Keep playing', 'Tell the coach or teacher right away', 'Move them quickly', 'Ignore it'], 1, 'An adult who knows first aid should check the injury first.'),
  q('Sports safety', 'Which drink is best during exercise?', ['Soda', 'Water', 'Coffee', 'Energy drink'], 1, 'Water replaces the fluid you lose when you sweat.'),
  q('Team sports', 'How many players does a volleyball team have on the court?', ['5', '6', '7', '11'], 1, 'Each volleyball team has 6 players on the court.'),
  q('Team sports', 'In basketball, how many points is a shot from behind the arc?', ['1', '2', '3', '4'], 2, 'A shot from behind the three-point line is worth 3 points.'),
  q('Team sports', 'What does "fair play" mean?', ['Winning at all costs', 'Following the rules and respecting others', 'Playing only with friends', 'Arguing with the referee'], 1, 'Fair play means respecting rules, teammates, opponents and officials.'),
  q('Team sports', 'Who decides if a rule was broken during a game?', ['The fans', 'The referee', 'The team captain', 'The fastest player'], 1, 'The referee enforces the rules of the game.'),
  q('Fitness', 'Which is an example of aerobic exercise?', ['Push-ups', 'Jogging', 'Lifting weights', 'Stretching'], 1, 'Aerobic exercise like jogging trains the heart and lungs.'),
  q('Fitness', 'How long should a cool-down usually last?', ['30 seconds', '5 to 10 minutes', '1 hour', 'No need to cool down'], 1, 'A 5 to 10 minute cool-down helps your heart rate return to normal.'),
  q('Fitness', 'What part of fitness does the sit-and-reach test measure?', ['Speed', 'Flexibility', 'Strength', 'Balance'], 1, 'Sit-and-reach measures flexibility of the lower back and hamstrings.'),
  q('Fitness', 'Why is sleep important for athletes?', ['It is not important', 'It helps the body recover', 'It makes you slower', 'It replaces training'], 1, 'During sleep the body repairs muscles and restores energy.'),
];
