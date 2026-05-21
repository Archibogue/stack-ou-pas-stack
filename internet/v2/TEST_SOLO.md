# Test manuel V2 solo

## Lancement

Depuis la racine du dépôt :

```bash
php -S 127.0.0.1:8765 -t internet/v2/public
```

Ouvrir ensuite :

```text
http://127.0.0.1:8765/
```

## Checklist

- [ ] Lancer une partie solo avec le profil `pedagogique`.
- [ ] Vérifier que le bot joue avec un délai visible entre les actions.
- [ ] Vérifier qu'un message temporaire s'affiche pour les actions importantes.
- [ ] Jouer au moins 5 tours complets.
- [ ] Vérifier que le bot explique ses actions dans le journal.
- [ ] Vérifier que le bot ne joue pas pendant une modale humaine de choix de profondeur, cible ou pioche.
- [ ] Exporter la partie en JSON.
- [ ] Importer le JSON et vérifier que la partie reprend correctement.
- [ ] Tester le profil `equilibre`.
- [ ] Tester le profil `agressif`.
- [ ] Vérifier le retour accueil.
- [ ] Vérifier qu'une partie locale hot-seat fonctionne encore.
- [ ] Si l'API est disponible, vérifier qu'une partie serveur n'est pas affectée.

## En cas de bug

Noter le profil du bot, le tour, la phase, les dernières lignes du journal et les étapes pour reproduire. Joindre un export JSON de la partie quand c'est possible.
