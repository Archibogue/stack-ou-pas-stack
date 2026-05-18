import { PHASES } from './rules.js';
import { getState, newGame, loadGame, saveGame, exportGame, importGame, drawForPlayer, validateUpdatePhase, updateFunction, playCard, canPlayCard, canEndTurn, endTurn, setApiAvailability, setRemoteCode, persistGameState, loadDemoScenario, getPlayerUsedMemory, canUseOverclock, useOverclock, rebootCurrentPlayer } from './game-engine.js';
import { detectApi, createRemoteGame, joinRemoteGame, loadLocalState } from './storage.js';

const app = document.getElementById('app');
const modal = document.getElementById('modal');
let apiAvailable = false;

export async function initUI() {
  showHomeScreen();
  apiAvailable = await detectApi();
  setApiAvailability(apiAvailable);
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
  const header = createElement('div', { className: 'header' }, [
    createElement('div', {}, [
      createElement('h1', { textContent: 'Stack ou pas Stack — V2' }),
      createElement('p', { textContent: 'Nouvelle version web, maintenable et hébergeable sur serveur PHP/MySQL. Le jeu fonctionne aussi en hot-seat local si l’API n’est pas disponible.' })
    ]),
    createElement('div', { className: 'header-actions' }, [
      createElement('button', { className: 'primary', onclick: () => promptNewGame() }, ['Nouvelle partie locale']),
      createElement('button', { onclick: () => loadLocalGame() }, ['Charger sauvegarde']),
      createElement('button', { onclick: () => exportGameJson() }, ['Exporter JSON']),
      createElement('button', { onclick: () => importGameJson() }, ['Importer JSON']),
      createElement('a', { className: 'button-link', href: 'regles.html' }, ['Règles complètes'])
    ])
  ]);

  const serverActions = createElement('div', { className: 'panel panel-body' }, [
    createElement('h2', { textContent: 'Partie serveur (optionnel)' }),
    createElement('p', { textContent: apiAvailable ? 'API détectée. Créez ou rejoignez une partie distante.' : 'Aucune API détectée sur ce serveur.' }),
    createElement('div', { className: 'phase-actions' }, [
      createElement('button', { onclick: () => createServerGame(), disabled: !apiAvailable }, ['Créer une partie']),
      createElement('button', { onclick: () => joinServerGame(), disabled: !apiAvailable }, ['Rejoindre une partie'])
    ])
  ]);

  const demoPanel = createElement('div', { className: 'panel panel-body' }, [
    createElement('h2', { textContent: 'Mode démonstration' }),
    createElement('p', { textContent: 'Charger une situation pédagogique préparée, avec mains cohérentes et journal d’actions.' }),
    createElement('div', { className: 'phase-actions' }, [
      createElement('button', { onclick: () => loadDemo('depth_choice') }, ['1. Choix profondeur']),
      createElement('button', { onclick: () => loadDemo('base_not_end') }, ['2. Cas de base']),
      createElement('button', { onclick: () => loadDemo('strategic_memory') }, ['3. Choix mémoire']),
      createElement('button', { onclick: () => loadDemo('repair_or_clean') }, ['4. Nettoyer / réparer']),
      createElement('button', { onclick: () => loadDemo('ram') }, ['5. Barrette RAM']),
      createElement('button', { onclick: () => loadDemo('stack_spike_break') }, ['6. Stack Spike'])
    ])
  ]);

  const helpPanel = createElement('div', { className: 'panel panel-body help-box' }, [
    createElement('h2', { textContent: 'Rappel rapide' }),
    createElement('p', { textContent: 'Ordre de tour : mise à jour → pioche → conception → fin de tour. Les fonctions actives non cassées doivent être mises à jour pendant la phase de mise à jour.' }),
    createElement('ul', {}, [
      createElement('li', { textContent: 'Les cadres parasites comptent dans la pile et n’offrent aucun effet.' }),
      createElement('li', { textContent: 'Une fonction casse si elle doit recevoir un 7e cadre.' }),
      createElement('li', { textContent: 'Les Commandes/Interrupts sont payées et libèrent leur mémoire après résolution.' }),
      createElement('li', { textContent: 'Le reboot volontaire est possible uniquement pendant la phase de conception.' })
    ])
  ]);

  app.append(header, serverActions, demoPanel, helpPanel);
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
}

function renderGameScreen() {
  const state = getState();
  if (!state) return;
  app.innerHTML = '';
  const header = createElement('div', { className: 'header' }, [
    createElement('div', {}, [
      createElement('h1', { textContent: 'Stack ou pas Stack — V2' }),
      createElement('p', { textContent: `Tour ${state.turn} — ${state.winner !== null ? 'Partie terminée' : `Phase ${state.phase}`}` })
    ]),
    createElement('div', { className: 'header-actions' }, [
      createElement('button', { onclick: () => showHomeScreen() }, ['Retour accueil']),
      createElement('button', { onclick: () => saveGame() }, ['Sauvegarder local']),
      createElement('button', { onclick: () => exportGameJson() }, ['Exporter JSON']),
      createElement('button', { onclick: () => importGameJson() }, ['Importer JSON']),
      createElement('a', { className: 'button-link', href: 'regles.html' }, ['Règles complètes'])
    ])
  ]);

  const board = createElement('div', { className: 'grid-3' }, [
    renderPlayerPanel(state.players[0]),
    renderCenterPanel(state),
    renderPlayerPanel(state.players[1])
  ]);

  app.append(header, board, renderHelpPanel());
}

function renderPlayerPanel(player) {
  const state = getState();
  const isActive = state.currentPlayerIndex === player.index && state.phase !== PHASES.GAME_OVER;
  const panel = createElement('div', { className: `panel player-panel${isActive ? ' active' : ''}` }, [
    createElement('div', { className: 'panel-body' }, [
      createElement('div', { className: 'player-header' }, [
        createElement('div', {}, [
          createElement('h2', { className: 'player-title', textContent: player.name }),
          createElement('div', { className: 'chip', textContent: player.index === 0 ? 'Joueur Cyan' : 'Joueur Orange' })
        ]),
        createElement('div', { className: 'chip', textContent: `Score ${player.score}` })
      ]),
      createElement('div', { className: 'stats' }, [
        stat('Mémoire libre', player.memFree),
        stat('Mémoire totale', player.memTotal),
        stat('Mémoire utilisée', getPlayerUsedMemory(player)),
        stat('Main', player.hand.length)
      ]),
      createElement('div', {}, [
        createElement('h3', { className: 'area-title', textContent: 'Piles' }),
        createElement('div', { className: 'pile-list' }, [
          pileInfo('Fonctions', player.functionsDeck.length),
          pileInfo('Système', player.systemDeck.length),
          createElement('div', { className: 'chip', textContent: `Défausse ${player.discard.length}` })
        ]),
        createElement('div', { className: 'phase-actions' }, [
          createElement('button', {
            onclick: () => { drawPileButton(player.index, 'functions'); },
            disabled: !(state.phase === PHASES.DRAW && state.currentPlayerIndex === player.index && state.winner === null)
          }, ['Piocher Fonctions']),
          createElement('button', {
            onclick: () => { drawPileButton(player.index, 'system'); },
            disabled: !(state.phase === PHASES.DRAW && state.currentPlayerIndex === player.index && state.winner === null)
          }, ['Piocher Système'])
        ])
      ]),
      createElement('div', {}, [
        createElement('h3', { className: 'area-title', textContent: 'Fonctions actives' }),
        createElement('div', { className: 'function-list' }, player.active.map((fn) => renderFunctionCard(player, fn)))
      ]),
      createElement('div', {}, [
        createElement('h3', { className: 'area-title', textContent: 'Hardware' }),
        createElement('div', { className: 'chips' }, player.hardware.map((hw) => createElement('span', { className: 'chip', textContent: hw.name })))
      ]),
      createElement('div', {}, [
        createElement('h3', { className: 'area-title', textContent: 'Main' }),
        createElement('div', { className: 'hand-cards' }, player.hand.map((card) => renderCard(player, card)))
      ])
    ])
  ]);
  return panel;
}

function stat(label, value) {
  return createElement('div', { className: 'stat' }, [
    createElement('span', { className: 'label', textContent: label }),
    createElement('span', { className: 'value', textContent: value })
  ]);
}

function pileInfo(title, count) {
  return createElement('div', { className: 'chip', textContent: `${title} : ${count}` });
}

function renderFunctionCard(player, fn) {
  const state = getState();
  const isCurrent = state.currentPlayerIndex === player.index && state.phase === PHASES.UPDATE && !fn.broken;
  return createElement('div', { className: `function-item${fn.broken ? ' broken' : ''}` }, [
    createElement('div', { className: 'function-title' }, [
      createElement('h3', { textContent: fn.name }),
      createElement('span', { className: 'chip', textContent: fn.broken ? 'Cassée' : fn.reachedZero ? 'Dépilage' : 'Empilage' })
    ]),
    createElement('div', { className: 'function-meta', textContent: `R=${fn.R} — cadres ${fn.frames.length} — mémoire ${fn.memUsed}` }),
    createElement('div', { className: 'frame-row' }, fn.frames.map((frame) => createElement('span', { className: `frame${frame === 'P' ? ' parasite' : ''}`, textContent: frame }))),
    createElement('div', { className: 'card-actions' }, [
      createElement('button', { className: 'good', onclick: () => applyUpdate(fn.id), disabled: !isCurrent }, ['Mettre à jour']),
      createElement('button', { onclick: () => applyOverclock(fn.id), disabled: !canUseOverclock(fn.id) }, ['Overclock'])
    ])
  ]);
}

function renderCard(player, card) {
  const state = getState();
  const enabled = canPlayCard() && state.currentPlayerIndex === player.index;
  const children = [
    createElement('div', { className: 'meta', textContent: `${card.type} — coût ${card.cost}` }),
    createElement('h3', { className: 'title', textContent: card.name }),
    card.type === 'Fonction'
      ? createElement('div', { className: 'card-rule', textContent: `${card.mode === 'fixe' ? 'Empiler' : 'Empiler jusqu’à'} ${card.maxR} — valeur ${card.value}` })
      : null,
    createElement('div', { className: 'desc', textContent: card.description }),
    createElement('div', { className: 'card-actions' }, [
      createElement('button', { onclick: () => playCardAction(player.index, card.id), disabled: !enabled }, ['Jouer'])
    ])
  ];
  return createElement('div', { className: `card ${card.type.toLowerCase()}` }, children);
}

function renderCenterPanel(state) {
  const currentPlayer = getState().players[state.currentPlayerIndex];
  const pendingUpdates = currentPlayer.active.filter((fn) => !fn.broken && !currentPlayer.updatedThisTurn.includes(fn.id)).length;
  const phaseText = state.phase === PHASES.UPDATE
    ? pendingUpdates > 0 ? `Phase de mise à jour : ${pendingUpdates} fonction(s) restantes` : 'Mise à jour terminée'
    : state.phase === PHASES.DRAW
      ? 'Phase de pioche : choisissez une pile' : state.phase === PHASES.ACTION ? 'Phase de conception' : 'Partie terminée';
  const buttons = [];

  buttons.push(createElement('button', {
    className: 'primary',
    onclick: () => { validateUpdatePhase(); renderGameScreen(); },
    disabled: state.phase !== PHASES.UPDATE || pendingUpdates > 0 || state.winner !== null
  }, ['Valider mise à jour']));

  buttons.push(createElement('button', {
    onclick: () => { alert('Sélectionnez la pile depuis le panneau du joueur actif.'); },
    disabled: state.phase !== PHASES.DRAW || state.winner !== null
  }, ['Choisir pile']));

  buttons.push(createElement('button', {
    className: 'warn',
    onclick: () => { endTurn(); renderGameScreen(); },
    disabled: !canEndTurn()
  }, ['Fin de tour']));

  buttons.push(createElement('button', {
    className: 'bad',
    onclick: () => { rebootCurrentPlayer(); renderGameScreen(); },
    disabled: state.phase !== PHASES.ACTION || state.winner !== null || currentPlayer.rebootedThisTurn
  }, ['Reboot volontaire']));

  const winnerBox = state.winner !== null ? createElement('div', { className: 'panel panel-body' }, [
    createElement('h2', { textContent: 'Victoire !' }),
    createElement('p', { textContent: `${state.players[state.winner].name} remporte la partie.` })
  ]) : null;

  return createElement('div', { className: 'panel panel-body phase-card' }, [
    createElement('h2', { textContent: 'État du tour' }),
    createElement('div', { className: 'big', textContent: phaseText }),
    createElement('div', { className: 'help-box', textContent: `Joueur actif : ${currentPlayer.name}` }),
    createElement('div', { className: 'phase-actions' }, buttons),
    winnerBox,
    createElement('div', { className: 'log' }, [
      createElement('h3', { textContent: 'Journal des actions' }),
      createElement('div', { className: 'log-lines' }, state.log.map((entry) => createElement('div', { className: `log-line ${entry.cls}` }, [`[${entry.time}] ${entry.text}`])))
    ])
  ]);
}

function renderHelpPanel() {
  return createElement('div', { className: 'panel panel-body help-box' }, [
    createElement('h2', { textContent: 'Aide et règles' }),
    createElement('p', { textContent: 'Ce jeu met en œuvre la variante d’initiation quadratique avec mémoire 11, victoire à 11, et overflow au 7e cadre.' }),
    createElement('ul', {}, [
      createElement('li', { textContent: 'Fonctions actives non cassées = mise à jour obligatoire.' }),
      createElement('li', { textContent: 'Les fonctions cassées restent en jeu et occupent de la mémoire.' }),
      createElement('li', { textContent: 'Nettoyer libère la mémoire et défausse la fonction.' }),
      createElement('li', { textContent: 'Réparer remet la fonction en état selon le texte de la carte.' })
    ])
  ]);
}

function drawPileButton(playerIndex, deckType) {
  const current = getState().currentPlayerIndex;
  if (playerIndex !== current) return;
  drawForPlayer(deckType);
  renderGameScreen();
}

function applyUpdate(functionId) {
  updateFunction(functionId);
  renderGameScreen();
}

function applyOverclock(functionId) {
  useOverclock(functionId);
  renderGameScreen();
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
  playCard(playerIndex, cardId, targetData);
  renderGameScreen();
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
