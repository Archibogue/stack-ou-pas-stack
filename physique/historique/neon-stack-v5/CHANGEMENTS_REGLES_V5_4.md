# NEON STACK — Changements règles V5.4

Cette fiche liste les changements entre la V5.3 et la V5.4.

## 1. Épuisement de pioche

### Ancienne logique V5.3
Un joueur perdait la partie s’il devait piocher alors qu’il ne pouvait piocher ni dans sa pile Fonctions ni dans sa pile Système.

### Nouvelle logique V5.4
Si un joueur doit piocher une carte et que ses deux piles sont vides :
- il ne pioche pas ;
- il perd 1 mémoire totale ;
- si sa mémoire totale tombe à 0, il perd immédiatement la partie.

## 2. Mémoire utilisée

La V5.4 précise la notion de **mémoire utilisée**.

La mémoire utilisée correspond à la somme de :
- la mémoire réservée par les Fonctions actives ou cassées ;
- la mémoire occupée par les Hardware actifs.

Si une perte de mémoire totale rend la mémoire utilisée supérieure à la mémoire totale actuelle, le joueur effectue immédiatement un reboot forcé.

## 3. Reboot avec recyclage de la défausse

Lors d’un reboot, volontaire ou forcé :
- les fonctions actives sont défaussées ;
- les piles associées aux fonctions sont retirées sans effet ;
- la main est défaussée ;
- la défausse est remélangée dans les deux piles de pioche selon le type des cartes :
  - les Fonctions retournent dans la pile Fonctions ;
  - les Commandes, Interrupts et Hardware retournent dans la pile Système ;
- le joueur pioche 5 cartes, si possible.

## 4. Reboot forcé

Un reboot forcé suit les règles normales du reboot, sauf qu’il se produit immédiatement et ne remplace pas l’action de conception du tour.

## 5. Pioche F(R)

La pioche F(R) n’est pas plafonnée en V5.4.

## 6. Cartes

Aucune nouvelle carte n’est modifiée en V5.4.

Les deux cartes rééquilibrées en V5.3 restent inchangées :
- Bombe à Retours ;
- Overclocking.
