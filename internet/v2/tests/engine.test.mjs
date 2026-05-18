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

function assertRebootStopsActions() {
  const state = engine.newGame('Ada', 'Grace');
  const player = state.players[0];
  player.hand = [createCard('factorielle')];
  engine.playCard(0, player.hand[0].id, { R: 1 });
  player.hand = [createCard('swap')];

  assert.equal(engine.rebootCurrentPlayer(), true);
  assert.equal(engine.canPlayCard(), false, 'No card can be played after a voluntary reboot this turn');
  assert.equal(player.active.length, 0);
  assert.equal(player.hand.length, 5);
}

function assertRulesConstants() {
  const markdown = readFileSync(resolve(repoRoot, 'physique/initiation/regles/REGLES_INITIATION_QUADRATIQUE.md'), 'utf8');
  assert.match(markdown, /Mémoire de départ.+11 mémoire totale \/ 11 mémoire libre/);
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
    'stack_spike_break'
  ];
  const expectedTurns = {
    depth_choice: 3,
    base_not_end: 4,
    strategic_memory: 4,
    repair_or_clean: 5,
    ram: 3,
    stack_spike_break: 6
  };

  scenarios.forEach((scenario) => {
    const state = engine.loadDemoScenario(scenario);
    assert.notEqual(state.phase, rules.PHASES.GAME_OVER, `${scenario} should be playable`);
    assert.equal(state.turn, expectedTurns[scenario], `${scenario} should use a plausible turn number`);
    assert.ok(state.log.length >= 5, `${scenario} should include a readable route to the situation`);
    state.players.forEach((player) => {
      assert.ok(player.memFree >= 0 && player.memFree <= player.memTotal + player.tempMemory, `${scenario}: ${player.name} memory must be legal`);
      player.active.forEach(assertFunctionStateCoherence);
      assertPlayerDeckCoherence(player);
    });
  });

  let state = engine.loadDemoScenario('base_not_end');
  let cyan = state.players[0];
  assert.equal(engine.updateFunction(cyan.active[0].id), true);
  assert.equal(cyan.active.length, 1, 'Base case should not complete the function');
  assert.deepEqual(cyan.active[0].frames, [2, 1]);

  state = engine.loadDemoScenario('strategic_memory');
  cyan = state.players[0];
  const compactage = cyan.active.find((func) => func.cardKey === 'compactage');
  const factorielle = cyan.active.find((func) => func.cardKey === 'factorielle');
  assert.equal(cyan.memFree, 1);
  assert.equal(engine.updateFunction(compactage.id), true);
  assert.ok(cyan.memFree >= 2, 'Compactage base case should create breathing room');
  assert.equal(engine.updateFunction(factorielle.id), true);

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
assertRebootStopsActions();
assertDemoScenarios();

console.log('V2 engine tests ok');
