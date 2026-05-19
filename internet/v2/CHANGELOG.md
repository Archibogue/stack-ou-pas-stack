# Changelog V2

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
