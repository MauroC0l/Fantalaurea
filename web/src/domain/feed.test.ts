import { describe, expect, it } from 'vitest';
import { mergeFeed, withLike, type FeedItem } from './feed';

const post = (id: string, minute: number, likes = { count: 0, likedByMe: false }): FeedItem => ({
  kind: 'post',
  id,
  author: { id: 'a', nickname: 'A', avatarId: null },
  createdAt: new Date(2026, 9, 2, 22, minute),
  likes,
  photoId: `photo-${id}`,
  caption: '',
});

describe('feed', () => {
  it('merges pages newest first, keeping the freshest copy of an item', () => {
    const merged = mergeFeed([post('a', 1), post('b', 2)], [post('b', 2, { count: 3, likedByMe: true }), post('c', 3)]);
    expect(merged.map((i) => i.id)).toEqual(['c', 'b', 'a']);
    expect(merged[1].likes.count).toBe(3);
  });

  it('toggles a like and keeps the count consistent', () => {
    const liked = withLike(post('a', 1, { count: 2, likedByMe: false }), true);
    expect(liked.likes).toEqual({ count: 3, likedByMe: true });
    expect(withLike(liked, true)).toBe(liked);
    expect(withLike(liked, false).likes).toEqual({ count: 2, likedByMe: false });
  });
});
