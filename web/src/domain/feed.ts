import type { ActionKind } from './action';

export const CAPTION_MAX = 300;

export interface FeedAuthor {
  readonly id: string;
  readonly nickname: string;
  readonly avatarId: string | null;
}

export interface LikeSummary {
  readonly count: number;
  readonly likedByMe: boolean;
}

interface FeedItemBase {
  /** A post id or a completion id: likes point here. */
  readonly id: string;
  readonly author: FeedAuthor;
  readonly createdAt: Date;
  readonly likes: LikeSummary;
}

export interface PostItem extends FeedItemBase {
  readonly kind: 'post';
  readonly photoId: string;
  readonly caption: string;
}

/** Created automatically when someone completes an action. */
export interface CompletionItem extends FeedItemBase {
  readonly kind: 'completion';
  readonly photoId: string | null;
  readonly action: { readonly title: string; readonly kind: ActionKind; readonly points: number };
}

export type FeedItem = PostItem | CompletionItem;

export interface Liker {
  readonly id: string;
  readonly nickname: string;
  readonly avatarId: string | null;
}

/** Newest first; a fresher copy of the same item replaces the older one. */
export function mergeFeed(current: readonly FeedItem[], incoming: readonly FeedItem[]): FeedItem[] {
  const byId = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) byId.set(item.id, item);
  return [...byId.values()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export function withLike(item: FeedItem, liked: boolean): FeedItem {
  if (item.likes.likedByMe === liked) return item;
  return { ...item, likes: { likedByMe: liked, count: item.likes.count + (liked ? 1 : -1) } };
}

export function isValidCaption(caption: string): boolean {
  return [...caption.trim()].length <= CAPTION_MAX;
}
