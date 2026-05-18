# Stack ou pas Stack

Jeu pédagogique sur la récursion, la mémoire, les piles d’appels, les fonctions cassées et l’overflow.

Le dépôt est séparé en deux parties.

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

- V1 reste disponible dans `internet/index.html`.
- V2 est disponible dans `internet/v2/public/index.html` : architecture séparée, moteur centralisé, sauvegarde locale et API PHP optionnelle.

La V1.1 impose l’ordre obligatoire d’un tour :

1. phase de mise à jour ;
2. phase de pioche ;
3. phase de conception ;
4. fin de tour.

## Organisation

```text
stack-ou-pas-stack/
├── physique/
│   ├── regles/
│   ├── cartes/
│   ├── impression/
│   └── archives-v5/
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
└── LICENSE.md
```

## Commandes Git utiles

```bash
git status
git log --oneline
git remote add origin git@github.com:TON-COMPTE/stack-ou-pas-stack.git
git push -u origin main
```
