# Contribuer

Merci de contribuer à **Stack ou pas Stack**. Le projet est une bêta jouable : les retours de partie sont aussi utiles que les corrections de code.

## Signaler un bug

Ouvrir une Issue GitHub avec :

- la version testée : physique, V1/V1.1 ou V2 ;
- les étapes pour reproduire ;
- le comportement observé ;
- le comportement attendu ;
- si possible, une capture ou un export JSON de partie V2.

## Proposer une correction de règle

Indiquer le fichier concerné, la phrase actuelle, la correction proposée et la raison pédagogique ou ludique. Les règles actives sont dans [`physique/initiation/regles/REGLES_INITIATION_QUADRATIQUE.md`](physique/initiation/regles/REGLES_INITIATION_QUADRATIQUE.md).

## Proposer une carte

Décrire :

- le nom de la carte ;
- son type ;
- son coût ;
- son effet ;
- l’intention pédagogique ;
- les risques d’équilibrage.

Les cartes existantes sont documentées dans [`physique/initiation/cartes/CARD_SET_INITIATION_QUADRATIQUE.md`](physique/initiation/cartes/CARD_SET_INITIATION_QUADRATIQUE.md).

## Proposer une amélioration web

Préciser si la proposition concerne l’interface, le moteur, la sauvegarde locale, l’API PHP/MySQL ou les tests. La V2 est décrite dans [`internet/v2/README.md`](internet/v2/README.md).

## Tests avant une PR

Avant d’ouvrir une Pull Request, lancer :

```bash
npm test
```

ou directement :

```bash
node internet/v2/tests/engine.test.mjs
```

Si une modification touche les règles ou les cartes, vérifier aussi que le Markdown physique reste cohérent avec `internet/v2/public/assets/js/rules.js` et `internet/v2/public/assets/js/cards.js`.

## Licence

Le dépôt utilise une double licence :

- code source : **MIT** ;
- règles, cartes, documents pédagogiques et kits d’impression : **Creative Commons BY-NC-SA 4.0**.

Toute contribution doit respecter cette séparation.
