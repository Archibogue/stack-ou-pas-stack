import { PHASES } from './rules.js';
import { getState, newGame, loadGame, saveGame, exportGame, importGame, drawForPlayer, validateUpdatePhase, updateFunction, playCard, canPlayCard, canEndTurn, endTurn, setApiAvailability, setRemoteCode, persistGameState, loadDemoScenario, getPlayerUsedMemory, canUseOverclock, useOverclock, rebootCurrentPlayer, getFunctionEffectSummary, getNextFunctionEffect, canUndo, undoLastAction } from './game-engine.js';
import { detectApi, createRemoteGame, joinRemoteGame, loadLocalState } from './storage.js';

const app = document.getElementById('app');
const modal = document.getElementById('modal');
let apiAvailable = false;

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
  ['stack_spike_break', '6. Stack Spike']
];

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

function showHomeScreen() {
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
      createElement('li', { textContent: 'Les Commandes/Interrupts sont payées et libèrent leur mémoire après résolution.' }),
      createElement('li', { textContent: 'Le reboot volontaire est possible uniquement pendant la phase de conception.' })
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
  const name1 = prompt('Nom du joueur 1 ?', 'Joueur Cyan')?.trim() || 'Joueur Cyan';
  const name2 = prompt('Nom du joueur 2 ?', 'Joueur Orange')?.trim() || 'Joueur Orange';
  newGame(name1, name2);
  renderGameScreen();
}

function loadLocalGame() {
  const saved = loadLocalState();
  if (!saved) {
    alert('Aucune sauvegarde locale trouvée.');
    return;
  }
  loadGame(saved);
  renderGameScreen();
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
    renderGameScreen();
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
    setRemoteCode(response.code);
    persistGameState();
    alert(`Partie créée. Code : ${response.code}`);
    renderGameScreen();
  } else {
    alert('Échec de la création de la partie serveur.');
  }
}

async function joinServerGame() {
  const code = (prompt('Code de partie :') || '').trim().toUpperCase();
  if (!code) return;
  const response = await joinRemoteGame(code);
  if (response?.state) {
    loadGame(response.state);
    setRemoteCode(code);
    persistGameState();
    renderGameScreen();
  } else {
    alert('Impossible de charger la partie.');
  }
}

function loadDemo(name) {
  loadDemoScenario(name);
  renderGameScreen();
  spawnArcadeEffect('deploy', 'DEMO');
}

function undoAction() {
  if (!undoLastAction()) return;
  renderGameScreen();
  spawnArcadeEffect('reboot', 'UNDO');
}

function renderGameScreen() {
  const state = getState();
  if (!state) return;
  app.innerHTML = '';
  app.className = `app game-screen phase-${phaseClass(state.phase)}`;
  const currentPlayer = state.players[state.currentPlayerIndex];
  const header = createElement('div', { className: 'header game-header' }, [
    createElement('div', { className: 'brand-block' }, [
      createElement('span', { className: 'eyebrow', textContent: `Tour ${state.turn}` }),
      createElement('h1', { textContent: 'Stack ou pas Stack — V2' }),
      createElement('p', { textContent: state.winner !== null ? 'Partie terminée' : `Joueur actif : ${currentPlayer.name}` }),
      renderPhaseRail(state)
    ]),
    createElement('div', { className: 'header-actions' }, [
      createElement('button', { onclick: () => showHomeScreen() }, ['Retour accueil']),
      createElement('button', { className: 'undo-button', onclick: () => undoAction(), disabled: !canUndo() }, ['Undo']),
      createElement('button', { onclick: () => saveGame() }, ['Sauvegarder local']),
      createElement('button', { onclick: () => exportGameJson() }, ['Exporter JSON']),
      createElement('button', { onclick: () => importGameJson() }, ['Importer JSON']),
      createElement('a', { className: 'button-link', href: 'regles.html' }, ['Règles complètes'])
    ])
  ]);

  const board = createElement('div', { className: 'grid-3 game-board' }, [
    renderPlayerPanel(state.players[0]),
    renderCenterPanel(state),
    renderPlayerPanel(state.players[1])
  ]);

  app.append(header, board, renderHelpPanel());
}

function renderPlayerPanel(player) {
  const state = getState();
  const isActive = state.currentPlayerIndex === player.index && state.phase !== PHASES.GAME_OVER;
  const brokenCount = player.active.filter((fn) => fn.broken).length;
  const tone = player.index === 0 ? 'cyan' : 'orange';
  const panel = createElement('section', { className: `panel player-panel player-${tone}${isActive ? ' active' : ''}` }, [
    createElement('div', { className: 'panel-body' }, [
      createElement('div', { className: 'player-header' }, [
        createElement('div', { className: 'player-name' }, [
          createElement('h2', { className: 'player-title', textContent: player.name }),
          createElement('div', { className: 'chip', textContent: player.index === 0 ? 'Joueur Cyan' : 'Joueur Orange' })
        ]),
        createElement('div', { className: 'score-pill', textContent: `${player.score} pts` })
      ]),
      memoryMeter(player),
      createElement('div', { className: 'stats' }, [
        stat('Libre', player.memFree),
        stat('Totale', player.memTotal),
        stat('Utilisée', getPlayerUsedMemory(player)),
        stat('Main', player.hand.length),
        stat('Cassées', brokenCount)
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
            disabled: !(state.phase === PHASES.DRAW && state.currentPlayerIndex === player.index && state.winner === null)
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
          ? player.hardware.map((hw) => createElement('span', { className: 'chip hardware-chip', textContent: hw.name }))
          : [emptyState('Aucun hardware')])
      ]),
      createElement('section', { className: 'play-area' }, [
        createElement('h3', { className: 'area-title', textContent: 'Main' }),
        createElement('div', { className: 'hand-cards' }, player.hand.length
          ? player.hand.map((card, index) => renderCard(player, card, index))
          : [emptyState('Main vide')])
      ])
    ])
  ]);
  return panel;
}

function stat(label, value) {
  return createElement('div', { className: 'stat compact-stat' }, [
    createElement('span', { className: 'label', textContent: label }),
    createElement('span', { className: 'value', textContent: value })
  ]);
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
  const isCurrent = state.currentPlayerIndex === player.index && state.phase === PHASES.UPDATE && !fn.broken;
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
      createElement('button', { onclick: () => applyOverclock(fn.id), disabled: !canUseOverclock(fn.id) }, ['Overclock'])
    ])
  ]);
}

function renderCard(player, card, index = 0) {
  const state = getState();
  const enabled = canUseCardFromHand(player, card);
  const typeClass = cardTypeClass(card.type);
  const actionLabel = card.type === 'Interrupt' && state.currentPlayerIndex !== player.index ? 'Interrompre' : 'Jouer';
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
      createElement('button', { onclick: () => playCardAction(player.index, card.id), disabled: !enabled }, [actionLabel])
    ])
  ];
  return createElement('article', { className: `card ${typeClass}`, style: `--i:${index}` }, children);
}

function canUseCardFromHand(player, card) {
  if (!canPlayCard(player.index, card.id)) return false;
  const targetChoices = getTargetChoices(player.index, card);
  return targetChoices === null || targetChoices.length > 0;
}

function renderCenterPanel(state) {
  const currentPlayer = getState().players[state.currentPlayerIndex];
  const pendingUpdates = currentPlayer.active.filter((fn) => !fn.broken && !currentPlayer.updatedThisTurn.includes(fn.id)).length;
  const phaseText = state.phase === PHASES.UPDATE
    ? pendingUpdates > 0 ? `Phase de mise à jour : ${pendingUpdates} fonction(s) restantes` : 'Mise à jour terminée'
    : state.phase === PHASES.DRAW
      ? 'Phase de pioche : carte Système uniquement' : state.phase === PHASES.ACTION ? 'Phase de conception' : 'Partie terminée';
  const buttons = [];

  buttons.push(createElement('button', {
    className: 'primary',
    onclick: () => {
      const changed = validateUpdatePhase();
      renderGameScreen();
      if (changed) spawnArcadeEffect('draw', 'NEXT');
    },
    disabled: state.phase !== PHASES.UPDATE || pendingUpdates > 0 || state.winner !== null
  }, ['Valider mise à jour']));

  buttons.push(createElement('button', {
    onclick: () => {
      const card = drawForPlayer('system');
      renderGameScreen();
      if (card) spawnArcadeEffect('draw', 'DRAW');
    },
    disabled: state.phase !== PHASES.DRAW || state.winner !== null
  }, ['Piocher Système']));

  buttons.push(createElement('button', {
    className: 'warn',
    onclick: () => {
      const ended = endTurn();
      renderGameScreen();
      if (ended) spawnArcadeEffect('draw', 'TURN');
    },
    disabled: !canEndTurn()
  }, ['Fin de tour']));

  buttons.push(createElement('button', {
    className: 'bad',
    onclick: () => {
      const rebooted = rebootCurrentPlayer();
      renderGameScreen();
      if (rebooted) spawnArcadeEffect('reboot', 'REBOOT');
    },
    disabled: state.phase !== PHASES.ACTION || state.winner !== null || currentPlayer.rebootedThisTurn
  }, ['Reboot volontaire']));

  const winnerBox = state.winner !== null ? createElement('div', { className: 'winner-banner' }, [
    createElement('h2', { textContent: 'Victoire !' }),
    createElement('p', { textContent: `${state.players[state.winner].name} remporte la partie.` })
  ]) : null;

  return createElement('section', { className: 'panel panel-body phase-card' }, [
    createElement('h2', { textContent: 'État du tour' }),
    renderPhaseRail(state),
    createElement('div', { className: 'big', textContent: phaseText }),
    createElement('div', { className: 'turn-owner', textContent: `Joueur actif : ${currentPlayer.name}` }),
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
      createElement('li', { textContent: 'Pas de pioche libre dans la pile Fonctions : remplacement automatique à la terminaison, ou reboot.' }),
      createElement('li', { textContent: 'Les fonctions cassées restent en jeu et occupent de la mémoire.' }),
      createElement('li', { textContent: 'Nettoyer libère la mémoire et défausse la fonction.' }),
      createElement('li', { textContent: 'Réparer remet la fonction en état selon le texte de la carte.' })
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
  const card = drawForPlayer(deckType);
  renderGameScreen();
  if (card) spawnArcadeEffect('draw', 'DRAW');
}

function applyUpdate(functionId) {
  const state = getState();
  const beforeOwner = state.players.find((player) => player.active.some((fn) => fn.id === functionId));
  const before = beforeOwner?.active.find((fn) => fn.id === functionId);
  const beforeFrames = before ? before.frames.length : 0;
  const wasUnwinding = Boolean(before?.reachedZero);
  const updated = updateFunction(functionId);
  renderGameScreen();
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
}

function applyOverclock(functionId) {
  const used = useOverclock(functionId);
  renderGameScreen();
  if (used) spawnArcadeEffect('overclock', '2X');
}

async function playCardAction(playerIndex, cardId) {
  const card = getState().players[playerIndex].hand.find((c) => c.id === cardId);
  if (!card) return;
  const targetData = {};
  if (card.type === 'Fonction' && card.mode !== undefined && card.mode !== 'fixe') {
    targetData.R = await askForR(card);
    if (targetData.R === null) return;
  }
  const targetChoices = getTargetChoices(playerIndex, card);
  if (targetChoices) {
    const selected = await chooseTargetFunction(`Choisir une fonction pour ${card.name}`, targetChoices);
    if (!selected) return;
    targetData.functionId = selected;
  }
  const played = playCard(playerIndex, cardId, targetData);
  renderGameScreen();
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
