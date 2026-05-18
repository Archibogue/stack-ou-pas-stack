<?php
// Option 1 recommandée sur un serveur WordPress :
// ne créez pas config.php. L’API cherche automatiquement wp-config.php
// dans les dossiers parents ou dans DOCUMENT_ROOT, puis réutilise DB_NAME,
// DB_USER, DB_PASSWORD et DB_HOST.
//
// Option 2 : copiez ce fichier en config.php pour forcer une connexion dédiée.
return [
    'db_host' => '127.0.0.1',
    'db_name' => 'stackoupasstack',
    'db_user' => 'username',
    'db_pass' => 'password',
    'db_charset' => 'utf8mb4',
    'table_prefix' => 'sops_',
    'table_games' => 'sops_games'
];
