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

1. Copier `internet/v2/public/api/config.example.php` en `config.php`.
2. Modifier les paramètres de connexion à votre base MySQL/MariaDB.
3. Importer `internet/v2/public/api/schema.sql` dans la base.
4. Déployer `internet/v2/public/` sur votre serveur PHP.
5. Créer une partie serveur ou rejoindre une partie existante depuis l’écran d’accueil.

## Checklist manuelle

- Démarrer une partie locale.
- Respecter l’ordre des phases : mise à jour → pioche → conception → fin de tour.
- Vérifier que la pioche de tour tire une carte Système, pas une nouvelle Fonction.
- Lancer une fonction et atteindre [0].
- Dépiler le cas de base puis terminer une fonction.
- Vérifier qu’une Fonction terminée déclenche une pioche automatique de remplacement.
- Déclencher un overflow sur le 7e cadre.
- Nettoyer une fonction cassée.
- Sauvegarder et recharger en local.
- Exporter et importer une partie JSON.
- Si l’API est disponible : créer une partie serveur, enregistrer et charger une partie distante.
