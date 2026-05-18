<?php
if (!is_file(__DIR__ . '/config.php')) {
    http_response_code(503);
    echo json_encode(['success' => false, 'error' => 'Configuration API manquante.']);
    exit;
}

$config = require __DIR__ . '/config.php';
$dsn = sprintf('mysql:host=%s;dbname=%s;charset=%s', $config['db_host'], $config['db_name'], $config['db_charset']);
try {
    $pdo = new PDO($dsn, $config['db_user'], $config['db_pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Connexion à la base de données impossible.']);
    exit;
}
