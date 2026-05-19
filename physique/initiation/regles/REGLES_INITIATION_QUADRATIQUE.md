# Stack ou pas Stack — Règles d’initiation quadratique

Version physique d’initiation, issue de Neon Stack V5.4 mais accélérée pour des parties courtes.

## Paramètres de partie

- **Mémoire de départ** : 11 mémoire totale / 11 mémoire libre.
- **Condition de victoire** : 11 points ou plus.
- **Condition qualitative** : au moins 3 fonctions terminées, avec au moins 2 noms de fonctions différents.
- **Limite de pile** : une fonction casse si elle devrait recevoir un 7e cadre.
- **Bonus de récursion** : `B(R)=R²`.
- **Decks** : deux decks d’initiation symétriques de 26 cartes.

## Mise en place

Chaque joueur sépare son deck en deux piles :

1. **Pile Fonctions** : uniquement les cartes Fonction.
2. **Pile Système** : Commandes, Interrupts et Hardware.

Chaque joueur pioche 5 cartes au total. Répartition conseillée :

- 3 cartes depuis la pile Fonctions ;
- 2 cartes depuis la pile Système.

Le premier joueur ne pioche pas au premier tour.

## Ordre obligatoire d’un tour

Au tout début de son tour, le joueur peut effectuer un reboot volontaire s’il n’a encore fait aucune autre action ce tour-ci.

S’il ne reboote pas, chaque tour suit ensuite obligatoirement cet ordre :

1. **Phase de mise à jour** : toutes les fonctions actives non cassées du joueur actif sont mises à jour, dans l’ordre choisi par ce joueur.
2. **Phase de pioche** : le joueur pioche 1 carte dans la pile Système.
3. **Phase de conception** : le joueur peut jouer des Fonctions, Commandes et Hardware.
4. **Fin de tour** : les effets temporaires cessent.

Aucune carte ne peut être jouée avant la phase de conception, sauf les Interrupts. Une Interrupt peut être jouée pendant le tour adverse quand sa condition de réaction est explicitement remplie et qu’une cible légale existe.

La phase de pioche ne permet pas de tirer une nouvelle Fonction. Une Fonction est piochée automatiquement uniquement quand le joueur vient d’en terminer une, ou pendant un reboot qui redonne une main de départ.

## Fonctionnement des fonctions

Quand une fonction est lancée, son contrôleur choisit sa profondeur `R` si la carte indique « Empiler jusqu’à X ». Pour une carte « Empiler X », `R=X`.

La fonction place d’abord son cadre initial `[R]`. À chaque phase de mise à jour :

- si elle n’a pas encore atteint `[0]`, elle empile le cadre suivant ;
- si elle a déjà atteint `[0]`, elle dépile le cadre du sommet.

Le joueur ne choisit pas entre empiler ou dépiler. L’état de la fonction le détermine.

## Cas de base, remontée, terminaison

- Le cadre `[0]` déclenche le **cas de base**.
- Les cadres supérieurs à `[0]` déclenchent la **remontée**.
- La fonction se termine seulement quand son cadre initial est dépilé et que sa pile devient vide.

Quand une fonction se termine :

1. elle rapporte ses points de base ;
2. elle ajoute le bonus `B(R)=R²` ;
3. elle applique son effet de terminaison ;
4. elle libère sa mémoire ;
5. elle va en défausse ;
6. son contrôleur pioche automatiquement 1 nouvelle carte Fonction, si possible.

## Bonus quadratique

| R | 0 | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|---|
| B(R)=R² | 0 | 1 | 4 | 9 | 16 | 25 |

## Fonctions cassées

Une fonction casse si :

- elle doit empiler mais son contrôleur ne peut pas payer la mémoire ;
- elle devrait recevoir un 7e cadre ;
- un effet de carte la casse explicitement.

Une fonction cassée reste en jeu, continue d’occuper sa mémoire et ne rapporte aucun point tant qu’elle n’est pas nettoyée ou réparée.

## Cadres parasites

Un cadre parasite :

- compte dans la taille de la pile ;
- doit être dépilé normalement ;
- ne produit aucun effet ;
- ne libère pas de mémoire ;
- ne modifie jamais `R`.

Un parasite ajouté avant `[0]` ne bloque pas la descente : la fonction continue jusqu’au cas de base, puis les parasites seront dépilés pendant la remontée.

## Stack Spike

**Stack Spike** se joue sur une fonction contenant exactement **4 ou 5 cadres**. Elle ajoute 2 cadres parasites. Si cela devait créer un 7e cadre, la fonction casse immédiatement.

## Reboot

Au début de son tour, avant toute autre action du tour, un joueur peut effectuer un reboot volontaire. S’il a déjà mis à jour une fonction, pioché ou joué une carte ce tour-ci, il ne peut plus rebooter volontairement.

Le reboot volontaire remplace toutes ses autres actions du tour :

- il défausse ses fonctions actives ;
- il retire les piles associées sans effet ;
- il libère la mémoire occupée par les fonctions ;
- il défausse sa main ;
- il remélange sa défausse dans les deux piles selon le type des cartes ;
- il repioche une main de départ si possible : 3 cartes Fonctions et 2 cartes Système.
