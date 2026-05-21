import { PHASES } from './rules.js';
import {
  canEndTurn,
  canPlayCard,
  canRebootCurrentPlayer,
  canUseOverclock,
  drawForPlayer,
  endTurn,
  getPendingDeckEffect,
  getPendingUpdates,
  getState,
  logAction,
  newGame,
  playCard,
  rebootCurrentPlayer,
  resolvePendingDeckEffect,
  updateFunction,
  useOverclock,
  validateUpdatePhase
} from './game-engine.js';

const MAX_BOT_STEPS = 80;
const BOT_PROFILES = ['pedagogique', 'equilibre', 'agressif'];
const PROFILE_LABELS = {
  pedagogique: 'pédagogique',
  equilibre: 'équilibré',
  agressif: 'agressif'
};

export function startSoloGame(humanName = 'Joueur Cyan', botName = 'Ordinateur', options = {}) {
  const state = newGame(humanName, botName);
  state.soloMode = true;
  state.botIndex = 1;
  state.botProfile = normalizeBotProfile(options.botProfile || options.botDifficulty);
  state.players.forEach((player) => {
    player.isBot = player.index === state.botIndex;
    player.botReactionsThisTurn = 0;
    player.botLastReactionLogSequence = 0;
    player.botReactionLockSequence = 0;
  });
  return state;
}

export function getBotProfileLabel(profile = getState()?.botProfile) {
  return PROFILE_LABELS[normalizeBotProfile(profile)];
}

export function runBotStep(botIndex = getState()?.botIndex) {
  const state = getState();
  if (!state || state.winner !== null || botIndex === null || state.currentPlayerIndex !== botIndex) return false;

  const effect = getPendingDeckEffect();
  if (effect && effect.ownerIndex !== botIndex) return false;
  if (resolveBotPendingEffect(botIndex)) return true;
  if (state.winner !== null || state.currentPlayerIndex !== botIndex) return false;

  if (shouldVoluntaryReboot(botIndex)) {
    explainBot({ kind: 'reboot' });
    return rebootCurrentPlayer();
  }

  if (state.phase === PHASES.UPDATE) {
    const pending = getPendingUpdates(state.players[botIndex]);
    if (pending.length === 0) {
      explainBot({ kind: 'validateUpdate' });
      return validateUpdatePhase();
    }
    const target = chooseUpdateTarget(state.players[botIndex], pending);
    explainBot({ kind: 'update', target });
    return updateFunction(target.id);
  }

  if (state.phase === PHASES.DRAW) {
    explainBot({ kind: 'draw' });
    drawForPlayer('system');
    return true;
  }

  if (state.phase === PHASES.ACTION) {
    const action = chooseAction(botIndex);
    if (action) return executeBotAction(botIndex, action);
    if (canEndTurn()) {
      explainBot({ kind: 'endTurn' });
      return endTurn();
    }
  }

  return false;
}

export function runBotTurn(botIndex = getState()?.botIndex) {
  const state = getState();
  if (!state || state.winner !== null || botIndex === null || state.currentPlayerIndex !== botIndex) return false;

  let changed = false;
  for (let step = 0; step < MAX_BOT_STEPS; step += 1) {
    const acted = runBotStep(botIndex);
    changed = acted || changed;
    if (!acted || state.winner !== null || state.currentPlayerIndex !== botIndex) return changed;
  }

  explainBot({ kind: 'endTurn', reason: 'limite de sécurité atteinte' });
  return changed;
}

export function maybeReactToHumanAction(botIndex = getState()?.botIndex) {
  const state = getState();
  if (!state || state.winner !== null || botIndex === null || state.currentPlayerIndex === botIndex) return false;

  const effect = getPendingDeckEffect();
  if (effect && effect.ownerIndex !== botIndex) return false;
  resolveBotPendingEffect(botIndex);

  const bot = state.players[botIndex];
  if (!bot?.isBot) return false;
  if ((bot.botReactionsThisTurn || 0) >= 2) return false;
  if ((state.logSequence || 0) <= (bot.botReactionLockSequence || 0)) return false;

  const triggerSequence = latestHumanActionSequence(state, botIndex);
  if (triggerSequence <= (bot.botLastReactionLogSequence || 0)) return false;

  const action = chooseReaction(botIndex);
  if (!action) return false;

  const changed = executeBotAction(botIndex, action);
  if (changed) {
    bot.botReactionsThisTurn = (bot.botReactionsThisTurn || 0) + 1;
    bot.botLastReactionLogSequence = triggerSequence;
    bot.botReactionLockSequence = state.logSequence || triggerSequence;
  }
  return changed;
}

function chooseAction(botIndex) {
  const state = getState();
  const bot = state.players[botIndex];
  const profile = normalizeBotProfile(state.botProfile);

  const broken = bot.active
    .filter((fn) => fn.broken)
    .sort((a, b) => b.memUsed - a.memUsed)[0];
  if (broken) {
    const clean = findPlayableCard(bot, 'collecte');
    if (clean) return { kind: 'card', card: clean, target: broken, targetData: { functionId: broken.id }, reason: 'nettoyer une fonction cassée libère de la mémoire' };
    const repair = findPlayableCard(bot, 'hotfix');
    if (repair) return { kind: 'card', card: repair, target: broken, targetData: { functionId: broken.id }, reason: 'réparer garde une chance de marquer plus tard' };
  }

  const ram = findPlayableCard(bot, 'ram');
  if (ram && bot.memFree <= (profile === 'agressif' ? 4 : 5)) return { kind: 'card', card: ram, reason: 'la mémoire libre est basse' };

  const planifier = findPlayableCard(bot, 'planificateur');
  if (planifier && bot.active.some((fn) => !fn.broken && !fn.reachedZero)) return { kind: 'card', card: planifier, reason: 'empiler sera plus lisible et moins risqué' };

  const overclock = findPlayableCard(bot, 'overclock');
  if (overclock && bot.active.some((fn) => !fn.broken && fn.reachedZero)) return { kind: 'card', card: overclock, reason: 'une fonction prête à dépiler peut profiter du tempo' };

  const overclockTarget = chooseOverclockTarget();
  if (overclockTarget) return { kind: 'overclock', target: overclockTarget };

  if (profile !== 'pedagogique' || getState().turn >= 4) {
    const pressure = choosePressureAction(botIndex, profile, false);
    if (pressure) return pressure;
  }

  const functionCard = chooseFunctionCard(bot, profile);
  if (functionCard && bot.active.length < 3 && bot.memFree >= functionCard.cost) {
    const R = chooseDepth(bot, functionCard, profile);
    return { kind: 'card', card: functionCard, targetData: { R }, reason: depthReason(profile, functionCard, R) };
  }

  return null;
}

function chooseReaction(botIndex) {
  const state = getState();
  const profile = normalizeBotProfile(state.botProfile);
  const minScore = profile === 'pedagogique' ? 24 : profile === 'agressif' ? 13 : 18;
  return choosePressureAction(botIndex, profile, true, minScore);
}

function choosePressureAction(botIndex, profile, reaction = false, minScore = 0) {
  const state = getState();
  const bot = state.players[botIndex];
  const actions = [];

  const spike = findPlayableCard(bot, 'stack_spike');
  const spikeTarget = bestStackSpikeTarget(state, botIndex, profile);
  if (spike && spikeTarget) {
    actions.push({
      kind: 'card',
      card: spike,
      target: spikeTarget,
      targetData: { functionId: spikeTarget.id },
      score: disruptionScore(spikeTarget) + 8,
      reason: `la fonction adverse a ${spikeTarget.frames.length} cadres`
    });
  }

  const injection = findPlayableCard(bot, 'injection');
  const injectionTarget = bestDisruptionTarget(state, botIndex, profile, true);
  if (injection && injectionTarget && (profile !== 'pedagogique' || !reaction)) {
    actions.push({
      kind: 'card',
      card: injection,
      target: injectionTarget,
      targetData: { functionId: injectionTarget.id },
      score: disruptionScore(injectionTarget) + (profile === 'agressif' ? 6 : 1),
      reason: 'la cible a un bon potentiel et peut manquer de mémoire'
    });
  }

  const pollution = findPlayableCard(bot, 'pollution');
  const pollutionTarget = bestDisruptionTarget(state, botIndex, profile, false);
  if (!reaction && pollution && pollutionTarget && profile !== 'pedagogique') {
    actions.push({
      kind: 'card',
      card: pollution,
      target: pollutionTarget,
      targetData: { functionId: pollutionTarget.id },
      score: disruptionScore(pollutionTarget) + (profile === 'agressif' ? 5 : 0),
      reason: 'ajouter des parasites ralentit une fonction menaçante'
    });
  }

  return actions
    .filter((action) => action.score >= minScore)
    .sort((a, b) => b.score - a.score)[0] || null;
}

function executeBotAction(botIndex, action) {
  if (action.kind === 'overclock') {
    explainBot(action);
    return useOverclock(action.target.id);
  }
  explainBot(action);
  return safePlayCard(botIndex, action.card, action.targetData);
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

function chooseFunctionCard(player, profile) {
  const readable = ['sentinelle', 'factorielle', 'compactage', 'tri_fusion'];
  return player.hand
    .filter((card) => card.type === 'Fonction')
    .sort((a, b) => functionScore(player, b, profile, readable) - functionScore(player, a, profile, readable))[0];
}

function functionScore(player, card, profile, readable) {
  let score = 20 - card.cost + card.value;
  if (readable.includes(card.key)) score += profile === 'pedagogique' ? 8 : 2;
  if (profile === 'agressif' && ['quicksort', 'expansion', 'glouton'].includes(card.key)) score += 6;
  if (profile === 'pedagogique' && ['quicksort', 'glouton'].includes(card.key)) score -= 5;
  if (player.memFree - card.cost <= 2) score -= 4;
  return score;
}

function chooseDepth(player, card, profile = normalizeBotProfile(getState()?.botProfile)) {
  if (card.mode === 'fixe') return card.maxR;
  const safeMemoryDepth = Math.max(0, player.memFree - card.cost - 2);
  if (profile === 'pedagogique') {
    const preferred = card.maxR >= 2 && player.memFree >= card.cost + 3 ? 2 : 1;
    return Math.max(0, Math.min(card.maxR, preferred, Math.max(1, safeMemoryDepth)));
  }
  if (profile === 'agressif') {
    const ambitious = player.memFree >= card.cost + 5 ? card.maxR : Math.max(2, safeMemoryDepth + 1);
    return Math.max(0, Math.min(card.maxR, ambitious));
  }
  if (player.memFree <= card.cost + 1) return Math.min(1, card.maxR);
  if (player.memFree <= card.cost + 3) return Math.min(2, card.maxR);
  return Math.min(card.maxR, Math.max(2, player.memFree - card.cost - 2));
}

function chooseOverclockTarget() {
  const state = getState();
  const player = state.players[state.currentPlayerIndex];
  return player.active
    .filter((fn) => !fn.broken && canUseOverclock(fn.id))
    .sort((a, b) => Number(b.reachedZero) - Number(a.reachedZero) || a.frames.length - b.frames.length)[0] || null;
}

function findPlayableCard(player, key) {
  return player.hand.find((card) => card.key === key && canPlayCard(player.index, card.id));
}

function safePlayCard(playerIndex, card, targetData = {}) {
  return Boolean(card && canPlayCard(playerIndex, card.id) && playCard(playerIndex, card.id, targetData));
}

function bestStackSpikeTarget(state, botIndex, profile = 'equilibre') {
  const opponent = state.players[1 - botIndex];
  return opponent.active
    .filter((fn) => !fn.broken && [4, 5].includes(fn.frames.length))
    .sort((a, b) => disruptionScore(b, profile) - disruptionScore(a, profile))[0] || null;
}

function bestDisruptionTarget(state, botIndex, profile = 'equilibre', allowAnyOwner = false) {
  const candidates = allowAnyOwner
    ? state.players.flatMap((player) => player.active.map((fn) => ({ ...fn, ownerIndex: player.index })))
    : state.players[1 - botIndex].active;
  return candidates
    .filter((fn) => !fn.broken && fn.ownerIndex !== botIndex)
    .sort((a, b) => disruptionScore(b, profile) - disruptionScore(a, profile))[0] || null;
}

function disruptionScore(fn, profile = 'equilibre') {
  const closeToScore = fn.reachedZero ? 8 : Math.max(0, fn.R - Math.max(0, fn.nextValue || 0));
  const vulnerable = [4, 5].includes(fn.frames.length) ? 6 : 0;
  const aggressiveBoost = profile === 'agressif' ? closeToScore + vulnerable : 0;
  return fn.frames.length * 3 + fn.R + fn.value + closeToScore + vulnerable + aggressiveBoost;
}

function shouldVoluntaryReboot(botIndex) {
  const state = getState();
  const bot = state.players[botIndex];
  if (!canRebootCurrentPlayer() || bot.turnActionsTaken) return false;
  const stuckMemory = bot.active.filter((fn) => fn.broken).reduce((sum, fn) => sum + fn.memUsed, 0);
  const weakHand = bot.hand.length <= 2 || bot.hand.every((card) => (
    card.type !== 'Fonction'
    && !['ram', 'collecte', 'hotfix'].includes(card.key)
  ));
  return stuckMemory >= 5 && weakHand && bot.memFree <= 2;
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
  explainBot({ kind: 'pendingEffect', effect });
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

function latestHumanActionSequence(state, botIndex) {
  const activeHuman = state.players[state.currentPlayerIndex]?.isBot
    ? null
    : state.players[state.currentPlayerIndex]?.name;
  return [...state.log]
    .reverse()
    .find((entry) => (
      entry.actorIndex !== undefined
        ? entry.actorIndex !== botIndex
        : activeHuman !== null && entry.player === activeHuman
    ))
    ?.order || 0;
}

function explainBot(action) {
  const state = getState();
  if (!state) return;
  const bot = state.players[state.botIndex ?? state.currentPlayerIndex];
  logAction(state, describeBotDecision(action), 'sys', { player: bot?.name || 'Ordinateur' });
}

function describeBotDecision(action) {
  if (action.kind === 'pendingEffect') return 'Ordinateur résout son effet de pioche en attente pour continuer le tour.';
  if (action.kind === 'validateUpdate') return 'Ordinateur valide la mise à jour : aucune fonction restante à traiter.';
  if (action.kind === 'draw') return 'Ordinateur pioche une carte Système avant sa phase de conception.';
  if (action.kind === 'update') {
    const detail = action.target?.reachedZero
      ? 'elle dépile et peut libérer de la mémoire'
      : 'elle progresse vers son cas de base';
    return `Ordinateur choisit de mettre à jour ${action.target?.name || 'une fonction'} car ${detail}.`;
  }
  if (action.kind === 'overclock') return `Ordinateur active Overclocking sur ${action.target.name} pour accélérer une fonction déjà utile.`;
  if (action.kind === 'reboot') return 'Ordinateur choisit un reboot volontaire : trop de mémoire bloquée.';
  if (action.kind === 'endTurn') return `Ordinateur termine son tour : ${action.reason || 'aucune action utile ou légale restante'}.`;
  if (action.kind === 'card') {
    if (action.card.type === 'Fonction') return `Ordinateur lance ${action.card.name} avec R=${action.targetData.R} : ${action.reason}.`;
    if (action.card.key === 'stack_spike') return `Ordinateur joue Stack Spike sur ${action.target.name} : ${action.reason}.`;
    if (action.card.key === 'injection') return `Ordinateur joue Injection de Boucle sur ${action.target.name} : ${action.reason}.`;
    if (action.card.key === 'pollution') return `Ordinateur joue Pollution de Cache sur ${action.target.name} : ${action.reason}.`;
    if (action.card.key === 'collecte') return `Ordinateur nettoie ${action.target.name} pour libérer de la mémoire.`;
    return `Ordinateur joue ${action.card.name} : ${action.reason || 'le coup est légal et utile'}.`;
  }
  return 'Ordinateur choisit une action légale.';
}

function depthReason(profile, card, R) {
  if (profile === 'pedagogique') return `profondeur prudente R=${R}, plus lisible et moins punitive`;
  if (profile === 'agressif') return `mémoire suffisante et bon potentiel de score`;
  return `mémoire suffisante et progression raisonnable`;
}

function normalizeBotProfile(profile) {
  return BOT_PROFILES.includes(profile) ? profile : 'equilibre';
}
