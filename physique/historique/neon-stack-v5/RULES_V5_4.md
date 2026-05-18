# NEON STACK — Règles officielles V5.4 harmonisées


## Nouveautés V5.4
Cette version conserve la structure V5.3 et intègre la règle d'épuisement validée après les simulations :
- si un joueur doit piocher alors que ses deux piles sont vides, il perd 1 mémoire totale au lieu de perdre immédiatement ;
- si cette perte rend sa mémoire utilisée supérieure à sa mémoire totale, il effectue immédiatement un reboot forcé ;
- lors d’un reboot, volontaire ou forcé, la défausse est remélangée dans les deux piles selon le type des cartes ;
- la pioche F(R) n’est pas plafonnée ;
- les cartes V5.3 rééquilibrées, Overclocking et Bombe à Retours, restent inchangées.

## 1. Idée générale
Chaque joueur construit un **programme** en lançant, en faisant évoluer, puis en terminant plusieurs **fonctions**.

Le jeu repose sur :
- la **mémoire** ;
- les **piles d’appels** ;
- les **fonctions cassées** ;
- les **cadres parasites** ;
- les effets de récursion.

Il n’y a plus de combat entre unités. La partie se joue sur la gestion de la mémoire, du tempo des fonctions, des perturbations adverses et du bon moment pour lancer ou sécuriser ses fonctions.

## 2. Condition de victoire
Un joueur gagne immédiatement s’il atteint **21 points ou plus**, à condition d’avoir terminé :
- au moins **4 fonctions** ;
- avec au moins **3 noms de fonctions différents**.

Un joueur conserve toujours ses points.

S’il atteint **21 points ou plus** sans remplir encore les autres conditions de victoire, il ne gagne pas immédiatement, mais garde ce total. Il gagne dès qu’un effet ou une terminaison ultérieure le laisse à **21 points ou plus** tout en remplissant aussi toutes les conditions de victoire.

## 3. Mise en place

### 3.1 Séparation des cartes
Chaque joueur sépare son paquet en **deux piles** :
- une **pile Fonctions**, contenant uniquement les cartes **Fonction** ;
- une **pile Système**, contenant les cartes **Commande**, **Interrupt** et **Hardware**.

Ces deux piles sont mélangées séparément.

### 3.2 Main de départ
Chaque joueur pioche **5 cartes** au total.
Pour la règle de base, on recommande :
- **3 cartes depuis la pile Fonctions** ;
- **2 cartes depuis la pile Système**.

### 3.3 Premier joueur
Le premier joueur est désigné aléatoirement.

Le premier joueur **ne pioche pas** à son premier tour.

### 3.4 Mulligan
Chaque joueur peut effectuer **un mulligan une seule fois** au début de la partie :
- il remélange sa main dans ses deux piles ;
- il repioche **5 cartes** selon la répartition de son choix ;
- puis il place **1 carte de sa main sous la pile de son choix**.

### 3.5 Épuisement de pioche
Si un joueur doit piocher une carte et que ses deux piles sont vides, il ne pioche pas.

À la place, il perd **1 mémoire totale**.

Si, après cette perte, sa **mémoire utilisée** dépasse sa **mémoire totale actuelle**, il effectue immédiatement un **reboot forcé**.

Si sa mémoire totale tombe à **0**, il perd immédiatement la partie.

## 4. Mémoire
Chaque joueur commence avec :
- **15 mémoire totale** ;
- **15 mémoire libre**.

La mémoire libre sert à payer :
- les **cartes** ;
- les **appels récursifs** supplémentaires ;
- certains effets demandant explicitement un paiement en mémoire.

La mémoire totale fixe la quantité maximale de mémoire qu’un joueur peut posséder.

On appelle **mémoire utilisée** la somme de :
- la mémoire réservée par les **Fonctions** actives ou cassées ;
- la mémoire occupée par les **Hardware** actifs.

Quand la mémoire totale baisse, la mémoire libre ne peut jamais rester supérieure à cette nouvelle mémoire totale : si c’est le cas, elle est réduite à cette nouvelle valeur.

## 5. Types de cartes
Il existe quatre types de cartes :

### Fonction
Carte principale du jeu. Elle crée une pile d’appels, produit des points et des effets.

### Commande
Carte jouée pendant ton tour.

### Interrupt
Carte jouée en réaction, pendant n’importe quel tour si sa condition est remplie et si son coût peut être payé.

### Hardware
Amélioration durable qui reste en jeu.

Le coût imprimé sur une carte est payé en **mémoire libre**, sauf mention contraire.

### 5.1 Paiement et libération de la mémoire
Quand une carte est jouée, son coût est payé immédiatement en mémoire libre.

- Une **Commande** libère sa mémoire dès que son effet est entièrement résolu.
- Un **Interrupt** libère sa mémoire dès que son effet est entièrement résolu.
- Un **Hardware** conserve sa mémoire occupée tant qu’il reste en jeu.
- Une **Fonction** conserve sa mémoire initiale réservée tant qu’elle est active, cassée, réparée ou en cours d’exécution.

La mémoire libre ne peut jamais descendre sous 0. Si un effet fait perdre plus de mémoire libre que le joueur n’en possède, elle devient simplement 0.

## 6. Fonctions actives et Hardware
Un joueur peut contrôler au maximum :
- **3 fonctions actives** ;
- **2 Hardware actifs**.

Un joueur ne peut pas jouer une Fonction s’il contrôle déjà **3 fonctions actives**.

Une Fonction active ne peut pas être défaussée volontairement tant qu’elle n’est pas terminée ou cassée, sauf effet de carte.

Si un joueur joue un Hardware alors qu’il en contrôle déjà **2**, il choisit immédiatement un de ses Hardware actifs et le met en défausse.

## 7. Coût mémoire des fonctions

### 7.1 Lancement d’une fonction
Quand une fonction est lancée :
- son **coût mémoire initial** est payé en mémoire libre ;
- cette mémoire devient alors **réservée** ;
- son **cadre initial** est placé dans sa pile ;
- cette mémoire reste occupée tant que la fonction n’est pas terminée, nettoyée, supprimée par effet, ou réparée selon le texte applicable.

### 7.2 Empilage supplémentaire
Chaque fois qu’une fonction reçoit un cadre récursif supplémentaire, son contrôleur doit payer :
- **1 mémoire libre**,

sauf si une carte modifie ce coût.

### 7.3 Libération de mémoire
Quand un **cadre récursif normal** est dépilé, la mémoire correspondant à cet appel est libérée.

Quand le **cadre initial** est dépilé, la mémoire initiale réservée par la fonction est libérée.

Les **cadres parasites** ne libèrent jamais de mémoire.

## 8. Phase de mise à jour des fonctions
Au début du tour d’un joueur, toutes ses **fonctions actives non cassées** passent par une **phase de mise à jour**, une par une.

Le **joueur actif choisit l’ordre** dans lequel ses fonctions actives non cassées sont mises à jour.

- Si une fonction **n’a pas encore atteint [0]**, elle **empile automatiquement** un nouveau cadre.
- Si une fonction **a déjà atteint [0]**, elle **dépile automatiquement** son cadre du sommet.

Les fonctions évoluent donc automatiquement :
- elles **descendent** jusqu’au cas de base ;
- puis elles **remontent** cadre après cadre jusqu’à terminaison.

Le joueur ne choisit pas, à ce stade, entre empiler ou dépiler : cela dépend uniquement de l’état de chaque fonction.

## 9. Empiler et dépiler

### 9.1 Empiler X
**Empiler X** signifie qu’une fonction a une profondeur cible fixe de **X**.

Quand elle est lancée, on place son cadre initial **[X]**.

Puis, à chaque mise à jour, si elle n’a pas encore atteint **[0]**, elle reçoit successivement :
**[X-1]**, puis **[X-2]**, etc., jusqu’à **[0]**.

### 9.2 Empiler jusqu’à X
**Empiler jusqu’à X** signifie que le joueur choisit, au lancement de la fonction, une profondeur cible comprise entre **0** et **X**.

Le cadre initial porte cette valeur choisie.

### 9.3 Dépiler
**Dépiler** consiste à retirer le cadre du sommet d’une pile et à appliquer son effet selon sa nature.

## 10. Atteindre [0], puis remonter
Une fonction ne peut pas dépiler tant qu’elle n’a pas atteint son cadre **[0]**.

Une fois le cadre **[0]** placé, la fonction entre en **phase de remontée**.

Une fonction en phase de remontée ne peut plus recevoir d’empilage normal.

Seuls les **effets de cartes** peuvent encore lui ajouter des cadres après cela.

## 11. Cas de base, remontée, terminaison
Le **cas de base** est le cadre **[0]**.

Il est :
- le **dernier cadre empilé normalement** ;
- le **premier cadre dépilé en remontée**.

Une fonction n’est pas terminée quand son cas de base est résolu.

Elle est terminée seulement quand son **cadre initial** — c’est-à-dire le premier cadre placé — est dépilé à son tour et que sa pile devient vide.

Chaque fonction peut donc avoir jusqu’à trois niveaux d’effet :
- **Cas de base** : effet du cadre **[0]** ;
- **Remontée** : effet des cadres supérieurs à **[0]** ;
- **Terminaison** : effet final, appliqué seulement quand la pile de la fonction devient vide.

## 12. Valeur de récursion
On note **R** la valeur de récursion de la fonction.

La valeur de **R** est fixée **au lancement** de la fonction :
- si la carte dit **Empiler X**, alors **R = X** ;
- si la carte dit **Empiler jusqu’à X**, alors **R** est égal à la profondeur choisie au lancement.

Les **cadres parasites** ne modifient jamais **R**.

Les cadres ajoutés par un effet de carte ne modifient pas **R**, sauf mention explicite du contraire.

Le bonus de récursion suit la **suite de Fibonacci classique** :
- F(0) = 0
- F(1) = 1
- F(2) = 1
- F(3) = 2
- F(4) = 3
- F(5) = 5
- F(6) = 8

## 13. Score d’une fonction terminée
La **valeur** imprimée sur une carte Fonction correspond à ses **points de base**.

Quand une fonction se termine :
1. son contrôleur marque ses **points de base** ;
2. il ajoute un bonus de récursion égal à **F(R)** ;
3. il résout l’effet de **Terminaison** ;
4. la fonction est défaussée ;
5. toute la mémoire qu’elle occupait est libérée.

## 14. Fonctions cassées
Une fonction casse si :
- elle devrait **empiler** mais son contrôleur n’a pas assez de mémoire libre pour payer cet appel ;
- elle devrait recevoir un cadre au-delà de la limite autorisée ;
- un effet de carte la casse explicitement.

Une fonction cassée :
- reste en jeu ;
- ne peut plus être empilée ni dépilée ;
- ne rapporte aucun point ;
- continue d’occuper toute la mémoire déjà engagée ;
- compte toujours dans la limite des fonctions actives.

## 15. Nettoyer et réparer

### Nettoyer
**Nettoyer** une fonction cassée consiste à la défausser.
Toute sa mémoire est alors libérée.

### Réparer
**Réparer** une fonction cassée consiste à la remettre en état selon le texte de la carte utilisée.

Par défaut, une fonction réparée revient avec :
- sa **mémoire initiale toujours réservée** ;
- son **cadre initial seulement** ;
- **aucun cadre parasite**, sauf mention contraire.

## 16. Reboot
À la place de toute autre action pendant son tour, un joueur peut effectuer un **reboot**.

Dans ce cas :
- toutes ses **fonctions actives**, intactes ou cassées, sont défaussées ;
- toutes leurs piles sont retirées **sans produire d’effet** ;
- il récupère immédiatement toute la mémoire occupée par ses fonctions ;
- ses **Hardware** restent en jeu et continuent d’occuper leur mémoire ;
- il défausse toute sa main ;
- il mélange sa défausse dans ses deux piles de pioche, en respectant les types :
  - les cartes **Fonction** retournent dans la **pile Fonctions** ;
  - les cartes **Commande**, **Interrupt** et **Hardware** retournent dans la **pile Système** ;
- il pioche **5 nouvelles cartes**, si possible ;
- il ne peut effectuer **aucune autre action** ce tour-ci.

Le reboot sert à sortir d’une situation bloquée. En V5.4, il représente un vrai redémarrage du système : les ressources déjà utilisées sont relâchées et les cartes de la défausse sont recyclées dans les deux piles.

### 16.1 Reboot forcé
Un **reboot forcé** peut être provoqué par l’épuisement de pioche.

Un reboot forcé suit les règles normales du reboot, sauf que :
- il se produit immédiatement ;
- il ne remplace pas l’action de conception du tour, puisqu’il n’est pas choisi volontairement ;
- il ne permet de piocher que si au moins une des deux piles contient des cartes après le mélange de la défausse.

## 17. Cadres parasites
Certains effets ajoutent des **cadres parasites**.

Un cadre parasite :
- compte pour la taille de la pile ;
- doit être dépilé normalement ;
- n’applique **aucun Cas de base**, **aucune Remontée**, **aucune Terminaison** ;
- ne libère **pas** de mémoire lorsqu’il est dépilé ;
- ne modifie jamais **R**.

Les cadres parasites représentent des appels parasites ou des encombrements de pile. Ils ralentissent ou perturbent la fonction, sans produire d’effet utile.

### 17.1 Parasite ajouté avant [0]
Un cadre parasite ajouté avant que la fonction atteigne **[0]** ne bloque pas la descente.

Lors des mises à jour suivantes, la fonction continue d’empiler les cadres récursifs attendus jusqu’à atteindre **[0]**.

Les cadres parasites seront dépilés pendant la remontée lorsqu’ils arriveront au sommet.

## 18. Cadres ajoutés par effet
Quand un effet ajoute un **cadre récursif normal** à une fonction, ce cadre est ajouté du côté du **plus grand cadre**.

Sa valeur est égale à la plus grande valeur déjà présente, **plus 1**.

En revanche, si une carte dit qu’elle ajoute un **cadre parasite**, elle ajoute bien un cadre parasite, et non un cadre récursif normal.

Quand un effet ajoute plusieurs cadres, ils sont ajoutés **un par un**.

## 19. Overflow
Une pile ne peut contenir que **7 cadres**.

Si un effet ou une mise à jour devrait ajouter un **8e cadre**, il y a immédiatement **overflow** :
- la fonction casse aussitôt ;
- les ajouts restants ne sont pas appliqués ;
- la pile n’est plus résolue normalement ensuite.

La fonction reste en jeu comme fonction cassée.

## 20. Épuisement de pioche et perte de mémoire totale
Si un joueur doit piocher une carte et que ses deux piles sont vides, il ne pioche pas et perd **1 mémoire totale**.

Après cette perte :
1. si sa mémoire libre est supérieure à sa nouvelle mémoire totale, elle est réduite à cette nouvelle valeur ;
2. si sa mémoire utilisée dépasse sa mémoire totale actuelle, il effectue immédiatement un **reboot forcé** ;
3. si sa mémoire totale tombe à **0**, il perd immédiatement la partie.

La pioche **F(R)** n’est pas plafonnée en V5.4.

## 21. Commandes, Interrupts et mémoire
Les **Commandes** sont jouées pendant ton tour. Les **Interrupts** peuvent être joués pendant n’importe quel tour, dès que leur condition de déclenchement est remplie et que leur coût peut être payé.

Une Commande ou un Interrupt est payé en **mémoire libre** au moment où il est joué.

Une fois la Commande ou l’Interrupt entièrement résolu, la mémoire utilisée pour le payer est **immédiatement libérée**.

Ainsi :
- une Commande ou un Interrupt doit bien pouvoir être payé ;
- mais il n’occupe pas durablement de mémoire comme une Fonction ou un Hardware.

## 22. Ordre de réaction
Quand un événement déclencheur se produit :
1. le joueur **non actif** a la première possibilité de jouer un Interrupt ;
2. puis les joueurs alternent, **un Interrupt à la fois** ;
3. les Interrupts se résolvent ensuite dans **l’ordre inverse de leur pose** ;
4. un joueur qui veut répondre à un Interrupt doit le faire immédiatement ;
5. un joueur ne peut pas attendre puis revenir plus tard dans la même séquence.

Si les deux joueurs passent successivement, la séquence de réaction s’achève et le jeu reprend.

## 23. Empilage annulé
Quand un **empilage** est annulé :
- le cadre n’est pas ajouté ;
- la **mémoire libre** correspondant à cet empilage n’est **pas payée**.

## 24. Cas particulier : Débogueur pas à pas
Si **Débogueur pas à pas** annule une casse puis dépile le dernier cadre d’une fonction, cette fonction est défaussée :
- **sans marquer de points** ;
- **sans appliquer d’effet de Terminaison**.

Si le cadre dépilé était le **cadre initial**, la mémoire initiale de cette fonction est libérée normalement.

Ainsi, **Débogueur pas à pas** peut sauver une fonction d’une casse, mais ne transforme jamais cette casse en terminaison gratuite.

## 25. Déroulement d’un tour
1. **Phase de mise à jour** : le joueur actif choisit l’ordre de mise à jour de ses fonctions actives non cassées.
   - si elles n’ont pas atteint **[0]**, elles empilent ;
   - sinon, elles dépilent.

2. **Pioche** : le joueur pioche **1 carte** dans la pile de son choix :
   - **pile Fonctions**
   - ou **pile Système**
   Le premier joueur ne pioche pas à son premier tour.
   Si les deux piles sont vides au moment où le joueur doit piocher, il applique la règle d’**épuisement de pioche**.

3. **Conception** : le joueur peut jouer des Fonctions, des Commandes et des Hardware tant qu’il peut payer leur coût, ou choisir d’effectuer un **reboot** à la place de toute autre action.

4. **Fin de tour** : les effets temporaires cessent ; la mémoire libre temporaire non dépensée disparaît.


## 26. Cartes rééquilibrées conservées en V5.4

### Overclocking
**Hardware — coût 2**

Au début de chacun de tes tours, tu peux choisir une de tes fonctions. Elle effectue immédiatement une mise à jour supplémentaire.

Si elle ne termine pas ce tour-ci, perds 1 mémoire libre à la fin du tour.

Cette mise à jour supplémentaire a lieu au début de la phase de mise à jour, avant les mises à jour normales.

### Bombe à Retours
**Fonction — coût 4 — valeur 3 — Empiler 4**

- **Cas de base** : Pioche 1 carte.
- **Remontée** : Au prochain tour adverse, la première fonction adverse mise à jour en phase de descente ignore sa mise à jour.
- **Terminaison** : L’adversaire perd 2 mémoire libre au début de son prochain tour.

Si plusieurs effets de Bombe à Retours devraient s’appliquer au même tour adverse, un seul de ces effets s’applique.

## 27. Intention pédagogique
Le jeu doit faire sentir que :
- la récursion profonde est rentable, mais plus lente à mener jusqu’au score ;
- les fonctions évoluent automatiquement : elles descendent jusqu’au cas de base, puis remontent ;
- la mémoire engagée devient une vraie contrainte ;
- les cadres parasites ralentissent ou perturbent l’exécution ;
- une fonction cassée est une fuite durable ;
- les outils de nettoyage, de réparation et de protection ont une vraie valeur ;
- bien choisir quand lancer une nouvelle fonction est essentiel, car son évolution se poursuivra ensuite automatiquement.
