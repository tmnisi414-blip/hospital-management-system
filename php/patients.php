<?php
// php/patients.php  –  CRUD for patient profiles & medical records
require_once __DIR__ . '/config.php';
requireLogin();

header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
$db     = getDB();

// ── GET own profile ────────────────────────────────────────
if ($method === 'GET' && $action === 'profile') {
    requireRole('patient', 'admin');

    $userId = (int)$_SESSION['user_id'];
    $stmt   = $db->prepare(
        'SELECT u.first_name, u.last_name, u.email, u.phone,
                p.date_of_birth, p.gender, p.blood_type, p.address, p.patient_id
         FROM   users u
         JOIN   patients p ON p.user_id = u.user_id
         WHERE  u.user_id = ?'
    );
    $stmt->execute([$userId]);
    $row = $stmt->fetch();

    echo json_encode($row ? ['success'=>true,'data'=>$row] : ['error'=>'Profile not found.']);
    exit;
}

// ── UPDATE own profile ─────────────────────────────────────
if ($method === 'POST' && $action === 'update_profile') {
    requireRole('patient');

    $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
    if (!validateCsrfToken($input['csrf_token'] ?? '')) {
        http_response_code(403);
        echo json_encode(['error'=>'Invalid CSRF.']);
        exit;
    }

    $userId  = (int)$_SESSION['user_id'];
    $phone   = sanitize($input['phone']      ?? '');
    $address = sanitize($input['address']    ?? '');
    $blood   = sanitize($input['blood_type'] ?? '');

    $db->prepare('UPDATE users    SET phone      = ? WHERE user_id  = ?')->execute([$phone,   $userId]);
    $db->prepare('UPDATE patients SET address    = ?, blood_type = ? WHERE user_id = ?')
       ->execute([$address, $blood, $userId]);

    echo json_encode(['success'=>true]);
    exit;
}

// ── LIST all patients (admin/doctor) ──────────────────────
if ($method === 'GET' && $action === 'list') {
    requireRole('admin', 'doctor');

    $search = '%' . sanitize($_GET['search'] ?? '') . '%';
    $stmt   = $db->prepare(
        'SELECT p.patient_id, u.first_name, u.last_name, u.email, u.phone,
                p.date_of_birth, p.gender, p.blood_type, u.is_active
         FROM   patients p
         JOIN   users u ON u.user_id = p.user_id
         WHERE  (u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ?)
         ORDER  BY u.last_name, u.first_name
         LIMIT  100'
    );
    $stmt->execute([$search, $search, $search]);
    echo json_encode(['success'=>true,'data'=>$stmt->fetchAll()]);
    exit;
}

// ── GET medical records ────────────────────────────────────
if ($method === 'GET' && $action === 'records') {
    requireRole('patient', 'doctor', 'admin');

    $patientId = (int)($_GET['patient_id'] ?? 0);
    $role      = $_SESSION['role'];
    $userId    = (int)$_SESSION['user_id'];

    // Patients can only view their own records
    if ($role === 'patient') {
        $s = $db->prepare('SELECT patient_id FROM patients WHERE user_id = ?');
        $s->execute([$userId]);
        $own = $s->fetch();
        if (!$own || (int)$own['patient_id'] !== $patientId) {
            http_response_code(403);
            echo json_encode(['error'=>'Access denied.']);
            exit;
        }
    }

    $stmt = $db->prepare(
        'SELECT mr.record_id, mr.diagnosis, mr.prescription, mr.record_date,
                CONCAT(u.first_name," ",u.last_name) AS doctor_name
         FROM   medical_records mr
         JOIN   doctors d ON d.doctor_id = mr.doctor_id
         JOIN   users   u ON u.user_id   = d.user_id
         WHERE  mr.patient_id = ?
         ORDER  BY mr.record_date DESC'
    );
    $stmt->execute([$patientId]);
    echo json_encode(['success'=>true,'data'=>$stmt->fetchAll()]);
    exit;
}

// ── ADD medical record (doctor only) ──────────────────────
if ($method === 'POST' && $action === 'add_record') {
    requireRole('doctor', 'admin');

    $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;

    $patientId  = (int)($input['patient_id']  ?? 0);
    $apptId     = (int)($input['appointment_id'] ?? 0) ?: null;
    $diagnosis  = sanitize($input['diagnosis']    ?? '');
    $presc      = sanitize($input['prescription'] ?? '');
    $date       = $input['record_date'] ?? date('Y-m-d');

    $userId   = (int)$_SESSION['user_id'];
    $s = $db->prepare('SELECT doctor_id FROM doctors WHERE user_id = ?');
    $s->execute([$userId]);
    $dr = $s->fetch();
    if (!$dr) {
        http_response_code(403);
        echo json_encode(['error'=>'Doctor profile not found.']);
        exit;
    }

    if (!$patientId || !$diagnosis) {
        http_response_code(422);
        echo json_encode(['error'=>'Patient and diagnosis are required.']);
        exit;
    }

    $ins = $db->prepare(
        'INSERT INTO medical_records
         (patient_id, doctor_id, appointment_id, diagnosis, prescription, record_date)
         VALUES (?, ?, ?, ?, ?, ?)'
    );
    $ins->execute([$patientId, $dr['doctor_id'], $apptId, $diagnosis, $presc, $date]);

    echo json_encode(['success'=>true,'record_id'=>$db->lastInsertId()]);
    exit;
}

// ── TOGGLE active (admin) ──────────────────────────────────
if ($method === 'POST' && $action === 'toggle_active') {
    requireRole('admin');

    $input  = json_decode(file_get_contents('php://input'), true) ?? $_POST;
    $userId = (int)($input['user_id'] ?? 0);

    $db->prepare('UPDATE users SET is_active = NOT is_active WHERE user_id = ?')
       ->execute([$userId]);
    echo json_encode(['success'=>true]);
    exit;
}

http_response_code(400);
echo json_encode(['error'=>'Unknown action.']);
