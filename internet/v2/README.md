# Stack ou pas Stack — V2

Version web V2 hébergeable pour le jeu d’initiation quadratique.

## Objectifs

- Séparer clairement le moteur, les données, l’interface et la persistance.
- Créer une version jouable en mode local/hot-seat.
- Ajouter une couche API PHP optionnelle pour hébergement mutualisé PHP/MySQL.
- Garder une architecture simple sans framework lourd.

## Dossier principal

`internet/v2/public/`

- `index.html` : point d’entrée de l’application.
- `regles.html` : page autonome avec les règles complètes et la référence des cartes.
- `assets/css/app.css` : styles centralisés.
- `assets/js/` : modules JavaScript séparés.
- `api/` : endpoints PHP optionnels.

## Tester localement

1. Ouvrir `internet/v2/public/index.html` dans un navigateur moderne.
2. Créer une partie locale depuis l’écran d’accueil.
3. Jouer en hot-seat entre deux joueurs.
4. Utiliser les boutons `Exporter` / `Importer` pour sauvegarder et restaurer une partie JSON.

Pour tester avec les modules JavaScript dans des conditions proches du déploiement :

```bash
php -S 127.0.0.1:8765 -t internet/v2/public
```

Puis ouvrir `http://127.0.0.1:8765/`.

## Tests moteur

Les tests restent volontairement simples et sans framework externe :

```bash
node internet/v2/tests/engine.test.mjs
```

Ils vérifient les constantes de règles, la composition du deck par rapport au Markdown physique, la main de départ, la pioche Système, le remplacement automatique des Fonctions terminées, le cycle mémoire des fonctions, le Planificateur local, Hotfix et le reboot volontaire.

## Tester avec API PHP/MySQL

L’API PHP/MySQL est optionnelle et pensée pour un usage pédagogique / prototype. La V2 reste jouable sans serveur de base de données grâce à la sauvegarde locale et à l’export/import JSON.

1. Si la V2 est placée sous un site WordPress, laisser `api/config.php` absent : l’API cherche automatiquement `wp-config.php` dans les dossiers parents ou dans `DOCUMENT_ROOT` et réutilise les constantes `DB_NAME`, `DB_USER`, `DB_PASSWORD` et `DB_HOST`.
2. Importer `internet/v2/public/api/schema.sql` dans la base WordPress. Les tables du jeu utilisent le préfixe `sops_`, actuellement `sops_games`.
3. Déployer `internet/v2/public/` sur votre serveur PHP.
4. Créer une partie serveur ou rejoindre une partie existante depuis l’écran d’accueil.

Pour forcer une base dédiée hors WordPress, copier `internet/v2/public/api/config.example.php` en `config.php` et modifier les paramètres côté serveur.

Ne versionnez jamais `internet/v2/public/api/config.php` : ce fichier contient les identifiants réels. `config.example.php` est seulement un modèle.

## Checklist manuelle

- Démarrer une partie locale.
- Respecter l’ordre des phases : mise à jour → pioche → conception → fin de tour.
- Vérifier que la pioche de tour tire une carte Système, pas une nouvelle Fonction.
- Lancer une fonction et atteindre [0].
- Dépiler le cas de base puis terminer une fonction.
- Vérifier qu’une Fonction terminée déclenche une pioche automatique de remplacement.
- Vider les deux piles puis vérifier l’épuisement de pioche : -1 mémoire totale, défaite immédiate à 0, ou reboot forcé si la mémoire utilisée dépasse la mémoire totale.
- Déclencher un overflow sur le 7e cadre.
- Nettoyer une fonction cassée.
- Réparer une fonction cassée et vérifier qu’elle revient avec son cadre initial seulement.
- Sauvegarder et recharger en local.
- Exporter et importer une partie JSON.
- Si l’API est disponible : créer une partie serveur, enregistrer et charger une partie distante.

## Licence

Le code de la V2 est distribué sous licence **MIT**.

Les textes de règles, cartes et contenus pédagogiques affichés ou repris par la V2 restent distribués sous licence **Creative Commons BY-NC-SA 4.0**.

Voir [`../../LICENSE.md`](../../LICENSE.md).
