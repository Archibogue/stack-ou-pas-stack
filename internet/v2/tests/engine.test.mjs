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

function assertOverclockStillAllowsExtraUpdate() {
  const state = engine.newGame('Ada', 'Grace');
  const player = state.players[0];

  player.hand = [createCard('factorielle'), createCard('overclock')];
  player.memFree = player.memTotal;
  assert.equal(engine.playCard(0, player.hand[0].id, { R: 2 }), true);
  assert.equal(engine.playCard(0, player.hand[0].id), true);
  const func = player.active[0];

  state.phase = rules.PHASES.UPDATE;
  player.updatedThisTurn = [];
  assert.equal(engine.updateFunction(func.id), true);
  assert.deepEqual(func.frames, [2, 1]);
  assert.equal(player.updatedThisTurn.includes(func.id), true);
  assert.equal(engine.updateFunction(func.id), false, 'Normal update cannot run twice in the same update phase');
  assert.equal(engine.canUseOverclock(func.id), true, 'Overclock remains legal after the normal update');
  assert.equal(engine.useOverclock(func.id), true);
  assert.deepEqual(func.frames, [2, 1, 0], 'Overclock performs the extra update on the same function');
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
  const topFunction = createCard('factorielle');
  const topSystem = createCard('swap');
  player.functionsDeck = [topFunction, createCard('sentinelle')];
  player.systemDeck = [topSystem, createCard('purge')];
  player.hand = [createCard('sentinelle')];
  player.memFree = player.memTotal;
  assert.equal(engine.playCard(0, player.hand[0].id, { R: 0 }), true);
  const func = player.active[0];
  state.phase = rules.PHASES.UPDATE;
  player.updatedThisTurn = [];

  assert.equal(engine.updateFunction(func.id), true);
  const consultation = state.log.find((entry) => entry.text.includes('dessus des piles'));
  assert.ok(consultation, 'A peek effect writes the revealed cards to the log');
  assert.match(consultation.text, new RegExp(topFunction.name));
  assert.match(consultation.text, new RegExp(topSystem.name));
  assert.equal(player.systemDeck[0].id, topSystem.id, 'Peeking does not draw the System card');
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
    forced_reboot: 7
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

  state = engine.loadDemoScenario('forced_reboot');
  cyan = state.players[0];
  assert.equal(cyan.functionsDeck.length, 0);
  assert.equal(cyan.systemDeck.length, 0);
  assert.equal(cyan.active.length, 1);
  assert.equal(engine.drawForPlayer('system'), null);
  assert.equal(cyan.memTotal, 3);
  assert.equal(cyan.active.length, 0, 'Exhaustion can trigger a forced reboot');
  assert.equal(cyan.hand.length, 5);
}

assertMapsEqual(deckCompositionFromCards(), parseDeckMarkdown());
assertRulesConstants();
assertFunctionDescriptionsUseRulePhases();
assertInitialSetup();
assertDeckBuild();
assertFunctionMemoryLifecycle();
assertStructuredLog();
assertUndo();
assertPlanifierAndHotfix();
assertOverclockStillAllowsExtraUpdate();
assertRebootStopsActions();
assertInterruptsCanReactOnOpponentTurn();
assertDrawRulesAndFunctionReplacement();
assertDrawExhaustionForcesRebootWhenUsedMemoryIsTooHigh();
assertPeekEffectsRevealDeckTopsWithoutDrawing();
assertEndTurnInActionPhase();
assertDemoScenarios();

console.log('V2 engine tests ok');
