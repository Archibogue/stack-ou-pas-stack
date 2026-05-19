# Sécurité

- Ne jamais publier `internet/v2/public/api/config.php`.
- Ne jamais publier de mots de passe, identifiants, jetons ou accès personnels.
- [`config.example.php`](internet/v2/public/api/config.example.php) sert uniquement de modèle et ne doit pas contenir de secrets réels.
- L’API PHP actuelle est prévue pour un usage pédagogique / prototype.
- En cas d’hébergement public, limiter l’accès si possible : environnement de test, sous-domaine non critique, restrictions serveur, sauvegardes régulières.
- Signaler les failles via les Issues GitHub ou par contact direct avec le mainteneur.
