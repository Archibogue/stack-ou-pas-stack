export const CARD_DEFINITIONS = {
  factorielle: {
    key: 'factorielle', name: 'Fonction Factorielle', type: 'Fonction', cost: 3, value: 2, maxR: 4, mode: 'jusqua', target: 'none',
    description: 'Cas de base : pioche 1 carte Système. Remontée : gagne 1 mémoire. Terminaison : gagne B(R) mémoire.'
  },
  tri_fusion: {
    key: 'tri_fusion', name: 'Tri Fusion Tempéré', type: 'Fonction', cost: 3, value: 2, maxR: 4, mode: 'jusqua', target: 'none',
    description: 'Cas de base : pioche 1 carte Système. Remontée : regarde les 2 cartes du dessus d’une de tes pioches. Tu peux mettre l’une d’elles sous la pile. Terminaison : retire B(R) parasites.'
  },
  recherche: {
    key: 'recherche', name: 'Recherche Dichotomique', type: 'Fonction', cost: 2, value: 2, maxR: 3, mode: 'fixe', target: 'none',
    description: 'Cas de base : révèle les 3 cartes du dessus d’une de tes pioches, prends-en 1 en main, puis remets les autres sous la pile. Remontée : retire 1 parasite. Terminaison : révèle B(R)+1 cartes du dessus d’une de tes pioches, prends-en 1 en main, puis remets les autres sous la pile.'
  },
  sentinelle: {
    key: 'sentinelle', name: 'Routine Sentinelle', type: 'Fonction', cost: 2, value: 1, maxR: 2, mode: 'jusqua', target: 'none',
    description: 'Cas de base : regarde la carte du dessus d’une pioche de ton choix, à toi ou adverse. Tu dois la laisser au-dessus. Remontée : gagne 1 mémoire. Terminaison : pioche B(R) cartes Système.'
  },
  glouton: {
    key: 'glouton', name: 'Greffon Glouton', type: 'Fonction', cost: 2, value: 1, maxR: 3, mode: 'jusqua', target: 'none',
    description: 'Cas de base : pioche 1 carte Système. Remontée : l’adversaire perd 1 mémoire. Terminaison : ajoute B(R) parasites.'
  },
  archiviste: {
    key: 'archiviste', name: 'Archiviste du Cache', type: 'Fonction', cost: 2, value: 1, maxR: 3, mode: 'jusqua', target: 'none',
    description: 'Cas de base : regarde les 2 cartes du dessus d’une pioche de ton choix, à toi ou adverse, puis remets-les au-dessus dans l’ordre de ton choix. Remontée : gagne 1 mémoire. Terminaison : pioche B(R) cartes Système, puis défausse 1.'
  },
  quicksort: {
    key: 'quicksort', name: 'Quicksort Agressif', type: 'Fonction', cost: 3, value: 2, maxR: 4, mode: 'jusqua', target: 'none',
    description: 'Cas de base : pioche 1 carte Système. Remontée : l’adversaire perd 1 mémoire. Terminaison : il perd B(R) mémoire.'
  },
  expansion: {
    key: 'expansion', name: 'Expansion Quadratique', type: 'Fonction', cost: 3, value: 2, maxR: 5, mode: 'jusqua', target: 'none',
    description: 'Cas de base : pioche 1 carte Système. Remontée : gagne 1 mémoire. Terminaison : gagne B(R) mémoire.'
  },
  compactage: {
    key: 'compactage', name: 'Compactage Mémoire', type: 'Fonction', cost: 3, value: 2, maxR: 3, mode: 'jusqua', target: 'none',
    description: 'Cas de base : gagne 1 mémoire. Remontée : gagne 1 mémoire. Terminaison : nettoie une de tes fonctions cassées, si possible. Si B(R) ≥ 2, pioche 1 carte Système, même si aucune fonction n’a été nettoyée.'
  },
  hotfix: {
    key: 'hotfix', name: 'Hotfix', type: 'Commande', cost: 3, target: 'ownBrokenFunction',
    description: 'Répare une fonction cassée avec son cadre initial seulement.'
  },
  collecte: {
    key: 'collecte', name: 'Collecte Incrémentale', type: 'Commande', cost: 2, target: 'ownBrokenFunction',
    description: 'Nettoie une fonction cassée puis pioche 1 carte Système.'
  },
  stack_spike: {
    key: 'stack_spike', name: 'Stack Spike', type: 'Interrupt', cost: 3, target: 'function45',
    description: 'Ajoute 2 cadres parasites sur une fonction de ton choix contenant exactement 4 ou 5 cadres. Cette fonction peut être à toi ou à l’adversaire.'
  },
  injection: {
    key: 'injection', name: 'Injection de Boucle', type: 'Interrupt', cost: 2, target: 'anyFunction',
    description: 'Ajoute 1 cadre parasite sur une fonction de ton choix. Le contrôleur de cette fonction doit payer 1 mémoire libre ; sinon, elle casse.'
  },
  overclock: {
    key: 'overclock', name: 'Overclocking', type: 'Hardware', cost: 2, target: 'none',
    description: 'Une fois par tour, à la fin de ta phase de mise à jour, après avoir mis à jour toutes tes fonctions actives non cassées, tu peux choisir une de tes fonctions actives non cassées. Elle effectue immédiatement une mise à jour supplémentaire. Si cette mise à jour supplémentaire ne termine pas cette fonction, perds immédiatement 1 mémoire libre.'
  },
  debug: {
    key: 'debug', name: 'Débogueur pas à pas', type: 'Interrupt', cost: 2, target: 'ownBrokenFunction',
    description: 'Choisis une de tes fonctions cassées. Dépile son cadre du sommet sans appliquer son effet. Si la fonction contient encore au moins un cadre après ce dépilage, elle est réparée. Si elle ne contient plus aucun cadre, elle est défaussée sans marquer de points ni appliquer de terminaison.'
  },
  planificateur: {
    key: 'planificateur', name: 'Planificateur local', type: 'Hardware', cost: 2, target: 'none',
    description: 'Une fois pendant ta phase de mise à jour, le premier empilage normal d’une de tes fonctions coûte 0 mémoire libre. Cet effet ne s’applique pas aux cadres parasites ni aux cadres ajoutés par une carte.'
  },
  ram: {
    key: 'ram', name: 'Barrette RAM', type: 'Hardware', cost: 3, target: 'none',
    description: 'Après avoir payé son coût, gagne +4 mémoire totale et +4 mémoire libre. Cette carte reste en jeu comme Hardware et continue d’occuper sa mémoire.'
  },
  pollution: {
    key: 'pollution', name: 'Pollution de Cache', type: 'Commande', cost: 2, target: 'opponentFunction',
    description: 'Ajoute 2 parasites à une fonction adverse.'
  },
  purge: {
    key: 'purge', name: 'Purge Contrôlée', type: 'Commande', cost: 2, target: 'anyFunction',
    description: 'Retire jusqu’à 2 parasites d’une fonction, sinon pioche 1 carte Système.'
  },
  swap: {
    key: 'swap', name: 'Swap Brutal', type: 'Commande', cost: 1, target: 'none',
    description: 'Gagne +3 mémoire libre temporaire jusqu’à la fin du tour. À la fin du tour, si aucune de tes fonctions ne s’est terminée pendant ce tour, perds 1 mémoire totale. Une fonction terminée pendant la phase de mise à jour de ce même tour compte.'
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
