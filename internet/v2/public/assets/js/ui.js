import { MAX_HAND_SIZE, PHASES } from './rules.js';
import { getState, newGame, loadGame, saveGame, exportGame, importGame, drawForPlayer, getDeckTopCards, moveTopDeckCardToBottom, getPendingDeckEffect, getPendingHandLimitDiscard, resolvePendingDeckEffect, resolveHandLimitDiscard, validateUpdatePhase, updateFunction, playCard, canPlayCard, canEndTurn, endTurn, setApiAvailability, setRemoteCode, persistGameState, loadDemoScenario, getPlayerUsedMemory, canUseOverclock, useOverclock, canSkipOverclock, skipOverclock, rebootCurrentPlayer, canRebootCurrentPlayer, getFunctionEffectSummary, getNextFunctionEffect, canUndo, undoLastAction } from './game-engine.js';
import { getBotProfileLabel, maybeReactToHumanAction, runBotStep, startSoloGame } from './bot.js';
import { detectApi, createRemoteGame, joinRemoteGame, loadRemoteGame, loadLocalState, saveRemoteSeat, loadRemoteSeat } from './storage.js';

const app = document.getElementById('app');
const modal = document.getElementById('modal');
const BOT_STEP_DELAY_MS = 800;
const ACTION_TOAST_MS = 1900;
let apiAvailable = false;
let remotePollTimer = null;
let remotePollInFlight = false;
let lastRemoteSignature = '';
let remotePollPausedUntil = 0;
let lastSeenLogOrder = 0;
let lastCounterSnapshot = null;
let counterDeltas = new Map();
let openPendingDeckEffectId = null;
let openPendingHandLimitKey = null;
let botThinking = false;
let botStepCount = 0;
let botStepTimer = null;
let botPausedSignature = null;
let actionToastTimer = null;

const PHASE_STEPS = [
  { key: PHASES.UPDATE, label: 'Mise à jour' },
  { key: PHASES.DRAW, label: 'Pioche' },
  { key: PHASES.ACTION, label: 'Conception' }
];

const DEMO_SCENARIOS = [
  ['depth_choice', '1. Choix profondeur'],
  ['base_not_end', '2. Cas de base ≠ fin'],
  ['strategic_memory', '3. Choix mémoire'],
  ['repair_or_clean', '4. Nettoyer / réparer'],
  ['ram', '5. Barrette RAM'],
  ['stack_spike_break', '6. Stack Spike'],
  ['overflow_avoidable', '7. Overflow évitable'],
  ['profitable_reboot', '8. Reboot rentable'],
  ['opponent_interrupt', '9. Interrupt lisible'],
  ['deck_peek_order', '10. Lire une pioche'],
  ['recherche_pick', '11. Recherche choisie'],
  ['forced_reboot', '12. Reboot forcé']
];

const DEMO_GUIDES = {
  depth_choice: {
    title: 'Choix de profondeur',
    goal: 'Comparer une petite profondeur rapide avec une profondeur plus risquée mais mieux récompensée.',
    observe: 'Cyan a toute sa mémoire libre et plusieurs Fonctions en main. Le bonus B(R)=R² rend les grands R très attractifs.',
    action: 'Lance une Fonction et choisis volontairement une profondeur. Regarde le coût en temps et en mémoire.'
  },
  base_not_end: {
    title: 'Cas de base ≠ fin',
    goal: 'Montrer qu’atteindre [0] déclenche le cas de base, mais ne termine pas la fonction.',
    observe: 'Factorielle contient [2], [1], [0] et va commencer à dépiler.',
    action: 'Mets Factorielle à jour et observe que [0] disparaît, mais que la fonction reste active.'
  },
  strategic_memory: {
    title: 'Choix mémoire',
    goal: 'Trouver l’ordre de mise à jour qui évite toute casse malgré 0 mémoire libre.',
    observe: 'Compactage veut empiler [0], mais Factorielle peut d’abord dépiler [0] et libérer 1 mémoire.',
    action: 'Mets Factorielle à jour avant Compactage, puis compare avec l’ordre inverse.'
  },
  repair_or_clean: {
    title: 'Nettoyer ou réparer',
    goal: 'Comparer les réponses possibles à une fonction cassée qui occupe beaucoup de mémoire.',
    observe: 'Quicksort est cassée, ne progresse plus, mais réserve encore sa mémoire.',
    action: 'Essaie Hotfix, Collecte ou Débogueur et compare mémoire récupérée, tempo et potentiel de score.'
  },
  ram: {
    title: 'Barrette RAM',
    goal: 'Lire la différence entre mémoire libre, mémoire totale et mémoire utilisée.',
    observe: 'Cyan a peu de mémoire libre et deux fonctions actives. Barrette RAM coûte cher mais augmente la capacité.',
    action: 'Installe Barrette RAM et regarde les compteurs mémoire avant de finir le tour.'
  },
  stack_spike_break: {
    title: 'Stack Spike',
    goal: 'Voir pourquoi une pile à 5 cadres est vulnérable.',
    observe: 'Tri Fusion adverse a exactement 5 cadres. Stack Spike ajoute 2 parasites.',
    action: 'Joue Stack Spike sur Tri Fusion et observe la casse au moment où le 7e cadre serait créé.'
  },
  overflow_avoidable: {
    title: 'Overflow évitable',
    goal: 'Comprendre qu’un parasite retiré au bon moment peut empêcher une casse.',
    observe: 'Tri Fusion a 5 cadres dont un parasite. Sans action, Stack Spike est dangereux.',
    action: 'Joue Purge Contrôlée avant que l’adversaire puisse exploiter Stack Spike.'
  },
  profitable_reboot: {
    title: 'Reboot rentable',
    goal: 'Montrer qu’un reboot volontaire peut être un choix stratégique, pas seulement une punition.',
    observe: 'Cyan commence son tour avec peu de mémoire libre, une main faible et une fonction cassée encombrante.',
    action: 'Fais un reboot volontaire avant toute autre action et observe la mémoire et la nouvelle main.'
  },
  opponent_interrupt: {
    title: 'Interrupt lisible',
    goal: 'Apprendre à jouer une Interrupt pendant le tour adverse quand la condition est visible.',
    observe: 'C’est le tour d’Orange, mais Cyan a Stack Spike et Tri Fusion adverse a 5 cadres.',
    action: 'Joue Stack Spike depuis la main de Cyan pendant le tour adverse.'
  },
  deck_peek_order: {
    title: 'Lire une pioche',
    goal: 'Montrer qu’un effet de vision peut cibler une pioche précise, y compris adverse.',
    observe: 'Archiviste va dépiler [0]. Orange a une pioche Système préparée avec deux menaces visibles.',
    action: 'Mets Archiviste à jour, choisis la pioche Système d’Orange, puis décide si tu inverses les deux cartes.'
  },
  recherche_pick: {
    title: 'Recherche choisie',
    goal: 'Comprendre la différence entre regarder et révéler : ici une carte est choisie et les autres partent sous la pile.',
    observe: 'Recherche Dichotomique va révéler 3 cartes de l’une de tes pioches.',
    action: 'Mets Recherche à jour, choisis ta pioche Système, prends la carte la plus utile, puis observe l’ordre restant.'
  },
  forced_reboot: {
    title: 'Reboot forcé',
    goal: 'Illustrer la règle mémoire utilisée > mémoire totale après épuisement de pioche.',
    observe: 'Cyan utilise exactement toute sa mémoire totale et ses deux piles sont vides.',
    action: 'Clique sur Piocher Système : l’épuisement baisse la mémoire totale et force le reboot.'
  }
};

const ARCADE_SPRITES = {
  ship: [
    '00100',
    '01110',
    '11111',
    '10101'
  ],
  invader: [
    '10101',
    '01110',
    '11111',
    '10101',
    '01010'
  ],
  burst: [
    '10001',
    '01010',
    '00100',
    '01010',
    '10001'
  ],
  ram: [
    '11111',
    '10101',
    '11111',
    '10101'
  ],
  repair: [
    '00100',
    '01100',
    '11111',
    '00110',
    '00100'
  ]
};

export async function initUI() {
  showHomeScreen();
  apiAvailable = await detectApi();
  setApiAvailability(apiAvailable);
  if (app.classList.contains('home-screen')) showHomeScreen();
}

function createElement(tag, props = {}, children = []) {
  const element = document.createElement(tag);
  Object.entries(props).forEach(([key, value]) => {
    if (key === 'className') element.className = value;
    else if (key.startsWith('on') && typeof value === 'function') element.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'textContent') element.textContent = value;
    else if (key === 'disabled') element.disabled = Boolean(value);
    else if (value !== false && value !== null && value !== undefined) element.setAttribute(key, value === true ? '' : value);
  });
  children.flat().forEach((child) => { if (typeof child === 'string') element.append(child); else if (child) element.appendChild(child); });
  return element;
}

function remoteCodeFor(state = getState()) {
  return String(state?.remoteCode || '').trim().toUpperCase();
}

function isRemoteState(state = getState()) {
  return Boolean(state?.isRemote && remoteCodeFor(state));
}

function usesRemoteBoardLayout(state = getState()) {
  return Boolean(isRemoteState(state) || state?.soloMode);
}

function getRemoteSeat(state = getState()) {
  if (!isRemoteState(state)) return null;
  return loadRemoteSeat(remoteCodeFor(state));
}

function canControlPlayer(playerIndex) {
  const state = getState();
  if (state?.players?.[playerIndex]?.isBot) return false;
  if (!isRemoteState(state)) return true;
  return getRemoteSeat(state) === playerIndex;
}

function canViewPlayerHand(playerIndex) {
  return canControlPlayer(playerIndex);
}

function canControlCurrentTurn(state = getState()) {
  if (state?.players?.[state.currentPlayerIndex]?.isBot) return false;
  if (!isRemoteState(state)) return true;
  return getRemoteSeat(state) === state.currentPlayerIndex;
}

function remoteBottomPlayerIndex(state = getState()) {
  if (state?.soloMode) return state.players.find((player) => !player.isBot)?.index ?? 0;
  const seat = getRemoteSeat(state);
  return seat === null ? 0 : seat;
}

function remoteSeatText(state = getState()) {
  if (!isRemoteState(state)) return '';
  const seat = getRemoteSeat(state);
  if (seat === null) return 'Mode spectateur';
  const player = state.players[seat];
  return `Vous jouez : ${player?.name || `Joueur ${seat + 1}`}`;
}

function remoteTurnHint(state = getState()) {
  if (!isRemoteState(state)) {
    const active = state.players[state.currentPlayerIndex];
    return `Joueur actif : ${active.name}${active.isBot ? ' (ordinateur)' : ''}`;
  }
  const seat = getRemoteSeat(state);
  const active = state.players[state.currentPlayerIndex];
  if (seat === null) return `Spectateur : tour de ${active.name}`;
  if (seat === state.currentPlayerIndex) return `A vous de jouer : ${active.name}`;
  return `En attente de ${active.name}`;
}

function remoteSignature(state) {
  if (!state) return '';
  return JSON.stringify({
    turn: state.turn,
    currentPlayerIndex: state.currentPlayerIndex,
    phase: state.phase,
    winner: state.winner,
    logSequence: state.logSequence || 0,
    players: state.players.map((player) => ({
      score: player.score,
      memFree: player.memFree,
      memTotal: player.memTotal,
      tempMemory: player.tempMemory,
      rebootedThisTurn: player.rebootedThisTurn,
      completedThisTurn: player.completedThisTurn,
      updatedThisTurn: player.updatedThisTurn,
      active: player.active,
      hardware: player.hardware,
      hand: player.hand.map((card) => card.id),
      discard: player.discard.length,
      functionsDeck: player.functionsDeck.length,
      systemDeck: player.systemDeck.length
    }))
  });
}

function noteRemoteLocalAction(changed = true) {
  if (!changed) return;
  const state = getState();
  if (!isRemoteState(state)) return;
  remotePollPausedUntil = Date.now() + 2200;
  lastRemoteSignature = remoteSignature(state);
  lastSeenLogOrder = state.logSequence || lastSeenLogOrder;
}

function startRemotePollingIfNeeded() {
  stopRemotePolling();
  const state = getState();
  if (!isRemoteState(state)) return;
  lastRemoteSignature = remoteSignature(state);
  lastSeenLogOrder = Math.max(lastSeenLogOrder, state.logSequence || 0);
  remotePollTimer = window.setInterval(() => {
    pollRemoteGame();
  }, 2200);
  pollRemoteGame();
}

function stopRemotePolling() {
  if (remotePollTimer) window.clearInterval(remotePollTimer);
  remotePollTimer = null;
  remotePollInFlight = false;
}

async function pollRemoteGame() {
  const state = getState();
  const code = remoteCodeFor(state);
  if (!isRemoteState(state) || remotePollInFlight || Date.now() < remotePollPausedUntil) return;
  remotePollInFlight = true;
  try {
    const response = await loadRemoteGame(code);
    const current = getState();
    if (!response?.state || !isRemoteState(current) || remoteCodeFor(current) !== code) return;
    const incoming = response.state;
    const incomingSignature = remoteSignature(incoming);
    const currentSequence = current.logSequence || 0;
    const incomingSequence = incoming.logSequence || 0;
    if (incomingSignature === lastRemoteSignature || incomingSequence < currentSequence) return;
    const seat = getRemoteSeat(current);
    const alert = findIncomingInterruptAlert(current, incoming, seat);
    loadGame(incoming);
    setRemoteCode(code);
    if (seat !== null) saveRemoteSeat(code, seat);
    lastRemoteSignature = remoteSignature(getState());
    lastSeenLogOrder = Math.max(lastSeenLogOrder, incomingSequence);
    renderGameScreen();
    if (alert) showInterruptWarning(alert);
    else spawnArcadeEffect('draw', 'SYNC');
  } finally {
    remotePollInFlight = false;
  }
}

function findIncomingInterruptAlert(current, incoming, seat) {
  if (seat === null || !incoming?.log?.length) return null;
  const lastSeen = Math.max(lastSeenLogOrder, current?.logSequence || 0);
  const victim = incoming.players?.[seat];
  const attacker = incoming.players?.[1 - seat];
  if (!victim || !attacker) return null;
  const newEntries = incoming.log.filter((entry) => (entry.order || 0) > lastSeen);
  const playedEntry = newEntries.find((entry) => (
    entry.event === 'card_played'
    && entry.cardType === 'Interrupt'
    && entry.actorIndex !== seat
    && entry.targetPlayerIndex === seat
  ));
  if (!playedEntry) return null;
  const impactEntry = newEntries.find((entry) => (
    (entry.cls === 'bad' || entry.cls === 'warn')
    && ((entry.text || '').includes(victim.name) || (entry.order || 0) > (playedEntry.order || 0))
  ));
  return {
    title: 'Interrupt adverse !',
    text: impactEntry?.text || playedEntry.text,
    attacker: attacker.name
  };
}

function showHomeScreen() {
  stopRemotePolling();
  app.innerHTML = '';
  app.className = 'app home-screen';

  const header = createElement('div', { className: 'header home-header' }, [
    createElement('div', { className: 'brand-block' }, [
      createElement('span', { className: 'eyebrow', textContent: 'Initiation quadratique' }),
      createElement('h1', { textContent: 'Stack ou pas Stack — V2' }),
      createElement('p', { textContent: 'Nouvelle version web, maintenable et hébergeable sur serveur PHP/MySQL. Le jeu fonctionne aussi en hot-seat local si l’API n’est pas disponible.' })
    ]),
    createElement('div', { className: 'header-actions' }, [
      createElement('button', { onclick: () => importGameJson() }, ['Importer JSON']),
      createElement('a', { className: 'button-link', href: 'regles.html' }, ['Règles complètes'])
    ])
  ]);

  const startPanel = createElement('section', { className: 'panel panel-body start-panel' }, [
    createElement('span', { className: 'eyebrow', textContent: 'Partie locale' }),
    createElement('h2', { textContent: 'Lancer une table' }),
    createElement('p', { textContent: 'Deux joueurs, un même écran, une partie complète sans serveur.' }),
    createElement('div', { className: 'phase-actions' }, [
      createElement('button', { className: 'primary', onclick: () => promptNewGame() }, ['Nouvelle partie locale']),
      createElement('button', { onclick: () => startSoloLocalGame() }, ['Solo contre l’ordi']),
      createElement('button', { onclick: () => loadLocalGame() }, ['Charger sauvegarde'])
    ])
  ]);

  const serverActions = createElement('section', { className: `panel panel-body server-panel${apiAvailable ? ' online' : ' offline'}` }, [
    createElement('span', { className: 'eyebrow', textContent: apiAvailable ? 'API disponible' : 'API absente' }),
    createElement('h2', { textContent: 'Partie serveur (optionnel)' }),
    createElement('p', { textContent: apiAvailable ? 'API détectée. Créez ou rejoignez une partie distante.' : 'Aucune API détectée sur ce serveur.' }),
    createElement('div', { className: 'phase-actions' }, [
      createElement('button', { onclick: () => createServerGame(), disabled: !apiAvailable }, ['Créer une partie']),
      createElement('button', { onclick: () => joinServerGame(), disabled: !apiAvailable }, ['Rejoindre une partie'])
    ])
  ]);

  const demoPanel = createElement('section', { className: 'panel panel-body demo-panel' }, [
    createElement('span', { className: 'eyebrow', textContent: 'Situations préparées' }),
    createElement('h2', { textContent: 'Mode démonstration' }),
    createElement('p', { textContent: 'Charger une situation pédagogique préparée, avec mains cohérentes et journal d’actions.' }),
    createElement('div', { className: 'demo-grid' }, DEMO_SCENARIOS.map(([key, label]) => (
      createElement('button', { onclick: () => loadDemo(key) }, [label])
    )))
  ]);

  const helpPanel = createElement('section', { className: 'panel panel-body quick-rules' }, [
    createElement('span', { className: 'eyebrow', textContent: 'Rappel rapide' }),
    createElement('h2', { textContent: 'Rappel rapide' }),
    createElement('p', { textContent: 'Ordre de tour : mise à jour → pioche → conception → fin de tour. Les fonctions actives non cassées doivent être mises à jour pendant la phase de mise à jour.' }),
    createElement('ul', {}, [
      createElement('li', { textContent: 'La phase de pioche tire uniquement une carte Système ; une Fonction est piochée automatiquement quand une fonction se termine, ou pendant un reboot.' }),
      createElement('li', { textContent: 'Les Interrupts se jouent aussi pendant le tour adverse, dès qu’une cible légale existe.' }),
      createElement('li', { textContent: 'Les cadres parasites comptent dans la pile et n’offrent aucun effet.' }),
      createElement('li', { textContent: 'Une fonction casse si elle doit recevoir un 7e cadre.' }),
      createElement('li', { textContent: 'Si un joueur doit piocher avec ses deux piles vides, il perd 1 mémoire totale au lieu de piocher.' }),
      createElement('li', { textContent: 'Les Commandes/Interrupts sont payées et libèrent leur mémoire après résolution.' }),
      createElement('li', { textContent: 'Le reboot volontaire se fait au début du tour, avant toute mise à jour, pioche ou carte jouée.' })
    ])
  ]);

  app.append(header, createElement('div', { className: 'home-grid' }, [
    startPanel,
    serverActions,
    demoPanel,
    helpPanel
  ]));
}

function promptNewGame() {
  stopRemotePolling();
  const name1 = prompt('Nom du joueur 1 ?', 'Joueur Cyan')?.trim() || 'Joueur Cyan';
  const name2 = prompt('Nom du joueur 2 ?', 'Joueur Orange')?.trim() || 'Joueur Orange';
  resetCounterAnimations();
  newGame(name1, name2);
  renderGameScreen();
}

async function startSoloLocalGame() {
  stopRemotePolling();
  const name = prompt('Nom du joueur humain ?', 'Joueur Cyan')?.trim() || 'Joueur Cyan';
  const botProfile = await askForBotProfile();
  resetCounterAnimations();
  startSoloGame(name, 'Ordinateur', { botProfile });
  renderGameScreen();
}

function loadLocalGame() {
  const saved = loadLocalState();
  if (!saved) {
    alert('Aucune sauvegarde locale trouvée.');
    return;
  }
  resetCounterAnimations();
  loadGame(saved);
  renderGameScreen();
  startRemotePollingIfNeeded();
}

function exportGameJson() {
  exportGame();
  alert('L’état de jeu est copié dans le presse-papiers si le navigateur le permet.');
}

function importGameJson() {
  const json = prompt('Collez le JSON de la partie :');
  if (!json) return;
  const success = importGame(json);
  if (success) {
    resetCounterAnimations();
    renderGameScreen();
    startRemotePollingIfNeeded();
  } else {
    alert('JSON invalide ou partie incompatible.');
  }
}

async function createServerGame() {
  const name1 = prompt('Nom du joueur 1 ?', 'Joueur Cyan')?.trim() || 'Joueur Cyan';
  const name2 = prompt('Nom du joueur 2 ?', 'Joueur Orange')?.trim() || 'Joueur Orange';
  const state = newGame(name1, name2);
  const response = await createRemoteGame(state);
  if (response?.code) {
    resetCounterAnimations();
    setRemoteCode(response.code);
    saveRemoteSeat(response.code, 0);
    persistGameState();
    alert(`Partie créée. Code : ${response.code}`);
    renderGameScreen();
    startRemotePollingIfNeeded();
  } else {
    alert('Échec de la création de la partie serveur.');
  }
}

async function joinServerGame() {
  const code = (prompt('Code de partie :') || '').trim().toUpperCase();
  if (!code) return;
  const response = await joinRemoteGame(code);
  if (response?.state) {
    resetCounterAnimations();
    loadGame(response.state);
    setRemoteCode(code);
    saveRemoteSeat(code, 1);
    persistGameState();
    renderGameScreen();
    startRemotePollingIfNeeded();
  } else {
    alert('Impossible de charger la partie.');
  }
}

function loadDemo(name) {
  stopRemotePolling();
  resetCounterAnimations();
  loadDemoScenario(name);
  renderGameScreen();
  spawnArcadeEffect('deploy', 'DEMO');
  showDemoGuide(name);
}

function showDemoGuide(name) {
  const guide = DEMO_GUIDES[name];
  if (!guide) return;
  const content = createElement('div', { className: 'demo-guide' }, [
    createElement('section', {}, [
      createElement('span', { className: 'eyebrow', textContent: 'Objectif' }),
      createElement('p', { textContent: guide.goal })
    ]),
    createElement('section', {}, [
      createElement('span', { className: 'eyebrow', textContent: 'À observer' }),
      createElement('p', { textContent: guide.observe })
    ]),
    createElement('section', {}, [
      createElement('span', { className: 'eyebrow', textContent: 'Premier geste' }),
      createElement('p', { textContent: guide.action })
    ])
  ]);
  showModal(`Démonstration — ${guide.title}`, content, [
    { label: 'Commencer', onClick: () => {} }
  ]);
}

function undoAction() {
  if (!undoLastAction()) return;
  renderGameScreen();
  spawnArcadeEffect('reboot', 'UNDO');
}

function renderGameScreen() {
  const state = getState();
  if (!state) return;
  prepareCounterDeltas(state);
  if (isRemoteState(state)) lastRemoteSignature = remoteSignature(state);
  const remoteMode = isRemoteState(state);
  const remoteBoardLayout = usesRemoteBoardLayout(state);
  app.innerHTML = '';
  app.className = `app game-screen phase-${phaseClass(state.phase)}${remoteBoardLayout ? ' remote-game' : ''}`;
  const currentPlayer = state.players[state.currentPlayerIndex];
  const remoteInfo = remoteSeatText(state);
  const headerStatus = state.winner !== null
    ? 'Partie terminée'
    : `Joueur actif : ${currentPlayer.name}${currentPlayer.isBot ? ' (ordinateur)' : ''}${remoteInfo ? ` - ${remoteInfo}` : ''}`;
  const botStatus = state.soloMode ? renderBotStatus(state) : null;
  const headerActions = remoteMode
    ? [
      createElement('button', { onclick: () => showHomeScreen() }, ['Accueil']),
      createElement('button', { onclick: () => pollRemoteGame(), disabled: remotePollInFlight }, ['Synchroniser']),
      createElement('a', { className: 'button-link', href: 'regles.html' }, ['Règles'])
    ]
    : [
      createElement('button', { onclick: () => showHomeScreen() }, ['Retour accueil']),
      createElement('button', { className: 'undo-button', onclick: () => undoAction(), disabled: !canUndo() }, ['Undo']),
      createElement('button', { onclick: () => saveGame() }, ['Sauvegarder local']),
      createElement('button', { onclick: () => exportGameJson() }, ['Exporter JSON']),
      createElement('button', { onclick: () => importGameJson() }, ['Importer JSON']),
      createElement('a', { className: 'button-link', href: 'regles.html' }, ['Règles complètes'])
    ];
  const header = createElement('div', { className: 'header game-header' }, [
    createElement('div', { className: 'brand-block' }, [
      createElement('span', { className: 'eyebrow', textContent: `Tour ${state.turn}` }),
      createElement('h1', { textContent: 'Stack ou pas Stack — V2' }),
      createElement('p', { textContent: headerStatus }),
      botStatus,
      renderPhaseRail(state)
    ]),
    createElement('div', { className: 'header-actions' }, headerActions)
  ]);

  const board = remoteBoardLayout
    ? renderRemoteBoard(state)
    : createElement('div', { className: 'grid-3 game-board' }, [
      renderPlayerPanel(state.players[0]),
      renderCenterPanel(state),
      renderPlayerPanel(state.players[1])
    ]);

  app.append(header, board);
  if (!remoteBoardLayout) app.append(renderHelpPanel());
  lastCounterSnapshot = buildCounterSnapshot(state);
  counterDeltas = new Map();
  maybeOpenPendingHandLimitDiscard();
  maybeOpenPendingDeckEffect();
  scheduleBotTurn();
}

function scheduleBotTurn() {
  const state = getState();
  if (!state?.soloMode || state.winner !== null || isRemoteState(state)) return;
  const current = state.players[state.currentPlayerIndex];
  if (!current?.isBot || botThinking) return;
  if (botPausedSignature === botProgressSignature(state)) return;
  if (isHumanModalOpen()) return;
  const handLimit = getPendingHandLimitDiscard();
  if (handLimit && handLimit.playerIndex !== current.index) return;
  const effect = getPendingDeckEffect();
  if (effect && effect.ownerIndex !== current.index) return;
  botThinking = true;
  botStepCount = 0;
  renderGameScreen();
  queueBotStep(current.index);
}

function queueBotStep(botIndex) {
  if (botStepTimer) window.clearTimeout(botStepTimer);
  botStepTimer = window.setTimeout(() => {
    let queuedNextStep = false;
    try {
      const state = getState();
      if (!state?.soloMode || state.winner !== null || state.currentPlayerIndex !== botIndex || isRemoteState(state)) {
        botThinking = false;
        renderGameScreen();
        return;
      }
      if (isHumanModalOpen()) {
        botThinking = false;
        return;
      }
      const handLimit = getPendingHandLimitDiscard();
      if (handLimit && handLimit.playerIndex !== botIndex) {
        botThinking = false;
        renderGameScreen();
        return;
      }
      const effect = getPendingDeckEffect();
      if (effect && effect.ownerIndex !== botIndex) {
        botThinking = false;
        renderGameScreen();
        return;
      }
      botStepCount += 1;
      const beforeSequence = state.logSequence || 0;
      const changed = runBotStep(botIndex);
      if (!changed) botPausedSignature = botProgressSignature(getState());
      else botPausedSignature = null;
      if (changed) showActionToast(actionLabelFromLogs(beforeSequence, 'Ordinateur agit.'), { actor: 'bot' });
      renderGameScreen();
      const next = getState();
      if (next?.winner === null && next.currentPlayerIndex === botIndex && botStepCount < 80) {
        queuedNextStep = true;
        queueBotStep(botIndex);
        return;
      }
      if (next?.winner === null && next.currentPlayerIndex === botIndex && botStepCount >= 80) {
        botPausedSignature = botProgressSignature(next);
      }
    } finally {
      if (!queuedNextStep) {
        botThinking = false;
        renderGameScreen();
      }
    }
  }, getBotStepDelay());
}

function triggerBotReaction() {
  const state = getState();
  if (!state?.soloMode || botThinking || isRemoteState(state)) return false;
  if (isHumanModalOpen()) return false;
  if (getPendingHandLimitDiscard()) return false;
  const beforeSequence = state.logSequence || 0;
  const changed = maybeReactToHumanAction(state.botIndex);
  if (changed) {
    renderGameScreen();
    showActionToast(actionLabelFromLogs(beforeSequence, 'Ordinateur joue une interruption.'), { actor: 'bot', tone: 'bad' });
    spawnArcadeEffect('hit', 'INT');
  }
  return changed;
}

function renderBotStatus(state) {
  const label = getBotProfileLabel(state.botProfile);
  const thinking = botThinking && state.players[state.currentPlayerIndex]?.isBot;
  return createElement('div', { className: `bot-status${thinking ? ' thinking' : ''}`, role: 'status' }, [
    createElement('span', { textContent: `Bot : ${label}` }),
    thinking ? createElement('strong', { textContent: 'L’ordinateur réfléchit...' }) : null
  ]);
}

function isHumanModalOpen() {
  return modal && !modal.classList.contains('hidden');
}

function normalizeBotProfileInput(value) {
  const normalized = String(value || 'equilibre')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (normalized === 'pedagogique') return 'pedagogique';
  if (normalized === 'agressif') return 'agressif';
  return 'equilibre';
}

function askForBotProfile() {
  return new Promise((resolve) => {
    const profiles = [
      ['pedagogique', 'Pédagogique', 'Prudent, lisible, interruptions rares.'],
      ['equilibre', 'Équilibré', 'Standard, légal et raisonnable.'],
      ['agressif', 'Agressif', 'Plus de pression et d’interruptions.']
    ];
    const name = `bot-profile-${Date.now()}`;
    const content = createElement('div', { className: 'bot-profile-choice' }, profiles.map(([value, label, help]) => (
      createElement('label', { className: 'radio-option' }, [
        createElement('input', {
          type: 'radio',
          name,
          value,
          checked: value === 'equilibre'
        }),
        createElement('span', {}, [
          createElement('strong', { textContent: label }),
          createElement('small', { textContent: help })
        ])
      ])
    )));
    showModal('Niveau du bot', content, [
      {
        label: 'Commencer',
        onClick: () => {
          const selected = modal.querySelector(`input[name="${name}"]:checked`)?.value;
          resolve(normalizeBotProfileInput(selected));
        }
      },
      {
        label: 'Annuler',
        onClick: () => resolve('equilibre')
      }
    ]);
  });
}

function getBotStepDelay() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ? Math.max(700, BOT_STEP_DELAY_MS - 100)
    : BOT_STEP_DELAY_MS;
}

function botProgressSignature(state) {
  if (!state) return '';
  return JSON.stringify({
    turn: state.turn,
    currentPlayerIndex: state.currentPlayerIndex,
    phase: state.phase,
    logSequence: state.logSequence || 0,
    pendingDeckEffectId: state.pendingDeckEffect?.id || null,
    pendingHandLimitDiscard: state.pendingHandLimitDiscard ? `${state.pendingHandLimitDiscard.playerIndex}:${state.pendingHandLimitDiscard.discardCount}` : null
  });
}

function showActionToast(label, options = {}) {
  const text = String(label || '').trim();
  if (!text) return;
  let toast = document.getElementById('action-toast');
  if (!toast) {
    toast = createElement('div', { id: 'action-toast', className: 'action-toast', role: 'status', 'aria-live': 'polite' });
    document.body.appendChild(toast);
  }
  const actor = options.actor === 'bot' ? 'bot' : 'human';
  const tone = ['good', 'warn', 'bad'].includes(options.tone) ? ` ${options.tone}` : '';
  toast.className = `action-toast ${actor}${tone} visible`;
  toast.textContent = text;
  if (actionToastTimer) window.clearTimeout(actionToastTimer);
  actionToastTimer = window.setTimeout(() => {
    toast.classList.remove('visible');
  }, ACTION_TOAST_MS);
}

function actionLabelFromLogs(beforeSequence, fallback = 'Action enregistrée.') {
  const state = getState();
  const entries = (state?.log || []).filter((entry) => (entry.order || 0) > beforeSequence);
  const explained = [...entries].reverse().find((entry) => /^Ordinateur /.test(entry.text || ''));
  if (explained) return explained.text;
  const played = [...entries].reverse().find((entry) => entry.event === 'card_played');
  if (played) return played.text.replace(' : début de résolution.', '.');
  const meaningful = [...entries].reverse().find((entry) => entry.cls !== 'sys') || entries[entries.length - 1];
  return meaningful?.text || fallback;
}

function renderRemoteBoard(state) {
  const bottomIndex = remoteBottomPlayerIndex(state);
  const topIndex = 1 - bottomIndex;
  return createElement('div', { className: 'hearthstone-board game-board' }, [
    renderRemoteOpponentSummary(state.players[topIndex]),
    renderCenterPanel(state),
    renderRemoteLocalConsole(state.players[bottomIndex])
  ]);
}

function renderRemoteOpponentSummary(player) {
  const brokenCount = player.active.filter((fn) => fn.broken).length;
  const tone = player.index === 0 ? 'cyan' : 'orange';
  return createElement('section', { className: `panel remote-opponent-summary player-${tone}` }, [
    createElement('div', { className: 'panel-body' }, [
      createElement('div', { className: 'remote-identity' }, [
        createElement('div', { className: 'player-name' }, [
          createElement('span', { className: 'eyebrow', textContent: 'Adversaire' }),
          createElement('h2', { className: 'player-title', textContent: player.name })
        ]),
        scorePill(player)
      ]),
      createElement('div', { className: 'remote-public-counters' }, [
        stat('ML', player.memFree, counterKey(player, 'memFree')),
        stat('MT', player.memTotal, counterKey(player, 'memTotal')),
        stat('Main', player.hand.length, counterKey(player, 'hand')),
        stat('Cassées', brokenCount, counterKey(player, 'broken'))
      ]),
      createElement('div', { className: 'remote-public-zone' }, [
        createElement('div', { className: 'remote-zone-head' }, [
          createElement('strong', { textContent: 'Fonctions visibles' }),
          createElement('span', { className: 'chip', textContent: `${player.functionsDeck.length} F · ${player.systemDeck.length} S · def. ${player.discard.length}` })
        ]),
        createElement('div', { className: 'remote-function-row' }, player.active.length
          ? player.active.map((fn) => renderRemoteFunctionCard(player, fn, { actions: false }))
          : [emptyState('Aucune fonction')])
      ]),
      createElement('div', { className: 'remote-hardware-row' }, player.hardware.length
        ? player.hardware.map((hw) => renderHardwareChip(hw))
        : [createElement('span', { className: 'chip', textContent: 'Aucun hardware' })])
    ])
  ]);
}

function renderRemoteLocalConsole(player) {
  const state = getState();
  const brokenCount = player.active.filter((fn) => fn.broken).length;
  const seat = getRemoteSeat(state);
  const label = state?.soloMode ? 'Votre camp' : seat === null ? 'Spectateur' : 'Votre camp';
  const tone = player.index === 0 ? 'cyan' : 'orange';
  return createElement('section', { className: `panel remote-local-console player-${tone}` }, [
    createElement('div', { className: 'panel-body' }, [
      createElement('div', { className: 'remote-local-status' }, [
        createElement('div', { className: 'remote-identity' }, [
          createElement('div', { className: 'player-name' }, [
            createElement('span', { className: 'eyebrow', textContent: label }),
          createElement('h2', { className: 'player-title', textContent: player.name })
        ]),
          scorePill(player)
        ]),
        createElement('div', { className: 'remote-public-counters' }, [
          stat('ML', player.memFree, counterKey(player, 'memFree')),
          stat('MT', player.memTotal, counterKey(player, 'memTotal')),
          stat('Utilisée', getPlayerUsedMemory(player), counterKey(player, 'used')),
          stat('Main', player.hand.length, counterKey(player, 'hand')),
          stat('Cassées', brokenCount, counterKey(player, 'broken'))
        ]),
        createElement('div', { className: 'remote-hardware-row' }, player.hardware.length
          ? player.hardware.map((hw) => renderHardwareChip(hw))
          : [createElement('span', { className: 'chip', textContent: 'Aucun hardware' })])
      ]),
      createElement('div', { className: 'remote-local-functions' }, [
        createElement('div', { className: 'remote-zone-head' }, [
          createElement('strong', { textContent: 'Fonctions actives' }),
          createElement('span', { className: 'chip', textContent: `${player.functionsDeck.length} F · ${player.systemDeck.length} S · def. ${player.discard.length}` })
        ]),
        createElement('div', { className: 'remote-function-row' }, player.active.length
          ? player.active.map((fn) => renderRemoteFunctionCard(player, fn, { actions: true }))
          : [emptyState('Aucune fonction')])
      ]),
      createElement('div', { className: 'remote-hand-dock' }, [
        createElement('div', { className: 'remote-zone-head' }, [
          createElement('strong', { textContent: 'Main' }),
          createElement('span', { className: 'chip', textContent: `${player.hand.length} carte(s)` })
        ]),
        renderRemoteDeckShelf(player),
        createElement('div', { className: 'hand-cards remote-hand-cards', style: `--cards:${Math.max(1, player.hand.length)}` }, player.hand.length
          ? player.hand.map((card, index) => renderCard(player, card, index, { compact: true, previewOnClick: true }))
          : [emptyState('Main vide')])
      ])
    ])
  ]);
}

function renderRemoteDeckShelf(player) {
  const topDiscard = player.discard[player.discard.length - 1];
  return createElement('div', { className: 'remote-card-shelf' }, [
    renderRemotePileCard('Fonctions', player.functionsDeck.length, 'function'),
    renderRemotePileCard('Système', player.systemDeck.length, 'system'),
    topDiscard
      ? renderRemoteDiscardCard(topDiscard, player.discard.length)
      : createElement('div', { className: 'remote-table-card discard empty-discard' }, [
        createElement('span', { className: 'remote-table-card-label', textContent: 'Défausse' }),
        createElement('strong', { textContent: 'Vide' }),
        createElement('span', { className: 'remote-table-card-count', textContent: '0' })
      ])
  ]);
}

function renderRemotePileCard(label, count, tone) {
  return createElement('div', { className: `remote-table-card deck-back ${tone}` }, [
    createElement('span', { className: 'remote-table-card-label', textContent: label }),
    createElement('strong', { textContent: count }),
    createElement('span', { className: 'remote-table-card-count', textContent: 'pioche' })
  ]);
}

function renderRemoteDiscardCard(card, count) {
  return createElement('div', { className: `remote-table-card discard ${cardTypeClass(card.type)}` }, [
    createElement('span', { className: 'remote-table-card-label', textContent: 'Défausse' }),
    createElement('strong', { textContent: card.name }),
    createElement('span', { className: 'remote-table-card-count', textContent: `${count} carte(s)` })
  ]);
}

function renderRemoteFunctionCard(player, fn, options = {}) {
  const state = getState();
  const canAct = Boolean(options.actions) && canControlPlayer(player.index);
  const alreadyUpdated = player.updatedThisTurn.includes(fn.id);
  const canUpdate = canAct && state.currentPlayerIndex === player.index && state.phase === PHASES.UPDATE && !fn.broken && !alreadyUpdated;
  const modeClass = fn.broken ? 'broken' : fn.reachedZero ? 'unwinding' : 'stacking';
  const nextEffect = getNextFunctionEffect(fn);
  return createElement('div', {
    className: `remote-function-card previewable-function ${modeClass}${canUpdate ? ' actionable' : ''}`,
    onclick: () => showFunctionPreview(player, fn, options)
  }, [
    createElement('div', { className: 'remote-function-title' }, [
      createElement('strong', { textContent: fn.name }),
      createElement('span', { className: 'chip', textContent: fn.broken ? 'Cassée' : fn.reachedZero ? 'Dépilage' : 'Empilage' })
    ]),
    createElement('div', { className: 'function-meta', textContent: `R=${fn.R} · cadres ${fn.frames.length} · mem ${fn.memUsed}` }),
    createElement('div', { className: 'frame-row compact-frames' }, fn.frames.map((frame, index) => createElement('span', {
      className: `frame${frame === 'P' ? ' parasite' : ''}`,
      style: `--i:${index}`,
      textContent: frame
    }))),
    createElement('div', { className: 'next-effect compact-next' }, [
      createElement('span', { textContent: nextEffect.label }),
      createElement('strong', { textContent: nextEffect.text })
    ]),
    options.actions ? createElement('div', { className: 'card-actions compact-actions' }, [
      createElement('button', {
        className: 'good',
        onclick: (event) => {
          event.stopPropagation();
          applyUpdate(fn.id);
        },
        disabled: !canUpdate
      }, ['Update']),
      createElement('button', {
        onclick: (event) => {
          event.stopPropagation();
          applyOverclock(fn.id);
        },
        disabled: !canAct || !canUseOverclock(fn.id)
      }, ['2X'])
    ]) : null
  ]);
}

function renderPlayerPanel(player, options = {}) {
  const state = getState();
  const isActive = state.currentPlayerIndex === player.index && state.phase !== PHASES.GAME_OVER;
  const brokenCount = player.active.filter((fn) => fn.broken).length;
  const tone = player.index === 0 ? 'cyan' : 'orange';
  const canSeeHand = canViewPlayerHand(player.index);
  const roleClass = options.arenaRole ? ` remote-player remote-player-${options.arenaRole}` : '';
  const isSpectatorBottom = options.arenaRole === 'local' && isRemoteState(state) && getRemoteSeat(state) === null;
  const seatChip = isSpectatorBottom
    ? 'Spectateur'
    : options.arenaRole === 'local'
    ? 'Votre camp'
    : options.arenaRole === 'opponent'
      ? 'Adversaire'
      : player.index === 0 ? 'Joueur Cyan' : 'Joueur Orange';
  const panel = createElement('section', { className: `panel player-panel player-${tone}${roleClass}${isActive ? ' active' : ''}` }, [
    createElement('div', { className: 'panel-body' }, [
      createElement('div', { className: 'player-header' }, [
        createElement('div', { className: 'player-name' }, [
          createElement('h2', { className: 'player-title', textContent: player.name }),
          createElement('div', { className: 'chip', textContent: seatChip })
        ]),
        scorePill(player)
      ]),
      memoryMeter(player),
      createElement('div', { className: 'stats' }, [
        stat('Libre', player.memFree, counterKey(player, 'memFree')),
        stat('Totale', player.memTotal, counterKey(player, 'memTotal')),
        stat('Utilisée', getPlayerUsedMemory(player), counterKey(player, 'used')),
        stat('Main', player.hand.length, counterKey(player, 'hand')),
        stat('Cassées', brokenCount, counterKey(player, 'broken'))
      ]),
      createElement('section', { className: 'play-area' }, [
        createElement('h3', { className: 'area-title', textContent: 'Piles' }),
        createElement('div', { className: 'pile-list' }, [
          pileInfo('Fonctions', player.functionsDeck.length),
          pileInfo('Système', player.systemDeck.length),
          createElement('div', { className: 'chip', textContent: `Défausse ${player.discard.length}` })
        ]),
        createElement('div', { className: 'phase-actions' }, [
          createElement('button', {
            onclick: () => { drawPileButton(player.index, 'system'); },
            disabled: !(state.phase === PHASES.DRAW && state.currentPlayerIndex === player.index && state.winner === null && canControlPlayer(player.index))
          }, ['Piocher Système'])
        ])
      ]),
      createElement('section', { className: 'play-area' }, [
        createElement('h3', { className: 'area-title', textContent: 'Fonctions actives' }),
        createElement('div', { className: 'function-list' }, player.active.length
          ? player.active.map((fn) => renderFunctionCard(player, fn))
          : [emptyState('Aucune fonction active')])
      ]),
      createElement('section', { className: 'play-area compact-area' }, [
        createElement('h3', { className: 'area-title', textContent: 'Hardware' }),
        createElement('div', { className: 'chips' }, player.hardware.length
          ? player.hardware.map((hw) => renderHardwareChip(hw))
          : [emptyState('Aucun hardware')])
      ]),
      createElement('section', { className: 'play-area' }, [
        createElement('h3', { className: 'area-title', textContent: canSeeHand ? 'Main' : 'Main adverse' }),
        createElement('div', { className: 'hand-cards' }, player.hand.length
          ? canSeeHand
            ? player.hand.map((card, index) => renderCard(player, card, index))
            : renderHiddenHand(player)
          : [emptyState('Main vide')])
      ])
    ])
  ]);
  return panel;
}

function scorePill(player) {
  const delta = counterDeltas.get(counterKey(player, 'score')) || 0;
  return createElement('div', { className: 'score-pill counter-pop-host' }, [
    `${player.score} pts`,
    renderCounterDelta(delta)
  ]);
}

function stat(label, value, key = null) {
  const delta = key ? counterDeltas.get(key) || 0 : 0;
  return createElement('div', { className: 'stat compact-stat' }, [
    createElement('span', { className: 'label', textContent: label }),
    createElement('span', { className: 'value', textContent: value }),
    renderCounterDelta(delta)
  ]);
}

function renderCounterDelta(delta) {
  if (!delta) return null;
  const sign = delta > 0 ? '+' : '';
  return createElement('span', {
    className: `counter-delta ${delta > 0 ? 'positive' : 'negative'}`,
    textContent: `${sign}${delta}`
  });
}

function counterKey(player, metric) {
  return `p${player.index}:${metric}`;
}

function buildCounterSnapshot(state) {
  const snapshot = new Map();
  state.players.forEach((player) => {
    snapshot.set(counterKey(player, 'score'), player.score);
    snapshot.set(counterKey(player, 'memFree'), player.memFree);
    snapshot.set(counterKey(player, 'memTotal'), player.memTotal);
    snapshot.set(counterKey(player, 'used'), getPlayerUsedMemory(player));
    snapshot.set(counterKey(player, 'hand'), player.hand.length);
    snapshot.set(counterKey(player, 'broken'), player.active.filter((fn) => fn.broken).length);
  });
  return snapshot;
}

function prepareCounterDeltas(state) {
  const next = buildCounterSnapshot(state);
  counterDeltas = new Map();
  if (!lastCounterSnapshot) return;
  next.forEach((value, key) => {
    const previous = lastCounterSnapshot.get(key);
    if (typeof previous === 'number' && value !== previous) {
      counterDeltas.set(key, value - previous);
    }
  });
}

function resetCounterAnimations() {
  lastCounterSnapshot = null;
  counterDeltas = new Map();
}

function memoryMeter(player) {
  const used = Math.max(0, player.memTotal - player.memFree);
  const ratio = player.memTotal > 0 ? Math.min(100, Math.max(0, Math.round((used / player.memTotal) * 100))) : 0;
  return createElement('div', { className: 'memory-meter', style: `--mem:${ratio}%` }, [
    createElement('div', { className: 'memory-meter-head' }, [
      createElement('span', { textContent: 'Occupation mémoire' }),
      createElement('strong', { textContent: `${used}/${player.memTotal}` })
    ]),
    createElement('div', { className: 'memory-track' }, [
      createElement('span', { className: 'memory-fill' })
    ])
  ]);
}

function pileInfo(title, count) {
  return createElement('div', { className: 'chip', textContent: `${title} : ${count}` });
}

function renderFunctionCard(player, fn) {
  const state = getState();
  const alreadyUpdated = player.updatedThisTurn.includes(fn.id);
  const isCurrent = canControlPlayer(player.index) && state.currentPlayerIndex === player.index && state.phase === PHASES.UPDATE && !fn.broken && !alreadyUpdated;
  const modeClass = fn.broken ? 'broken' : fn.reachedZero ? 'unwinding' : 'stacking';
  const nextEffect = getNextFunctionEffect(fn);
  const effects = getFunctionEffectSummary(fn);
  return createElement('div', { className: `function-item ${modeClass}${isCurrent ? ' actionable' : ''}` }, [
    createElement('div', { className: 'function-title' }, [
      createElement('h3', { textContent: fn.name }),
      createElement('span', { className: 'chip', textContent: fn.broken ? 'Cassée' : fn.reachedZero ? 'Dépilage' : 'Empilage' })
    ]),
    createElement('div', { className: 'function-meta', textContent: `R=${fn.R} — cadres ${fn.frames.length} — mémoire ${fn.memUsed}` }),
    createElement('div', { className: 'frame-row' }, fn.frames.map((frame, index) => createElement('span', {
      className: `frame${frame === 'P' ? ' parasite' : ''}`,
      style: `--i:${index}`,
      textContent: frame
    }))),
    createElement('div', { className: 'function-effects' }, [
      createElement('div', { className: 'next-effect' }, [
        createElement('span', { textContent: nextEffect.label }),
        createElement('strong', { textContent: nextEffect.text })
      ]),
      createElement('div', { className: 'effect-list' }, [
        effectLine('Cas de base', effects.base),
        effectLine('Remontée', effects.up),
        effectLine('Terminaison', effects.terminal)
      ])
    ]),
    createElement('div', { className: 'card-actions' }, [
      createElement('button', { className: 'good', onclick: () => applyUpdate(fn.id), disabled: !isCurrent }, ['Mettre à jour']),
      createElement('button', { onclick: () => applyOverclock(fn.id), disabled: !canControlPlayer(player.index) || !canUseOverclock(fn.id) }, ['Overclock'])
    ])
  ]);
}

function renderCard(player, card, index = 0, options = {}) {
  const state = getState();
  const enabled = canUseCardFromHand(player, card);
  const typeClass = cardTypeClass(card.type);
  const actionLabel = card.type === 'Interrupt' && state.currentPlayerIndex !== player.index ? 'Interrompre' : 'Jouer';
  const compactClass = options.compact ? ' compact-card' : '';
  const previewClass = options.previewOnClick ? ' previewable-card' : '';
  const children = [
    createElement('div', { className: 'card-top' }, [
      createElement('span', { className: `type-badge ${typeClass}`, textContent: card.type }),
      createElement('span', { className: 'cost-badge', textContent: `Coût ${card.cost}` })
    ]),
    createElement('h3', { className: 'title', textContent: card.name }),
    card.type === 'Fonction'
      ? createElement('div', { className: 'card-rule', textContent: `${card.mode === 'fixe' ? 'Empiler' : 'Empiler jusqu’à'} ${card.maxR} — valeur ${card.value}` })
      : null,
    createElement('div', { className: 'desc', textContent: card.description }),
    createElement('div', { className: 'card-actions' }, [
      createElement('button', {
        onclick: (event) => {
          event.stopPropagation();
          playCardAction(player.index, card.id);
        },
        disabled: !enabled
      }, [actionLabel])
    ])
  ];
  return createElement('article', {
    className: `card ${typeClass}${compactClass}${previewClass}`,
    style: `--i:${index}`,
    onclick: options.previewOnClick ? () => showCardPreview(player, card) : null
  }, children);
}

function showCardPreview(player, card) {
  const enabled = canUseCardFromHand(player, card);
  const typeClass = cardTypeClass(card.type);
  const actionLabel = card.type === 'Interrupt' && getState().currentPlayerIndex !== player.index ? 'Interrompre' : 'Jouer';
  const content = createElement('div', { className: 'card-preview-content' }, [
    createElement('article', { className: `card ${typeClass} preview-card` }, [
      createElement('div', { className: 'card-top' }, [
        createElement('span', { className: `type-badge ${typeClass}`, textContent: card.type }),
        createElement('span', { className: 'cost-badge', textContent: `Coût ${card.cost}` })
      ]),
      createElement('h3', { className: 'title', textContent: card.name }),
      card.type === 'Fonction'
        ? createElement('div', { className: 'card-rule', textContent: `${card.mode === 'fixe' ? 'Empiler' : 'Empiler jusqu’à'} ${card.maxR} · valeur ${card.value}` })
        : null,
      createElement('div', { className: 'desc', textContent: card.description })
    ]),
    createElement('div', { className: 'phase-actions preview-actions' }, [
      createElement('button', {
        className: 'primary',
        onclick: () => {
          hideModal();
          playCardAction(player.index, card.id);
        },
        disabled: !enabled
      }, [actionLabel]),
      createElement('button', { onclick: () => hideModal() }, ['Fermer'])
    ])
  ]);
  showModal(card.name, content, []);
}

function renderHardwareChip(hardware) {
  return createElement('button', {
    className: 'chip hardware-chip hardware-chip-button',
    onclick: (event) => {
      event.stopPropagation();
      showHardwarePreview(hardware);
    },
    title: `Voir ${hardware.name}`
  }, [hardware.name]);
}

function showHardwarePreview(hardware) {
  const content = createElement('div', { className: 'card-preview-content' }, [
    createElement('article', { className: 'card hardware preview-card' }, [
      createElement('div', { className: 'card-top' }, [
        createElement('span', { className: 'type-badge hardware', textContent: hardware.type || 'Hardware' }),
        createElement('span', { className: 'cost-badge', textContent: `Coût ${hardware.cost ?? '-'}` })
      ]),
      createElement('h3', { className: 'title', textContent: hardware.name }),
      createElement('div', { className: 'desc', textContent: hardware.description || 'Hardware actif.' })
    ]),
    createElement('div', { className: 'phase-actions preview-actions' }, [
      createElement('button', { onclick: () => hideModal() }, ['Fermer'])
    ])
  ]);
  showModal(hardware.name, content, []);
}

function showFunctionPreview(player, fn, options = {}) {
  const state = getState();
  const canAct = Boolean(options.actions) && canControlPlayer(player.index);
  const alreadyUpdated = player.updatedThisTurn.includes(fn.id);
  const canUpdate = canAct && state.currentPlayerIndex === player.index && state.phase === PHASES.UPDATE && !fn.broken && !alreadyUpdated;
  const effects = getFunctionEffectSummary(fn);
  const nextEffect = getNextFunctionEffect(fn);
  const content = createElement('div', { className: 'function-preview-content' }, [
    createElement('div', { className: 'function-preview-card' }, [
      createElement('div', { className: 'remote-function-title' }, [
        createElement('strong', { textContent: fn.name }),
        createElement('span', { className: 'chip', textContent: fn.broken ? 'Cassée' : fn.reachedZero ? 'Dépilage' : 'Empilage' })
      ]),
      createElement('div', { className: 'function-meta', textContent: `${player.name} · R=${fn.R} · cadres ${fn.frames.length} · mémoire ${fn.memUsed}` }),
      createElement('div', { className: 'frame-row preview-stack compact-frames' }, fn.frames.map((frame, index) => createElement('span', {
        className: `frame${frame === 'P' ? ' parasite' : ''}`,
        style: `--i:${index}`,
        textContent: frame
      }))),
      createElement('div', { className: 'next-effect' }, [
        createElement('span', { textContent: nextEffect.label }),
        createElement('strong', { textContent: nextEffect.text })
      ]),
      createElement('div', { className: 'effect-list' }, [
        effectLine('Cas de base', effects.base),
        effectLine('Remontée', effects.up),
        effectLine('Terminaison', effects.terminal)
      ])
    ]),
    options.actions ? createElement('div', { className: 'phase-actions preview-actions' }, [
      createElement('button', {
        className: 'good',
        onclick: () => {
          hideModal();
          applyUpdate(fn.id);
        },
        disabled: !canUpdate
      }, ['Mettre à jour']),
      createElement('button', {
        onclick: () => {
          hideModal();
          applyOverclock(fn.id);
        },
        disabled: !canAct || !canUseOverclock(fn.id)
      }, ['Overclock']),
      createElement('button', { onclick: () => hideModal() }, ['Fermer'])
    ]) : createElement('div', { className: 'phase-actions preview-actions' }, [
      createElement('button', { onclick: () => hideModal() }, ['Fermer'])
    ])
  ]);
  showModal(fn.name, content, []);
}

function renderHiddenHand(player) {
  return player.hand.map((card, index) => renderHiddenCard(index));
}

function renderHiddenCard(index = 0) {
  return createElement('article', { className: 'card hidden-card', style: `--i:${index}` }, [
    createElement('div', { className: 'hidden-card-pattern' }),
    createElement('h3', { className: 'title', textContent: 'Carte cachee' }),
    createElement('div', { className: 'desc', textContent: 'La main adverse reste masquee en partie distante.' })
  ]);
}

function canUseCardFromHand(player, card) {
  if (!canControlPlayer(player.index)) return false;
  if (!canPlayCard(player.index, card.id)) return false;
  const targetChoices = getTargetChoices(player.index, card);
  return targetChoices === null || targetChoices.length > 0;
}

function renderCenterPanel(state) {
  const currentPlayer = getState().players[state.currentPlayerIndex];
  const canUseTurnControls = canControlCurrentTurn(state);
  const pendingUpdates = currentPlayer.active.filter((fn) => !fn.broken && !currentPlayer.updatedThisTurn.includes(fn.id)).length;
  const overclockDecision = canUseTurnControls && canSkipOverclock();
  const phaseText = state.phase === PHASES.UPDATE
    ? pendingUpdates > 0 ? `Phase de mise à jour : ${pendingUpdates} fonction(s) restantes` : overclockDecision ? 'Overclocking disponible' : 'Mise à jour terminée'
    : state.phase === PHASES.DRAW
      ? 'Phase de pioche : carte Système uniquement' : state.phase === PHASES.ACTION ? 'Phase de conception' : 'Partie terminée';
  const buttons = [];

  buttons.push(createElement('button', {
    className: 'primary',
    onclick: () => {
      const beforeSequence = getState().logSequence || 0;
      const changed = validateUpdatePhase();
      noteRemoteLocalAction(changed);
      renderGameScreen();
      if (changed) showActionToast(actionLabelFromLogs(beforeSequence, `${currentPlayer.name} valide la mise à jour.`), { actor: 'human' });
      if (changed) triggerBotReaction();
      if (changed) spawnArcadeEffect('draw', 'NEXT');
    },
    disabled: !canUseTurnControls || state.phase !== PHASES.UPDATE || pendingUpdates > 0 || overclockDecision || state.winner !== null
  }, ['Valider mise à jour']));

  buttons.push(createElement('button', {
    onclick: async () => {
      const choices = currentPlayer.active
        .filter((fn) => canUseOverclock(fn.id))
        .map((fn) => ({ id: fn.id, playerIndex: currentPlayer.index, functionId: fn.id, label: fn.name }));
      const selected = await chooseTargetFunction('Utiliser Overclocking', choices);
      if (selected) applyOverclock(selected);
    },
    disabled: !overclockDecision
  }, ['Utiliser Overclocking']));

  buttons.push(createElement('button', {
    onclick: () => {
      const beforeSequence = getState().logSequence || 0;
      const skipped = skipOverclock();
      noteRemoteLocalAction(skipped);
      renderGameScreen();
      if (skipped) showActionToast(actionLabelFromLogs(beforeSequence, `${currentPlayer.name} passe Overclocking.`), { actor: 'human' });
      if (skipped) spawnArcadeEffect('draw', 'SKIP');
    },
    disabled: !overclockDecision
  }, ['Passer Overclocking']));

  buttons.push(createElement('button', {
    onclick: () => {
      previewPhaseDraw();
    },
    disabled: !canUseTurnControls || state.phase !== PHASES.DRAW || state.winner !== null
  }, ['Piocher Système']));

  buttons.push(createElement('button', {
    className: 'warn',
    onclick: () => {
      const beforeSequence = getState().logSequence || 0;
      const ended = endTurn();
      noteRemoteLocalAction(ended);
      renderGameScreen();
      if (ended) showActionToast(actionLabelFromLogs(beforeSequence, `${currentPlayer.name} termine son tour.`), { actor: 'human', tone: 'warn' });
      if (ended) triggerBotReaction();
      if (ended) spawnArcadeEffect('draw', 'TURN');
    },
    disabled: !canUseTurnControls || !canEndTurn()
  }, ['Fin de tour']));

  buttons.push(createElement('button', {
    className: 'bad',
    onclick: () => {
      const beforeSequence = getState().logSequence || 0;
      const rebooted = rebootCurrentPlayer();
      noteRemoteLocalAction(rebooted);
      renderGameScreen();
      if (rebooted) showActionToast(actionLabelFromLogs(beforeSequence, `${currentPlayer.name} lance un reboot volontaire.`), { actor: 'human', tone: 'warn' });
      if (rebooted) triggerBotReaction();
      if (rebooted) spawnArcadeEffect('reboot', 'REBOOT');
    },
    disabled: !canUseTurnControls || !canRebootCurrentPlayer()
  }, ['Reboot volontaire']));

  const winnerBox = state.winner !== null ? createElement('div', { className: 'winner-banner' }, [
    createElement('h2', { textContent: 'Victoire !' }),
    createElement('p', { textContent: `${state.players[state.winner].name} remporte la partie.` })
  ]) : null;

  return createElement('section', { className: `panel panel-body phase-card${usesRemoteBoardLayout(state) ? ' remote-phase-card' : ''}` }, [
    createElement('h2', { className: 'phase-title-row' }, [
      createElement('span', { textContent: 'État du tour' }),
      createElement('span', { className: `phase-current phase-current-${phaseClass(state.phase)}`, textContent: phaseText })
    ]),
    renderPhaseRail(state),
    createElement('div', { className: 'turn-owner', textContent: remoteTurnHint(state) }),
    createElement('div', { className: 'phase-actions' }, buttons),
    winnerBox,
    createElement('div', { className: 'log action-log' }, [
      createElement('div', { className: 'log-head' }, [
        createElement('h3', { textContent: 'Journal des actions' }),
        createElement('span', { className: 'chip', textContent: `${state.log.length} entrée(s)` })
      ]),
      createElement('div', { className: 'log-lines' }, [...state.log].reverse().map((entry, index) => createElement('div', {
        className: `log-line ${entry.cls}`,
        style: `--i:${index}`
      }, [
        createElement('div', { className: 'log-meta', textContent: formatLogMeta(entry, index) }),
        createElement('div', { className: 'log-text', textContent: entry.text })
      ])))
    ])
  ]);
}

function renderHelpPanel() {
  return createElement('aside', { className: 'rules-strip' }, [
    createElement('h2', { textContent: 'Aide et règles' }),
    createElement('p', { textContent: 'Ce jeu met en œuvre la variante d’initiation quadratique avec mémoire 11, victoire à 11, et overflow au 7e cadre.' }),
    createElement('ul', {}, [
      createElement('li', { textContent: 'Fonctions actives non cassées = mise à jour obligatoire.' }),
      createElement('li', { textContent: 'Les Interrupts peuvent être jouées pendant le tour adverse si leur condition est remplie.' }),
      createElement('li', { textContent: 'Pas de pioche libre dans la pile Fonctions : remplacement automatique à la terminaison, ou reboot de début de tour.' }),
      createElement('li', { textContent: 'Les fonctions cassées restent en jeu et occupent de la mémoire.' }),
      createElement('li', { textContent: 'Nettoyer libère la mémoire et défausse la fonction.' }),
      createElement('li', { textContent: 'Réparer remet la fonction en état selon le texte de la carte ; par défaut elle revient avec son cadre initial seulement.' }),
      createElement('li', { textContent: 'Si les deux piles sont vides au moment de piocher, le joueur perd 1 mémoire totale ; si sa mémoire utilisée dépasse ensuite sa mémoire totale, il subit un reboot forcé.' })
    ])
  ]);
}

function renderPhaseRail(state) {
  return createElement('ol', { className: 'phase-rail' }, PHASE_STEPS.map((step, index) => {
    const isActive = state.phase === step.key;
    const isDone = PHASE_STEPS.findIndex((item) => item.key === state.phase) > index || state.phase === PHASES.GAME_OVER;
    return createElement('li', { className: `${isActive ? 'active' : ''}${isDone ? ' done' : ''}`.trim() }, [
      createElement('span', { textContent: String(index + 1) }),
      createElement('strong', { textContent: step.label })
    ]);
  }));
}

function emptyState(label) {
  return createElement('div', { className: 'empty-state', textContent: label });
}

function effectLine(label, text) {
  return createElement('div', { className: 'effect-line' }, [
    createElement('span', { textContent: label }),
    createElement('strong', { textContent: text })
  ]);
}

function formatLogMeta(entry, index) {
  const order = entry.order ? `#${String(entry.order).padStart(2, '0')}` : `#${String(index + 1).padStart(2, '0')}`;
  const turn = entry.turn ? `Tour ${entry.turn}` : 'Tour ?';
  const player = entry.player || 'Système';
  const phase = entry.phase || 'Phase ?';
  return `${order} · ${turn} · ${player} · ${phase}`;
}

function cardTypeClass(type) {
  if (type === 'Fonction') return 'function';
  if (type === 'Commande') return 'command';
  if (type === 'Interrupt') return 'interrupt';
  if (type === 'Hardware') return 'hardware';
  return 'system';
}

function phaseClass(phase) {
  if (phase === PHASES.UPDATE) return 'update';
  if (phase === PHASES.DRAW) return 'draw';
  if (phase === PHASES.ACTION) return 'action';
  if (phase === PHASES.GAME_OVER) return 'game-over';
  return 'setup';
}

function drawPileButton(playerIndex, deckType) {
  const current = getState().currentPlayerIndex;
  if (playerIndex !== current) return;
  if (!canControlPlayer(playerIndex)) return;
  if (deckType === 'system') {
    previewPhaseDraw();
  }
}

function previewPhaseDraw() {
  const state = getState();
  const player = state.players[state.currentPlayerIndex];
  if (!canControlCurrentTurn(state) || state.phase !== PHASES.DRAW || state.winner !== null) return;
  const top = getDeckTopCards(player.index, 'system', 1)[0];
  if (!top) {
    const beforeSequence = state.logSequence || 0;
    const card = drawForPlayer('system');
    noteRemoteLocalAction(true);
    renderGameScreen();
    showActionToast(actionLabelFromLogs(beforeSequence, `${player.name} pioche une carte Système.`), { actor: 'human' });
    triggerBotReaction();
    if (card) spawnArcadeEffect('draw', 'DRAW');
    return;
  }
  showCardDecisionModal({
    title: 'Pioche Système',
    player,
    deckType: 'system',
    cards: [top],
    allowTake: true,
    allowBottom: false,
    allowTop: false,
    takeLabel: 'Mettre dans la main',
    topLabel: 'Remettre au-dessus'
  });
}

function showCardDecisionModal({ title, player, deckType, cards, allowTake, allowBottom, allowTop = true, takeLabel = 'Mettre dans la main', topLabel = 'Remettre au-dessus' }) {
  const content = createElement('div', { className: 'draw-preview' }, [
    createElement('div', { className: 'draw-preview-cards' }, cards.length
      ? cards.map((card) => renderPreviewCard(card))
      : [emptyState('Pile vide')])
  ]);
  const actions = [];
  if (allowTop) {
    actions.push({
      label: topLabel,
      onClick: () => {}
    });
  }
  if (allowBottom && cards.length) {
    actions.push({
      label: 'Mettre au-dessous',
      onClick: () => {
        const beforeSequence = getState().logSequence || 0;
        const changed = moveTopDeckCardToBottom(player.index, deckType);
        noteRemoteLocalAction(changed);
        renderGameScreen();
        if (changed) showActionToast(actionLabelFromLogs(beforeSequence, `${player.name} place une carte sous la pioche.`), { actor: 'human' });
      }
    });
  }
  if (allowTake && cards.length) {
    actions.push({
      label: takeLabel,
      onClick: () => {
        const beforeSequence = getState().logSequence || 0;
        const card = drawForPlayer(deckType);
        noteRemoteLocalAction(true);
        renderGameScreen();
        showActionToast(actionLabelFromLogs(beforeSequence, `${player.name} pioche une carte Système.`), { actor: 'human' });
        triggerBotReaction();
        if (card) spawnArcadeEffect('draw', 'DRAW');
      }
    });
  }
  showModal(title, content, actions);
}

function renderPreviewCard(card) {
  return createElement('article', { className: `card ${cardTypeClass(card.type)} preview-card draw-preview-card` }, [
    createElement('div', { className: 'card-top' }, [
      createElement('span', { className: `type-badge ${cardTypeClass(card.type)}`, textContent: card.type }),
      createElement('span', { className: 'cost-badge', textContent: `Coût ${card.cost ?? '-'}` })
    ]),
    createElement('h3', { className: 'title', textContent: card.name }),
    createElement('div', { className: 'desc', textContent: card.description || 'Carte.' })
  ]);
}

function applyUpdate(functionId) {
  const state = getState();
  const beforeOwner = state.players.find((player) => player.active.some((fn) => fn.id === functionId));
  if (!beforeOwner || !canControlPlayer(beforeOwner.index)) return;
  const before = beforeOwner?.active.find((fn) => fn.id === functionId);
  const beforeFrames = before ? before.frames.length : 0;
  const beforeTop = before?.frames[before.frames.length - 1];
  const beforeCardKey = before?.cardKey;
  const wasUnwinding = Boolean(before?.reachedZero);
  const beforeSequence = state.logSequence || 0;
  const updated = updateFunction(functionId);
  noteRemoteLocalAction(updated);
  renderGameScreen();
  if (updated) showActionToast(`${beforeOwner.name} met à jour ${before.name}.`, { actor: 'human' });
  if (updated) triggerBotReaction();
  if (!updated || !beforeOwner || !before) return;
  const afterOwner = getState().players.find((player) => player.index === beforeOwner.index);
  const after = afterOwner?.active.find((fn) => fn.id === functionId);
  if (!after) {
    spawnArcadeEffect('score', 'SCORE');
  } else if (after.broken) {
    spawnArcadeEffect('break', 'CRASH');
  } else if (!wasUnwinding && after.reachedZero) {
    spawnArcadeEffect('base', '[0]');
  } else if (after.frames.length > beforeFrames) {
    spawnArcadeEffect('stack', 'STACK');
  } else {
    spawnArcadeEffect('unwind', 'POP');
  }
  maybeShowPeekDecision(beforeOwner, beforeCardKey, beforeTop, wasUnwinding);
}

function maybeShowPeekDecision(player, cardKey, poppedFrame, wasUnwinding) {
  maybeOpenPendingDeckEffect();
}

function showPeekDecision(player, count, allowBottom, sourceName) {
  const cards = getDeckTopCards(player.index, 'system', count);
  showCardDecisionModal({
    title: `${sourceName} — dessus Système`,
    player,
    deckType: 'system',
    cards,
    allowTake: false,
    allowBottom,
    topLabel: 'Laisser au-dessus'
  });
}

function maybeOpenPendingDeckEffect() {
  if (getPendingHandLimitDiscard()) return;
  const effect = getPendingDeckEffect();
  if (!effect) {
    openPendingDeckEffectId = null;
    return;
  }
  if (!canControlPlayer(effect.ownerIndex)) return;
  if (openPendingDeckEffectId === effect.id && !modal.classList.contains('hidden')) return;
  openPendingDeckEffectId = effect.id;
  showPendingDeckTargetChoice(effect);
}

function showPendingDeckTargetChoice(effect) {
  const state = getState();
  const choices = [];
  effect.allowedPlayerIndexes.forEach((playerIndex) => {
    const player = state.players[playerIndex];
    if (!player) return;
    effect.allowedDecks.forEach((deckType) => {
      const cards = getDeckTopCards(playerIndex, deckType, effect.count);
      choices.push(createElement('button', {
        onclick: () => {
          hideModal();
          showPendingDeckResolution(effect, playerIndex, deckType);
        }
      }, [`${player.name} - ${deckLabel(deckType)} (${cards.length})`]));
    });
  });
  showModal(effect.sourceName, createElement('div', { className: 'modal-choice' }, choices), []);
}

function maybeOpenPendingHandLimitDiscard() {
  const pending = getPendingHandLimitDiscard();
  if (!pending) {
    openPendingHandLimitKey = null;
    return;
  }
  if (!canControlPlayer(pending.playerIndex)) return;
  const key = `${pending.playerIndex}:${pending.discardCount}:${getState().players[pending.playerIndex]?.hand.map((card) => card.id).join('|')}`;
  if (openPendingHandLimitKey === key && !modal.classList.contains('hidden')) return;
  openPendingHandLimitKey = key;
  showHandLimitDiscardModal(pending);
}

function showHandLimitDiscardModal(pending) {
  const state = getState();
  const player = state.players[pending.playerIndex];
  if (!player) return;
  const selected = new Set();
  let confirmButton = null;
  const counter = createElement('p', {
    className: 'help',
    textContent: `Limite de main : choisissez ${pending.discardCount} carte(s) à défausser pour revenir à ${pending.maxHandSize || MAX_HAND_SIZE}.`
  });
  const refresh = () => {
    counter.textContent = `Limite de main : ${selected.size}/${pending.discardCount} carte(s) sélectionnée(s) pour revenir à ${pending.maxHandSize || MAX_HAND_SIZE}.`;
    if (confirmButton) confirmButton.disabled = selected.size !== pending.discardCount;
  };
  const cards = createElement('div', { className: 'hand-limit-list' }, player.hand.map((card) => {
    const checkbox = createElement('input', { type: 'checkbox' });
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) selected.add(card.id);
      else selected.delete(card.id);
      refresh();
    });
    return createElement('label', { className: 'hand-limit-card' }, [
      checkbox,
      createElement('span', {}, [
        createElement('strong', { textContent: card.name }),
        createElement('small', { textContent: `${card.type} - coût ${card.cost}` })
      ])
    ]);
  }));
  confirmButton = createElement('button', {
    className: 'primary',
    disabled: true,
    onclick: () => {
      const beforeSequence = getState().logSequence || 0;
      const resolved = resolveHandLimitDiscard([...selected]);
      noteRemoteLocalAction(resolved);
      if (!resolved) return;
      openPendingHandLimitKey = null;
      hideModal();
      renderGameScreen();
      showActionToast(actionLabelFromLogs(beforeSequence, `${player.name} respecte la limite de main.`), { actor: 'human', tone: 'warn' });
      spawnArcadeEffect('repair', 'DISCARD');
    }
  }, ['Défausser']);
  const content = createElement('div', { className: 'hand-limit-modal' }, [
    counter,
    cards,
    createElement('div', { className: 'modal-choice' }, [confirmButton])
  ]);
  showModal('Limite de main', content, []);
}

function showPendingDeckResolution(effect, targetPlayerIndex, deckType) {
  const current = getPendingDeckEffect();
  if (!current || current.id !== effect.id) return;
  const state = getState();
  const player = state.players[targetPlayerIndex];
  const cards = getDeckTopCards(targetPlayerIndex, deckType, current.count);
  const buttons = [];
  const resolveChoice = (choice) => {
    const beforeSequence = getState().logSequence || 0;
    const resolved = resolvePendingDeckEffect({
      targetPlayerIndex,
      deckType,
      ...choice
    });
    openPendingDeckEffectId = null;
    noteRemoteLocalAction(resolved);
    hideModal();
    renderGameScreen();
    if (resolved) showActionToast(actionLabelFromLogs(beforeSequence, `${player.name} résout un effet de pioche.`), { actor: 'human' });
    if (resolved) triggerBotReaction();
    if (resolved && current.mode === 'reveal_take') spawnArcadeEffect('draw', 'TAKE');
  };

  if (current.mode === 'peek_top') {
    buttons.push(createElement('button', { onclick: () => resolveChoice({ action: 'top' }) }, ['Laisser au-dessus']));
  } else if (current.mode === 'peek_order') {
    buttons.push(createElement('button', { onclick: () => resolveChoice({ action: 'keep' }) }, ["Conserver l'ordre"]));
    buttons.push(createElement('button', { onclick: () => resolveChoice({ action: 'reverse' }), disabled: cards.length < 2 }, ['Inverser les 2 cartes']));
  } else if (current.mode === 'may_bottom') {
    buttons.push(createElement('button', { onclick: () => resolveChoice({ action: 'keep' }) }, ['Laisser au-dessus']));
    cards.forEach((card) => {
      buttons.push(createElement('button', { onclick: () => resolveChoice({ action: 'bottom', cardId: card.id }) }, [`Mettre ${card.name} dessous`]));
    });
  } else if (current.mode === 'reveal_take') {
    cards.forEach((card) => {
      buttons.push(createElement('button', { onclick: () => resolveChoice({ action: 'take', cardId: card.id }) }, [`Prendre ${card.name}`]));
    });
    if (!cards.length) buttons.push(createElement('button', { onclick: () => resolveChoice({ action: 'empty' }) }, ['Continuer']));
  }

  const content = createElement('div', { className: 'draw-preview' }, [
    createElement('p', { className: 'help', textContent: `${player.name} - ${deckLabel(deckType)}` }),
    createElement('div', { className: 'draw-preview-cards' }, cards.length
      ? cards.map((card) => renderPreviewCard(card))
      : [emptyState('Pile vide')]),
    createElement('div', { className: 'modal-choice' }, buttons)
  ]);
  showModal(current.sourceName, content, []);
}

function deckLabel(deckType) {
  return deckType === 'functions' ? 'pioche Fonctions' : 'pioche Système';
}

function applyOverclock(functionId) {
  const state = getState();
  const owner = state.players.find((player) => player.active.some((fn) => fn.id === functionId));
  if (!owner || !canControlPlayer(owner.index)) return;
  const beforeSequence = state.logSequence || 0;
  const used = useOverclock(functionId);
  noteRemoteLocalAction(used);
  renderGameScreen();
  if (used) showActionToast(actionLabelFromLogs(beforeSequence, `${owner.name} active Overclocking.`), { actor: 'human', tone: 'good' });
  if (used) triggerBotReaction();
  if (used) spawnArcadeEffect('overclock', '2X');
}

async function playCardAction(playerIndex, cardId) {
  if (!canControlPlayer(playerIndex)) return;
  const state = getState();
  const player = state.players[playerIndex];
  const card = player.hand.find((c) => c.id === cardId);
  if (!card) return;
  const targetData = {};
  if (card.type === 'Fonction' && card.mode !== undefined && card.mode !== 'fixe') {
    targetData.R = await askForR(card);
    if (targetData.R === null) return;
  }
  if (card.type === 'Hardware' && player.hardware.length >= 2) {
    targetData.replaceHardwareId = await chooseHardwareToReplace(player, card);
    if (!targetData.replaceHardwareId) return;
  }
  const targetChoices = getTargetChoices(playerIndex, card);
  if (targetChoices) {
    const selected = await chooseTargetFunction(`Choisir une fonction pour ${card.name}`, targetChoices);
    if (!selected) return;
    targetData.functionId = selected;
  }
  const beforeSequence = getState().logSequence || 0;
  const played = playCard(playerIndex, cardId, targetData);
  noteRemoteLocalAction(played);
  renderGameScreen();
  if (played) showActionToast(actionLabelFromLogs(beforeSequence, `${player.name} joue ${card.name}.`), {
    actor: player.isBot ? 'bot' : 'human',
    tone: card.type === 'Interrupt' ? 'bad' : ''
  });
  if (played) triggerBotReaction();
  if (played) spawnCardEffect(card);
}

function spawnCardEffect(card) {
  if (card.type === 'Fonction') {
    spawnArcadeEffect('deploy', 'RUN');
    return;
  }
  if (card.key === 'ram') {
    spawnArcadeEffect('ram', 'RAM +4');
    return;
  }
  if (card.key === 'overclock' || card.key === 'planificateur') {
    spawnArcadeEffect('overclock', 'BOOST');
    return;
  }
  if (['stack_spike', 'injection', 'pollution', 'swap'].includes(card.key)) {
    spawnArcadeEffect('hit', 'HIT');
    return;
  }
  if (['hotfix', 'collecte', 'purge', 'debug'].includes(card.key)) {
    spawnArcadeEffect('repair', 'FIX');
    return;
  }
  spawnArcadeEffect('draw', 'OK');
}

function showInterruptWarning(alert) {
  spawnArcadeEffect('hit', 'ALERTE');
  const warning = createElement('div', { className: 'interrupt-warning', role: 'status' }, [
    createElement('span', { className: 'eyebrow', textContent: alert.attacker }),
    createElement('strong', { textContent: alert.title }),
    createElement('p', { textContent: alert.text })
  ]);
  document.body.appendChild(warning);
  window.setTimeout(() => warning.remove(), 3600);
}

function getTargetChoices(playerIndex, card) {
  const state = getState();
  const current = state.players[playerIndex];
  const opponent = state.players[1 - playerIndex];
  if (['hotfix', 'collecte', 'debug'].includes(card.key)) {
    return current.active
      .filter((fn) => fn.broken)
      .map((fn) => ({ id: fn.id, label: `${current.name} — ${fn.name} (${fn.frames.length})` }));
  }
  if (card.key === 'pollution') {
    return opponent.active
      .filter((fn) => !fn.broken)
      .map((fn) => ({ id: fn.id, label: `${opponent.name} — ${fn.name} (${fn.frames.length})` }));
  }
  if (card.key === 'stack_spike') {
    return state.players.flatMap((player) => player.active
      .filter((fn) => !fn.broken && [4, 5].includes(fn.frames.length))
      .map((fn) => ({ id: fn.id, label: `${player.name} — ${fn.name} (${fn.frames.length})` })));
  }
  if (['injection', 'purge'].includes(card.key)) {
    return state.players.flatMap((player) => player.active
      .filter((fn) => !fn.broken)
      .map((fn) => ({ id: fn.id, label: `${player.name} — ${fn.name} (${fn.frames.length})` })));
  }
  return null;
}

function askForR(card) {
  return new Promise((resolve) => {
    const options = [];
    for (let i = 0; i <= card.maxR; i += 1) {
      options.push(createElement('button', {
        onclick: () => { hideModal(); resolve(i); }
      }, [`R=${i}`]));
    }
    options.push(createElement('button', {
      onclick: () => { hideModal(); resolve(null); }
    }, ['Annuler']));
    showModal(`Profondeur pour ${card.name}`, createElement('div', { className: 'modal-choice' }, options), []);
  });
}

function chooseHardwareToReplace(player, card) {
  return new Promise((resolve) => {
    const choices = player.hardware.map((hardware) => createElement('button', {
      onclick: () => { hideModal(); resolve(hardware.id); }
    }, [`Défausser ${hardware.name}`]));
    choices.push(createElement('button', {
      onclick: () => { hideModal(); resolve(null); }
    }, ['Annuler']));
    showModal(`Remplacer un Hardware pour ${card.name}`, createElement('div', { className: 'modal-choice' }, choices), []);
  });
}

function chooseTargetFunction(title, functions) {
  return new Promise((resolve) => {
    if (functions.length === 0) {
      alert('Aucune fonction disponible pour cibler.');
      resolve(null);
      return;
    }
    const choices = functions.map((fn) => createElement('button', {
      onclick: () => { hideModal(); resolve(fn.id); }
    }, [fn.label]));
    choices.push(createElement('button', {
      onclick: () => { hideModal(); resolve(null); }
    }, ['Annuler']));
    showModal(title, createElement('div', { className: 'modal-choice' }, choices), []);
  });
}

export function showModal(title, content, actions = []) {
  modal.innerHTML = '';
  modal.classList.remove('hidden');
  const dialog = createElement('div', { className: 'modal-content' }, [
    createElement('h2', { textContent: title }),
    typeof content === 'string' ? createElement('p', { textContent: content }) : content,
    createElement('div', { className: 'actions' }, actions.map((action) => createElement('button', { onclick: () => { action.onClick(); hideModal(); } }, [action.label])))
  ]);
  modal.appendChild(dialog);
}

export function hideModal() {
  modal.classList.add('hidden');
  modal.innerHTML = '';
}

function spawnArcadeEffect(kind, label) {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const layer = getArcadeLayer();
  const spriteName = spriteForEffect(kind);
  const effect = createElement('div', {
    className: `arcade-effect ${kind}`,
    style: `--x:${20 + Math.random() * 60}vw; --y:${18 + Math.random() * 54}vh;`,
    'aria-hidden': 'true'
  }, [
    createPixelSprite(spriteName),
    createElement('div', { className: 'arcade-label', textContent: label }),
    createElement('div', { className: 'arcade-lasers' }, [
      createElement('span'),
      createElement('span'),
      createElement('span')
    ]),
    createElement('div', { className: 'arcade-sparks' }, Array.from({ length: 10 }, (_, index) => (
      createElement('span', { style: `--i:${index}` })
    )))
  ]);
  layer.appendChild(effect);
  window.setTimeout(() => effect.remove(), 1400);
}

function getArcadeLayer() {
  let layer = document.getElementById('arcade-layer');
  if (!layer) {
    layer = createElement('div', { id: 'arcade-layer', 'aria-hidden': 'true' });
    document.body.appendChild(layer);
  }
  return layer;
}

function spriteForEffect(kind) {
  if (['hit', 'break'].includes(kind)) return 'invader';
  if (kind === 'ram') return 'ram';
  if (kind === 'repair') return 'repair';
  if (['score', 'base'].includes(kind)) return 'burst';
  return 'ship';
}

function createPixelSprite(name) {
  const rows = ARCADE_SPRITES[name] || ARCADE_SPRITES.ship;
  return createElement('div', {
    className: `arcade-sprite sprite-${name}`,
    style: `--cols:${rows[0].length}`
  }, rows.flatMap((row) => row.split('').map((cell) => (
    createElement('span', { className: cell === '1' ? 'on' : '' })
  ))));
}
