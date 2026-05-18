export const CARD_DEFINITIONS = {
  factorielle: {
    key: 'factorielle', name: 'Fonction Factorielle', type: 'Fonction', cost: 3, value: 2, maxR: 4, mode: 'jusqua', target: 'none',
    description: 'Cas de base : pioche 1 carte. Remontée : gagne 1 mémoire. Terminaison : gagne B(R) mémoire.'
  },
  tri_fusion: {
    key: 'tri_fusion', name: 'Tri Fusion Tempéré', type: 'Fonction', cost: 3, value: 2, maxR: 4, mode: 'jusqua', target: 'none',
    description: 'Cas de base : pioche 1 carte. Remontée : réordonne virtuellement. Terminaison : retire B(R) parasites.'
  },
  recherche: {
    key: 'recherche', name: 'Recherche Dichotomique', type: 'Fonction', cost: 2, value: 2, maxR: 3, mode: 'fixe', target: 'none',
    description: 'Cas de base : révèle puis prend 1 carte. Remontée : retire 1 parasite. Terminaison : pioche B(R)+1.'
  },
  sentinelle: {
    key: 'sentinelle', name: 'Routine Sentinelle', type: 'Fonction', cost: 2, value: 1, maxR: 2, mode: 'jusqua', target: 'none',
    description: 'Cas de base : regarde le dessus d’une pile. Remontée : gagne 1 mémoire. Terminaison : pioche B(R).'
  },
  glouton: {
    key: 'glouton', name: 'Greffon Glouton', type: 'Fonction', cost: 2, value: 1, maxR: 3, mode: 'jusqua', target: 'none',
    description: 'Cas de base : pioche 1 carte. Remontée : l’adversaire perd 1 mémoire. Terminaison : ajoute B(R) parasites.'
  },
  archiviste: {
    key: 'archiviste', name: 'Archiviste du Cache', type: 'Fonction', cost: 2, value: 1, maxR: 3, mode: 'jusqua', target: 'none',
    description: 'Cas de base : regarde 2 cartes. Remontée : gagne 1 mémoire. Terminaison : pioche B(R), puis défausse 1.'
  },
  quicksort: {
    key: 'quicksort', name: 'Quicksort Agressif', type: 'Fonction', cost: 3, value: 2, maxR: 4, mode: 'jusqua', target: 'none',
    description: 'Cas de base : pioche 1 carte. Remontée : l’adversaire perd 1 mémoire. Terminaison : il perd B(R) mémoire.'
  },
  expansion: {
    key: 'expansion', name: 'Expansion Quadratique', type: 'Fonction', cost: 3, value: 2, maxR: 5, mode: 'jusqua', target: 'none',
    description: 'Cas de base : pioche 1 carte. Remontée : gagne 1 mémoire. Terminaison : gagne B(R) mémoire.'
  },
  compactage: {
    key: 'compactage', name: 'Compactage Mémoire', type: 'Fonction', cost: 3, value: 2, maxR: 3, mode: 'jusqua', target: 'none',
    description: 'Cas de base : gagne 1 mémoire. Remontée : gagne 1 mémoire. Terminaison : nettoie une fonction cassée.'
  },
  hotfix: {
    key: 'hotfix', name: 'Hotfix', type: 'Commande', cost: 3, target: 'ownBrokenFunction',
    description: 'Répare une fonction cassée avec son cadre initial seulement.'
  },
  collecte: {
    key: 'collecte', name: 'Collecte Incrémentale', type: 'Commande', cost: 2, target: 'ownBrokenFunction',
    description: 'Nettoie une fonction cassée puis pioche 1 carte.'
  },
  stack_spike: {
    key: 'stack_spike', name: 'Stack Spike', type: 'Interrupt', cost: 3, target: 'function45',
    description: 'Ajoute 2 parasites sur une fonction à 4 ou 5 cadres.'
  },
  injection: {
    key: 'injection', name: 'Injection de Boucle', type: 'Interrupt', cost: 2, target: 'anyFunction',
    description: 'Ajoute 1 parasite. Si la cible ne paie pas 1 mémoire, elle casse.'
  },
  overclock: {
    key: 'overclock', name: 'Overclocking', type: 'Hardware', cost: 2, target: 'none',
    description: 'Une fois par tour, met à jour une fonction en plus ; -1 mémoire si elle ne termine pas.'
  },
  debug: {
    key: 'debug', name: 'Débogueur pas à pas', type: 'Interrupt', cost: 2, target: 'ownBrokenFunction',
    description: 'Dépile le sommet d’une fonction cassée sans effet.'
  },
  planificateur: {
    key: 'planificateur', name: 'Planificateur local', type: 'Hardware', cost: 2, target: 'none',
    description: 'Une fois par tour, empiler coûte 0 mémoire.'
  },
  ram: {
    key: 'ram', name: 'Barrette RAM', type: 'Hardware', cost: 3, target: 'none',
    description: '+4 mémoire totale et +4 mémoire libre.'
  },
  pollution: {
    key: 'pollution', name: 'Pollution de Cache', type: 'Commande', cost: 2, target: 'opponentFunction',
    description: 'Ajoute 2 parasites à une fonction adverse.'
  },
  purge: {
    key: 'purge', name: 'Purge Contrôlée', type: 'Commande', cost: 2, target: 'anyFunction',
    description: 'Retire jusqu’à 2 parasites d’une fonction, sinon pioche 1 carte.'
  },
  swap: {
    key: 'swap', name: 'Swap Brutal', type: 'Commande', cost: 1, target: 'none',
    description: '+3 mémoire temporaire, pénalité si aucune fonction ne termine ce tour.'
  }
};

export const DECK_COMPOSITION = [
  ['factorielle', 2], ['tri_fusion', 1], ['recherche', 1], ['sentinelle', 2],
  ['glouton', 2], ['archiviste', 1], ['quicksort', 1], ['expansion', 1], ['compactage', 1],
  ['hotfix', 1], ['collecte', 2], ['stack_spike', 1], ['injection', 1], ['overclock', 1],
  ['debug', 1], ['planificateur', 1], ['ram', 1], ['pollution', 2], ['purge', 2], ['swap', 1]
];

export function createCard(key) {
  const definition = CARD_DEFINITIONS[key];
  return definition ? { ...definition, id: `${key}-${crypto.randomUUID?.() ?? Date.now().toString(36)}-${Math.random().toString(36).slice(2)}` } : null;
}

export function buildDecks() {
  const functions = [];
  const system = [];
  DECK_COMPOSITION.forEach(([key, count]) => {
    for (let i = 0; i < count; i += 1) {
      const card = createCard(key);
      if (card.type === 'Fonction') functions.push(card);
      else system.push(card);
    }
  });
  return {
    functions: shuffle(functions),
    system: shuffle(system)
  };
}

function shuffle(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
