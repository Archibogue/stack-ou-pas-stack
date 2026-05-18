<?php
$config = sops_load_config();
$dsn = sops_mysql_dsn($config['db_host'], $config['db_name'], $config['db_charset']);
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

function sops_load_config()
{
    $defaults = [
        'db_charset' => 'utf8mb4',
        'table_prefix' => 'sops_',
        'table_games' => 'sops_games',
    ];

    $localConfigPath = __DIR__ . '/config.php';
    if (is_file($localConfigPath)) {
        $localConfig = require $localConfigPath;
        if (!is_array($localConfig)) {
            sops_config_error('Configuration API invalide.');
        }
        return sops_validate_config(array_merge($defaults, $localConfig));
    }

    $wpConfigPath = sops_find_wp_config(__DIR__);
    if ($wpConfigPath === null) {
        sops_config_error('Configuration API manquante : ajoutez api/config.php ou placez le jeu sous un WordPress avec wp-config.php.');
    }

    $wpConfig = sops_parse_wp_config($wpConfigPath);
    return sops_validate_config(array_merge($defaults, [
        'db_host' => $wpConfig['DB_HOST'],
        'db_name' => $wpConfig['DB_NAME'],
        'db_user' => $wpConfig['DB_USER'],
        'db_pass' => $wpConfig['DB_PASSWORD'],
    ]));
}

function sops_validate_config($config)
{
    foreach (['db_host', 'db_name', 'db_user', 'db_pass', 'db_charset', 'table_games'] as $key) {
        if (!array_key_exists($key, $config)) {
            sops_config_error('Configuration API incomplète : ' . $key . '.');
        }
    }
    foreach (['db_host', 'db_name', 'db_user', 'db_charset', 'table_prefix', 'table_games'] as $key) {
        if (!is_string($config[$key]) || $config[$key] === '') {
            sops_config_error('Configuration API invalide : ' . $key . '.');
        }
    }
    if (!is_string($config['db_pass'])) {
        sops_config_error('Configuration API invalide : db_pass.');
    }
    return $config;
}

function sops_find_wp_config($startDir)
{
    $dir = realpath($startDir);
    for ($depth = 0; $depth < 8 && $dir && $dir !== dirname($dir); $depth += 1) {
        $candidate = $dir . DIRECTORY_SEPARATOR . 'wp-config.php';
        if (is_file($candidate)) {
            return $candidate;
        }
        $dir = dirname($dir);
    }

    $documentRoot = $_SERVER['DOCUMENT_ROOT'] ?? null;
    if ($documentRoot) {
        $candidate = rtrim($documentRoot, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'wp-config.php';
        if (is_file($candidate)) {
            return $candidate;
        }
    }

    return null;
}

function sops_parse_wp_config($path)
{
    $content = file_get_contents($path);
    if ($content === false) {
        sops_config_error('wp-config.php illisible.');
    }

    $required = ['DB_NAME', 'DB_USER', 'DB_PASSWORD', 'DB_HOST'];
    $config = [];
    foreach ($required as $constant) {
        $value = sops_extract_wp_constant($content, $constant);
        if ($value === null) {
            sops_config_error('Constante WordPress manquante : ' . $constant . '.');
        }
        $config[$constant] = $value;
    }

    return $config;
}

function sops_extract_wp_constant($content, $name)
{
    $pattern = '/define\s*\(\s*[\'"]' . preg_quote($name, '/') . '[\'"]\s*,\s*([\'"])(.*?)\1\s*\)\s*;/s';
    if (!preg_match($pattern, $content, $matches)) {
        return null;
    }
    return stripcslashes($matches[2]);
}

function sops_mysql_dsn($host, $dbName, $charset)
{
    if (preg_match('/^([^:]+):(\d+)$/', $host, $matches)) {
        return sprintf('mysql:host=%s;port=%s;dbname=%s;charset=%s', $matches[1], $matches[2], $dbName, $charset);
    }

    if (preg_match('/^([^:]+):(.+)$/', $host, $matches) && strpos($matches[2], '/') === 0) {
        return sprintf('mysql:unix_socket=%s;dbname=%s;charset=%s', $matches[2], $dbName, $charset);
    }

    return sprintf('mysql:host=%s;dbname=%s;charset=%s', $host, $dbName, $charset);
}

function sops_config_error($message)
{
    http_response_code(503);
    echo json_encode(['success' => false, 'error' => $message]);
    exit;
}
