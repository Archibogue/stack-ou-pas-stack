# NEON STACK — Set de cartes V5.4 (texte uniquement)

Version sans graphisme, harmonisée pour les règles V5.4 :
- mémoire de départ à 15 ;
- deux piles de pioche (Fonctions / Système) ;
- phase de mise à jour automatique des fonctions ;
- plus de Cycles CPU ;
- reboot avec recyclage de la défausse ;
- bonus de récursion en Fibonacci classique.

## Format retenu
- **2 decks de 34 cartes**
- **12 cartes communes** aux deux decks
- **22 cartes spécifiques** par deck
- **Deck Cyan** : stabilité, nettoyage, réparation, contrôle de pile
- **Deck Orange** : pression, surcharge, pollution de pile, sabotage de tempo

---

# A. Cartes communes aux deux decks (12 cartes)

## Routine Sentinelle ×2
**Fonction** — coût 2 — valeur 1 — **Empiler jusqu'à 2**
- **Cas de base** : Regarde la carte du dessus de ta pile Fonctions ou de ta pile Système. Tu peux la laisser ou la mettre dessous.
- **Remontée** : Gagne 1 mémoire libre.
- **Terminaison** : Pioche F(R) carte(s), réparties librement entre tes deux piles.

## Fonction Factorielle ×2
**Fonction** — coût 3 — valeur 2 — **Empiler jusqu'à 4**
- **Cas de base** : Pioche 1 carte.
- **Remontée** : Gagne 1 mémoire libre.
- **Terminaison** : Gagne F(R) mémoire libre jusqu'à la fin du tour.

## Vérification de Bornes ×2
**Fonction** — coût 2 — valeur 1 — **Empiler jusqu'à 3**
- **Cas de base** : Retire 1 cadre parasite de cette fonction.
- **Remontée** : Tu peux regarder le sommet d'une autre de tes fonctions.
- **Terminaison** : Retire jusqu'à F(R) cadres parasites répartis comme tu veux parmi tes fonctions.

## Collecte Incrémentale ×2
**Commande** — coût 2
- **Effet** : Nettoie une de tes fonctions cassées. Pioche 1 carte.

## Débogueur pas à pas ×1
**Interrupt** — coût 2
- **Effet** : Joue cette carte quand une de tes fonctions devrait casser. Annule cette casse. Dépile à la place le cadre du sommet de cette fonction. N'applique pas son effet. Si c'était un cadre récursif normal, libère la mémoire correspondante. Si c'était le dernier cadre, la fonction est défaussée sans point ni terminaison.

## Cache L1 ×1
**Hardware** — coût 2
- **Effet** : La première fois à chacun de tes tours qu'une de tes fonctions dépile un cadre parasite, retire aussi un second cadre parasite au sommet de cette fonction, si possible.

## Barrette RAM ×1
**Hardware** — coût 3
- **Effet** : Quand cette carte entre en jeu, gagne +4 mémoire totale et +4 mémoire libre.

## Planificateur local ×1
**Hardware** — coût 2
- **Effet** : Une fois par tour, quand une de tes fonctions devrait empiler pendant ta phase de mise à jour, réduis de 1 le coût mémoire de cet empilage.

---

# B. Deck Cyan — 22 cartes spécifiques

## Archiviste du Cache ×2
**Fonction** — coût 2 — valeur 1 — **Empiler jusqu'à 3**
- **Cas de base** : Regarde les 2 cartes du dessus d'une de tes piles puis remets-les dans l'ordre de ton choix.
- **Remontée** : Gagne 1 mémoire libre.
- **Terminaison** : Pioche F(R) carte(s), puis défausse 1 carte.

## Recherche Dichotomique ×2
**Fonction** — coût 2 — valeur 2 — **Empiler 3**
- **Cas de base** : Révèle les 3 cartes du dessus d'une de tes piles ; mets-en 1 dans ta main et replace le reste dessous dans l'ordre de ton choix.
- **Remontée** : Retire 1 cadre parasite d'une de tes fonctions.
- **Terminaison** : Révèle les F(R)+1 cartes du dessus d'une de tes piles ; mets-en 1 dans ta main et replace le reste dessous dans l'ordre de ton choix.

## Tri Fusion Tempéré ×2
**Fonction** — coût 3 — valeur 2 — **Empiler jusqu'à 4**
- **Cas de base** : Pioche 1 carte.
- **Remontée** : Tu peux réordonner les 2 cartes du dessus d'une de tes piles.
- **Terminaison** : Retire jusqu'à F(R) cadres parasites répartis comme tu veux parmi tes fonctions.

## Compactage Mémoire ×2
**Fonction** — coût 3 — valeur 2 — **Empiler jusqu'à 3**
- **Cas de base** : Gagne 1 mémoire libre.
- **Remontée** : Retire 1 cadre parasite de cette fonction.
- **Terminaison** : Nettoie une de tes fonctions cassées. Si F(R) ≥ 2, pioche 1 carte.

## Inspecteur de Pile ×1
**Fonction** — coût 2 — valeur 1 — **Empiler jusqu'à 2**
- **Cas de base** : Regarde le sommet d'une pile de ton choix.
- **Remontée** : Tu peux déplacer le cadre parasite du sommet d'une de tes fonctions vers une autre de tes fonctions.
- **Terminaison** : Répare une de tes fonctions cassées.

## Nettoyeur Générationnel ×1
**Fonction** — coût 4 — valeur 3 — **Empiler jusqu'à 5**
- **Cas de base** : Nettoie une de tes fonctions cassées.
- **Remontée** : Gagne 1 mémoire libre.
- **Terminaison** : Pioche F(R) carte(s).

## Purge Contrôlée ×2
**Commande** — coût 2
- **Effet** : Retire jusqu'à 2 cadres parasites d'une fonction. Si aucun cadre parasite n'a été retiré, pioche 1 carte.

## Hotfix ×2
**Commande** — coût 3
- **Effet** : Répare une de tes fonctions cassées. Cette fonction revient avec son cadre initial seulement. Sa mémoire initiale reste réservée.

## Pause de Sécurité ×1
**Interrupt** — coût 2
- **Effet** : Joue cette carte quand une fonction adverse devrait être mise à jour en phase de descente. Cette mise à jour est annulée. L'empilage n'a pas lieu et sa mémoire n'est pas payée.

## Défragmentation ×2
**Interrupt** — coût 2
- **Effet** : Joue cette carte quand un adversaire dépile une Remontée. Annule l'effet de cette Remontée. La mémoire normalement libérée par ce cadre est quand même libérée.

## Console de Diagnostic ×1
**Hardware** — coût 2
- **Effet** : Une fois par tour, quand tu lances une fonction portant la mention Empiler jusqu'à X, tu peux augmenter ou réduire sa profondeur cible de 1, sans sortir de l'intervalle autorisé.

## ECC Mémoire ×1
**Hardware** — coût 3
- **Effet** : La première fois à chaque tour qu'une de tes fonctions devrait casser, annule cette casse. Ajoute à la place 1 cadre parasite au sommet de cette fonction.

## Ordonnanceur Zen ×1
**Hardware** — coût 2
- **Effet** : Au début de chacun de tes tours, choisis une de tes fonctions. Si elle devrait empiler pendant cette phase de mise à jour, son empilage ne coûte pas de mémoire.

## Limiteur de Pile ×1
**Hardware** — coût 2
- **Effet** : Une fois par tour, quand une de tes fonctions devrait recevoir un 8e cadre, annule cet ajout à la place. La fonction ne casse pas pour cet overflow évité.

## Sauvegarde Locale ×1
**Commande** — coût 1
- **Effet** : Choisis une de tes fonctions actives. Jusqu'à la fin du tour, si elle casse, renvoie-la dans ta main à la place et libère toute la mémoire qu'elle occupait.

---

# C. Deck Orange — 22 cartes spécifiques

## Greffon Glouton ×2
**Fonction** — coût 2 — valeur 1 — **Empiler jusqu'à 3**
- **Cas de base** : Pioche 1 carte.
- **Remontée** : L'adversaire perd 1 mémoire libre.
- **Terminaison** : Ajoute F(R) cadres parasites répartis comme tu veux entre les fonctions adverses.

## Quicksort Agressif ×2
**Fonction** — coût 3 — valeur 2 — **Empiler jusqu'à 4**
- **Cas de base** : Regarde les 2 cartes du dessus d'une de tes piles ; mets-en 1 dans ta main et défausse l'autre.
- **Remontée** : L'adversaire perd 1 mémoire libre.
- **Terminaison** : L'adversaire perd F(R) mémoire libre au début de son prochain tour.

## Expansion Fibonacci ×2
**Fonction** — coût 3 — valeur 2 — **Empiler jusqu'à 5**
- **Cas de base** : Pioche 1 carte.
- **Remontée** : Gagne 1 mémoire libre.
- **Terminaison** : Gagne F(R) mémoire libre jusqu'à la fin de ton prochain tour.

## Fonction Parasite ×2
**Fonction** — coût 2 — valeur 1 — **Empiler jusqu'à 3**
- **Cas de base** : Ajoute 1 cadre parasite au sommet de cette fonction.
- **Remontée** : Déplace 1 cadre parasite de cette fonction vers une fonction adverse.
- **Terminaison** : Si cette fonction n'a plus de cadre parasite, ajoute F(R) cadres parasites répartis comme tu veux entre les fonctions adverses.

## Bombe à Retours ×1
**Fonction** — coût 4 — valeur 3 — **Empiler 4**
- **Cas de base** : Pioche 1 carte.
- **Remontée** : Au prochain tour adverse, la première fonction adverse mise à jour en phase de descente ignore sa mise à jour.
- **Terminaison** : L’adversaire perd 2 mémoire libre au début de son prochain tour.
- Si plusieurs effets de **Bombe à Retours** devaient s’appliquer au même tour adverse, un seul de ces effets s’applique.

## Récursion Gloutonne ×1
**Fonction** — coût 4 — valeur 3 — **Empiler jusqu'à 6**
- **Cas de base** : Aucun effet.
- **Remontée** : Gagne 1 mémoire libre.
- **Terminaison** : Si R ≥ 4, marque 2 points supplémentaires.

## Injection de Boucle ×2
**Interrupt** — coût 2
- **Effet** : Joue cette carte quand une fonction est lancée ou quand elle devrait empiler. Ajoute immédiatement 1 cadre parasite au sommet de cette fonction. Son contrôleur doit payer 1 mémoire libre ; sinon, cette fonction casse.

## Stack Spike ×2
**Interrupt** — coût 3
- **Effet** : Joue cette carte quand une fonction contient exactement 5 ou 6 cadres. Ajoute 2 cadres parasites à cette fonction.

## Pollution de Cache ×2
**Commande** — coût 2
- **Effet** : Choisis une fonction adverse. Ajoute-lui 2 cadres parasites.

## Rebond Infini ×1
**Interrupt** — coût 3
- **Effet** : Joue cette carte quand un adversaire devrait dépiler un cadre [0]. Annule le Cas de base de ce cadre. Cette fonction casse immédiatement.

## Overclocking ×1
**Hardware** — coût 2
- **Effet** : Au début de chacun de tes tours, tu peux choisir une de tes fonctions. Elle effectue immédiatement une mise à jour supplémentaire. Si elle ne termine pas ce tour-ci, perds 1 mémoire libre à la fin du tour. Cette mise à jour supplémentaire a lieu au début de la phase de mise à jour, avant les mises à jour normales.

## Démon du Débordement ×1
**Hardware** — coût 3
- **Effet** : À chaque fois qu'une fonction adverse casse à cause d'un overflow, ajoute 1 cadre parasite à une autre fonction adverse.

## Sabotage de Collecte ×1
**Interrupt** — coût 1
- **Effet** : Joue cette carte quand un adversaire joue une carte qui nettoie ou répare. Contrecarre cette carte.

## Swap Brutal ×2
**Commande** — coût 1
- **Effet** : Gagne 3 mémoire libre jusqu'à la fin du tour. À la fin du tour, si tu n'as pas terminé au moins une fonction, perds 1 mémoire totale.

---

# D. Constitution des paquets

## Deck Cyan (34 cartes)
### Communes (12)
- Routine Sentinelle ×2
- Fonction Factorielle ×2
- Vérification de Bornes ×2
- Collecte Incrémentale ×2
- Débogueur pas à pas ×1
- Cache L1 ×1
- Barrette RAM ×1
- Planificateur local ×1

### Spécifiques Cyan (22)
- Archiviste du Cache ×2
- Recherche Dichotomique ×2
- Tri Fusion Tempéré ×2
- Compactage Mémoire ×2
- Inspecteur de Pile ×1
- Nettoyeur Générationnel ×1
- Purge Contrôlée ×2
- Hotfix ×2
- Pause de Sécurité ×1
- Défragmentation ×2
- Console de Diagnostic ×1
- ECC Mémoire ×1
- Ordonnanceur Zen ×1
- Limiteur de Pile ×1
- Sauvegarde Locale ×1

## Deck Orange (34 cartes)
### Communes (12)
- Routine Sentinelle ×2
- Fonction Factorielle ×2
- Vérification de Bornes ×2
- Collecte Incrémentale ×2
- Débogueur pas à pas ×1
- Cache L1 ×1
- Barrette RAM ×1
- Planificateur local ×1

### Spécifiques Orange (22)
- Greffon Glouton ×2
- Quicksort Agressif ×2
- Expansion Fibonacci ×2
- Fonction Parasite ×2
- Bombe à Retours ×1
- Récursion Gloutonne ×1
- Injection de Boucle ×2
- Stack Spike ×2
- Pollution de Cache ×2
- Rebond Infini ×1
- Overclocking ×1
- Démon du Débordement ×1
- Sabotage de Collecte ×1
- Swap Brutal ×2

---

# E. Remarques d'harmonisation V5.4

- Les cartes faisant auparavant référence aux **Cycles CPU** ont été réécrites pour la **phase de mise à jour**.
- Les **Interrupts** sont payés en mémoire libre puis cette mémoire est libérée après leur résolution.
- Les **cadres parasites** n'ont pas d'effet, ne libèrent pas de mémoire et ne modifient jamais **R**.
- Les textes de pioche font référence aux **deux piles** quand c'est pertinent.
- Ce set est prévu pour accompagner les règles V5.4 harmonisées.
- Aucune carte supplémentaire n’est modifiée en V5.4 par rapport aux rééquilibrages V5.3.
- **Pioche F(R)** reste non plafonnée.