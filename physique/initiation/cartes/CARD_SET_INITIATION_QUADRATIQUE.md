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
- Cas de base : pioche 1 carte Système.
- Remontée : gagne 1 mémoire libre.
- Terminaison : gagne B(R) mémoire libre.

### Tri Fusion Tempéré ×1

- Type : Fonction.
- Coût : 3 mémoire.
- Points de base : 2.
- Empiler jusqu’à 4.
- Cas de base : pioche 1 carte Système.
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
- Cas de base : regarde la carte du dessus d’une pioche de ton choix, à toi ou adverse. Tu dois la laisser au-dessus.
- Remontée : gagne 1 mémoire libre.
- Terminaison : pioche B(R) cartes Système.

### Greffon Glouton ×2

- Type : Fonction.
- Coût : 2 mémoire.
- Points de base : 1.
- Empiler jusqu’à 3.
- Cas de base : pioche 1 carte Système.
- Remontée : l’adversaire perd 1 mémoire libre.
- Terminaison : ajoute B(R) parasites chez l’adversaire.

### Archiviste du Cache ×1

- Type : Fonction.
- Coût : 2 mémoire.
- Points de base : 1.
- Empiler jusqu’à 3.
- Cas de base : regarde les 2 cartes du dessus d’une pioche de ton choix, à toi ou adverse, puis remets-les au-dessus dans l’ordre de ton choix.
- Remontée : gagne 1 mémoire libre.
- Terminaison : pioche B(R) cartes Système, puis défausse 1 carte.

### Quicksort Agressif ×1

- Type : Fonction.
- Coût : 3 mémoire.
- Points de base : 2.
- Empiler jusqu’à 4.
- Cas de base : pioche 1 carte Système.
- Remontée : l’adversaire perd 1 mémoire libre.
- Terminaison : l’adversaire perd B(R) mémoire libre.

### Expansion Quadratique ×1

- Type : Fonction.
- Coût : 3 mémoire.
- Points de base : 2.
- Empiler jusqu’à 5.
- Cas de base : pioche 1 carte Système.
- Remontée : gagne 1 mémoire libre.
- Terminaison : gagne B(R) mémoire libre.

### Compactage Mémoire ×1

- Type : Fonction.
- Coût : 3 mémoire.
- Points de base : 2.
- Empiler jusqu’à 3.
- Cas de base : gagne 1 mémoire libre.
- Remontée : gagne 1 mémoire libre.
- Terminaison : nettoie une de tes fonctions cassées, si possible. Si B(R) ≥ 2, pioche 1 carte Système, même si aucune fonction n’a été nettoyée.

## Référence des cartes Système

### Hotfix ×1

- Type : Commande.
- Coût : 3 mémoire.
- Effet : répare une fonction cassée avec son cadre initial seulement.

### Collecte Incrémentale ×2

- Type : Commande.
- Coût : 2 mémoire.
- Effet : nettoie une fonction cassée puis pioche 1 carte Système.

### Stack Spike ×1

- Type : Interrupt.
- Coût : 3 mémoire.
- Effet : ajoute 2 cadres parasites sur une fonction de ton choix contenant exactement 4 ou 5 cadres. Cette fonction peut être à toi ou à l’adversaire.

### Injection de Boucle ×1

- Type : Interrupt.
- Coût : 2 mémoire.
- Effet : ajoute 1 cadre parasite sur une fonction de ton choix. Le contrôleur de cette fonction doit payer 1 mémoire libre ; sinon, elle casse.

### Overclocking ×1

- Type : Hardware.
- Coût : 2 mémoire.
- Effet : une fois par tour, à la fin de ta phase de mise à jour, après avoir mis à jour toutes tes fonctions actives non cassées, tu peux choisir une de tes fonctions actives non cassées. Elle effectue immédiatement une mise à jour supplémentaire. Si cette mise à jour supplémentaire ne termine pas cette fonction, perds immédiatement 1 mémoire libre.

### Débogueur pas à pas ×1

- Type : Interrupt.
- Coût : 2 mémoire.
- Effet : choisis une de tes fonctions cassées. Dépile son cadre du sommet sans appliquer son effet. Si la fonction contient encore au moins un cadre après ce dépilage, elle est réparée. Si elle ne contient plus aucun cadre, elle est défaussée sans marquer de points ni appliquer de terminaison.

### Planificateur local ×1

- Type : Hardware.
- Coût : 2 mémoire.
- Effet : une fois pendant ta phase de mise à jour, le premier empilage normal d’une de tes fonctions coûte 0 mémoire libre. Cet effet ne s’applique pas aux cadres parasites ni aux cadres ajoutés par une carte.

### Barrette RAM ×1

- Type : Hardware.
- Coût : 3 mémoire.
- Effet : après avoir payé son coût, gagne +4 mémoire totale et +4 mémoire libre. Cette carte reste en jeu comme Hardware et continue d’occuper sa mémoire.

### Pollution de Cache ×2

- Type : Commande.
- Coût : 2 mémoire.
- Effet : ajoute 2 cadres parasites à une fonction adverse.

### Purge Contrôlée ×2

- Type : Commande.
- Coût : 2 mémoire.
- Effet : retire jusqu’à 2 cadres parasites d’une fonction ; s’il n’y en a pas à retirer, pioche 1 carte Système.

### Swap Brutal ×1

- Type : Commande.
- Coût : 1 mémoire.
- Effet : gagne +3 mémoire libre temporaire jusqu’à la fin du tour. À la fin du tour, si aucune de tes fonctions ne s’est terminée pendant ce tour, perds 1 mémoire totale. Une fonction terminée pendant la phase de mise à jour de ce même tour compte.

## Note de version

Cette version remplace le bonus Fibonacci par le bonus quadratique `B(R)=R²` et remplace Expansion Fibonacci par **Expansion Quadratique**.
