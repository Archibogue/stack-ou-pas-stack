<?php
header('Content-Type: application/json; charset=utf-8');

$method = $_SERVER['REQUEST_METHOD'];
action_dispatch($method);

function action_dispatch($method)
{
    if ($method === 'GET' && isset($_GET['action']) && $_GET['action'] === 'pong') {
        require __DIR__ . '/db.php';
        echo json_encode(['success' => true, 'status' => 'pong']);
        return;
    }

    if ($method === 'GET' && isset($_GET['action']) && $_GET['action'] === 'load') {
        load_game();
        return;
    }

    if ($method === 'POST') {
        $body = json_decode(file_get_contents('php://input'), true);
        if (!is_array($body) || !isset($body['action'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Action manquante.']);
            return;
        }
        switch ($body['action']) {
            case 'create':
                create_game($body);
                break;
            case 'save':
                save_game($body);
                break;
            default:
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'Action inconnue.']);
                break;
        }
        return;
    }

    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Méthode non autorisée.']);
}

function create_game($body)
{
    if (empty($body['state']) || !is_array($body['state'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'État de jeu manquant.']);
        return;
    }
    $jsonState = json_encode($body['state']);
    if ($jsonState === false || strlen($jsonState) > 100000) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'État invalide ou trop volumineux.']);
        return;
    }

    require __DIR__ . '/db.php';
    $table = table_name($config);
    $code = generate_unique_code($pdo, $table);
    $body['state']['remoteCode'] = $code;
    $body['state']['isRemote'] = true;
    $jsonState = json_encode($body['state']);
    if ($jsonState === false || strlen($jsonState) > 100000) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'État invalide ou trop volumineux.']);
        return;
    }
    $sql = 'INSERT INTO ' . $table . ' (`code`, `state_json`, `created_at`, `updated_at`) VALUES (:code, :state, NOW(), NOW())';
    $stmt = $pdo->prepare($sql);
    $stmt->execute(['code' => $code, 'state' => $jsonState]);
    echo json_encode(['success' => true, 'code' => $code]);
}

function load_game()
{
    $code = strtoupper($_GET['code'] ?? '');
    if (empty($code) || !preg_match('/^[A-Z0-9]{6}$/', $code)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Code invalide.']);
        return;
    }
    require __DIR__ . '/db.php';
    $sql = 'SELECT state_json FROM ' . table_name($config) . ' WHERE code = :code LIMIT 1';
    $stmt = $pdo->prepare($sql);
    $stmt->execute(['code' => $code]);
    $row = $stmt->fetch();
    if (!$row) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Partie introuvable.']);
        return;
    }
    echo json_encode(['success' => true, 'state' => json_decode($row['state_json'], true)]);
}

function save_game($body)
{
    $code = strtoupper($body['code'] ?? '');
    if (empty($code) || !preg_match('/^[A-Z0-9]{6}$/', $code) || empty($body['state']) || !is_array($body['state'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Paramètres invalides.']);
        return;
    }
    $body['state']['remoteCode'] = $code;
    $body['state']['isRemote'] = true;
    $jsonState = json_encode($body['state']);
    if ($jsonState === false || strlen($jsonState) > 100000) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'État invalide ou trop volumineux.']);
        return;
    }
    require __DIR__ . '/db.php';
    $table = table_name($config);
    $existsSql = 'SELECT 1 FROM ' . $table . ' WHERE code = :code LIMIT 1';
    $existsStmt = $pdo->prepare($existsSql);
    $existsStmt->execute(['code' => $code]);
    if (!$existsStmt->fetch()) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Partie introuvable.']);
        return;
    }

    $sql = 'UPDATE ' . $table . ' SET state_json = :state, updated_at = NOW() WHERE code = :code';
    $stmt = $pdo->prepare($sql);
    $stmt->execute(['state' => $jsonState, 'code' => $code]);
    echo json_encode(['success' => true]);
}

function table_name($config)
{
    $table = $config['table_games'] ?? (($config['table_prefix'] ?? 'sops_') . 'games');
    if (!preg_match('/^[A-Za-z0-9_]+$/', $table)) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Nom de table invalide.']);
        exit;
    }
    return '`' . $table . '`';
}

function generate_unique_code($pdo, $table)
{
    for ($attempt = 0; $attempt < 10; $attempt += 1) {
        $code = generate_code();
        $stmt = $pdo->prepare('SELECT 1 FROM ' . $table . ' WHERE code = :code LIMIT 1');
        $stmt->execute(['code' => $code]);
        if (!$stmt->fetch()) {
            return $code;
        }
    }
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Impossible de générer un code de partie unique.']);
    exit;
}

function generate_code()
{
    $chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    $code = '';
    for ($i = 0; $i < 6; $i += 1) {
        $code .= $chars[random_int(0, strlen($chars) - 1)];
    }
    return $code;
}
