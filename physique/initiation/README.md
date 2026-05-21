# Stack ou pas Stack — Initiation quadratique

Ce dossier contient la version physique active du jeu. C’est le point d’entrée à utiliser pour jouer, imprimer ou relire les règles.

## Contenu

- [`regles/REGLES_INITIATION_QUADRATIQUE.md`](regles/REGLES_INITIATION_QUADRATIQUE.md) : règles complètes.
- [`cartes/CARD_SET_INITIATION_QUADRATIQUE.md`](cartes/CARD_SET_INITIATION_QUADRATIQUE.md) : liste des cartes et quantités.
- [`cartes/stack_ou_pas_stack_cartes_png_quadratique.zip`](cartes/stack_ou_pas_stack_cartes_png_quadratique.zip) : export PNG des cartes.
- [`impression/plateau_compact_2xA4_v3b.pdf`](impression/plateau_compact_2xA4_v3b.pdf) : plateau compact.
- [`impression/stack_ou_pas_stack_initiation_quadratique_planches_recto_verso.pdf`](impression/stack_ou_pas_stack_initiation_quadratique_planches_recto_verso.pdf) : planches de cartes recto verso.
- [`impression/stack_ou_pas_stack_initiation_quadratique_J1_recto_verso.pdf`](impression/stack_ou_pas_stack_initiation_quadratique_J1_recto_verso.pdf) : deck joueur 1.
- [`impression/stack_ou_pas_stack_initiation_quadratique_J2_recto_verso.pdf`](impression/stack_ou_pas_stack_initiation_quadratique_J2_recto_verso.pdf) : deck joueur 2.
- [`impression/stack_ou_pas_stack_regles_initiation_quadratique.pdf`](impression/stack_ou_pas_stack_regles_initiation_quadratique.pdf) : règles en PDF.

## Génération des planches

Les planches de cartes sont générées depuis les définitions de la version web :

```bash
node physique/initiation/scripts/generate-print-assets.mjs
```

Le script régénère les HTML sources, les PDF J1/J2/global, le ZIP PNG des cartes et le ZIP du kit d’impression web.

## Paramètres rapides

- Mémoire : 11 / 11.
- Victoire : 11 points.
- Condition qualitative : 3 fonctions terminées avec au moins 2 noms différents.
- Bonus : `B(R)=R²`.
- Overflow : casse au 7e cadre.
- Decks : 26 cartes par joueur.
