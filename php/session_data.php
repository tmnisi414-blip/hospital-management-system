<?php
// php/session_data.php  –  returns current session info as JSON (used by JS dashboards)
require_once __DIR__ . '/config.php';
requireLogin();

header('Content-Type: application/json');

echo json_encode([
    'user_id'    => $_SESSION['user_id'],
    'full_name'  => $_SESSION['full_name'],
    'role'       => $_SESSION['role'],
    'csrf_token' => generateCsrfToken(),
]);
