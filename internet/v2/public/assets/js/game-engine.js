import { createPlayer, createGameState, drawFromDeck, createFunctionFrame, restoreState, cloneStateForSave } from './game-state.js';
import { CARD_DEFINITIONS, createCard } from './cards.js';
import { MAX_FRAMES_PER_FUNCTION, PHASES, bonusRecursion, isWinningState } from './rules.js';
import { saveLocalState, exportStateToClipboard, importStateFromJson, saveRemoteGame } from './storage.js';

let gameState = null;

export function getState() {
  return gameState;
}

export function newGame(player1, player2) {
  gameState = createGameState(player1, player2);
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

export function canPlayCard() {
  const player = gameState ? getCurrentPlayer() : null;
  return gameState.phase === PHASES.ACTION && gameState.winner === null && !player?.rebootedThisTurn;
}

export function canEndTurn() {
  if (gameState.winner !== null) return false;
  if (gameState.phase !== PHASES.ACTION) return false;
  const player = getCurrentPlayer();
  const pending = player.active.filter((fn) => !fn.broken && !player.updatedThisTurn.includes(fn.id));
  return pending.length === 0 && gameState.phase !== PHASES.DRAW;
}

export function drawForPlayer(deckType) {
  if (gameState.phase !== PHASES.DRAW || gameState.winner !== null) return null;
  const player = getCurrentPlayer();
  const card = drawFromDeck(player, deckType);
  if (!card) {
    handleDeckExhaustion(player);
    persistGameState();
    return null;
  }
  logAction(gameState, `${player.name} pioche ${card.name}.`);
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
  }
}

export function validateUpdatePhase() {
  if (gameState.phase !== PHASES.UPDATE) return false;
  const player = getCurrentPlayer();
  const pending = player.active.filter((fn) => !fn.broken && !player.updatedThisTurn.includes(fn.id));
  if (pending.length > 0) return false;
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

export function updateFunction(functionId, extra = false) {
  if (gameState.phase !== PHASES.UPDATE || gameState.winner !== null) return false;
  const player = getCurrentPlayer();
  const func = player.active.find((item) => item.id === functionId);
  if (!func || func.broken) return false;
  if (player.updatedThisTurn.includes(func.id) && !extra) return false;

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
      drawBestCard(player, 1);
      break;
    case 'compactage':
      releaseMemory(player, 1);
      logAction(gameState, `${player.name} gagne 1 mémoire libre grâce à Compactage Mémoire.`, 'good');
      break;
    case 'recherche':
      logAction(gameState, 'Recherche Dichotomique : révélé et pris 1 carte.', 'sys');
      drawBestCard(player, 1);
      break;
    case 'sentinelle':
      logAction(gameState, 'Routine Sentinelle : exploré le sommet d’une pile.', 'sys');
      break;
    case 'archiviste':
      logAction(gameState, 'Archiviste du Cache : regardé le dessus de la pile.', 'sys');
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
      logAction(gameState, `${player.name} gagne 1 mémoire libre en remontée de ${func.name}.`, 'good');
      break;
    case 'glouton':
    case 'quicksort':
      const opponent = getOpponentPlayer();
      loseMemory(opponent, 1);
      logAction(gameState, `${opponent.name} perd 1 mémoire libre sous l’effet de ${func.name}.`, 'bad');
      break;
    case 'recherche':
      removeParasites(player, 1);
      break;
    case 'tri_fusion':
      logAction(gameState, 'Tri Fusion Tempéré : réordonne virtuellement les cartes du dessus.', 'sys');
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
  logAction(gameState, `${player.name} termine ${func.name} (+${func.value} + B(${func.R})=${bonus}) → +${gain} points.`, 'good');
  removeActiveFunction(player, func.id);
  discardFunction(player, func);
  applyTerminalEffect(player, func, bonus);
  func.memUsed = Math.min(func.memUsed, func.cost);
  releaseMemory(player, func.memUsed);
  player.completedThisTurn = true;
}

function applyTerminalEffect(player, func, bonus) {
  const opponent = getOpponentPlayer();
  switch (func.cardKey) {
    case 'factorielle':
    case 'expansion':
      releaseMemory(player, bonus);
      logAction(gameState, `${player.name} gagne ${bonus} mémoire libre au terme de ${func.name}.`, 'good');
      break;
    case 'sentinelle':
      drawBestCard(player, bonus);
      break;
    case 'glouton':
      addParasitesToPlayer(opponent, bonus);
      break;
    case 'quicksort':
      loseMemory(opponent, bonus);
      logAction(gameState, `${opponent.name} perd ${bonus} mémoire libre sous l’effet de ${func.name}.`, 'bad');
      break;
    case 'archiviste':
      drawBestCard(player, bonus);
      if (player.hand.length > 0) discardCardFromHand(player, player.hand[0].id, true);
      break;
    case 'tri_fusion':
      removeParasites(player, bonus);
      break;
    case 'compactage':
      cleanBrokenFunction(player);
      if (bonus >= 2) drawBestCard(player, 1);
      break;
    case 'recherche':
      drawBestCard(player, bonus + 1);
      break;
    default:
      break;
  }
}

export function logAction(state, text, cls = '') {
  state.log.unshift({ text, cls, time: new Date().toLocaleTimeString() });
  if (state.log.length > 200) state.log.pop();
}

function removeActiveFunction(player, functionId) {
  player.active = player.active.filter((fn) => fn.id !== functionId);
}

function drawBestCard(player, count) {
  for (let i = 0; i < count; i += 1) {
    if (player.functionsDeck.length >= player.systemDeck.length && player.functionsDeck.length > 0) {
      drawFromDeck(player, 'functions');
    } else if (player.systemDeck.length > 0) {
      drawFromDeck(player, 'system');
    }
  }
}

function discardCardFromHand(player, cardId, silent = false) {
  const index = player.hand.findIndex((c) => c.id === cardId);
  if (index === -1) return;
  const [card] = player.hand.splice(index, 1);
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
  const player = getCurrentPlayer();
  player.overclockUsed = true;
  player.overclockTarget = functionId;
  logAction(gameState, `${player.name} active Overclocking.`, 'sys');
  return updateFunction(functionId, true);
}

export function rebootCurrentPlayer() {
  if (gameState.phase !== PHASES.ACTION || gameState.winner !== null) return false;
  const player = getCurrentPlayer();
  if (player.rebootedThisTurn) return false;
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

  for (let i = 0; i < 5; i += 1) {
    const deckType = player.functionsDeck.length >= player.systemDeck.length ? 'functions' : 'system';
    if (!drawFromDeck(player, deckType)) {
      const fallback = deckType === 'functions' ? 'system' : 'functions';
      drawFromDeck(player, fallback);
    }
  }

  logAction(gameState, `${player.name} effectue un ${forced ? 'reboot forcé' : 'reboot volontaire'}.`, forced ? 'bad' : 'warn');
}

function shuffleInPlace(array) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

export function endTurn() {
  if (gameState.phase !== PHASES.ACTION || gameState.winner !== null) return false;
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
  if (gameState.phase !== PHASES.ACTION || gameState.winner !== null || player.index !== gameState.currentPlayerIndex || player.rebootedThisTurn) {
    return false;
  }
  const card = player.hand.find((item) => item.id === cardId);
  if (!card) return false;
  if (card.type === 'Fonction') {
    const result = playFunctionCard(player, card, targetData.R);
    if (result) persistGameState();
    return result;
  }
  if (card.type === 'Hardware') {
    const result = playHardwareCard(player, card, targetData);
    if (result) persistGameState();
    return result;
  }
  const result = playSystemCard(player, card, targetData);
  if (result) persistGameState();
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
  discardCardFromHand(player, card.id, true);
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
  discardCardFromHand(player, card.id, true);
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
  switch (card.key) {
    case 'hotfix':
      resolved = repairFunction(player, targetData.functionId);
      break;
    case 'collecte':
      resolved = cleanBrokenFunction(player, targetData.functionId);
      if (resolved) drawBestCard(player, 1);
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
  if (!resolved) return false;
  discardCardFromHand(player, card.id, true);
  logAction(gameState, `${player.name} joue ${card.name}.`, 'sys');
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
    drawBestCard(player, 1);
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
  const player1 = createPlayer('Joueur Cyan', 0);
  const player2 = createPlayer('Joueur Orange', 1);
  const state = createGameState(player1.name, player2.name);
  const game = state;
  game.log = [];
  switch (name) {
    case 'overflow':
      game.players[0].active = [
        { ...createFunctionFrame(CARD_DEFINITIONS.factorielle, 4), frames: [4, 3, 2, 1, 0, 'P'], nextValue: -1, reachedZero: true, memUsed: 7 }
      ];
      game.players[0].memFree = 4;
      game.phase = PHASES.UPDATE;
      logAction(game, 'Situation de démonstration : overflow proche.', 'sys');
      break;
    case 'broken':
      game.players[0].active = [
        { ...createFunctionFrame(CARD_DEFINITIONS.compactage, 3), broken: true, frames: [3, 2, 'P'], memUsed: 4 }
      ];
      game.players[0].memFree = 7;
      game.phase = PHASES.ACTION;
      logAction(game, 'Situation de démonstration : fonction cassée en jeu.', 'sys');
      break;
    case 'pollution':
      game.players[0].active = [createFunctionFrame(CARD_DEFINITIONS.recherche, 2)];
      game.players[0].memFree = 9;
      game.players[1].active = [
        { ...createFunctionFrame(CARD_DEFINITIONS.tri_fusion, 3), frames: [3, 2, 1, 'P'], memUsed: 5 }
      ];
      game.players[1].memFree = 6;
      game.phase = PHASES.ACTION;
      logAction(game, 'Démonstration : pollution de cache déjà appliquée.', 'sys');
      break;
    case 'victory':
      game.players[0].score = 11;
      game.players[0].completed = [{ key: 'factorielle', name: 'Fonction Factorielle' }, { key: 'recherche', name: 'Recherche Dichotomique' }, { key: 'sentinelle', name: 'Routine Sentinelle' }];
      game.phase = PHASES.GAME_OVER;
      game.winner = 0;
      logAction(game, 'Démonstration : victoire par score et fonctions distinctes.', 'good');
      break;
    default:
      break;
  }
  game.phase = game.phase ?? PHASES.UPDATE;
  gameState = game;
  return game;
}
