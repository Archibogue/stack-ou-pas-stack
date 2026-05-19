# Stack ou pas Stack

Jeu pédagogique sur la récursion, la mémoire, les piles d’appels, les fonctions cassées et l’overflow.

**Statut** : bêta jouable / prototype pédagogique.

**Public visé** : enseignants NSI/SNT, élèves et testeurs.

**Version recommandée** : **Stack ou pas Stack — initiation quadratique**, en version physique ou web V2.

Cette version est encore en test. Les retours de partie, corrections de règles et signalements de bugs sont bienvenus.

Le dépôt est séparé en deux parties.

## Démarrage rapide

- [`QUICKSTART.md`](QUICKSTART.md) : imprimer, tester en local ou héberger la V2.
- [`CONTRIBUTING.md`](CONTRIBUTING.md) : proposer un bug, une carte, une règle ou une amélioration web.
- [`SECURITY.md`](SECURITY.md) : précautions pour l’API PHP/MySQL et les fichiers sensibles.
- [`RELEASE_CHECKLIST.md`](RELEASE_CHECKLIST.md) : vérifications avant diffusion.
- [`internet/v2/README.md`](internet/v2/README.md) : détails de la version web V2.
- [`physique/initiation/regles/REGLES_INITIATION_QUADRATIQUE.md`](physique/initiation/regles/REGLES_INITIATION_QUADRATIQUE.md) : règles physiques actives.
- [`physique/initiation/cartes/CARD_SET_INITIATION_QUADRATIQUE.md`](physique/initiation/cartes/CARD_SET_INITIATION_QUADRATIQUE.md) : deck d’initiation.

## 1. Version physique

Dossier : [`physique/`](physique/)

Cette partie contient les règles et les ressources destinées au jeu sur table :

- règles d’initiation quadratique ;
- composition des decks ;
- fichiers imprimables ;
- archives des versions Neon Stack V5.

Version active : **Stack ou pas Stack — initiation quadratique**.

Paramètres principaux :

- mémoire de départ : 11 / 11 ;
- victoire : 11 points ;
- condition : 3 fonctions terminées avec 2 noms différents ;
- bonus : `B(R)=R²` ;
- overflow : casse au 7e cadre ;
- Stack Spike : cible 4 ou 5 cadres.

## 2. Version internet

Dossier : [`internet/`](internet/)

Cette partie contient une version jouable en navigateur.

- V1/V1.1 reste disponible dans `internet/index.html` comme version historique jouable en fichier HTML autonome.
- V2 est disponible dans `internet/v2/public/index.html` : version recommandée pour test web, avec architecture séparée, moteur centralisé, sauvegarde locale et API PHP/MySQL optionnelle.

La règle d’ordre obligatoire d’un tour, utilisée par la version physique active et reprise par la V2, est :

1. phase de mise à jour ;
2. phase de pioche ;
3. phase de conception ;
4. fin de tour.

## Organisation

```text
stack-ou-pas-stack/
├── physique/
│   ├── initiation/
│   │   ├── regles/
│   │   ├── cartes/
│   │   └── impression/
│   └── historique/
│       └── neon-stack-v5/
├── internet/
│   ├── index.html
│   └── v2/
│       ├── public/
│       │   ├── assets/
│       │   │   ├── css/
│       │   │   └── js/
│       │   ├── api/
│       │   └── index.html
│       ├── tests/
│       ├── README.md
│       └── CHANGELOG.md
├── docs/
│   └── ROADMAP.md
├── README.md
├── CHANGELOG.md
├── NOTICE.md
└── LICENSE.md
```

## Licence

Le dépôt utilise une licence en deux volets :

- code source : **MIT** ;
- règles, cartes, documents pédagogiques et kits d'impression : **Creative Commons BY-NC-SA 4.0**.

Cette licence permet le partage gratuit, l'impression et l'adaptation des contenus de jeu, avec attribution, sans usage commercial, et avec repartage sous les mêmes conditions.

Voir [`LICENSE.md`](LICENSE.md).

Attribution prête à réutiliser : [`NOTICE.md`](NOTICE.md).

## Commandes Git utiles

```bash
git status
git log --oneline
git remote add origin git@github.com:TON-COMPTE/stack-ou-pas-stack.git
git push -u origin main
```
