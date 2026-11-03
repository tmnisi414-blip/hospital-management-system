<?php
require_once __DIR__ . '/config.php';

$action = $_GET['action'] ?? '';

if ($action === 'login' && $_SERVER['REQUEST_METHOD'] === 'POST') {

    if (!validateCsrfToken($_POST['csrf_token'] ?? '')) {
        $_SESSION['flash'] = ['type'=>'error','msg'=>'Invalid request. Please try again.'];
        header('Location: ../html/login.php');
        exit;
    }

    $email    = strtolower(trim($_POST['email'] ?? ''));
    $password = $_POST['password'] ?? '';

    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || empty($password)) {
        $_SESSION['flash'] = ['type'=>'error','msg'=>'Please enter a valid email and password.'];
        header('Location: ../html/login.php');
        exit;
    }

    $db   = getDB();
    $stmt = $db->prepare(
        'SELECT u.user_id, u.first_name, u.last_name, u.password_hash,
                r.role_name, u.is_active
         FROM   users u
         JOIN   roles r ON r.role_id = u.role_id
         WHERE  u.email = ?'
    );
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password_hash'])) {
        $_SESSION['flash'] = ['type'=>'error','msg'=>'Invalid email or password.'];
        header('Location: ../html/login.php');
        exit;
    }

    if (!$user['is_active']) {
        $_SESSION['flash'] = ['type'=>'error','msg'=>'Account suspended. Contact admin.'];
        header('Location: ../html/login.php');
        exit;
    }

    session_regenerate_id(true);

    $_SESSION['user_id']   = $user['user_id'];
    $_SESSION['full_name'] = $user['first_name'] . ' ' . $user['last_name'];
    $_SESSION['role']      = $user['role_name'];

    $redirect = match($user['role_name']) {
        'admin'  => '../html/admin.html',
        'doctor' => '../html/doctor.html',
        default  => '../html/patient.html',
    };

    header('Location: ' . $redirect);
    exit;
}

if ($action === 'logout') {
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000,
            $p['path'], $p['domain'], $p['secure'], $p['httponly']);
    }
    session_destroy();
    header('Location: ../html/login.php');
    exit;
}

if ($action === 'register' && $_SERVER['REQUEST_METHOD'] === 'POST') {

    if (!validateCsrfToken($_POST['csrf_token'] ?? '')) {
        $_SESSION['flash'] = ['type'=>'error','msg'=>'Invalid request.'];
        header('Location: ../html/login.php');
        exit;
    }

    $firstName = sanitize($_POST['first_name'] ?? '');
    $lastName  = sanitize($_POST['last_name']  ?? '');
    $email     = strtolower(trim($_POST['email'] ?? ''));
    $phone     = sanitize($_POST['phone']       ?? '');
    $password  = $_POST['password']  ?? '';
    $dob       = $_POST['dob']       ?? '';
    $gender    = $_POST['gender']    ?? '';

    $errors = [];
    if (empty($firstName) || empty($lastName)) $errors[] = 'Name is required.';
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) $errors[] = 'Invalid email.';
    if (strlen($password) < 8) $errors[] = 'Password must be at least 8 characters.';
    if (!preg_match('/[A-Z]/', $password)) $errors[] = 'Password needs an uppercase letter.';
    if (!preg_match('/[0-9]/', $password)) $errors[] = 'Password needs a number.';
    if (empty($dob)) $errors[] = 'Date of birth is required.';
    if (!in_array($gender, ['male','female','other'])) $errors[] = 'Gender is required.';

    if ($errors) {
        $_SESSION['flash'] = ['type'=>'error','msg'=>implode(' ', $errors)];
        header('Location: ../html/login.php');
        exit;
    }

    $db  = getDB();
    $chk = $db->prepare('SELECT user_id FROM users WHERE email = ?');
    $chk->execute([$email]);
    if ($chk->fetch()) {
        $_SESSION['flash'] = ['type'=>'error','msg'=>'Email already registered.'];
        header('Location: ../html/login.php');
        exit;
    }

    $hash = password_hash($password, PASSWORD_BCRYPT, ['cost'=>12]);

    $db->beginTransaction();
    try {
        $insUser = $db->prepare(
            'INSERT INTO users (role_id, first_name, last_name, email, password_hash, phone)
             VALUES (3, ?, ?, ?, ?, ?)'
        );
        $insUser->execute([$firstName, $lastName, $email, $hash, $phone]);
        $userId = $db->lastInsertId();

        $insPat = $db->prepare(
            'INSERT INTO patients (user_id, date_of_birth, gender) VALUES (?, ?, ?)'
        );
        $insPat->execute([$userId, $dob, $gender]);

        $db->commit();
        $_SESSION['flash'] = ['type'=>'success','msg'=>'Registration successful! Please log in.'];
        header('Location: ../html/login.php');
    } catch (Exception $e) {
        $db->rollBack();
        $_SESSION['flash'] = ['type'=>'error','msg'=>'Registration failed. Please try again.'];
        header('Location: ../html/login.php');
    }
    exit;
}

header('Location: ../html/login.php');
exit;
