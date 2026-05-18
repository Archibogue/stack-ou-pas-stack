import { buildDecks, createCard } from './cards.js';
import { START_MEMORY, PHASES } from './rules.js';

function shuffle(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function createPlayer(name, index) {
  const decks = buildDecks();
  return {
    name,
    index,
    score: 0,
    completed: [],
    memTotal: START_MEMORY,
    memFree: START_MEMORY,
    functionsDeck: decks.functions,
    systemDeck: decks.system,
    hand: [],
    active: [],
    hardware: [],
    discard: [],
    updatedThisTurn: [],
    planifierUsed: false,
    overclockTarget: null,
    overclockUsed: false,
    swapActive: false,
    tempMemory: 0,
    rebootedThisTurn: false,
    completedThisTurn: false
  };
}

export function createGameState(player1Name = 'Joueur Cyan', player2Name = 'Joueur Orange') {
  const game = {
    players: [createPlayer(player1Name, 0), createPlayer(player2Name, 1)],
    currentPlayerIndex: 0,
    phase: PHASES.SETUP,
    turn: 1,
    winner: null,
    log: [],
    logSequence: 0,
    undoStack: [],
    firstTurn: true,
    remoteCode: null,
    isRemote: false,
    apiAvailable: false
  };
  dealStartingHands(game);
  return game;
}

export function dealStartingHands(game) {
  game.players.forEach(drawStartingHand);
}

export function drawStartingHand(player) {
  for (let i = 0; i < 3; i += 1) drawFromDeck(player, 'functions', true);
  for (let i = 0; i < 2; i += 1) drawFromDeck(player, 'system', true);
}

export function drawFromDeck(player, deckType, free = false) {
  const deck = deckType === 'functions' ? player.functionsDeck : player.systemDeck;
  if (deck.length === 0) return null;
  const card = deck.shift();
  player.hand.push(card);
  return card;
}

export function copyGameState(state) {
  return JSON.parse(JSON.stringify(state));
}

export function createFunctionFrame(card, R) {
  return {
    id: `${card.key}-${crypto.randomUUID?.() ?? Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
    cardKey: card.key,
    name: card.name,
    cost: card.cost,
    value: card.value,
    R,
    frames: [R],
    nextValue: R - 1,
    reachedZero: R === 0,
    broken: false,
    memUsed: card.cost
  };
}

export function cloneStateForSave(state) {
  const clone = JSON.parse(JSON.stringify(state));
  delete clone.undoStack;
  return clone;
}

export function restoreState(data) {
  const state = cloneStateForSave(data);
  if (!state.phase) state.phase = PHASES.SETUP;
  state.log = state.log || [];
  state.logSequence = state.logSequence || state.log.length || 0;
  state.undoStack = [];
  state.players?.forEach((player) => {
    player.updatedThisTurn = player.updatedThisTurn || [];
    player.planifierUsed = Boolean(player.planifierUsed);
    player.overclockTarget = player.overclockTarget || null;
    player.overclockUsed = Boolean(player.overclockUsed);
    player.swapActive = Boolean(player.swapActive);
    player.tempMemory = player.tempMemory || 0;
    player.rebootedThisTurn = Boolean(player.rebootedThisTurn);
    player.completedThisTurn = Boolean(player.completedThisTurn);
  });
  return state;
}
