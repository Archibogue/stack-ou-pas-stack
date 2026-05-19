# Stack ou pas Stack — Decks d’initiation quadratique

Les deux joueurs utilisent le même deck de 26 cartes.

## Fonctions — 12 cartes

- Fonction Factorielle ×2
- Tri Fusion Tempéré ×1
- Recherche Dichotomique ×1
- Routine Sentinelle ×2
- Greffon Glouton ×2
- Archiviste du Cache ×1
- Quicksort Agressif ×1
- Expansion Quadratique ×1
- Compactage Mémoire ×1

## Système — 14 cartes

- Hotfix ×1
- Collecte Incrémentale ×2
- Stack Spike ×1
- Injection de Boucle ×1
- Overclocking ×1
- Débogueur pas à pas ×1
- Planificateur local ×1
- Barrette RAM ×1
- Pollution de Cache ×2
- Purge Contrôlée ×2
- Swap Brutal ×1

## Référence des fonctions

### Fonction Factorielle ×2

- Type : Fonction.
- Coût : 3 mémoire.
- Points de base : 2.
- Empiler jusqu’à 4.
- Cas de base : pioche 1 carte.
- Remontée : gagne 1 mémoire libre.
- Terminaison : gagne B(R) mémoire libre.

### Tri Fusion Tempéré ×1

- Type : Fonction.
- Coût : 3 mémoire.
- Points de base : 2.
- Empiler jusqu’à 4.
- Cas de base : pioche 1 carte.
- Remontée : regarde les 2 cartes du dessus d’une de tes pioches. Tu peux mettre l’une d’elles sous la pile.
- Terminaison : retire B(R) cadres parasites parmi tes fonctions.

### Recherche Dichotomique ×1

- Type : Fonction.
- Coût : 2 mémoire.
- Points de base : 2.
- Empiler 3.
- Cas de base : révèle les 3 cartes du dessus d’une de tes pioches, prends-en 1 en main, puis remets les autres sous la pile.
- Remontée : retire 1 cadre parasite.
- Terminaison : révèle B(R)+1 cartes du dessus d’une de tes pioches, prends-en 1 en main, puis remets les autres sous la pile.

### Routine Sentinelle ×2

- Type : Fonction.
- Coût : 2 mémoire.
- Points de base : 1.
- Empiler jusqu’à 2.
- Cas de base : regarde la carte du dessus d’une pioche. Tu dois la laisser au-dessus.
- Remontée : gagne 1 mémoire libre.
- Terminaison : pioche B(R) cartes.

### Greffon Glouton ×2

- Type : Fonction.
- Coût : 2 mémoire.
- Points de base : 1.
- Empiler jusqu’à 3.
- Cas de base : pioche 1 carte.
- Remontée : l’adversaire perd 1 mémoire libre.
- Terminaison : ajoute B(R) parasites chez l’adversaire.

### Archiviste du Cache ×1

- Type : Fonction.
- Coût : 2 mémoire.
- Points de base : 1.
- Empiler jusqu’à 3.
- Cas de base : regarde les 2 cartes du dessus d’une pioche, puis remets-les au-dessus dans l’ordre de ton choix.
- Remontée : gagne 1 mémoire libre.
- Terminaison : pioche B(R), puis défausse 1 carte.

### Quicksort Agressif ×1

- Type : Fonction.
- Coût : 3 mémoire.
- Points de base : 2.
- Empiler jusqu’à 4.
- Cas de base : pioche 1 carte.
- Remontée : l’adversaire perd 1 mémoire libre.
- Terminaison : l’adversaire perd B(R) mémoire libre.

### Expansion Quadratique ×1

- Type : Fonction.
- Coût : 3 mémoire.
- Points de base : 2.
- Empiler jusqu’à 5.
- Cas de base : pioche 1 carte.
- Remontée : gagne 1 mémoire libre.
- Terminaison : gagne B(R) mémoire libre.

### Compactage Mémoire ×1

- Type : Fonction.
- Coût : 3 mémoire.
- Points de base : 2.
- Empiler jusqu’à 3.
- Cas de base : gagne 1 mémoire libre.
- Remontée : gagne 1 mémoire libre.
- Terminaison : nettoie une fonction cassée. Si B(R) ≥ 2, pioche 1 carte.

## Référence des cartes Système

### Hotfix ×1

- Type : Commande.
- Coût : 3 mémoire.
- Effet : répare une fonction cassée avec son cadre initial seulement.

### Collecte Incrémentale ×2

- Type : Commande.
- Coût : 2 mémoire.
- Effet : nettoie une fonction cassée puis pioche 1 carte.

### Stack Spike ×1

- Type : Interrupt.
- Coût : 3 mémoire.
- Effet : ajoute 2 cadres parasites sur une fonction contenant exactement 4 ou 5 cadres.

### Injection de Boucle ×1

- Type : Interrupt.
- Coût : 2 mémoire.
- Effet : ajoute 1 cadre parasite. Si la cible ne paie pas 1 mémoire, elle casse.

### Overclocking ×1

- Type : Hardware.
- Coût : 2 mémoire.
- Effet : une fois par tour, met à jour une fonction en plus ; si elle ne termine pas, perds 1 mémoire libre.

### Débogueur pas à pas ×1

- Type : Interrupt.
- Coût : 2 mémoire.
- Effet : dépile le sommet d’une fonction cassée sans effet.

### Planificateur local ×1

- Type : Hardware.
- Coût : 2 mémoire.
- Effet : une fois par tour, empiler coûte 0 mémoire.

### Barrette RAM ×1

- Type : Hardware.
- Coût : 3 mémoire.
- Effet : gagne +4 mémoire totale et +4 mémoire libre.

### Pollution de Cache ×2

- Type : Commande.
- Coût : 2 mémoire.
- Effet : ajoute 2 cadres parasites à une fonction adverse.

### Purge Contrôlée ×2

- Type : Commande.
- Coût : 2 mémoire.
- Effet : retire jusqu’à 2 cadres parasites d’une fonction ; s’il n’y en a pas à retirer, pioche 1 carte.

### Swap Brutal ×1

- Type : Commande.
- Coût : 1 mémoire.
- Effet : gagne +3 mémoire temporaire ; pénalité si aucune fonction ne termine ce tour.

## Note de version

Cette version remplace le bonus Fibonacci par le bonus quadratique `B(R)=R²` et remplace Expansion Fibonacci par **Expansion Quadratique**.
