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
  const markdown = readFileSync(resolve(repoRoot, 'physique/cartes/CARD_SET_INITIATION_QUADRATIQUE.md'), 'utf8');
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

  state.phase = rules.PHASES.UPDATE;
  assert.equal(engine.updateFunction(func.id), true);
  assert.equal(player.memFree, 7, 'Adding a recursive frame costs one memory');
  assert.equal(func.memUsed, 4);
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
  const markdown = readFileSync(resolve(repoRoot, 'physique/regles/REGLES_INITIATION_QUADRATIQUE.md'), 'utf8');
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

assertMapsEqual(deckCompositionFromCards(), parseDeckMarkdown());
assertRulesConstants();
assertFunctionDescriptionsUseRulePhases();
assertInitialSetup();
assertDeckBuild();
assertFunctionMemoryLifecycle();
assertPlanifierAndHotfix();
assertRebootStopsActions();

console.log('V2 engine tests ok');
