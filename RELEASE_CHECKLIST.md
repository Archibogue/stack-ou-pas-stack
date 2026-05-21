# Checklist de diffusion

Avant de partager une version bêta :

- [ ] Tests moteur OK : `node internet/v2/tests/engine.test.mjs`.
- [ ] Test solo V2 OK avec les profils `pedagogique`, `equilibre` et `agressif`.
- [ ] Bot V2 lisible : délai entre actions, badge de réflexion, message temporaire et explications dans le journal.
- [ ] Export/import JSON OK sur une partie solo, y compris si c'est au tour du bot.
- [ ] Partie locale hot-seat V2 toujours OK.
- [ ] Partie serveur V2 non affectée si l'API est disponible.
- [ ] Règles Markdown cohérentes avec `internet/v2/public/assets/js/rules.js`.
- [ ] Deck Markdown cohérent avec `internet/v2/public/assets/js/cards.js`.
- [ ] Kit d’impression présent dans `physique/initiation/impression/`.
- [ ] Aucun fichier sensible versionné, notamment `internet/v2/public/api/config.php`.
- [ ] `README.md` à jour.
- [ ] `CHANGELOG.md` à jour.
- [ ] Licence vérifiée : code MIT, contenus pédagogiques CC BY-NC-SA 4.0.
