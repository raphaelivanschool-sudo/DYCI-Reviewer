import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { confirmAction } from '@/lib/confirm';
import { deleteReviewer } from '@/lib/db';
import { plural } from '@/lib/format';
import { starsFor } from '@/lib/game';
import type { Folder, Reviewer } from '@/lib/types';
import { C } from '@/theme';

import { Icon, type IconName } from './Icon';
import { Card, Progress, T, Tile } from './ui';

/** A lesson (reviewer) row with its best score/stars and a delete button. Tap opens the lesson stats. */
export function ReviewerRow({ uid, reviewer, folder }: { uid: string; reviewer: Reviewer; folder?: Folder }) {
  const pct = reviewer.questionCount ? Math.round((reviewer.answered / reviewer.questionCount) * 100) : 0;
  const stars = reviewer.bestPercent === null ? 0 : starsFor(reviewer.bestPercent);
  const remove = () =>
    confirmAction(`Delete "${reviewer.title}"?`, 'Its questions will be deleted too. Your XP and past scores stay.', 'Delete', () => deleteReviewer(uid, reviewer.id));
  return (
    <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingLeft: 14, paddingRight: 12 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Open ${reviewer.title}`} onPress={() => router.push({ pathname: '/reviewer/[id]', params: { id: reviewer.id } })}
        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Tile icon={(folder?.icon as IconName) ?? 'book'} tint={folder?.tint ?? 'blue'} />
        <View style={{ flex: 1, gap: 2 }}>
          <T w={800} size={15.5} numberOfLines={1}>{reviewer.title}</T>
          {reviewer.bestPercent !== null ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <T w={700} size={13} color={C.muted}>Best {reviewer.bestPercent}% ·</T>
              {[0, 1, 2].map((i) => <Icon key={i} name="star" size={14} color={i < stars ? '#F59E0B' : '#CBD5E1'} />)}
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <Progress value={pct} height={6} style={{ maxWidth: 110 }} />
              <T w={600} size={12.5} color={C.muted}>{pct ? `${pct}% done` : `${plural(reviewer.questionCount, 'question')}`}</T>
            </View>
          )}
        </View>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${reviewer.title}`} onPress={remove} hitSlop={6}
        style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: C.danger50, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="trash" size={20} color={C.danger} />
      </Pressable>
    </Card>
  );
}
