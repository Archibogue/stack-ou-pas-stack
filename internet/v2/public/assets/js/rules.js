export const START_MEMORY = 11;
export const WIN_SCORE = 11;
export const MAX_HAND_SIZE = 8;
export const MAX_FRAMES_PER_FUNCTION = 6;
export const REQUIRED_COMPLETED_FUNCTIONS = 3;
export const REQUIRED_DISTINCT_NAMES = 2;
export const PHASES = {
  SETUP: 'setup',
  UPDATE: 'update',
  DRAW: 'draw',
  ACTION: 'action',
  GAME_OVER: 'game_over'
};

export function bonusRecursion(r) {
  return r * r;
}

export function isWinningState(player) {
  const distinctNames = new Set(player.completed.map((card) => card.key)).size;
  return (
    player.score >= WIN_SCORE &&
    player.completed.length >= REQUIRED_COMPLETED_FUNCTIONS &&
    distinctNames >= REQUIRED_DISTINCT_NAMES
  );
}

export function formatMemory(player) {
  return `${player.memFree}/${player.memTotal}`;
}
