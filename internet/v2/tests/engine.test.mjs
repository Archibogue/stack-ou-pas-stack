import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

globalThis.window = {
  localStorage: {
    setItem() {},
    getItem() {
      return null;
    }
  }
};

Object.defineProperty(globalThis, 'navigator', {
  value: { clipboard: { writeText() {} } },
  configurable: true
});

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');

const engine = await import('../public/assets/js/game-engine.js');
const bot = await import('../public/assets/js/bot.js');
const gameState = await import('../public/assets/js/game-state.js');
const { CARD_DEFINITIONS, DECK_COMPOSITION, createCard, buildDecks } = await import('../public/assets/js/cards.js');
const rules = await import('../public/assets/js/rules.js');

function parseDeckMarkdown() {
  const markdown = readFileSync(resolve(repoRoot, 'physique/initiation/cartes/CARD_SET_INITIATION_QUADRATIQUE.md'), 'utf8');
  const expected = new Map();
  let type = null;

  markdown.split(/\r?\n/).forEach((line) => {
    if (line.startsWith('## Fonctions')) type = 'Fonction';
    if (line.startsWith('## Système')) type = 'Système';

    const match = line.match(/^- (.+) ×(\d+)$/);
    if (!match || !type) return;
    expected.set(match[1], { count: Number(match[2]), type });
  });

  return expected;
}

function deckCompositionFromCards() {
  const actual = new Map();
  DECK_COMPOSITION.forEach(([key, count]) => {
    const definition = CARD_DEFINITIONS[key];
    assert.ok(definition, `Card definition missing for key ${key}`);
    actual.set(definition.name, { count, type: definition.type === 'Fonction' ? 'Fonction' : 'Système' });
  });
  return actual;
}

function assertMapsEqual(actual, expected) {
  assert.deepEqual([...actual.keys()].sort(), [...expected.keys()].sort(), 'Deck card names must match Markdown');
  expected.forEach((expectedValue, name) => {
    assert.deepEqual(actual.get(name), expectedValue, `Deck entry mismatch for ${name}`);
  });
}

function assertInitialSetup() {
  const state = engine.newGame('Ada', 'Grace');
  assert.equal(state.players.length, 2);
  assert.equal(state.players[0].memTotal, 11);
  assert.equal(state.players[0].memFree, 11);
  assert.equal(state.players[0].hand.filter((card) => card.type === 'Fonction').length, 3);
  assert.equal(state.players[0].hand.filter((card) => card.type !== 'Fonction').length, 2);
  assert.equal(state.phase, rules.PHASES.ACTION, 'First player skips draw on first turn when no update is pending');
}

function assertSoloSetup() {
  const state = bot.startSoloGame('Ada', 'Ordinateur', { botProfile: 'pedagogique' });
  assert.equal(state.soloMode, true);
  assert.equal(state.botIndex, 1);
  assert.equal(state.botProfile, 'pedagogique');
  assert.equal(state.players[0].isBot, false);
  assert.equal(state.players[1].isBot, true);

  const restored = engine.loadGame(JSON.parse(JSON.stringify({
    players: state.players.map((player) => {
      const copy = { ...player };
      delete copy.isBot;
      delete copy.overclockSkipped;
      return copy;
    }),
    currentPlayerIndex: 0,
    phase: rules.PHASES.ACTION,
    turn: 1,
    winner: null,
    log: []
  })));
  assert.equal(restored.players[0].isBot, false, 'Old saves without isBot remain human by default');
  assert.equal(restored.players[0].overclockSkipped, false, 'Old saves without overclockSkipped remain compatible');
  assert.equal(restored.soloMode, false, 'Old saves without soloMode remain normal local games');
  assert.equal(restored.botProfile, 'equilibre', 'Old saves without botProfile use the balanced bot');
}

function assertRunBotStepIsAtomic() {
  const state = bot.startSoloGame('Ada', 'Ordinateur');
  const computer = state.players[1];
  state.currentPlayerIndex = 1;
  state.phase = rules.PHASES.UPDATE;
  state.firstTurn = false;
  computer.active = [];
  computer.hand = [];
  computer.systemDeck = [createCard('swap')];

  assert.equal(bot.runBotStep(1), true);
  assert.equal(state.phase, rules.PHASES.DRAW, 'One bot step validates update but does not also draw');
  assert.equal(computer.systemDeck.length, 1);
}

function assertBotCanPassTurnCycle() {
  const state = bot.startSoloGame('Ada', 'Ordinateur');
  const computer = state.players[1];
  state.currentPlayerIndex = 1;
  state.phase = rules.PHASES.UPDATE;
  state.firstTurn = false;
  computer.active = [];
  computer.hand = [];
  computer.systemDeck = [createCard('swap')];
  const systemBefore = computer.systemDeck.length;

  assert.equal(bot.runBotTurn(1), true);
  assert.equal(computer.systemDeck.length, systemBefore - 1, 'Bot draws System during draw phase');
  assert.equal(state.currentPlayerIndex, 0, 'Bot ends its turn and returns control to human');
  assert.equal(state.phase, rules.PHASES.DRAW);
}

function assertBotDoesNotPlayIllegalMove() {
  const state = bot.startSoloGame('Ada', 'Ordinateur');
  const computer = state.players[1];
  state.currentPlayerIndex = 1;
  state.phase = rules.PHASES.ACTION;
  computer.hand = [createCard('pollution')];
  computer.memFree = computer.memTotal;
  state.players[0].active = [];

  assert.equal(bot.runBotTurn(1), true);
  assert.equal(computer.hand.some((card) => card.key === 'pollution'), true, 'Bot keeps a card when no legal target exists');
  assert.equal(computer.discard.some((card) => card.key === 'pollution'), false);
  assert.equal(state.currentPlayerIndex, 0);
}

function assertBotStackSpikeReaction() {
  const state = bot.startSoloGame('Ada', 'Ordinateur');
  const human = state.players[0];
  const computer = state.players[1];
  human.hand = [createCard('tri_fusion')];
  human.memFree = human.memTotal;
  assert.equal(engine.playCard(0, human.hand[0].id, { R: 4 }), true);
  const target = human.active[0];
  target.frames = [4, 3, 2, 1];
  target.nextValue = 0;
  target.reachedZero = false;
  target.memUsed = 6;
  human.memFree = 5;
  computer.hand = [createCard('stack_spike')];
  computer.memFree = computer.memTotal;
  state.phase = rules.PHASES.UPDATE;
  engine.logAction(state, 'Action humaine de test.', 'sys', { player: human.name, actorIndex: 0 });

  assert.equal(bot.maybeReactToHumanAction(1), true);
  assert.equal(computer.discard.some((card) => card.key === 'stack_spike'), true);
  assert.equal(target.frames.filter((frame) => frame === 'P').length, 2);
}

function makeFunction(key, R, frames, overrides = {}) {
  const card = CARD_DEFINITIONS[key];
  return {
    id: `${key}-${Math.random().toString(36).slice(2)}`,
    cardKey: key,
    key,
    name: card.name,
    cost: card.cost,
    value: card.value,
    R,
    frames,
    nextValue: overrides.nextValue ?? (frames.includes(0) ? -1 : 0),
    reachedZero: overrides.reachedZero ?? frames.includes(0),
    broken: Boolean(overrides.broken),
    memUsed: overrides.memUsed ?? card.cost + frames.slice(1).filter((frame) => frame !== 'P').length
  };
}

function assertBotProfilesAffectDepthAndTargets() {
  let state = bot.startSoloGame('Ada', 'Ordinateur', { botProfile: 'pedagogique' });
  let computer = state.players[1];
  state.currentPlayerIndex = 1;
  state.phase = rules.PHASES.ACTION;
  computer.hand = [createCard('expansion')];
  computer.active = [];
  computer.memFree = computer.memTotal;
  assert.equal(bot.runBotStep(1), true);
  assert.equal(computer.active[0].R <= 2, true, 'Pedagogic bot chooses a cautious depth');

  state = bot.startSoloGame('Ada', 'Ordinateur', { botProfile: 'agressif' });
  const human = state.players[0];
  computer = state.players[1];
  const nearScore = makeFunction('tri_fusion', 4, [4, 3, 2, 1, 0], { reachedZero: true, nextValue: -1, memUsed: 7 });
  const smaller = makeFunction('sentinelle', 1, [1, 0, 'P', 'P'], { reachedZero: true, nextValue: -1, memUsed: 3 });
  human.active = [smaller, nearScore];
  state.currentPlayerIndex = 1;
  state.phase = rules.PHASES.ACTION;
  computer.hand = [createCard('stack_spike')];
  computer.memFree = computer.memTotal;
  assert.equal(bot.runBotStep(1), true);
  assert.equal(nearScore.broken, true, 'Aggressive bot targets the high-value vulnerable function first');
  assert.equal(smaller.broken, false);
}

function assertBotVoluntaryReboot() {
  const state = bot.startSoloGame('Ada', 'Ordinateur');
  const computer = state.players[1];
  state.currentPlayerIndex = 1;
  state.phase = rules.PHASES.UPDATE;
  computer.active = [makeFunction('quicksort', 3, [3, 2, 1, 0, 'P', 'P'], { broken: true, reachedZero: true, memUsed: 6 })];
  computer.hand = [createCard('swap')];
  computer.memFree = 1;

  assert.equal(bot.runBotStep(1), true);
  assert.equal(computer.active.length, 0, 'Bot can choose a voluntary reboot when memory is blocked');
  assert.equal(computer.rebootedThisTurn, true);
  assert.ok(state.log.some((entry) => entry.text.includes('reboot volontaire')));
}

function assertBotReactionGuards() {
  let state = bot.startSoloGame('Ada', 'Ordinateur', { botProfile: 'agressif' });
  let human = state.players[0];
  let computer = state.players[1];
  human.active = [makeFunction('tri_fusion', 4, [4, 3, 2, 1, 0], { reachedZero: true, nextValue: -1, memUsed: 7 })];
  computer.hand = [createCard('stack_spike')];
  computer.memFree = 2;
  state.phase = rules.PHASES.UPDATE;
  engine.logAction(state, 'Action humaine de test.', 'sys', { player: human.name, actorIndex: 0 });
  assert.equal(bot.maybeReactToHumanAction(1), false, 'Bot cannot react without enough memory');
  assert.equal(computer.hand.some((card) => card.key === 'stack_spike'), true);

  state = bot.startSoloGame('Ada', 'Ordinateur', { botProfile: 'agressif' });
  human = state.players[0];
  computer = state.players[1];
  human.active = [makeFunction('tri_fusion', 3, [3, 2, 1], { reachedZero: false, nextValue: 0, memUsed: 5 })];
  computer.hand = [createCard('stack_spike')];
  computer.memFree = computer.memTotal;
  state.phase = rules.PHASES.UPDATE;
  engine.logAction(state, 'Action humaine de test.', 'sys', { player: human.name, actorIndex: 0 });
  assert.equal(bot.maybeReactToHumanAction(1), false, 'Bot ignores illegal Stack Spike targets');
  assert.equal(computer.discard.some((card) => card.key === 'stack_spike'), false);

  state = bot.startSoloGame('Ada', 'Ordinateur', { botProfile: 'agressif' });
  human = state.players[0];
  computer = state.players[1];
  human.active = [
    makeFunction('tri_fusion', 4, [4, 3, 2, 1], { reachedZero: false, nextValue: 0, memUsed: 6 }),
    makeFunction('expansion', 4, [4, 3, 2, 1], { reachedZero: false, nextValue: 0, memUsed: 6 })
  ];
  computer.hand = [createCard('stack_spike'), createCard('injection')];
  computer.memFree = computer.memTotal;
  state.phase = rules.PHASES.UPDATE;
  engine.logAction(state, 'Action humaine de test.', 'sys', { player: human.name, actorIndex: 0 });
  assert.equal(bot.maybeReactToHumanAction(1), true);
  assert.equal(bot.maybeReactToHumanAction(1), false, 'Bot plays at most one reaction for the same human action');
  assert.equal(computer.botReactionsThisTurn, 1);

  state = bot.startSoloGame('Ada', 'Ordinateur', { botProfile: 'agressif' });
  human = state.players[0];
  computer = state.players[1];
  human.active = [makeFunction('tri_fusion', 4, [4, 3, 2, 1, 0], { reachedZero: true, nextValue: -1, memUsed: 7 })];
  computer.hand = [createCard('stack_spike')];
  computer.memFree = computer.memTotal;
  state.phase = rules.PHASES.UPDATE;
  state.log = [];
  state.logSequence = 0;
  engine.logAction(state, 'Action interne du bot.', 'sys', { player: computer.name, actorIndex: 1 });
  assert.equal(bot.maybeReactToHumanAction(1), false, 'Bot does not react to its own action log');
  assert.equal(computer.discard.some((card) => card.key === 'stack_spike'), false);

  state.currentPlayerIndex = 1;
  assert.equal(bot.maybeReactToHumanAction(1), false, 'Bot does not react during its own turn');
}

function assertBotPendingDeckEffects() {
  let state = bot.startSoloGame('Ada', 'Ordinateur');
  let computer = state.players[1];
  state.currentPlayerIndex = 1;
  state.phase = rules.PHASES.UPDATE;
  state.pendingDeckEffect = {
    id: 'human-pending',
    ownerIndex: 0,
    sourceName: 'Effet humain',
    mode: 'peek_top',
    count: 1,
    allowedPlayerIndexes: [0],
    allowedDecks: ['system'],
    afterResolve: null
  };
  const logBefore = state.logSequence;
  assert.equal(bot.runBotStep(1), false, 'Human pending deck effect blocks bot step');
  assert.equal(state.pendingDeckEffect.id, 'human-pending');
  assert.equal(state.logSequence, logBefore, 'Blocked bot step does not spam the log');
  assert.equal(bot.runBotTurn(1), false, 'Bot turn loop stops on a human pending deck effect');

  state = bot.startSoloGame('Ada', 'Ordinateur');
  computer = state.players[1];
  state.currentPlayerIndex = 1;
  state.phase = rules.PHASES.UPDATE;
  computer.systemDeck = [createCard('swap'), createCard('ram')];
  state.pendingDeckEffect = {
    id: 'bot-pending',
    ownerIndex: 1,
    sourceName: 'Effet bot',
    mode: 'peek_top',
    count: 1,
    allowedPlayerIndexes: [1],
    allowedDecks: ['system'],
    afterResolve: null
  };
  assert.equal(bot.runBotStep(1), true, 'Bot resolves its own pending deck effect automatically');
  assert.equal(state.pendingDeckEffect, null);
}

function assertBotSkipsHardwareWhenSlotsAreFull() {
  const state = bot.startSoloGame('Ada', 'Ordinateur', { botProfile: 'pedagogique' });
  const human = state.players[0];
  const computer = state.players[1];
  state.turn = 5;
  state.currentPlayerIndex = 1;
  state.phase = rules.PHASES.ACTION;
  human.active = [makeFunction('factorielle', 4, [4, 3, 2, 1, 0], { reachedZero: true, nextValue: -1, memUsed: 7 })];
  computer.active = [];
  computer.hardware = [createCard('planificateur'), createCard('overclock')];
  computer.hand = [createCard('ram')];
  computer.memFree = 3;
  const logBefore = state.logSequence;

  assert.equal(bot.runBotStep(1), true, 'Bot should make progress instead of retrying impossible RAM');
  assert.equal(computer.hand.some((card) => card.key === 'ram'), true, 'Bot keeps RAM when hardware slots are full');
  assert.equal(state.log.slice(logBefore).some((entry) => entry.text.includes('déjà 2 Hardware')), false);
  assert.equal(state.currentPlayerIndex, 0, 'Bot ends turn when the only tempting action is impossible');
}

function assertBotOverclockChoices() {
  let state = bot.startSoloGame('Ada', 'Ordinateur', { botProfile: 'equilibre' });
  let computer = state.players[1];
  state.currentPlayerIndex = 1;
  state.phase = rules.PHASES.UPDATE;
  computer.hardware = [createCard('overclock')];
  const completing = makeFunction('factorielle', 0, [0], { reachedZero: true, nextValue: -1, memUsed: 3 });
  computer.active = [completing];
  computer.updatedThisTurn = [completing.id];
  const scoreBefore = computer.score;
  assert.equal(bot.runBotStep(1), true, 'Balanced bot uses Overclocking when it completes a function');
  assert.equal(computer.score > scoreBefore, true);
  assert.equal(computer.overclockUsed, true);

  state = bot.startSoloGame('Ada', 'Ordinateur', { botProfile: 'pedagogique' });
  computer = state.players[1];
  state.currentPlayerIndex = 1;
  state.phase = rules.PHASES.UPDATE;
  computer.hardware = [createCard('overclock')];
  const nonCompleting = makeFunction('factorielle', 2, [2, 1], { reachedZero: false, nextValue: 0, memUsed: 4 });
  computer.active = [nonCompleting];
  computer.updatedThisTurn = [nonCompleting.id];
  assert.equal(bot.runBotStep(1), true, 'Pedagogic bot explicitly passes non-finishing Overclocking');
  assert.equal(computer.overclockSkipped, true);
  assert.equal(nonCompleting.frames.length, 2);
  assert.equal(bot.runBotStep(1), true);
  assert.equal(state.phase, rules.PHASES.DRAW);

  state = bot.startSoloGame('Ada', 'Ordinateur', { botProfile: 'agressif' });
  computer = state.players[1];
  state.currentPlayerIndex = 1;
  state.phase = rules.PHASES.UPDATE;
  computer.hardware = [createCard('overclock')];
  const aggressiveTarget = makeFunction('factorielle', 2, [2, 1], { reachedZero: false, nextValue: 0, memUsed: 4 });
  computer.active = [aggressiveTarget];
  computer.updatedThisTurn = [aggressiveTarget.id];
  computer.memFree = 5;
  assert.equal(bot.runBotStep(1), true, 'Aggressive bot may accept the Overclocking penalty');
  assert.deepEqual(aggressiveTarget.frames, [2, 1, 0]);
  assert.equal(computer.overclockUsed, true);
}

function assertSoloImportExportRoundTrip() {
  const state = bot.startSoloGame('Ada', 'Ordinateur', { botProfile: 'agressif' });
  const computer = state.players[1];
  state.currentPlayerIndex = 1;
  state.phase = rules.PHASES.ACTION;
  computer.hand = [];
  computer.active = [];
  computer.botReactionsThisTurn = 1;
  computer.botLastReactionLogSequence = 12;
  computer.botReactionLockSequence = 13;

  const saved = gameState.cloneStateForSave(state);
  assert.equal(saved.soloMode, true);
  assert.equal(saved.botIndex, 1);
  assert.equal(saved.botProfile, 'agressif');
  assert.equal(saved.players[1].isBot, true);
  assert.equal(saved.players[1].botReactionsThisTurn, 1);

  engine.importGame(JSON.stringify(saved));
  const restored = engine.getState();
  assert.equal(restored.soloMode, true);
  assert.equal(restored.botIndex, 1);
  assert.equal(restored.botProfile, 'agressif');
  assert.equal(restored.players[1].isBot, true);
  assert.equal(restored.currentPlayerIndex, 1);
  assert.equal(bot.runBotStep(1), true, 'Imported solo game can resume the bot turn');
  assert.equal(restored.currentPlayerIndex, 0);
}

function assertBotReactionCountersResetOnTurnChange() {
  const state = bot.startSoloGame('Ada', 'Ordinateur');
  const computer = state.players[1];
  state.currentPlayerIndex = 1;
  state.phase = rules.PHASES.ACTION;
  computer.hand = [];
  computer.active = [];
  computer.botReactionsThisTurn = 2;

  assert.equal(bot.runBotStep(1), true);
  assert.equal(state.currentPlayerIndex, 0);
  assert.equal(computer.botReactionsThisTurn, 0, 'Reaction count resets when a new turn begins');
}

function assertCompleteBotTurnWithFunctionDrawActionEnd() {
  const state = bot.startSoloGame('Ada', 'Ordinateur');
  const computer = state.players[1];
  state.currentPlayerIndex = 1;
  state.phase = rules.PHASES.UPDATE;
  state.firstTurn = false;
  computer.active = [makeFunction('factorielle', 1, [1], { reachedZero: false, nextValue: 0, memUsed: 3 })];
  computer.updatedThisTurn = [];
  computer.hand = [createCard('sentinelle')];
  computer.systemDeck = [createCard('swap')];
  computer.memFree = 8;

  assert.equal(bot.runBotStep(1), true, 'Bot updates a function');
  assert.equal(computer.updatedThisTurn.length, 1);
  assert.equal(bot.runBotStep(1), true, 'Bot validates update phase');
  assert.equal(state.phase, rules.PHASES.DRAW);
  assert.equal(bot.runBotStep(1), true, 'Bot draws during draw phase');
  assert.equal(state.phase, rules.PHASES.ACTION);
  assert.equal(bot.runBotStep(1), true, 'Bot plays one action');
  assert.equal(computer.active.length, 2);
  computer.hand = [];
  assert.equal(bot.runBotStep(1), true, 'Bot ends turn when no useful action remains');
  assert.equal(state.currentPlayerIndex, 0);
}

function assertDeckBuild() {
  const decks = buildDecks();
  assert.equal(decks.functions.length, 12);
  assert.equal(decks.system.length, 14);
}

function assertFunctionMemoryLifecycle() {
  const state = engine.newGame('Ada', 'Grace');
  const player = state.players[0];
  player.hand = [createCard('factorielle')];
  player.memFree = player.memTotal;

  assert.equal(engine.playCard(0, player.hand[0].id, { R: 2 }), true);
  const func = player.active[0];
  assert.equal(player.memFree, 8, 'Launching Factorielle reserves its printed cost');
  assert.equal(func.memUsed, 3, 'Initial frame reserves only the printed cost');
  assert.equal(player.discard.some((card) => card.key === 'factorielle'), false, 'Active function card is not in discard');

  state.phase = rules.PHASES.UPDATE;
  assert.equal(engine.updateFunction(func.id), true);
  assert.equal(player.memFree, 7, 'Adding a recursive frame costs one memory');
  assert.equal(func.memUsed, 4);
  assert.match(engine.getNextFunctionEffect(func).text, /empile \[0\]/);
  assert.match(engine.getFunctionEffectSummary(func).base, /pioche 1 carte/);
}

function assertStructuredLog() {
  const state = engine.newGame('Ada', 'Grace');
  assert.equal('time' in state.log[0], false, 'Log entries should not rely on local clock time');
  assert.equal(state.log[0].turn, 1);
  assert.equal(state.log[0].player, 'Ada');
  assert.ok(state.log[0].order < state.log[state.log.length - 1].order, 'Log is chronological');
}

function assertUndo() {
  const state = engine.newGame('Ada', 'Grace');
  const player = state.players[0];
  player.hand = [createCard('factorielle')];
  player.memFree = player.memTotal;

  assert.equal(engine.canUndo(), false);
  assert.equal(engine.playCard(0, player.hand[0].id, { R: 2 }), true);
  assert.equal(engine.canUndo(), true);
  assert.equal(engine.getState().players[0].active.length, 1);
  assert.equal(engine.undoLastAction(), true);

  const restored = engine.getState();
  assert.equal(restored.players[0].active.length, 0);
  assert.equal(restored.players[0].hand.length, 1);
  assert.equal(restored.players[0].memFree, 11);
}

function assertPlanifierAndHotfix() {
  const state = engine.newGame('Ada', 'Grace');
  const player = state.players[0];

  player.hand = [createCard('factorielle')];
  engine.playCard(0, player.hand[0].id, { R: 2 });
  const func = player.active[0];

  state.phase = rules.PHASES.ACTION;
  player.hand = [createCard('planificateur')];
  player.memFree = 11;
  assert.equal(engine.playCard(0, player.hand[0].id), true);
  assert.equal(player.discard.some((card) => card.key === 'planificateur'), false, 'Active hardware card is not in discard');

  state.phase = rules.PHASES.UPDATE;
  player.updatedThisTurn = [];
  assert.equal(engine.updateFunction(func.id), true);
  assert.equal(player.memFree, 9, 'Planificateur makes the first stack free after hardware cost');

  state.phase = rules.PHASES.ACTION;
  player.active = [{ ...func, broken: true, frames: [2, 1, 'P'], memUsed: 4 }];
  player.hand = [createCard('hotfix')];
  player.memFree = 5;
  assert.equal(engine.playCard(0, player.hand[0].id, { functionId: player.active[0].id }), true);
  assert.deepEqual(player.active[0].frames, [2]);
  assert.equal(player.active[0].broken, false);
  assert.equal(player.active[0].memUsed, player.active[0].cost);
}

function assertHardwareReplacement() {
  let state = engine.newGame('Ada', 'Grace');
  let player = state.players[0];
  state.phase = rules.PHASES.ACTION;
  player.memFree = player.memTotal;
  player.hand = [createCard('overclock'), createCard('planificateur'), createCard('ram')];
  assert.equal(engine.playCard(0, player.hand[0].id), true);
  assert.equal(engine.playCard(0, player.hand[0].id), true);
  const ram = player.hand[0];
  assert.equal(engine.playCard(0, ram.id), false, 'A third Hardware needs an explicit replacement choice');
  assert.deepEqual(player.hardware.map((card) => card.key), ['overclock', 'planificateur']);

  const replaced = player.hardware.find((card) => card.key === 'overclock');
  assert.equal(engine.playCard(0, ram.id, { replaceHardwareId: replaced.id }), true, 'A third Hardware can replace an existing Hardware');
  assert.deepEqual(player.hardware.map((card) => card.key), ['planificateur', 'ram']);
  assert.equal(player.discard.some((card) => card.key === 'overclock'), true, 'Replaced Hardware goes to discard');

  state = engine.newGame('Ada', 'Grace');
  player = state.players[0];
  state.phase = rules.PHASES.ACTION;
  player.memFree = player.memTotal;
  player.hand = [createCard('ram'), createCard('overclock'), createCard('planificateur')];
  assert.equal(engine.playCard(0, player.hand[0].id), true);
  assert.equal(engine.playCard(0, player.hand[0].id), true);
  const totalBefore = player.memTotal;
  const planifier = player.hand[0];
  const ramInPlay = player.hardware.find((card) => card.key === 'ram');
  assert.equal(engine.playCard(0, planifier.id, { replaceHardwareId: ramInPlay.id }), true);
  assert.equal(player.memTotal, totalBefore - 4, 'Replacing RAM removes its ongoing memory-total bonus');
  assert.equal(player.hardware.some((card) => card.key === 'ram'), false);
}

function assertOverclockTimingAndPenalty() {
  let state = engine.newGame('Ada', 'Grace');
  let player = state.players[0];
  player.hand = [createCard('factorielle'), createCard('sentinelle'), createCard('overclock')];
  player.memFree = player.memTotal;
  assert.equal(engine.playCard(0, player.hand[0].id, { R: 2 }), true);
  assert.equal(engine.playCard(0, player.hand[0].id, { R: 1 }), true);
  assert.equal(engine.playCard(0, player.hand[0].id), true);
  let factorielle = player.active.find((fn) => fn.cardKey === 'factorielle');
  let sentinelle = player.active.find((fn) => fn.cardKey === 'sentinelle');

  state.phase = rules.PHASES.UPDATE;
  player.updatedThisTurn = [];
  assert.equal(engine.updateFunction(factorielle.id), true);
  assert.equal(engine.canUseOverclock(factorielle.id), false, 'Overclock is unavailable while mandatory updates remain');
  assert.equal(engine.updateFunction(sentinelle.id), true);
  assert.equal(engine.canUseOverclock(factorielle.id), true, 'Overclock is available after mandatory updates');
  const memoryBefore = player.memFree;
  assert.equal(engine.useOverclock(factorielle.id), true);
  assert.deepEqual(factorielle.frames, [2, 1, 0]);
  assert.equal(player.memFree, memoryBefore - 2, 'Overclock stack cost plus immediate penalty apply when function stays active');
  assert.equal(engine.canUseOverclock(factorielle.id), false, 'Overclock is once per turn');
  assert.equal(engine.validateUpdatePhase(), true);
  assert.equal(state.phase, rules.PHASES.DRAW);

  state = engine.newGame('Ada', 'Grace');
  player = state.players[0];
  player.hand = [createCard('overclock')];
  player.memFree = player.memTotal;
  assert.equal(engine.playCard(0, player.hand[0].id), true);
  factorielle = makeFunction('factorielle', 0, [0], { reachedZero: true, nextValue: -1, memUsed: 3 });
  player.active = [factorielle];
  state.phase = rules.PHASES.UPDATE;
  player.updatedThisTurn = [factorielle.id];
  assert.equal(engine.canUseOverclock(factorielle.id), true);
  const beforeCompletionOverclock = player.memFree;
  assert.equal(engine.useOverclock(factorielle.id), true);
  assert.equal(player.active.some((fn) => fn.id === factorielle.id), false, 'Overclock can complete a function');
  assert.ok(player.memFree >= beforeCompletionOverclock, 'No Overclock penalty is applied when the function completes');

  state = engine.newGame('Ada', 'Grace');
  player = state.players[0];
  player.hand = [createCard('factorielle'), createCard('overclock')];
  player.memFree = player.memTotal;
  assert.equal(engine.playCard(0, player.hand[0].id, { R: 1 }), true);
  assert.equal(engine.playCard(0, player.hand[0].id), true);
  factorielle = player.active[0];
  state.phase = rules.PHASES.UPDATE;
  player.updatedThisTurn = [];
  assert.equal(engine.updateFunction(factorielle.id), true);
  assert.equal(engine.validateUpdatePhase(), false, 'Update phase cannot advance until Overclock is used or passed');
  assert.equal(engine.canSkipOverclock(), true);
  assert.equal(engine.skipOverclock(), true);
  assert.equal(engine.validateUpdatePhase(), true);
  assert.equal(state.phase, rules.PHASES.DRAW);

  state = engine.newGame('Ada', 'Grace');
  player = state.players[0];
  player.hand = [createCard('overclock')];
  player.memFree = player.memTotal;
  assert.equal(engine.playCard(0, player.hand[0].id), true);
  const fragile = makeFunction('factorielle', 6, [6, 5, 4, 3, 2, 1], { reachedZero: false, nextValue: 0, memUsed: 8 });
  player.active = [fragile];
  player.memFree = 4;
  state.phase = rules.PHASES.UPDATE;
  player.updatedThisTurn = [fragile.id];
  const memoryBeforeBreak = player.memFree;
  assert.equal(engine.useOverclock(fragile.id), true);
  assert.equal(fragile.broken, true, 'Overclock can break an overfull function');
  assert.equal(player.memFree, memoryBeforeBreak - 1, 'Overclock penalty applies immediately when the extra update breaks the function');
}

function assertRebootStopsActions() {
  let state = engine.newGame('Ada', 'Grace');
  let player = state.players[0];
  player.hand = [createCard('swap')];

  assert.equal(engine.canRebootCurrentPlayer(), true, 'Voluntary reboot is available before any turn action');
  assert.equal(engine.rebootCurrentPlayer(), true);
  assert.equal(engine.canPlayCard(), false, 'No card can be played after a voluntary reboot this turn');
  assert.equal(player.active.length, 0);
  assert.equal(player.hand.length, 5);
  assert.equal(player.hand.filter((card) => card.type === 'Fonction').length, 3);
  assert.equal(player.hand.filter((card) => card.type !== 'Fonction').length, 2);

  state = engine.newGame('Ada', 'Grace');
  player = state.players[0];
  player.hand = [createCard('factorielle')];
  assert.equal(engine.playCard(0, player.hand[0].id, { R: 1 }), true);
  assert.equal(engine.canRebootCurrentPlayer(), false, 'A card play blocks voluntary reboot for the rest of the turn');
  assert.equal(engine.rebootCurrentPlayer(), false);

  state = engine.newGame('Ada', 'Grace');
  player = state.players[0];
  player.hand = [createCard('factorielle')];
  assert.equal(engine.rebootCurrentPlayer(), true, 'Reboot can happen during the opening update window');

  state = engine.newGame('Ada', 'Grace');
  player = state.players[0];
  player.hand = [createCard('factorielle')];
  assert.equal(engine.playCard(0, player.hand[0].id, { R: 1 }), true);
  engine.endTurn();
  player = state.players[1];
  state.phase = rules.PHASES.DRAW;
  assert.ok(engine.drawForPlayer('system'));
  assert.equal(engine.canRebootCurrentPlayer(), false, 'A draw blocks voluntary reboot for the rest of the turn');
}

function assertSwapBrutalCompletionWindow() {
  let state = engine.newGame('Ada', 'Grace');
  let player = state.players[0];
  player.hand = [createCard('factorielle')];
  player.memFree = player.memTotal;
  assert.equal(engine.playCard(0, player.hand[0].id, { R: 0 }), true);
  const func = player.active[0];
  engine.endTurn();
  state.currentPlayerIndex = 0;
  state.turn = 2;
  state.phase = rules.PHASES.UPDATE;
  player.updatedThisTurn = [];
  player.completedThisTurn = false;
  assert.equal(engine.updateFunction(func.id), true, 'Function completion during update counts for the turn');
  state.phase = rules.PHASES.ACTION;
  player.hand = [createCard('swap')];
  player.memFree = 3;
  player.memTotal = 11;
  assert.equal(engine.playCard(0, player.hand[0].id), true);
  assert.equal(engine.endTurn(), true);
  assert.equal(player.memTotal, 11, 'Swap penalty is avoided by a function completed earlier this turn');

  state = engine.newGame('Ada', 'Grace');
  player = state.players[0];
  state.phase = rules.PHASES.ACTION;
  player.hand = [createCard('swap')];
  player.memFree = 3;
  player.memTotal = 11;
  assert.equal(engine.playCard(0, player.hand[0].id), true);
  assert.equal(engine.endTurn(), true);
  assert.equal(player.memTotal, 10, 'Swap penalty applies if no function completed during the turn');
}

function assertInterruptsCanReactOnOpponentTurn() {
  let state = engine.newGame('Ada', 'Grace');
  let current = state.players[0];
  let opponent = state.players[1];
  current.hand = [createCard('tri_fusion')];
  assert.equal(engine.playCard(0, current.hand[0].id, { R: 4 }), true);
  const target = current.active[0];
  target.frames = [4, 3, 2, 1, 0];
  target.reachedZero = true;
  target.nextValue = -1;
  target.memUsed = 7;
  current.memFree = 4;
  opponent.hand = [createCard('stack_spike')];
  opponent.memFree = 8;
  state.phase = rules.PHASES.UPDATE;

  assert.equal(engine.canPlayCard(1, opponent.hand[0].id), true, 'A non-active player can react with an Interrupt');
  assert.equal(engine.playCard(1, opponent.hand[0].id, { functionId: target.id }), true);
  assert.equal(target.broken, true, 'Opponent Stack Spike can break a function during the active player turn');
  assert.equal(state.phase, rules.PHASES.UPDATE, 'Interrupts do not advance the active player phase');
  const interruptLog = state.log.find((entry) => entry.cardKey === 'stack_spike');
  assert.equal(interruptLog.cardType, 'Interrupt');
  assert.equal(interruptLog.actorIndex, 1);
  assert.equal(interruptLog.targetPlayerIndex, 0);

  state = engine.newGame('Ada', 'Grace');
  current = state.players[0];
  opponent = state.players[1];
  current.hand = [createCard('factorielle')];
  opponent.hand = [createCard('pollution')];
  state.phase = rules.PHASES.UPDATE;
  assert.equal(engine.canPlayCard(1, opponent.hand[0].id), false, 'A non-active player cannot play a Command as a reaction');
  assert.equal(engine.playCard(1, opponent.hand[0].id), false);
  assert.equal(engine.canPlayCard(0, current.hand[0].id), false, 'The active player cannot play a Function before conception');
}

function assertDrawRulesAndFunctionReplacement() {
  let state = engine.newGame('Ada', 'Grace');
  let player = state.players[0];
  state.phase = rules.PHASES.DRAW;
  const functionsBeforeManualDraw = player.functionsDeck.length;
  const systemsBeforeManualDraw = player.systemDeck.length;

  assert.equal(engine.drawForPlayer('functions'), null, 'The draw phase cannot draw a new Function');
  assert.equal(state.phase, rules.PHASES.DRAW);
  assert.equal(player.functionsDeck.length, functionsBeforeManualDraw);

  const systemCard = engine.drawForPlayer('system');
  assert.ok(systemCard, 'The draw phase draws from the System deck');
  assert.notEqual(systemCard.type, 'Fonction');
  assert.equal(player.functionsDeck.length, functionsBeforeManualDraw);
  assert.equal(player.systemDeck.length, systemsBeforeManualDraw - 1);
  assert.equal(state.phase, rules.PHASES.ACTION);

  state = engine.newGame('Ada', 'Grace');
  player = state.players[0];
  player.hand = [createCard('factorielle')];
  player.memFree = player.memTotal;
  assert.equal(engine.playCard(0, player.hand[0].id, { R: 0 }), true);
  const func = player.active[0];
  const functionsBeforeCompletion = player.functionsDeck.length;
  const systemsBeforeCompletion = player.systemDeck.length;

  state.phase = rules.PHASES.UPDATE;
  player.updatedThisTurn = [];
  assert.equal(engine.updateFunction(func.id), true);
  assert.equal(player.active.length, 0);
  assert.equal(player.functionsDeck.length, functionsBeforeCompletion - 1, 'Completing a function draws exactly one replacement Function');
  assert.equal(player.hand.filter((card) => card.type === 'Fonction').length, 1);
  assert.equal(player.systemDeck.length, systemsBeforeCompletion - 1, 'Factorielle base case draws from the System deck');
}

function assertDrawExhaustionForcesRebootWhenUsedMemoryIsTooHigh() {
  const state = engine.newGame('Ada', 'Grace');
  const player = state.players[0];
  state.phase = rules.PHASES.DRAW;
  player.functionsDeck = [];
  player.systemDeck = [];
  player.hand = [];
  player.memTotal = 4;
  player.memFree = 0;
  player.active = [{
    id: 'broken-factorielle',
    cardKey: 'factorielle',
    key: 'factorielle',
    name: 'Fonction Factorielle',
    cost: 3,
    value: 2,
    R: 2,
    frames: [2, 1, 0],
    nextValue: -1,
    reachedZero: true,
    broken: true,
    memUsed: 5
  }];

  assert.equal(engine.drawForPlayer('system'), null);
  assert.equal(player.memTotal, 3, 'Exhaustion reduces total memory by 1');
  assert.equal(player.active.length, 0, 'Used memory above total triggers an immediate forced reboot');
  assert.equal(state.phase, rules.PHASES.ACTION);
  assert.ok(state.log.some((entry) => entry.text.includes('reboot forcé')));
}

function assertPeekEffectsRevealDeckTopsWithoutDrawing() {
  const state = engine.newGame('Ada', 'Grace');
  const player = state.players[0];
  const opponent = state.players[1];
  const topFunction = createCard('factorielle');
  const topSystem = createCard('swap');
  player.functionsDeck = [topFunction, createCard('sentinelle')];
  player.systemDeck = [topSystem, createCard('purge')];
  opponent.systemDeck = [createCard('pollution'), createCard('ram')];
  player.hand = [createCard('sentinelle')];
  player.memFree = player.memTotal;
  assert.equal(engine.playCard(0, player.hand[0].id, { R: 0 }), true);
  const func = player.active[0];
  state.phase = rules.PHASES.UPDATE;
  player.updatedThisTurn = [];

  assert.equal(engine.updateFunction(func.id), true);
  const pending = engine.getPendingDeckEffect();
  assert.equal(pending.mode, 'peek_top');
  assert.deepEqual(pending.allowedPlayerIndexes, [0, 1], 'Sentinelle can inspect either player deck');
  assert.equal(engine.resolvePendingDeckEffect({ targetPlayerIndex: 1, deckType: 'system', action: 'top' }), true);
  assert.equal(player.systemDeck[0].id, topSystem.id, 'Peeking does not draw the System card');
  assert.equal(opponent.systemDeck.length, 2, 'Peeking an opponent deck does not draw either');
  assert.equal(engine.getPendingDeckEffect(), null);
}
function assertDeckTopPreviewHelpers() {
  const state = engine.newGame('Ada', 'Grace');
  const player = state.players[0];
  const first = createCard('swap');
  const second = createCard('purge');
  player.systemDeck = [first, second];

  assert.deepEqual(engine.getDeckTopCards(0, 'system', 2).map((card) => card.id), [first.id, second.id]);
  assert.equal(engine.moveTopDeckCardToBottom(0, 'system'), true);
  assert.deepEqual(player.systemDeck.map((card) => card.id), [second.id, first.id]);
  assert.equal(engine.getDeckTopCards(0, 'system', 1)[0].id, second.id);
}

function assertDeckChoiceEffectsMatchCardTexts() {
  let state = engine.newGame('Ada', 'Grace');
  let player = state.players[0];
  const first = createCard('swap');
  const second = createCard('purge');
  const third = createCard('ram');
  player.functionsDeck = [createCard('factorielle')];
  player.systemDeck = [first, second, third];
  player.hand = [createCard('recherche')];
  player.memFree = player.memTotal;
  assert.equal(engine.playCard(0, player.hand[0].id, { R: 0 }), true);
  player.active[0].frames = [3, 2, 1, 0];
  player.active[0].reachedZero = true;
  state.phase = rules.PHASES.UPDATE;
  player.updatedThisTurn = [];
  assert.equal(engine.updateFunction(player.active[0].id), true);
  assert.equal(engine.getPendingDeckEffect().mode, 'reveal_take');
  assert.equal(engine.resolvePendingDeckEffect({ targetPlayerIndex: 0, deckType: 'system', cardId: second.id }), true);
  assert.equal(player.hand.some((card) => card.id === second.id), true, 'Recherche takes the chosen revealed card');
  assert.deepEqual(player.systemDeck.map((card) => card.id), [first.id, third.id], 'Recherche puts the other revealed cards under that pile');

  state = engine.newGame('Ada', 'Grace');
  player = state.players[0];
  const top = createCard('collecte');
  const bottomed = createCard('pollution');
  const untouched = createCard('ram');
  player.systemDeck = [top, bottomed, untouched];
  player.hand = [createCard('tri_fusion')];
  player.memFree = player.memTotal;
  assert.equal(engine.playCard(0, player.hand[0].id, { R: 1 }), true);
  const tri = player.active[0];
  tri.frames = [1, 0];
  tri.reachedZero = true;
  state.phase = rules.PHASES.UPDATE;
  player.updatedThisTurn = [];
  assert.equal(engine.updateFunction(tri.id), true, 'Base case pops [0]');
  player.updatedThisTurn = [];
  assert.equal(engine.updateFunction(tri.id), true, 'Unwind creates the Tri Fusion deck effect');
  assert.equal(engine.getPendingDeckEffect().mode, 'may_bottom');
  assert.equal(engine.resolvePendingDeckEffect({ targetPlayerIndex: 0, deckType: 'system', action: 'bottom', cardId: bottomed.id }), true);
  assert.equal(player.hand.some((card) => card.id === top.id), true, 'Tri Fusion base case draws before the unwind choice');
  assert.deepEqual(player.systemDeck.map((card) => card.id), [untouched.id, bottomed.id], 'Tri Fusion can move one of the two seen cards under the pile');
}

function assertCompactageAndDebuggerDetails() {
  let state = engine.newGame('Ada', 'Grace');
  let player = state.players[0];
  const broken = makeFunction('quicksort', 3, [3, 2, 1], { broken: true, reachedZero: false, nextValue: 0, memUsed: 5 });
  const compactage = makeFunction('compactage', 2, [2], { reachedZero: true, nextValue: -1, memUsed: 3 });
  player.active = [compactage, broken];
  player.systemDeck = [createCard('swap')];
  player.functionsDeck = [createCard('factorielle')];
  player.memFree = 3;
  state.phase = rules.PHASES.UPDATE;
  player.updatedThisTurn = [];
  assert.equal(engine.updateFunction(compactage.id), true);
  assert.equal(player.active.some((fn) => fn.id === broken.id), false, 'Compactage cleans a broken function if possible');
  assert.equal(player.hand.some((card) => card.key === 'swap'), true, 'Compactage draws System when B(R) >= 2');

  state = engine.newGame('Ada', 'Grace');
  player = state.players[0];
  const compactageWithoutBroken = makeFunction('compactage', 2, [2], { reachedZero: true, nextValue: -1, memUsed: 3 });
  player.active = [compactageWithoutBroken];
  player.systemDeck = [createCard('ram')];
  player.functionsDeck = [createCard('factorielle')];
  player.memFree = 4;
  state.phase = rules.PHASES.UPDATE;
  player.updatedThisTurn = [];
  assert.equal(engine.updateFunction(compactageWithoutBroken.id), true);
  assert.equal(player.hand.some((card) => card.key === 'ram'), true, 'Compactage draws System even when no broken function was cleaned');

  state = engine.newGame('Ada', 'Grace');
  player = state.players[0];
  const debugTarget = makeFunction('factorielle', 2, [2, 1], { broken: true, reachedZero: false, nextValue: 0, memUsed: 4 });
  player.active = [debugTarget];
  player.hand = [createCard('debug')];
  player.memFree = 5;
  state.phase = rules.PHASES.ACTION;
  assert.equal(engine.playCard(0, player.hand[0].id, { functionId: debugTarget.id }), true);
  assert.equal(debugTarget.broken, false, 'Debugger repairs a non-empty broken function');
  assert.deepEqual(debugTarget.frames, [2]);
  assert.equal(debugTarget.memUsed, 3);

  state = engine.newGame('Ada', 'Grace');
  player = state.players[0];
  const emptied = makeFunction('factorielle', 2, [2], { broken: true, reachedZero: false, nextValue: 1, memUsed: 3 });
  player.active = [emptied];
  player.hand = [createCard('debug')];
  player.memFree = 5;
  const scoreBefore = player.score;
  state.phase = rules.PHASES.ACTION;
  assert.equal(engine.playCard(0, player.hand[0].id, { functionId: emptied.id }), true);
  assert.equal(player.active.some((fn) => fn.id === emptied.id), false, 'Debugger discards a function emptied by debugging');
  assert.equal(player.score, scoreBefore, 'Debugger does not score or apply terminal effects when emptying a function');
  assert.equal(player.memFree, 8, 'Debugger releases the stuck function memory');
}

function assertAnyOwnerInterruptTargets() {
  const state = engine.newGame('Ada', 'Grace');
  const player = state.players[0];
  const own = makeFunction('tri_fusion', 4, [4, 3, 2, 1], { reachedZero: false, nextValue: 0, memUsed: 6 });
  player.active = [own];
  player.hand = [createCard('stack_spike')];
  player.memFree = player.memTotal;
  state.phase = rules.PHASES.ACTION;
  assert.equal(engine.playCard(0, player.hand[0].id, { functionId: own.id }), true, 'Stack Spike can target own function with 4 or 5 frames');
  assert.equal(own.frames.filter((frame) => frame === 'P').length, 2);

  const state2 = engine.newGame('Ada', 'Grace');
  const current = state2.players[0];
  const ownInjectionTarget = makeFunction('factorielle', 2, [2, 1], { reachedZero: false, nextValue: 0, memUsed: 4 });
  current.active = [ownInjectionTarget];
  current.hand = [createCard('injection')];
  current.memFree = current.memTotal;
  state2.phase = rules.PHASES.ACTION;
  assert.equal(engine.playCard(0, current.hand[0].id, { functionId: ownInjectionTarget.id }), true, 'Injection can target own function');
  assert.equal(ownInjectionTarget.frames.includes('P'), true);
}

function assertOverclockButtonPassesSelectedId() {
  const uiSource = readFileSync(resolve(repoRoot, 'internet/v2/public/assets/js/ui.js'), 'utf8');
  assert.match(uiSource, /map\(\(fn\) => \(\{ id: fn\.id, playerIndex: currentPlayer\.index, functionId: fn\.id, label: fn\.name \}\)\)/, 'Overclock target choices expose id for chooseTargetFunction');
  assert.match(uiSource, /if \(selected\) applyOverclock\(selected\);/, 'Overclock button applies the selected function id');
  assert.doesNotMatch(uiSource, /applyOverclock\(selected\.functionId\)/, 'Overclock button must not expect an object from chooseTargetFunction');
}

function assertEndTurnInActionPhase() {
  let state = engine.loadDemoScenario('ram');
  assert.equal(state.phase, rules.PHASES.ACTION);
  assert.equal(engine.canEndTurn(), true, 'Action demos with active functions can still end the turn');

  state = engine.newGame('Ada', 'Grace');
  const player = state.players[0];
  player.hand = [createCard('factorielle')];
  assert.equal(engine.playCard(0, player.hand[0].id, { R: 2 }), true);
  assert.equal(engine.canEndTurn(), true, 'A function launched during action phase waits until next update phase');
}

function assertRulesConstants() {
  const markdown = readFileSync(resolve(repoRoot, 'physique/initiation/regles/REGLES_INITIATION_QUADRATIQUE.md'), 'utf8');
  assert.match(markdown, /Mémoire de départ.+11 mémoire totale \/ 11 mémoire libre/);
  assert.match(markdown, /La phase de pioche ne permet pas de tirer une nouvelle Fonction/);
  assert.match(markdown, /reboot qui redonne une main de départ/);
  assert.equal(rules.START_MEMORY, 11);
  assert.equal(rules.WIN_SCORE, 11);
  assert.equal(rules.MAX_FRAMES_PER_FUNCTION, 6);
  assert.equal(rules.bonusRecursion(5), 25);
}

function assertFunctionDescriptionsUseRulePhases() {
  Object.values(CARD_DEFINITIONS)
    .filter((definition) => definition.type === 'Fonction')
    .forEach((definition) => {
      assert.match(definition.description, /Cas de base :/, `${definition.name} must describe its base case`);
      assert.match(definition.description, /Remontée :/, `${definition.name} must describe its unwind effect`);
      assert.match(definition.description, /Terminaison :/, `${definition.name} must describe its terminal effect`);
    });
}

function assertPlayerDeckCoherence(player) {
  const counts = new Map(DECK_COMPOSITION.map(([key]) => [key, 0]));
  const add = (key) => counts.set(key, (counts.get(key) || 0) + 1);

  player.hand.forEach((card) => add(card.key));
  player.active.forEach((func) => add(func.cardKey));
  player.hardware.forEach((card) => add(card.key));
  player.discard.forEach((card) => add(card.key));
  player.functionsDeck.forEach((card) => add(card.key));
  player.systemDeck.forEach((card) => add(card.key));

  DECK_COMPOSITION.forEach(([key, expected]) => {
    assert.equal(counts.get(key), expected, `${player.name} has incoherent card count for ${key}`);
  });
}

function assertFunctionStateCoherence(fn) {
  const numericFrames = fn.frames.filter((frame) => frame !== 'P');
  assert.equal(numericFrames[0], fn.R, `${fn.name} first frame must be R`);
  for (let i = 1; i < numericFrames.length; i += 1) {
    assert.equal(numericFrames[i], numericFrames[i - 1] - 1, `${fn.name} frames must descend by 1`);
  }
  assert.equal(fn.reachedZero, numericFrames.includes(0), `${fn.name} reachedZero must match frames`);
  const expectedMem = fn.cost + fn.frames.slice(1).filter((frame) => frame !== 'P').length;
  assert.equal(fn.memUsed, expectedMem, `${fn.name} memory must ignore parasite frames`);
}

function assertDemoScenarios() {
  const scenarios = [
    'depth_choice',
    'base_not_end',
    'strategic_memory',
    'repair_or_clean',
    'ram',
    'stack_spike_break',
    'overflow_avoidable',
    'profitable_reboot',
    'opponent_interrupt',
    'deck_peek_order',
    'recherche_pick',
    'forced_reboot'
  ];
  const expectedTurns = {
    depth_choice: 3,
    base_not_end: 4,
    strategic_memory: 4,
    repair_or_clean: 5,
    ram: 3,
    stack_spike_break: 6,
    overflow_avoidable: 6,
    profitable_reboot: 5,
    opponent_interrupt: 6,
    deck_peek_order: 4,
    recherche_pick: 5,
    forced_reboot: 4
  };

  scenarios.forEach((scenario) => {
    const state = engine.loadDemoScenario(scenario);
    assert.notEqual(state.phase, rules.PHASES.GAME_OVER, `${scenario} should be playable`);
    assert.equal(state.turn, expectedTurns[scenario], `${scenario} should use a plausible turn number`);
    assert.ok(state.log.length >= 5, `${scenario} should include a readable route to the situation`);
    assert.ok(state.log.some((entry) => entry.text.includes('Position d’analyse')), `${scenario} should describe the teaching position`);
    assert.ok(state.log.some((entry) => entry.text.includes('Question pour la classe')), `${scenario} should end with a student-facing question`);
    state.players.forEach((player) => {
      assert.ok(player.memFree >= 0 && player.memFree <= player.memTotal + player.tempMemory, `${scenario}: ${player.name} memory must be legal`);
      player.active.forEach(assertFunctionStateCoherence);
      assertPlayerDeckCoherence(player);
    });
  });

  let state = engine.loadDemoScenario('depth_choice');
  let cyan = state.players[0];
  const factorielleToLaunch = cyan.hand.find((card) => card.key === 'factorielle');
  assert.equal(engine.playCard(0, factorielleToLaunch.id, { R: 3 }), true);
  assert.equal(cyan.active.some((func) => func.cardKey === 'factorielle' && func.R === 3), true);

  state = engine.loadDemoScenario('base_not_end');
  cyan = state.players[0];
  assert.equal(engine.updateFunction(cyan.active[0].id), true);
  assert.equal(cyan.active.length, 1, 'Base case should not complete the function');
  assert.deepEqual(cyan.active[0].frames, [2, 1]);

  state = engine.loadDemoScenario('strategic_memory');
  cyan = state.players[0];
  let compactage = cyan.active.find((func) => func.cardKey === 'compactage');
  let factorielle = cyan.active.find((func) => func.cardKey === 'factorielle');
  assert.equal(cyan.memTotal, 11);
  assert.equal(cyan.memFree, 0);
  assert.deepEqual(factorielle.frames, [2, 1, 0]);
  assert.equal(factorielle.reachedZero, true);
  assert.deepEqual(compactage.frames, [1]);
  assert.equal(compactage.reachedZero, false);
  assert.match(engine.getNextFunctionEffect(factorielle).text, /dépile \[0\]/);
  assert.match(engine.getNextFunctionEffect(compactage).text, /empile \[0\]/);
  assert.equal(engine.updateFunction(factorielle.id), true);
  assert.deepEqual(factorielle.frames, [2, 1]);
  assert.equal(cyan.memFree, 1, 'Unwinding Factorielle first frees one memory');
  assert.equal(engine.updateFunction(compactage.id), true);
  assert.deepEqual(compactage.frames, [1, 0]);
  assert.equal(cyan.memFree, 0);
  assert.equal(cyan.active.some((func) => func.broken), false, 'Correct update order breaks no function');

  state = engine.loadDemoScenario('strategic_memory');
  cyan = state.players[0];
  compactage = cyan.active.find((func) => func.cardKey === 'compactage');
  factorielle = cyan.active.find((func) => func.cardKey === 'factorielle');
  assert.equal(engine.updateFunction(compactage.id), true);
  assert.equal(compactage.broken, true, 'Stacking first with no free memory breaks Compactage');
  assert.equal(engine.updateFunction(factorielle.id), true);
  assert.equal(factorielle.broken, false);

  state = engine.loadDemoScenario('repair_or_clean');
  cyan = state.players[0];
  const broken = cyan.active[0];
  const hotfix = cyan.hand.find((card) => card.key === 'hotfix');
  assert.equal(engine.playCard(0, hotfix.id, { functionId: broken.id }), true);
  assert.equal(broken.broken, false);
  assert.deepEqual(broken.frames, [3]);
  assert.ok(cyan.memFree > 5, 'Repairing should free the recursive frames that were stuck in memory');

  state = engine.loadDemoScenario('ram');
  cyan = state.players[0];
  const ram = cyan.hand.find((card) => card.key === 'ram');
  assert.equal(engine.playCard(0, ram.id), true);
  assert.equal(cyan.memTotal, 14);
  assert.equal(cyan.hardware.some((card) => card.key === 'ram'), true);

  state = engine.loadDemoScenario('stack_spike_break');
  cyan = state.players[0];
  const orange = state.players[1];
  const stackSpike = cyan.hand.find((card) => card.key === 'stack_spike');
  assert.equal(engine.playCard(0, stackSpike.id, { functionId: orange.active[0].id }), true);
  assert.equal(orange.active[0].broken, true, 'Stack Spike should break the 5-frame function');

  state = engine.loadDemoScenario('overflow_avoidable');
  cyan = state.players[0];
  let vulnerable = cyan.active[0];
  let purge = cyan.hand.find((card) => card.key === 'purge');
  assert.equal(vulnerable.frames.length, 5);
  assert.equal(engine.playCard(0, purge.id, { functionId: vulnerable.id }), true);
  assert.equal(vulnerable.frames.length, 4, 'Purge removes the parasite before Stack Spike');
  let orangePlayer = state.players[1];
  let spike = orangePlayer.hand.find((card) => card.key === 'stack_spike');
  assert.equal(engine.playCard(1, spike.id, { functionId: vulnerable.id }), true);
  assert.equal(vulnerable.broken, false, 'Purge first prevents Stack Spike from breaking the function');

  state = engine.loadDemoScenario('overflow_avoidable');
  cyan = state.players[0];
  vulnerable = cyan.active[0];
  orangePlayer = state.players[1];
  spike = orangePlayer.hand.find((card) => card.key === 'stack_spike');
  assert.equal(engine.playCard(1, spike.id, { functionId: vulnerable.id }), true);
  assert.equal(vulnerable.broken, true, 'Ignoring the parasite lets Stack Spike break the function');

  state = engine.loadDemoScenario('profitable_reboot');
  cyan = state.players[0];
  assert.equal(engine.canRebootCurrentPlayer(), true);
  assert.equal(engine.rebootCurrentPlayer(), true);
  assert.equal(cyan.active.length, 0);
  assert.equal(cyan.hand.length, 5);
  assert.ok(cyan.memFree > 1, 'Voluntary reboot frees the stuck broken function memory');

  state = engine.loadDemoScenario('opponent_interrupt');
  cyan = state.players[0];
  orangePlayer = state.players[1];
  spike = cyan.hand.find((card) => card.key === 'stack_spike');
  assert.equal(state.currentPlayerIndex, 1);
  assert.equal(engine.canPlayCard(0, spike.id), true, 'Cyan can interrupt during Orange turn');
  assert.equal(engine.playCard(0, spike.id, { functionId: orangePlayer.active[0].id }), true);
  assert.equal(orangePlayer.active[0].broken, true);

  state = engine.loadDemoScenario('deck_peek_order');
  cyan = state.players[0];
  orangePlayer = state.players[1];
  assert.deepEqual(orangePlayer.systemDeck.slice(0, 2).map((card) => card.key), ['stack_spike', 'pollution']);
  assert.equal(engine.updateFunction(cyan.active[0].id), true);
  assert.equal(engine.getPendingDeckEffect().mode, 'peek_order');
  assert.equal(engine.resolvePendingDeckEffect({ targetPlayerIndex: 1, deckType: 'system', action: 'reverse' }), true);
  assert.deepEqual(orangePlayer.systemDeck.slice(0, 2).map((card) => card.key), ['pollution', 'stack_spike']);

  state = engine.loadDemoScenario('recherche_pick');
  cyan = state.players[0];
  assert.deepEqual(cyan.systemDeck.slice(0, 3).map((card) => card.key), ['ram', 'purge', 'overclock']);
  assert.equal(engine.updateFunction(cyan.active[0].id), true);
  assert.equal(engine.getPendingDeckEffect().mode, 'reveal_take');
  const revealedPurge = cyan.systemDeck.find((card) => card.key === 'purge');
  assert.equal(engine.resolvePendingDeckEffect({ targetPlayerIndex: 0, deckType: 'system', cardId: revealedPurge.id }), true);
  assert.equal(cyan.hand.some((card) => card.key === 'purge'), true);
  assert.deepEqual(cyan.systemDeck.slice(-2).map((card) => card.key), ['ram', 'overclock']);

  state = engine.loadDemoScenario('forced_reboot');
  cyan = state.players[0];
  assert.equal(cyan.functionsDeck.length, 0);
  assert.equal(cyan.systemDeck.length, 0);
  assert.equal(cyan.active.length, 1);
  assert.equal(engine.getPlayerUsedMemory(cyan), cyan.memTotal, 'Before exhaustion, used memory exactly matches total memory');
  assert.equal(engine.drawForPlayer('system'), null);
  assert.equal(cyan.memTotal, 5);
  assert.equal(cyan.active.length, 0, 'Exhaustion can trigger a forced reboot');
  assert.equal(cyan.hand.length, 5);
}

assertMapsEqual(deckCompositionFromCards(), parseDeckMarkdown());
assertRulesConstants();
assertFunctionDescriptionsUseRulePhases();
assertInitialSetup();
assertSoloSetup();
assertRunBotStepIsAtomic();
assertBotCanPassTurnCycle();
assertBotDoesNotPlayIllegalMove();
assertBotStackSpikeReaction();
assertBotProfilesAffectDepthAndTargets();
assertBotVoluntaryReboot();
assertBotReactionGuards();
assertBotPendingDeckEffects();
assertBotSkipsHardwareWhenSlotsAreFull();
assertBotOverclockChoices();
assertSoloImportExportRoundTrip();
assertBotReactionCountersResetOnTurnChange();
assertCompleteBotTurnWithFunctionDrawActionEnd();
assertDeckBuild();
assertFunctionMemoryLifecycle();
assertStructuredLog();
assertUndo();
assertPlanifierAndHotfix();
assertHardwareReplacement();
assertOverclockTimingAndPenalty();
assertRebootStopsActions();
assertSwapBrutalCompletionWindow();
assertInterruptsCanReactOnOpponentTurn();
assertDrawRulesAndFunctionReplacement();
assertDrawExhaustionForcesRebootWhenUsedMemoryIsTooHigh();
assertPeekEffectsRevealDeckTopsWithoutDrawing();
assertDeckTopPreviewHelpers();
assertDeckChoiceEffectsMatchCardTexts();
assertCompactageAndDebuggerDetails();
assertAnyOwnerInterruptTargets();
assertOverclockButtonPassesSelectedId();
assertEndTurnInActionPhase();
assertDemoScenarios();

console.log('V2 engine tests ok');
