import { createGameState, drawFromDeck, drawStartingHand, createFunctionFrame, restoreState, cloneStateForSave } from './game-state.js';
import { CARD_DEFINITIONS, DECK_COMPOSITION, createCard } from './cards.js';
import { MAX_FRAMES_PER_FUNCTION, PHASES, bonusRecursion, isWinningState } from './rules.js';
import { saveLocalState, exportStateToClipboard, importStateFromJson, saveRemoteGame } from './storage.js';

let gameState = null;

export function getState() {
  return gameState;
}

function createUndoPoint() {
  if (!gameState) return null;
  const snapshot = cloneStateForSave(gameState);
  const stack = gameState.undoStack || [];
  stack.push(snapshot);
  while (stack.length > 30) stack.shift();
  gameState.undoStack = stack;
  return snapshot;
}

function discardUndoPoint(snapshot) {
  if (!snapshot || !gameState?.undoStack) return;
  const index = gameState.undoStack.lastIndexOf(snapshot);
  if (index !== -1) gameState.undoStack.splice(index, 1);
}

export function canUndo() {
  return Boolean(gameState?.undoStack?.length);
}

export function undoLastAction() {
  if (!canUndo()) return false;
  const stack = gameState.undoStack;
  const previous = stack.pop();
  const restored = restoreState(previous);
  restored.undoStack = stack;
  gameState = restored;
  persistGameState();
  return true;
}

export function newGame(player1, player2) {
  gameState = createGameState(player1, player2);
  gameState.undoStack = [];
  gameState.phase = PHASES.UPDATE;
  gameState.log = [];
  logAction(gameState, `Nouvelle partie locale créée par ${player1} et ${player2}.`, 'sys');
  logAction(gameState, `Main de départ : 3 cartes Fonctions, 2 cartes Système.`, 'sys');
  beginTurn();
  return gameState;
}

export function loadGame(state) {
  gameState = restoreState(state);
  gameState.log = gameState.log || [];
  gameState.apiAvailable = gameState.apiAvailable || false;
  gameState.isRemote = Boolean(gameState.remoteCode);
  if (gameState.winner !== null) gameState.phase = PHASES.GAME_OVER;
  return gameState;
}

export function setRemoteCode(code) {
  if (!gameState) return;
  gameState.remoteCode = code;
  gameState.isRemote = Boolean(code);
}

export function persistGameState() {
  if (!gameState) return;
  saveLocalState(gameState);
  if (gameState.isRemote && gameState.remoteCode) {
    saveRemoteGame(gameState.remoteCode, cloneStateForSave(gameState))
      .then((response) => {
        if (!response?.success) {
          logAction(gameState, 'Sauvegarde serveur échouée.', 'warn');
        }
      })
      .catch(() => {
        logAction(gameState, 'Sauvegarde serveur impossible.', 'warn');
      });
  }
}

export function saveGame() {
  persistGameState();
  logAction(gameState, 'Partie sauvegardée localement.', 'sys');
}

export function exportGame() {
  exportStateToClipboard(gameState);
}

export function importGame(jsonText) {
  const state = importStateFromJson(jsonText);
  if (state) loadGame(state);
  return state;
}

export function startServerGame(state) {
  gameState = restoreState(state);
  gameState.apiAvailable = true;
  gameState.isRemote = Boolean(gameState.remoteCode);
  if (gameState.winner !== null) gameState.phase = PHASES.GAME_OVER;
  return gameState;
}

export function beginTurn() {
  const player = getCurrentPlayer();
  player.updatedThisTurn = [];
  player.planifierUsed = false;
  player.overclockTarget = null;
  player.overclockUsed = false;
  player.rebootedThisTurn = false;
  player.completedThisTurn = false;
  gameState.phase = PHASES.UPDATE;
  logAction(gameState, `Début du tour ${gameState.turn} de ${player.name} : phase de mise à jour.`, 'sys');
  if (player.active.filter((fn) => !fn.broken).length === 0) {
    logAction(gameState, `Aucune fonction active à mettre à jour : phase de mise à jour terminée automatiquement.`, 'sys');
    advanceAfterUpdatePhase();
  }
}

export function getCurrentPlayer() {
  return gameState.players[gameState.currentPlayerIndex];
}

export function getOpponentPlayer() {
  return gameState.players[1 - gameState.currentPlayerIndex];
}

export function getFunctionEffectSummary(func) {
  const bonus = bonusRecursion(func.R);
  const fallback = {
    base: 'aucun effet particulier',
    up: 'aucun effet particulier',
    terminal: 'aucun effet particulier'
  };
  const summaries = {
    factorielle: {
      base: 'pioche 1 carte',
      up: 'gagne 1 mémoire libre',
      terminal: `gagne B(${func.R})=${bonus} mémoire libre`
    },
    tri_fusion: {
      base: 'pioche 1 carte',
      up: 'réordonne virtuellement les cartes du dessus',
      terminal: `retire jusqu’à B(${func.R})=${bonus} parasite(s)`
    },
    recherche: {
      base: 'révèle puis prend 1 carte',
      up: 'retire 1 cadre parasite',
      terminal: `pioche B(${func.R})+1=${bonus + 1} carte(s)`
    },
    sentinelle: {
      base: 'regarde le dessus d’une pile',
      up: 'gagne 1 mémoire libre',
      terminal: `pioche B(${func.R})=${bonus} carte(s)`
    },
    glouton: {
      base: 'pioche 1 carte',
      up: 'l’adversaire perd 1 mémoire libre',
      terminal: `ajoute B(${func.R})=${bonus} parasite(s) chez l’adversaire`
    },
    archiviste: {
      base: 'regarde 2 cartes',
      up: 'gagne 1 mémoire libre',
      terminal: `pioche B(${func.R})=${bonus} carte(s), puis défausse 1 carte`
    },
    quicksort: {
      base: 'pioche 1 carte',
      up: 'l’adversaire perd 1 mémoire libre',
      terminal: `l’adversaire perd B(${func.R})=${bonus} mémoire libre`
    },
    expansion: {
      base: 'pioche 1 carte',
      up: 'gagne 1 mémoire libre',
      terminal: `gagne B(${func.R})=${bonus} mémoire libre`
    },
    compactage: {
      base: 'gagne 1 mémoire libre',
      up: 'gagne 1 mémoire libre',
      terminal: `nettoie une fonction cassée${bonus >= 2 ? ' puis pioche 1 carte' : ''}`
    }
  };
  return summaries[func.cardKey] || fallback;
}

export function getNextFunctionEffect(func) {
  const effects = getFunctionEffectSummary(func);
  const top = func.frames[func.frames.length - 1];
  const bonus = bonusRecursion(func.R);

  if (func.broken) {
    return {
      label: 'Cassée',
      text: `Aucun effet tant que ${func.name} n’est pas réparée ou nettoyée. Elle occupe encore ${func.memUsed} mémoire.`
    };
  }

  if (!func.reachedZero) {
    if (func.frames.length >= MAX_FRAMES_PER_FUNCTION) {
      return {
        label: 'Overflow',
        text: 'Prochaine mise à jour : tentative d’empiler un 7e cadre. La fonction cassera avant de progresser.'
      };
    }
    return {
      label: 'Empilage',
      text: func.nextValue === 0
        ? `Prochaine mise à jour : empile [0]. Le cas de base sera prêt ensuite : ${effects.base}.`
        : `Prochaine mise à jour : empile [${func.nextValue}] et consomme 1 mémoire libre.`
    };
  }

  if (top === 'P') {
    return {
      label: 'Parasite',
      text: 'Prochaine mise à jour : dépile un cadre parasite, sans effet de carte.'
    };
  }

  if (top === 0) {
    return {
      label: 'Cas de base',
      text: `Prochaine mise à jour : dépile [0] et applique le cas de base : ${effects.base}.`
    };
  }

  if (func.frames.length === 1) {
    return {
      label: 'Remontée + terminaison',
      text: `Prochaine mise à jour : applique la remontée (${effects.up}), puis termine pour +${func.value}+B(${func.R})=${func.value + bonus} points et ${effects.terminal}.`
    };
  }

  return {
    label: 'Remontée',
    text: `Prochaine mise à jour : dépile [${top}] et applique la remontée : ${effects.up}.`
  };
}

function hasHardware(player, key) {
  return player.hardware.some((hardware) => hardware.key === key);
}

function clampMemory(player) {
  const temporaryLimit = Math.max(0, player.tempMemory || 0);
  player.memTotal = Math.max(0, player.memTotal);
  player.memFree = Math.max(0, Math.min(player.memFree, player.memTotal + temporaryLimit));
}

function canPayMemory(player, amount) {
  return player.memFree >= amount;
}

function payMemory(player, amount) {
  if (!canPayMemory(player, amount)) {
    logAction(gameState, `${player.name} n’a pas assez de mémoire libre.`, 'warn');
    return false;
  }
  player.memFree -= amount;
  if (player.tempMemory > 0) {
    player.tempMemory = Math.max(0, player.tempMemory - amount);
  }
  clampMemory(player);
  return true;
}

function releaseMemory(player, amount) {
  player.memFree += amount;
  clampMemory(player);
}

function loseMemory(player, amount) {
  player.memFree = Math.max(0, player.memFree - amount);
  if (player.tempMemory > 0) {
    player.tempMemory = Math.max(0, player.tempMemory - amount);
  }
  clampMemory(player);
}

export function canPlayCard(playerIndex = gameState?.currentPlayerIndex, cardId = null) {
  if (!gameState || gameState.winner !== null) return false;
  const player = gameState.players[playerIndex];
  if (!player || player.rebootedThisTurn) return false;
  const card = cardId ? player.hand.find((item) => item.id === cardId) : null;
  if (card && player.memFree < card.cost) return false;
  if (player.index === gameState.currentPlayerIndex) {
    return gameState.phase === PHASES.ACTION;
  }
  return card?.type === 'Interrupt';
}

export function canEndTurn() {
  if (gameState.winner !== null) return false;
  return gameState.phase === PHASES.ACTION;
}

export function drawForPlayer(deckType) {
  if (gameState.phase !== PHASES.DRAW || gameState.winner !== null) return null;
  if (deckType !== 'system') {
    logAction(gameState, 'La phase de pioche ne permet pas de tirer une nouvelle Fonction. Une Fonction arrive automatiquement quand une fonction se termine, ou pendant un reboot.', 'warn');
    persistGameState();
    return null;
  }
  const undoPoint = createUndoPoint();
  const player = getCurrentPlayer();
  const card = drawFromDeck(player, 'system');
  if (!card) {
    const changed = handleDeckExhaustion(player);
    if (!changed) logAction(gameState, `${player.name} ne peut pas piocher : la pile Système est vide.`, 'warn');
    if (gameState.phase !== PHASES.GAME_OVER) {
      gameState.phase = PHASES.ACTION;
      logAction(gameState, 'Phase de conception commencée sans nouvelle carte Système.', 'sys');
    }
    persistGameState();
    return null;
  }
  logAction(gameState, `${player.name} pioche dans la pile Système et reçoit ${card.name}.`);
  gameState.phase = PHASES.ACTION;
  persistGameState();
  return card;
}

export function handleDeckExhaustion(player) {
  if (player.functionsDeck.length === 0 && player.systemDeck.length === 0) {
    player.memTotal -= 1;
    clampMemory(player);
    logAction(gameState, `${player.name} n’a plus de cartes : -1 mémoire totale.`, 'warn');
    if (player.memTotal <= 0) {
      gameState.winner = getOpponentPlayer().index;
      gameState.phase = PHASES.GAME_OVER;
      logAction(gameState, `${player.name} tombe à 0 mémoire totale. ${getOpponentPlayer().name} gagne.`, 'bad');
    }
    return true;
  }
  return false;
}

export function validateUpdatePhase() {
  if (gameState.phase !== PHASES.UPDATE) return false;
  const player = getCurrentPlayer();
  const pending = player.active.filter((fn) => !fn.broken && !player.updatedThisTurn.includes(fn.id));
  if (pending.length > 0) return false;
  createUndoPoint();
  advanceAfterUpdatePhase();
  persistGameState();
  return true;
}

function advanceAfterUpdatePhase() {
  if (gameState.firstTurn && gameState.turn === 1 && gameState.currentPlayerIndex === 0) {
    gameState.firstTurn = false;
    gameState.phase = PHASES.ACTION;
    logAction(gameState, 'Premier joueur : phase de pioche sautée au premier tour.', 'sys');
  } else {
    gameState.phase = PHASES.DRAW;
    logAction(gameState, 'Phase de pioche commencée.', 'sys');
  }
}

export function updateFunction(functionId, extra = false, options = {}) {
  if (gameState.phase !== PHASES.UPDATE || gameState.winner !== null) return false;
  const player = getCurrentPlayer();
  const func = player.active.find((item) => item.id === functionId);
  if (!func || func.broken) return false;
  if (player.updatedThisTurn.includes(func.id) && !extra) return false;
  if (!options.skipUndo) createUndoPoint();

  if (!func.reachedZero) {
    if (func.frames.length >= MAX_FRAMES_PER_FUNCTION) {
      breakFunction(player, func, 'overflow au 7e cadre');
      markFunctionUpdated(player, func, extra);
      persistGameState();
      return true;
    }
    const freeStack = hasHardware(player, 'planificateur') && !player.planifierUsed;
    const extraCost = freeStack ? 0 : 1;
    if (!canPayMemory(player, extraCost)) {
      breakFunction(player, func, 'mémoire insuffisante pendant l’empilement');
      markFunctionUpdated(player, func, extra);
      persistGameState();
      return true;
    }
    if (extraCost > 0) payMemory(player, extraCost);
    if (freeStack) player.planifierUsed = true;
    func.frames.push(func.nextValue);
    func.memUsed += 1;
    logAction(gameState, `${player.name} empile [${func.nextValue}] sur ${func.name}${freeStack ? ' gratuitement grâce au Planificateur local' : ''}.`, 'sys');
    func.nextValue -= 1;
    if (func.frames[func.frames.length - 1] === 0) {
      func.reachedZero = true;
      logAction(gameState, `${func.name} atteint [0] et commencera à dépiler au prochain update.`, 'good');
    }
  } else {
    const popped = func.frames.pop();
    logAction(gameState, `${player.name} dépile ${popped === 'P' ? 'un parasite' : `[${popped}]`} de ${func.name}.`, 'sys');
    if (popped !== 'P') {
      const poppedInitialFrame = func.frames.length === 0;
      if (!poppedInitialFrame) {
        func.memUsed = Math.max(func.cost, func.memUsed - 1);
        releaseMemory(player, 1);
      }
      if (popped === 0) applyBaseEffect(player, func);
      else applyUpEffect(player, func, popped);
    }
    if (func.frames.length === 0) {
      completeFunction(player, func);
    }
  }

  markFunctionUpdated(player, func, extra);
  checkVictory(player);
  persistGameState();
  return true;
}

function markFunctionUpdated(player, func, extra) {
  if (!extra && !player.updatedThisTurn.includes(func.id)) {
    player.updatedThisTurn.push(func.id);
  }
}

function applyBaseEffect(player, func) {
  switch (func.cardKey) {
    case 'factorielle':
    case 'tri_fusion':
    case 'glouton':
    case 'quicksort':
    case 'expansion':
      logAction(gameState, `${func.name} — cas de base : ${formatDrawnCards(drawSystemCards(player, 1))}.`, 'good');
      break;
    case 'compactage':
      releaseMemory(player, 1);
      logAction(gameState, `${func.name} — cas de base : ${player.name} gagne 1 mémoire libre.`, 'good');
      break;
    case 'recherche':
      logAction(gameState, `${func.name} — cas de base : révèle puis prend ${formatDrawnCards(drawSystemCards(player, 1))}.`, 'good');
      break;
    case 'sentinelle':
      logAction(gameState, `${func.name} — cas de base : ${player.name} regarde le dessus d’une pile.`, 'sys');
      break;
    case 'archiviste':
      logAction(gameState, `${func.name} — cas de base : ${player.name} regarde 2 cartes.`, 'sys');
      break;
    default:
      break;
  }
}

function applyUpEffect(player, func, value) {
  switch (func.cardKey) {
    case 'factorielle':
    case 'sentinelle':
    case 'archiviste':
    case 'expansion':
    case 'compactage':
      releaseMemory(player, 1);
      logAction(gameState, `${func.name} — remontée [${value}] : ${player.name} gagne 1 mémoire libre.`, 'good');
      break;
    case 'glouton':
    case 'quicksort':
      const opponent = getOpponentPlayer();
      loseMemory(opponent, 1);
      logAction(gameState, `${func.name} — remontée [${value}] : ${opponent.name} perd 1 mémoire libre.`, 'bad');
      break;
    case 'recherche':
      removeParasites(player, 1);
      break;
    case 'tri_fusion':
      logAction(gameState, `${func.name} — remontée [${value}] : réordonne virtuellement les cartes du dessus.`, 'sys');
      break;
    default:
      break;
  }
}

function completeFunction(player, func) {
  const bonus = bonusRecursion(func.R);
  const gain = func.value + bonus;
  player.score += gain;
  player.completed.push({ key: func.cardKey, name: func.name });
  logAction(gameState, `${func.name} — terminaison : ${player.name} marque ${func.value} + B(${func.R})=${bonus}, soit +${gain} points.`, 'good');
  removeActiveFunction(player, func.id);
  discardFunction(player, func);
  applyTerminalEffect(player, func, bonus);
  func.memUsed = Math.min(func.memUsed, func.cost);
  releaseMemory(player, func.memUsed);
  drawReplacementFunction(player, func);
  player.completedThisTurn = true;
}

function applyTerminalEffect(player, func, bonus) {
  const opponent = getOpponentPlayer();
  switch (func.cardKey) {
    case 'factorielle':
    case 'expansion':
      releaseMemory(player, bonus);
      logAction(gameState, `${func.name} — effet de terminaison : ${player.name} gagne ${bonus} mémoire libre.`, 'good');
      break;
    case 'sentinelle':
      logAction(gameState, `${func.name} — effet de terminaison : ${formatDrawnCards(drawSystemCards(player, bonus))}.`, 'good');
      break;
    case 'glouton':
      addParasitesToPlayer(opponent, bonus);
      break;
    case 'quicksort':
      loseMemory(opponent, bonus);
      logAction(gameState, `${func.name} — effet de terminaison : ${opponent.name} perd ${bonus} mémoire libre.`, 'bad');
      break;
    case 'archiviste':
      logAction(gameState, `${func.name} — effet de terminaison : ${formatDrawnCards(drawSystemCards(player, bonus))}.`, 'good');
      if (player.hand.length > 0) discardCardFromHand(player, player.hand[0].id, true);
      logAction(gameState, `${func.name} — effet de terminaison : ${player.name} défausse 1 carte après la pioche.`, 'sys');
      break;
    case 'tri_fusion':
      removeParasites(player, bonus);
      break;
    case 'compactage':
      cleanBrokenFunction(player);
      if (bonus >= 2) logAction(gameState, `${func.name} — effet de terminaison : ${formatDrawnCards(drawSystemCards(player, 1))}.`, 'good');
      break;
    case 'recherche':
      logAction(gameState, `${func.name} — effet de terminaison : ${formatDrawnCards(drawSystemCards(player, bonus + 1))}.`, 'good');
      break;
    default:
      break;
  }
}

export function logAction(state, text, cls = '', context = {}) {
  state.logSequence = (state.logSequence || 0) + 1;
  const player = context.player || state.players?.[state.currentPlayerIndex]?.name || 'Système';
  state.log.push({
    text,
    cls,
    order: state.logSequence,
    turn: state.turn,
    player,
    phase: context.phase || formatPhaseForLog(state.phase)
  });
  if (state.log.length > 200) state.log.shift();
}

function formatPhaseForLog(phase) {
  if (phase === PHASES.UPDATE) return 'Mise à jour';
  if (phase === PHASES.DRAW) return 'Pioche';
  if (phase === PHASES.ACTION) return 'Conception';
  if (phase === PHASES.GAME_OVER) return 'Fin de partie';
  return 'Mise en place';
}

function removeActiveFunction(player, functionId) {
  player.active = player.active.filter((fn) => fn.id !== functionId);
}

function drawSystemCards(player, count) {
  const drawn = [];
  for (let i = 0; i < count; i += 1) {
    const card = drawFromDeck(player, 'system');
    if (!card) break;
    drawn.push(card);
  }
  return drawn;
}

function drawReplacementFunction(player, func) {
  const card = drawFromDeck(player, 'functions');
  if (card) {
    logAction(gameState, `${player.name} remplace ${func.name} terminée : pioche automatique de ${card.name} depuis la pile Fonctions.`, 'good');
    return;
  }
  logAction(gameState, `${player.name} devrait piocher une Fonction de remplacement, mais la pile Fonctions est vide.`, 'warn');
}

function formatDrawnCards(cards) {
  if (cards.length === 0) return 'aucune carte piochée';
  const shown = cards.slice(0, 3).map((card) => card.name).join(', ');
  const suffix = cards.length > 3 ? `, +${cards.length - 3} autre(s)` : '';
  return `${cards.length} carte(s) piochée(s) : ${shown}${suffix}`;
}

function removeCardFromHand(player, cardId) {
  const index = player.hand.findIndex((c) => c.id === cardId);
  if (index === -1) return null;
  const [card] = player.hand.splice(index, 1);
  return card;
}

function discardCardFromHand(player, cardId, silent = false) {
  const card = removeCardFromHand(player, cardId);
  if (!card) return;
  player.discard.push(card);
  if (!silent) logAction(gameState, `${player.name} défausse ${card.name}.`, 'sys');
}

function discardFunction(player, func) {
  player.discard.push({ key: func.cardKey, name: func.name, type: 'Fonction' });
}

function removeParasites(player, count) {
  let removed = 0;
  player.active.forEach((func) => {
    while (removed < count) {
      const parasiteIndex = func.frames.indexOf('P');
      if (parasiteIndex === -1) break;
      func.frames.splice(parasiteIndex, 1);
      removed += 1;
    }
  });
  if (removed > 0) logAction(gameState, `${player.name} retire ${removed} parasite(s).`, 'good');
}

function cleanBrokenFunction(player, functionId = null) {
  const broken = functionId
    ? player.active.find((fn) => fn.broken && fn.id === functionId)
    : player.active.find((fn) => fn.broken);
  if (!broken) {
    logAction(gameState, 'Aucune fonction cassée à nettoyer.', 'warn');
    return false;
  }
  player.active = player.active.filter((fn) => fn.id !== broken.id);
  discardFunction(player, broken);
  releaseMemory(player, broken.memUsed);
  logAction(gameState, `${player.name} nettoie ${broken.name} et libère ${broken.memUsed} mémoire.`, 'good');
  return true;
}

function breakFunction(player, func, reason) {
  func.broken = true;
  func.frames = func.frames.slice(0, func.frames.length);
  logAction(gameState, `${func.name} casse : ${reason}.`, 'bad');
}

export function canUseOverclock(functionId) {
  if (!gameState || gameState.phase !== PHASES.UPDATE || gameState.winner !== null) return false;
  const player = getCurrentPlayer();
  if (!hasHardware(player, 'overclock') || player.overclockUsed) return false;
  return player.active.some((fn) => fn.id === functionId && !fn.broken);
}

export function useOverclock(functionId) {
  if (!canUseOverclock(functionId)) return false;
  const undoPoint = createUndoPoint();
  const player = getCurrentPlayer();
  player.overclockUsed = true;
  player.overclockTarget = functionId;
  logAction(gameState, `${player.name} active Overclocking.`, 'sys');
  const result = updateFunction(functionId, true, { skipUndo: true });
  if (!result) discardUndoPoint(undoPoint);
  return result;
}

export function rebootCurrentPlayer() {
  if (gameState.phase !== PHASES.ACTION || gameState.winner !== null) return false;
  const player = getCurrentPlayer();
  if (player.rebootedThisTurn) return false;
  createUndoPoint();
  rebootPlayer(player, false);
  player.rebootedThisTurn = true;
  persistGameState();
  return true;
}

function rebootPlayer(player, forced = false) {
  player.active.forEach((func) => {
    releaseMemory(player, func.memUsed);
    discardFunction(player, func);
  });
  player.active = [];
  player.hand.forEach((card) => player.discard.push(card));
  player.hand = [];
  player.updatedThisTurn = [];
  player.planifierUsed = false;
  player.overclockTarget = null;
  player.overclockUsed = false;
  player.swapActive = false;
  player.tempMemory = 0;
  player.completedThisTurn = false;

  const recycled = player.discard.splice(0);
  recycled.forEach((card) => {
    const fresh = createCard(card.key);
    if (!fresh) return;
    if (fresh.type === 'Fonction') player.functionsDeck.push(fresh);
    else player.systemDeck.push(fresh);
  });
  shuffleInPlace(player.functionsDeck);
  shuffleInPlace(player.systemDeck);
  clampMemory(player);

  drawStartingHand(player);

  logAction(gameState, `${player.name} effectue un ${forced ? 'reboot forcé' : 'reboot volontaire'} et repioche une main de départ.`, forced ? 'bad' : 'warn');
}

function shuffleInPlace(array) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

export function endTurn() {
  if (gameState.phase !== PHASES.ACTION || gameState.winner !== null) return false;
  createUndoPoint();
  const player = getCurrentPlayer();
  if (player.tempMemory > 0) {
    const expired = Math.min(player.tempMemory, player.memFree);
    player.memFree -= expired;
    player.tempMemory = 0;
    clampMemory(player);
    if (expired > 0) {
      logAction(gameState, `${expired} mémoire temporaire de ${player.name} disparaît.`, 'sys');
    }
  }
  if (player.overclockTarget && player.active.some((fn) => fn.id === player.overclockTarget)) {
    loseMemory(player, 1);
    logAction(gameState, `${player.name} perd 1 mémoire libre : la fonction overclockée n’a pas terminé.`, 'bad');
  }
  if (player.swapActive && !player.completedThisTurn) {
    player.memTotal = Math.max(0, player.memTotal - 1);
    clampMemory(player);
    logAction(gameState, `${player.name} n’a pas terminé de fonction après Swap Brutal : -1 mémoire totale.`, 'bad');
  }
  player.swapActive = false;
  player.overclockTarget = null;
  player.overclockUsed = false;
  player.rebootedThisTurn = false;
  player.completedThisTurn = false;
  clampMemory(player);
  gameState.currentPlayerIndex = 1 - gameState.currentPlayerIndex;
  if (gameState.currentPlayerIndex === 0) gameState.turn += 1;
  beginTurn();
  persistGameState();
  return true;
}

export function playCard(playerIndex, cardId, targetData = {}) {
  const player = gameState.players[playerIndex];
  if (!player || gameState.winner !== null || player.rebootedThisTurn) {
    return false;
  }
  const card = player.hand.find((item) => item.id === cardId);
  if (!card) return false;
  const ownAction = player.index === gameState.currentPlayerIndex && gameState.phase === PHASES.ACTION;
  const interruptReaction = player.index !== gameState.currentPlayerIndex && card.type === 'Interrupt';
  if (!ownAction && !interruptReaction) return false;
  const undoPoint = createUndoPoint();
  let result = false;
  if (card.type === 'Fonction') {
    result = playFunctionCard(player, card, targetData.R);
    if (result) persistGameState();
    else discardUndoPoint(undoPoint);
    return result;
  }
  if (card.type === 'Hardware') {
    result = playHardwareCard(player, card, targetData);
    if (result) persistGameState();
    else discardUndoPoint(undoPoint);
    return result;
  }
  result = playSystemCard(player, card, targetData);
  if (result) persistGameState();
  else discardUndoPoint(undoPoint);
  return result;
}

function playFunctionCard(player, card, R) {
  if (player.active.length >= 3) {
    logAction(gameState, `${player.name} ne peut pas lancer plus de 3 fonctions actives.`, 'warn');
    return false;
  }
  if (!payMemory(player, card.cost)) return false;
  const depth = card.mode === 'fixe' ? card.maxR : Math.max(0, Math.min(card.maxR, Number.isInteger(R) ? R : 0));
  const func = createFunctionFrame(card, depth);
  player.active.push(func);
  removeCardFromHand(player, card.id);
  logAction(gameState, `${player.name} lance ${card.name} avec R=${depth}.`, 'sys');
  return true;
}

function playHardwareCard(player, card, targetData) {
  if (player.hardware.length >= 2) {
    logAction(gameState, `${player.name} a déjà 2 Hardware en jeu.`, 'warn');
    return false;
  }
  if (!payMemory(player, card.cost)) return false;
  player.hardware.push(card);
  removeCardFromHand(player, card.id);
  switch (card.key) {
    case 'ram':
      player.memTotal += 4;
      releaseMemory(player, 4);
      logAction(gameState, `${player.name} installe Barrette RAM : +4 MT et +4 ML.`, 'good');
      break;
    case 'overclock':
      logAction(gameState, `${player.name} installe Overclocking.`, 'sys');
      break;
    default:
      logAction(gameState, `${player.name} installe ${card.name}.`, 'sys');
      break;
  }
  return true;
}

function playSystemCard(player, card, targetData) {
  if (!canPayMemory(player, card.cost)) {
    logAction(gameState, `${player.name} n’a pas assez de mémoire libre.`, 'warn');
    return false;
  }
  let resolved = true;
  logAction(gameState, `${player.name} joue ${card.name} : début de résolution.`, 'sys', { player: player.name });
  switch (card.key) {
    case 'hotfix':
      resolved = repairFunction(player, targetData.functionId);
      break;
    case 'collecte':
      resolved = cleanBrokenFunction(player, targetData.functionId);
      if (resolved) drawSystemCards(player, 1);
      break;
    case 'purge':
      resolved = purgeTarget(player, targetData.functionId);
      break;
    case 'pollution':
      resolved = addParasitesToTarget(getOpponentPlayer(), targetData.functionId, 2);
      break;
    case 'stack_spike':
      resolved = addParasitesToTarget(findFunctionOwner(targetData.functionId), targetData.functionId, 2, [4, 5]);
      break;
    case 'injection':
      resolved = injectionEffect(findFunctionOwner(targetData.functionId), targetData.functionId);
      break;
    case 'debug':
      resolved = debugFunction(player, targetData.functionId);
      break;
    case 'swap':
      player.memFree += 3;
      player.tempMemory += 3;
      player.swapActive = true;
      logAction(gameState, `${player.name} active Swap Brutal : +3 mémoire temporaire.`, 'warn');
      break;
    default:
      logAction(gameState, `${card.name} est joué, effet enregistré.`, 'sys');
      break;
  }
  if (!resolved) {
    logAction(gameState, `${card.name} n’est pas résolue : aucune carte n’est défaussée.`, 'warn', { player: player.name });
    return false;
  }
  discardCardFromHand(player, card.id, true);
  logAction(gameState, `${card.name} est résolue et rejoint la défausse.`, 'sys', { player: player.name });
  return true;
}

function findFunctionOwner(functionId) {
  return gameState.players.find((player) => player.active.some((fn) => fn.id === functionId));
}

function addParasitesToTarget(player, functionId, count, allowedSizes = [0, 1, 2, 3, 4, 5, 6]) {
  if (!player) {
    logAction(gameState, 'Cible invalide pour les parasites.', 'warn');
    return false;
  }
  const func = player.active.find((fn) => fn.id === functionId);
  if (!func) {
    logAction(gameState, 'Cible invalide pour les parasites.', 'warn');
    return false;
  }
  if (!allowedSizes.includes(func.frames.length)) {
    logAction(gameState, `Stack Spike ne peut cibler que des fonctions à 4 ou 5 cadres.`, 'warn');
    return false;
  }
  let added = 0;
  for (let i = 0; i < count; i += 1) {
    if (func.frames.length >= MAX_FRAMES_PER_FUNCTION) {
      breakFunction(player, func, 'overflow provoqué par l’ajout de parasite');
      return true;
    }
    func.frames.push('P');
    added += 1;
  }
  logAction(gameState, `${added} parasite(s) ajouté(s) à ${func.name}.`, 'bad');
  return true;
}

function addParasitesToPlayer(player, count) {
  if (count <= 0) return true;
  const targets = player.active.filter((func) => !func.broken);
  if (targets.length === 0) {
    logAction(gameState, `${player.name} n’a aucune fonction pouvant recevoir des parasites.`, 'warn');
    return false;
  }
  let added = 0;
  let targetIndex = 0;
  while (added < count && targets.length > 0) {
    const func = targets[targetIndex % targets.length];
    if (func.frames.length >= MAX_FRAMES_PER_FUNCTION) {
      breakFunction(player, func, 'overflow provoqué par l’ajout de parasite');
      targets.splice(targetIndex % targets.length, 1);
      continue;
    }
    func.frames.push('P');
    added += 1;
    targetIndex += 1;
  }
  if (added > 0) logAction(gameState, `${added} parasite(s) ajouté(s) chez ${player.name}.`, 'bad');
  return added > 0;
}

function injectionEffect(player, functionId) {
  if (!player) {
    logAction(gameState, 'Cible invalide pour Injection de Boucle.', 'warn');
    return false;
  }
  const func = player.active.find((fn) => fn.id === functionId);
  if (!func) {
    logAction(gameState, 'Cible invalide pour Injection de Boucle.', 'warn');
    return false;
  }
  if (func.frames.length >= MAX_FRAMES_PER_FUNCTION) {
    breakFunction(player, func, 'overflow provoqué par Injection de Boucle');
    return true;
  }
  func.frames.push('P');
  if (canPayMemory(player, 1)) {
    payMemory(player, 1);
    logAction(gameState, `${player.name} paie 1 mémoire pour encaisser Injection de Boucle.`, 'warn');
  } else {
    breakFunction(player, func, 'pas assez de mémoire pour Injection de Boucle');
  }
  return true;
}

function repairFunction(player, functionId = null) {
  const broken = functionId
    ? player.active.find((fn) => fn.broken && fn.id === functionId)
    : player.active.find((fn) => fn.broken);
  if (!broken) {
    logAction(gameState, `Aucune fonction cassée à réparer.`, 'warn');
    return false;
  }
  const freed = Math.max(0, broken.memUsed - broken.cost);
  broken.broken = false;
  broken.frames = [broken.R];
  broken.nextValue = broken.R - 1;
  broken.reachedZero = broken.R === 0;
  broken.memUsed = broken.cost;
  if (freed > 0) releaseMemory(player, freed);
  logAction(gameState, `${player.name} répare ${broken.name}.`, 'good');
  return true;
}

function purgeTarget(player, functionId) {
  const target = gameState.players.flatMap((pl) => pl.active).find((fn) => fn.id === functionId);
  if (!target) {
    logAction(gameState, 'Cible invalide pour Purge Contrôlée.', 'warn');
    return false;
  }
  let removed = 0;
  while (removed < 2) {
    const index = target.frames.indexOf('P');
    if (index === -1) break;
    target.frames.splice(index, 1);
    removed += 1;
  }
  if (removed === 0) {
    drawSystemCards(player, 1);
    logAction(gameState, `Purge Contrôlée n’a rien retiré : ${player.name} pioche 1 carte.`, 'good');
  } else {
    logAction(gameState, `${player.name} retire ${removed} parasite(s).`, 'good');
  }
  return true;
}

function debugFunction(player, functionId) {
  const func = player.active.find((fn) => fn.id === functionId);
  if (!func || !func.broken) {
    logAction(gameState, 'Aucune fonction cassée valide pour le débogueur.', 'warn');
    return false;
  }
  const popped = func.frames.pop();
  logAction(gameState, `Débogueur dépile ${popped === 'P' ? 'un parasite' : '[' + popped + ']'} de ${func.name}.`, 'good');
  if (func.frames.length === 0) {
    releaseMemory(player, func.memUsed);
    player.active = player.active.filter((fn) => fn.id !== func.id);
    discardFunction(player, func);
    logAction(gameState, `${func.name} est vidé par le débogueur.`, 'sys');
    return true;
  }
  if (popped !== 'P') {
    func.memUsed = Math.max(func.cost, func.memUsed - 1);
    releaseMemory(player, 1);
  }
  func.broken = false;
  return true;
}

export function goToActionPhase() {
  if (gameState.phase !== PHASES.DRAW) return false;
  gameState.phase = PHASES.ACTION;
  return true;
}

export function checkVictory(player) {
  if (isWinningState(player)) {
    gameState.winner = player.index;
    gameState.phase = PHASES.GAME_OVER;
    logAction(gameState, `${player.name} remplit les conditions de victoire.`, 'good');
    return true;
  }
  return false;
}

export function setApiAvailability(value) {
  if (gameState) gameState.apiAvailable = value;
}

export function getGameLog() {
  return gameState ? gameState.log : [];
}

export function getPendingUpdates(player) {
  return player.active.filter((fn) => !fn.broken && !player.updatedThisTurn.includes(fn.id));
}

export function getPlayerUsedMemory(player) {
  const activeUsed = player.active.reduce((sum, fn) => sum + fn.memUsed, 0);
  const hardwareUsed = player.hardware.reduce((sum, hw) => sum + hw.cost, 0);
  return activeUsed + hardwareUsed;
}

export function loadDemoScenario(name) {
  const game = createDemoGame();
  const cyan = game.players[0];
  const orange = game.players[1];

  switch (name) {
    case 'depth_choice':
      configureDemoPlayer(cyan, {
        hand: ['factorielle', 'expansion', 'sentinelle', 'planificateur', 'purge'],
        discard: ['collecte', 'sentinelle'],
        completed: demoCompleted(['sentinelle']),
        score: 2,
        memFree: 11
      });
      configureDemoPlayer(orange, {
        active: [
          demoFunction('glouton', 1, { frames: [1], reachedZero: false, nextValue: 0 })
        ],
        hand: ['pollution', 'tri_fusion', 'hotfix', 'ram'],
        discard: ['purge'],
        memFree: 9
      });
      game.phase = PHASES.ACTION;
      addDemoHistory(game, [
        'Démonstration 1 — Choix de profondeur.',
        'Tour 1 — Joueur Cyan a lancé Routine Sentinelle avec R=1 pour apprendre le cycle complet sans prendre trop de risque.',
        'Tour 2 — Routine Sentinelle s’est terminée : Joueur Cyan a marqué 2 points et a automatiquement pioché une nouvelle Fonction.',
        'Tour 2 — Joueur Orange a lancé Greffon Glouton avec R=1 : il menace de faire perdre de la mémoire libre au prochain dépilage.',
        'Position d’analyse — Score 2-0 pour Joueur Cyan. Cyan a toute sa mémoire libre et trois fonctions possibles en main.',
        'Question pour la classe — Faut-il choisir une petite profondeur pour aller vite, ou une grande profondeur pour viser un gros bonus B(R)=R² ?'
      ]);
      break;

    case 'base_not_end':
      game.turn = 4;
      configureDemoPlayer(cyan, {
        active: [
          demoFunction('factorielle', 2, { frames: [2, 1, 0], reachedZero: true, nextValue: -1 })
        ],
        hand: ['collecte', 'purge', 'recherche', 'ram'],
        discard: ['swap', 'sentinelle'],
        completed: demoCompleted(['sentinelle']),
        score: 2,
        memFree: 6
      });
      configureDemoPlayer(orange, {
        active: [
          demoFunction('glouton', 2, { frames: [2, 1], reachedZero: false, nextValue: 0 })
        ],
        hand: ['pollution', 'stack_spike', 'hotfix', 'factorielle'],
        memFree: 8
      });
      game.phase = PHASES.UPDATE;
      addDemoHistory(game, [
        'Démonstration 2 — Le cas de base n’est pas la fin.',
        'Tour 1 — Joueur Cyan a terminé Routine Sentinelle et a pris 2 points rapides.',
        'Tour 2 — Joueur Cyan a lancé Fonction Factorielle avec R=2, ce qui a réservé 3 mémoire.',
        'Tour 3 — Fonction Factorielle a empilé [1], puis [0]. La pile contient maintenant [2], [1], [0].',
        'Position d’analyse — La fonction a atteint le cas de base, mais elle n’a pas encore rapporté de points.',
        'Question pour la classe — Que se passe-t-il quand on dépile [0] ? Pourquoi la fonction reste-t-elle en jeu après le cas de base ?'
      ]);
      break;

    case 'strategic_memory':
      game.turn = 4;
      configureDemoPlayer(cyan, {
        active: [
          demoFunction('factorielle', 2, { frames: [2, 1], reachedZero: false, nextValue: 0 }),
          demoFunction('compactage', 1, { frames: [1], reachedZero: false, nextValue: 0 })
        ],
        hand: ['purge', 'collecte', 'ram'],
        discard: ['pollution', 'sentinelle'],
        completed: demoCompleted(['sentinelle']),
        score: 2,
        memTotal: 11,
        memFree: 1
      });
      configureDemoPlayer(orange, {
        hand: ['stack_spike', 'injection', 'glouton', 'hotfix'],
        memFree: 11
      });
      game.phase = PHASES.UPDATE;
      addDemoHistory(game, [
        'Démonstration 3 — Choix stratégique avec 1 mémoire libre.',
        'Tour 1 — Joueur Cyan a déjà terminé Routine Sentinelle : 2 points, mais la partie est encore loin d’être gagnée.',
        'Tour 2 — Joueur Cyan a lancé Fonction Factorielle avec R=2.',
        'Tour 3 — Fonction Factorielle a empilé [1], puis Joueur Cyan a lancé Compactage Mémoire avec R=1.',
        'Tour 3 — Joueur Orange a réduit la mémoire libre de Cyan. Il reste 1 mémoire libre, mais les deux fonctions veulent empiler [0].',
        'Position d’analyse — Une seule des deux fonctions peut atteindre le cas de base maintenant ; l’autre cassera si on tente aussi de l’empiler.',
        'Question pour la classe — Quelle fonction sauver en premier, et que nous apprend ce choix sur les appels récursifs qui consomment de la mémoire ?'
      ]);
      break;

    case 'repair_or_clean':
      game.turn = 5;
      configureDemoPlayer(cyan, {
        active: [
          demoFunction('quicksort', 3, { broken: true, frames: [3, 2, 1, 0, 'P', 'P'], reachedZero: true })
        ],
        hand: ['hotfix', 'collecte', 'debug', 'purge'],
        discard: ['swap', 'factorielle'],
        completed: demoCompleted(['factorielle']),
        score: 6,
        memFree: 5
      });
      configureDemoPlayer(orange, {
        active: [
          demoFunction('glouton', 1, { frames: [1, 0], reachedZero: true, nextValue: -1 })
        ],
        hand: ['pollution', 'factorielle', 'ram', 'injection'],
        discard: ['stack_spike', 'sentinelle'],
        completed: demoCompleted(['sentinelle']),
        score: 2,
        memFree: 8
      });
      game.phase = PHASES.ACTION;
      addDemoHistory(game, [
        'Démonstration 4 — Nettoyer ou réparer une fonction cassée.',
        'Tour 1 — Joueur Cyan a terminé Fonction Factorielle avec R=2 : 6 points et une nouvelle Fonction piochée automatiquement.',
        'Tour 2 — Joueur Cyan a lancé Quicksort Agressif avec R=3 pour viser un gros bonus.',
        'Tours 3-4 — Quicksort a atteint [0], puis des parasites ont été ajoutés sur la pile.',
        'Tour 4 — Joueur Orange a joué Stack Spike sur une pile à 5 cadres. Le deuxième parasite aurait créé un 7e cadre : Quicksort a cassé.',
        'Position d’analyse — Cyan mène 6-2, mais Quicksort occupe encore 6 mémoire et ne progressera plus tant qu’il est cassé.',
        'Question pour la classe — Nettoyer, réparer ou déboguer : quelle option libère de la mémoire, laquelle garde une chance de marquer, laquelle gagne seulement du temps ?'
      ]);
      break;

    case 'ram':
      configureDemoPlayer(cyan, {
        active: [
          demoFunction('factorielle', 2, { frames: [2, 1], reachedZero: false, nextValue: 0 }),
          demoFunction('compactage', 1, { frames: [1], reachedZero: false, nextValue: 0 })
        ],
        hand: ['ram', 'expansion', 'purge', 'sentinelle'],
        discard: ['collecte', 'sentinelle'],
        completed: demoCompleted(['sentinelle']),
        score: 2,
        memTotal: 10,
        memFree: 3,
        updatedThisTurnKeys: ['factorielle']
      });
      configureDemoPlayer(orange, {
        active: [
          demoFunction('glouton', 1, { frames: [1], reachedZero: false, nextValue: 0 })
        ],
        hand: ['pollution', 'stack_spike', 'hotfix', 'factorielle'],
        memFree: 9
      });
      game.phase = PHASES.ACTION;
      addDemoHistory(game, [
        'Démonstration 5 — Barrette RAM.',
        'Tour 1 — Joueur Cyan a marqué 2 points avec Routine Sentinelle, puis a perdu 1 mémoire totale sur une situation de pioche tendue.',
        'Tour 2 — Joueur Cyan a lancé Fonction Factorielle avec R=2.',
        'Tour 3 — Mise à jour : Fonction Factorielle a empilé [1]. En conception, Cyan a lancé Compactage Mémoire avec R=1.',
        'Position d’analyse — Cyan a 10 mémoire totale, 7 mémoire déjà utilisée et seulement 3 mémoire libre.',
        'Question pour la classe — Faut-il dépenser les 3 dernières mémoires pour installer Barrette RAM ? Observez ensuite mémoire totale, mémoire libre et mémoire utilisée.'
      ]);
      break;

    case 'stack_spike_break':
      game.turn = 6;
      configureDemoPlayer(cyan, {
        hand: ['stack_spike', 'injection', 'pollution', 'factorielle'],
        discard: ['purge', 'factorielle'],
        completed: demoCompleted(['factorielle']),
        score: 6,
        memFree: 8
      });
      configureDemoPlayer(orange, {
        active: [
          demoFunction('tri_fusion', 4, { frames: [4, 3, 2, 1, 0], reachedZero: true, nextValue: -1 })
        ],
        hand: ['hotfix', 'collecte', 'ram', 'sentinelle'],
        discard: ['purge', 'sentinelle', 'recherche'],
        completed: demoCompleted(['sentinelle', 'recherche']),
        score: 8,
        memFree: 4
      });
      game.phase = PHASES.ACTION;
      addDemoHistory(game, [
        'Démonstration 6 — Casse avec Stack Spike.',
        'Tours précédents — Joueur Orange a déjà terminé Routine Sentinelle et Recherche Dichotomique : 8 points et 2 noms différents.',
        'Tour 2 — Joueur Orange a lancé Tri Fusion Tempéré avec R=4.',
        'Tours 3 à 5 — Tri Fusion a empilé [3], [2], [1], puis [0]. Il contient exactement 5 cadres.',
        'Position d’analyse — Si Tri Fusion termine plus tard, Orange ajoutera 18 points et remplira la condition des 3 fonctions terminées.',
        'Tour 6 — Joueur Cyan a Stack Spike en main et assez de mémoire pour le jouer maintenant.',
        'Question pour la classe — Pourquoi Stack Spike est-il légal sur une pile à 5 cadres, et pourquoi provoque-t-il une casse immédiate ici ?'
      ]);
      break;

    default:
      return loadDemoScenario('depth_choice');
  }

  game.players.forEach((player) => {
    player.updatedThisTurn = player.updatedThisTurn || [];
    player.planifierUsed = false;
    player.overclockTarget = null;
    player.overclockUsed = false;
    player.swapActive = false;
    player.tempMemory = 0;
    player.rebootedThisTurn = false;
    player.completedThisTurn = false;
  });

  gameState = game;
  return game;
}

function createDemoGame() {
  const game = createGameState('Joueur Cyan', 'Joueur Orange');
  game.turn = 3;
  game.currentPlayerIndex = 0;
  game.phase = PHASES.ACTION;
  game.winner = null;
  game.firstTurn = false;
  game.remoteCode = null;
  game.isRemote = false;
  game.apiAvailable = false;
  game.log = [];
  return game;
}

function configureDemoPlayer(player, options = {}) {
  const handKeys = options.hand || [];
  const activeFunctions = options.active || [];
  const hardwareKeys = options.hardware || [];
  const discardKeys = options.discard || [];
  const usedKeys = [
    ...handKeys,
    ...activeFunctions.map((func) => func.cardKey),
    ...hardwareKeys,
    ...discardKeys
  ];
  const decks = buildRemainingDemoDecks(usedKeys);

  player.score = options.score || 0;
  player.completed = options.completed || [];
  player.memTotal = options.memTotal || 11;
  player.hand = handKeys.map((key) => createCard(key)).filter(Boolean);
  player.active = activeFunctions;
  player.hardware = hardwareKeys.map((key) => createCard(key)).filter(Boolean);
  player.discard = discardKeys.map((key) => createCard(key)).filter(Boolean);
  player.functionsDeck = decks.functions;
  player.systemDeck = decks.system;
  player.memFree = options.memFree ?? Math.max(0, player.memTotal - getPlayerUsedMemory(player));
  player.updatedThisTurn = (options.updatedThisTurnKeys || [])
    .map((key) => player.active.find((func) => func.cardKey === key)?.id)
    .filter(Boolean);
}

function buildRemainingDemoDecks(usedKeys) {
  const remaining = new Map(DECK_COMPOSITION);
  usedKeys.forEach((key) => {
    if (!remaining.has(key)) return;
    remaining.set(key, Math.max(0, remaining.get(key) - 1));
  });

  const functions = [];
  const system = [];
  DECK_COMPOSITION.forEach(([key]) => {
    const count = remaining.get(key) || 0;
    for (let i = 0; i < count; i += 1) {
      const card = createCard(key);
      if (!card) continue;
      if (card.type === 'Fonction') functions.push(card);
      else system.push(card);
    }
  });

  return { functions, system };
}

function demoFunction(key, R, overrides = {}) {
  const func = createFunctionFrame(CARD_DEFINITIONS[key], R);
  const frames = overrides.frames || func.frames;
  const reachedZero = overrides.reachedZero ?? frames.includes(0);
  return {
    ...func,
    frames,
    nextValue: overrides.nextValue ?? inferNextValue(frames, reachedZero),
    reachedZero,
    broken: Boolean(overrides.broken),
    memUsed: overrides.memUsed ?? estimateFunctionMemory(CARD_DEFINITIONS[key], frames)
  };
}

function demoCompleted(keys) {
  return keys.map((key) => ({ key, name: CARD_DEFINITIONS[key]?.name || key }));
}

function inferNextValue(frames, reachedZero) {
  if (reachedZero) return -1;
  const numericFrames = frames.filter((frame) => frame !== 'P');
  const last = numericFrames[numericFrames.length - 1];
  return Number.isInteger(last) ? last - 1 : 0;
}

function estimateFunctionMemory(card, frames) {
  return card.cost + frames.slice(1).filter((frame) => frame !== 'P').length;
}

function addDemoHistory(game, entries) {
  entries.forEach((entry) => logAction(game, entry, 'sys'));
}
