# Changelog V2

## Kit physique initiation quadratique — textes clarifiés

- Textes des cartes V2 alignés avec le kit physique imprimable.
- Pioches Système explicitées dans les cartes concernées.
- Overclocking déplacé en fin de phase de mise à jour, avec choix `Utiliser Overclocking` / `Passer Overclocking`.
- Clarification de Swap Brutal, Débogueur pas à pas et des cibles à soi ou adverses.
- Régénération des planches PDF, de l’export PNG et du ZIP téléchargeable depuis la V2.

## V2 solo RC

- Ajout du mode solo local contre l'ordinateur.
- Bot progressif via `runBotStep()` avec délai perceptible entre les actions.
- Profils `pedagogique`, `equilibre` et `agressif`.
- Décisions du bot expliquées dans le journal.
- Garde-fous anti-boucles, blocage correct sur les décisions humaines et résolution automatique des effets du bot.
- Tests renforcés pour le solo, les réactions, l'import/export et les tours complets du bot.
- Affichage plus lisible des actions en cours avec badge de réflexion et message temporaire non bloquant.

## 0.2.2 — Préparation au partage bêta

- Clarification du caractère optionnel et pédagogique de l’API PHP/MySQL dans la documentation V2.
- Rappel que `api/config.php` ne doit pas être versionné et que `config.example.php` sert de modèle.
- Vérification de cohérence des constantes V2 avec les règles physiques d’initiation quadratique.

## 0.2.1 — Stabilisation moteur

- Ajout de tests moteur sans framework dans `internet/v2/tests/`.
- Alignement des descriptions de `cards.js` sur les phases des règles : cas de base, remontée, terminaison.
- Stabilisation de la mémoire des fonctions, du reboot, d’Overclocking et des cibles de cartes.
- Correction du rattachement des parties serveur et de la détection d’API.

## 0.2.0 — Version internet V2

- Ajout d’une version web V2 hébergeable avec architecture séparée.
- Moteur de jeu centralisé dans `game-engine.js`.
- État de jeu, règles et cartes séparés en modules.
- Interface claire avec phases, log, points, mémoire, piles, cartes et fonctions actives.
- Sauvegarde locale, export/import JSON et détection d’API PHP optionnelle.
- API PHP simple avec création, chargement et sauvegarde de parties.
- Documentation de test local et serveur.
