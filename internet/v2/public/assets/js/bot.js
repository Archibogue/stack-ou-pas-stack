import { PHASES } from './rules.js';
import {
  canEndTurn,
  canPlayCard,
  canUseOverclock,
  drawForPlayer,
  endTurn,
  getPendingDeckEffect,
  getPendingUpdates,
  getState,
  newGame,
  playCard,
  resolvePendingDeckEffect,
  updateFunction,
  useOverclock,
  validateUpdatePhase
} from './game-engine.js';

const MAX_BOT_STEPS = 80;

export function startSoloGame(humanName = 'Joueur Cyan', botName = 'Ordinateur') {
  const state = newGame(humanName, botName);
  state.soloMode = true;
  state.botIndex = 1;
  state.players.forEach((player) => {
    player.isBot = player.index === state.botIndex;
  });
  return state;
}

export function runBotTurn(botIndex = getState()?.botIndex) {
  const state = getState();
  if (!state || state.winner !== null || botIndex === null || state.currentPlayerIndex !== botIndex) return false;

  let changed = false;
  for (let step = 0; step < MAX_BOT_STEPS; step += 1) {
    changed = resolveBotPendingEffect(botIndex) || changed;
    if (state.winner !== null || state.currentPlayerIndex !== botIndex) return changed;

    if (state.phase === PHASES.UPDATE) {
      const pending = getPendingUpdates(state.players[botIndex]);
      if (pending.length === 0) {
        changed = validateUpdatePhase() || changed;
        continue;
      }
      const target = chooseUpdateTarget(state.players[botIndex], pending);
      changed = updateFunction(target.id) || changed;
      continue;
    }

    if (state.phase === PHASES.DRAW) {
      drawForPlayer('system');
      changed = true;
      continue;
    }

    if (state.phase === PHASES.ACTION) {
      const acted = playOneAction(botIndex);
      if (acted) {
        changed = true;
        continue;
      }
      if (canEndTurn()) {
        changed = endTurn() || changed;
      }
      return changed;
    }

    return changed;
  }

  return changed;
}

export function maybeReactToHumanAction(botIndex = getState()?.botIndex) {
  const state = getState();
  if (!state || state.winner !== null || botIndex === null || state.currentPlayerIndex === botIndex) return false;
  resolveBotPendingEffect(botIndex);
  const bot = state.players[botIndex];
  if (!bot?.isBot) return false;

  const spikeTarget = bestStackSpikeTarget(state, botIndex);
  const spike = findPlayableCard(bot, 'stack_spike');
  if (spike && spikeTarget && safePlayCard(botIndex, spike, { functionId: spikeTarget.id })) return true;

  const injectionTarget = bestDisruptionTarget(state, botIndex);
  const injection = findPlayableCard(bot, 'injection');
  if (injection && injectionTarget && safePlayCard(botIndex, injection, { functionId: injectionTarget.id })) return true;

  return false;
}

function playOneAction(botIndex) {
  const state = getState();
  const bot = state.players[botIndex];

  const broken = bot.active
    .filter((fn) => fn.broken)
    .sort((a, b) => b.memUsed - a.memUsed)[0];
  if (broken) {
    const clean = findPlayableCard(bot, 'collecte');
    if (clean && safePlayCard(botIndex, clean, { functionId: broken.id })) return true;
    const repair = findPlayableCard(bot, 'hotfix');
    if (repair && safePlayCard(botIndex, repair, { functionId: broken.id })) return true;
  }

  const ram = findPlayableCard(bot, 'ram');
  if (ram && bot.memFree <= 5 && safePlayCard(botIndex, ram)) return true;

  const planifier = findPlayableCard(bot, 'planificateur');
  if (planifier && bot.active.some((fn) => !fn.broken && !fn.reachedZero) && safePlayCard(botIndex, planifier)) return true;

  const overclock = findPlayableCard(bot, 'overclock');
  if (overclock && bot.active.some((fn) => !fn.broken && fn.reachedZero) && safePlayCard(botIndex, overclock)) return true;

  if (tryUseOverclock()) return true;

  const opponentTarget = bestDisruptionTarget(state, botIndex);
  const pollution = findPlayableCard(bot, 'pollution');
  if (pollution && opponentTarget && safePlayCard(botIndex, pollution, { functionId: opponentTarget.id })) return true;

  const injection = findPlayableCard(bot, 'injection');
  if (injection && opponentTarget && safePlayCard(botIndex, injection, { functionId: opponentTarget.id })) return true;

  const spike = findPlayableCard(bot, 'stack_spike');
  const spikeTarget = bestStackSpikeTarget(state, botIndex);
  if (spike && spikeTarget && safePlayCard(botIndex, spike, { functionId: spikeTarget.id })) return true;

  const functionCard = bot.hand
    .filter((card) => card.type === 'Fonction')
    .sort((a, b) => a.cost - b.cost)[0];
  if (functionCard && bot.active.length < 3 && bot.memFree >= functionCard.cost) {
    const R = chooseDepth(bot, functionCard);
    if (safePlayCard(botIndex, functionCard, { R })) return true;
  }

  return false;
}

function chooseUpdateTarget(player, pending) {
  return [...pending].sort((a, b) => updateScore(player, b) - updateScore(player, a))[0];
}

function updateScore(player, func) {
  if (func.reachedZero) return 100 + func.frames.length;
  if (func.frames.length >= 6) return -100;
  const canStackSafely = player.memFree > 0 || player.hardware.some((card) => card.key === 'planificateur') && !player.planifierUsed;
  return canStackSafely ? 20 - func.frames.length : -10 - func.frames.length;
}

function chooseDepth(player, card) {
  if (card.mode === 'fixe') return card.maxR;
  if (player.memFree <= card.cost + 1) return Math.min(1, card.maxR);
  if (player.memFree <= card.cost + 3) return Math.min(2, card.maxR);
  return Math.min(card.maxR, Math.max(2, player.memFree - card.cost - 2));
}

function tryUseOverclock() {
  const state = getState();
  const player = state.players[state.currentPlayerIndex];
  const target = player.active
    .filter((fn) => !fn.broken && canUseOverclock(fn.id))
    .sort((a, b) => Number(b.reachedZero) - Number(a.reachedZero) || a.frames.length - b.frames.length)[0];
  return Boolean(target && useOverclock(target.id));
}

function findPlayableCard(player, key) {
  return player.hand.find((card) => card.key === key && canPlayCard(player.index, card.id));
}

function safePlayCard(playerIndex, card, targetData = {}) {
  return Boolean(card && canPlayCard(playerIndex, card.id) && playCard(playerIndex, card.id, targetData));
}

function bestStackSpikeTarget(state, botIndex) {
  const opponent = state.players[1 - botIndex];
  return opponent.active
    .filter((fn) => !fn.broken && [4, 5].includes(fn.frames.length))
    .sort((a, b) => b.frames.length - a.frames.length || b.value + b.R - a.value - a.R)[0] || null;
}

function bestDisruptionTarget(state, botIndex) {
  const opponent = state.players[1 - botIndex];
  return opponent.active
    .filter((fn) => !fn.broken)
    .sort((a, b) => disruptionScore(b) - disruptionScore(a))[0] || null;
}

function disruptionScore(fn) {
  return fn.frames.length * 3 + fn.R + fn.value + (fn.reachedZero ? 4 : 0);
}

function resolveBotPendingEffect(botIndex) {
  const effect = getPendingDeckEffect();
  if (!effect || effect.ownerIndex !== botIndex) return false;
  const state = getState();
  const targetPlayerIndex = effect.allowedPlayerIndexes.includes(botIndex) ? botIndex : effect.allowedPlayerIndexes[0];
  const deckType = chooseDeckType(state.players[targetPlayerIndex], effect.allowedDecks);
  const choice = { targetPlayerIndex, deckType, action: 'keep' };
  if (effect.mode === 'peek_top') choice.action = 'top';
  if (effect.mode === 'peek_order') choice.action = 'keep';
  if (effect.mode === 'may_bottom') {
    const cards = deckType === 'functions'
      ? state.players[targetPlayerIndex].functionsDeck.slice(0, effect.count)
      : state.players[targetPlayerIndex].systemDeck.slice(0, effect.count);
    const lowPriority = cards.find((card) => card.key === 'swap' || card.key === 'debug');
    if (lowPriority) {
      choice.action = 'bottom';
      choice.cardId = lowPriority.id;
    }
  }
  if (effect.mode === 'reveal_take') {
    const cards = deckType === 'functions'
      ? state.players[targetPlayerIndex].functionsDeck.slice(0, effect.count)
      : state.players[targetPlayerIndex].systemDeck.slice(0, effect.count);
    choice.action = 'take';
    choice.cardId = chooseRevealedCard(cards)?.id;
  }
  return resolvePendingDeckEffect(choice);
}

function chooseDeckType(player, allowedDecks) {
  if (allowedDecks.includes('system') && player.systemDeck.length > 0) return 'system';
  return allowedDecks[0] || 'system';
}

function chooseRevealedCard(cards) {
  const priorities = ['ram', 'collecte', 'hotfix', 'stack_spike', 'injection', 'pollution'];
  const rank = (card) => {
    const index = priorities.indexOf(card.key);
    return index === -1 ? priorities.length : index;
  };
  return [...cards].sort((a, b) => rank(a) - rank(b))[0] || cards[0] || null;
}
