# Quickstart

Guide court pour partager, tester ou héberger une bêta jouable de **Stack ou pas Stack**.

## Jouer avec la version physique

- Règles : [`physique/initiation/regles/REGLES_INITIATION_QUADRATIQUE.md`](physique/initiation/regles/REGLES_INITIATION_QUADRATIQUE.md).
- Cartes : [`physique/initiation/cartes/CARD_SET_INITIATION_QUADRATIQUE.md`](physique/initiation/cartes/CARD_SET_INITIATION_QUADRATIQUE.md).
- Kit d’impression : [`physique/initiation/impression/`](physique/initiation/impression/).
- Kit web téléchargeable depuis la V2 : [`internet/v2/public/assets/downloads/stack-ou-pas-stack-kit-impression-physique.zip`](internet/v2/public/assets/downloads/stack-ou-pas-stack-kit-impression-physique.zip).

Version recommandée : **initiation quadratique**.

## Tester la version web en local

Depuis la racine du dépôt :

```bash
php -S 127.0.0.1:8765 -t internet/v2/public
```

Puis ouvrir :

```text
http://127.0.0.1:8765/
```

La V2 peut aussi fonctionner en partie locale avec sauvegarde navigateur et export/import JSON. L’API PHP/MySQL est optionnelle.

Pour lancer les tests moteur :

```bash
node internet/v2/tests/engine.test.mjs
```

ou, si `npm` est disponible :

```bash
npm test
```

## Héberger la V2 sur un serveur PHP/MySQL

1. Déployer le contenu de [`internet/v2/public/`](internet/v2/public/) sur un serveur PHP.
2. Importer [`internet/v2/public/api/schema.sql`](internet/v2/public/api/schema.sql) dans la base MySQL.
3. Laisser [`internet/v2/public/api/config.example.php`](internet/v2/public/api/config.example.php) comme modèle.
4. Créer localement sur le serveur un fichier `internet/v2/public/api/config.php` si une base dédiée est nécessaire.

`config.php` ne doit jamais être versionné : il contient les identifiants réels. Le dépôt ignore déjà `internet/v2/public/api/config.php`.

Si la V2 est hébergée sous WordPress, l’API peut aussi réutiliser `wp-config.php` sans créer de `config.php`.
