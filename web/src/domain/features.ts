/** The parts of the app the admin can switch on and off for an evening (ADR 0014). */
export type FeatureName = 'actions' | 'chat' | 'feed' | 'leaderboard';

export type Features = Readonly<Record<FeatureName, boolean>>;

export const ALL_FEATURES_ON: Features = { actions: true, chat: true, feed: true, leaderboard: true };
