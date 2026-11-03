<?php
// php/appointments.php  –  CRUD for appointments
require_once __DIR__ . '/config.php';
requireLogin();

header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

$db = getDB();

// ── HELPER: get patient_id / doctor_id for current user ────
function getPatientId(PDO $db, int $userId): ?int {
    $s = $db->prepare('SELECT patient_id FROM patients WHERE user_id = ?');
    $s->execute([$userId]);
    $r = $s->fetch();
    return $r ? (int)$r['patient_id'] : null;
}
function getDoctorId(PDO $db, int $userId): ?int {
    $s = $db->prepare('SELECT doctor_id FROM doctors WHERE user_id = ?');
    $s->execute([$userId]);
    $r = $s->fetch();
    return $r ? (int)$r['doctor_id'] : null;
}

// ── LIST ───────────────────────────────────────────────────
if ($method === 'GET' && $action === 'list') {

    $role = $_SESSION['role'];
    $uid  = (int)$_SESSION['user_id'];

    if ($role === 'patient') {
        $pid = getPatientId($db, $uid);
        $stmt = $db->prepare(
            'SELECT a.appointment_id, a.appointment_date, a.appointment_time,
                    a.reason, a.notes, s.status_name,
                    CONCAT(u.first_name," ",u.last_name) AS doctor_name,
                    sp.specialisation_name
             FROM   appointments a
             JOIN   appointment_statuses s ON s.status_id = a.status_id
             JOIN   doctors d              ON d.doctor_id  = a.doctor_id
             JOIN   users   u              ON u.user_id    = d.user_id
             JOIN   specialisations sp     ON sp.specialisation_id = d.specialisation_id
             WHERE  a.patient_id = ?
             ORDER  BY a.appointment_date DESC'
        );
        $stmt->execute([$pid]);

    } elseif ($role === 'doctor') {
        $did = getDoctorId($db, $uid);
        $stmt = $db->prepare(
            'SELECT a.appointment_id, a.appointment_date, a.appointment_time,
                    a.reason, a.notes, s.status_name,
                    CONCAT(u.first_name," ",u.last_name) AS patient_name,
                    p.date_of_birth, p.gender
             FROM   appointments a
             JOIN   appointment_statuses s ON s.status_id = a.status_id
             JOIN   patients pa            ON pa.patient_id = a.patient_id
             JOIN   users    u             ON u.user_id     = pa.user_id
             JOIN   patients p             ON p.patient_id  = a.patient_id
             WHERE  a.doctor_id = ?
             ORDER  BY a.appointment_date ASC'
        );
        $stmt->execute([$did]);

    } else { // admin
        $stmt = $db->query(
            'SELECT a.appointment_id, a.appointment_date, a.appointment_time,
                    a.reason, s.status_name,
                    CONCAT(pu.first_name," ",pu.last_name) AS patient_name,
                    CONCAT(du.first_name," ",du.last_name) AS doctor_name
             FROM   appointments a
             JOIN   appointment_statuses s ON s.status_id  = a.status_id
             JOIN   patients pa            ON pa.patient_id = a.patient_id
             JOIN   users    pu            ON pu.user_id    = pa.user_id
             JOIN   doctors  d             ON d.doctor_id   = a.doctor_id
             JOIN   users    du            ON du.user_id    = d.user_id
             ORDER  BY a.appointment_date DESC
             LIMIT  200'
        );
    }

    echo json_encode(['success' => true, 'data' => $stmt->fetchAll()]);
    exit;
}

// ── CREATE (patient only) ──────────────────────────────────
if ($method === 'POST' && $action === 'create') {
    requireRole('patient', 'admin');

    $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;

    if (!validateCsrfToken($input['csrf_token'] ?? '')) {
        http_response_code(403);
        echo json_encode(['error' => 'Invalid CSRF token.']);
        exit;
    }

    $doctorId = (int)($input['doctor_id'] ?? 0);
    $date     = $input['appointment_date'] ?? '';
    $time     = $input['appointment_time'] ?? '';
    $reason   = sanitize($input['reason'] ?? '');

    if (!$doctorId || !$date || !$time) {
        http_response_code(422);
        echo json_encode(['error' => 'Doctor, date and time are required.']);
        exit;
    }

    $pid = getPatientId($db, (int)$_SESSION['user_id']);

    // Check no clash
    $clash = $db->prepare(
        'SELECT appointment_id FROM appointments
         WHERE  doctor_id = ? AND appointment_date = ? AND appointment_time = ?
         AND    status_id NOT IN (4)'
    );
    $clash->execute([$doctorId, $date, $time]);
    if ($clash->fetch()) {
        http_response_code(409);
        echo json_encode(['error' => 'That slot is already booked.']);
        exit;
    }

    $ins = $db->prepare(
        'INSERT INTO appointments (patient_id, doctor_id, status_id, appointment_date, appointment_time, reason)
         VALUES (?, ?, 1, ?, ?, ?)'
    );
    $ins->execute([$pid, $doctorId, $date, $time, $reason]);

    echo json_encode(['success' => true, 'appointment_id' => $db->lastInsertId()]);
    exit;
}

// ── UPDATE STATUS ──────────────────────────────────────────
if ($method === 'POST' && $action === 'update_status') {
    requireRole('doctor', 'admin');

    $input    = json_decode(file_get_contents('php://input'), true) ?? $_POST;
    $apptId   = (int)($input['appointment_id'] ?? 0);
    $statusId = (int)($input['status_id'] ?? 0);

    if (!$apptId || !$statusId) {
        http_response_code(422);
        echo json_encode(['error' => 'Missing parameters.']);
        exit;
    }

    $upd = $db->prepare('UPDATE appointments SET status_id = ? WHERE appointment_id = ?');
    $upd->execute([$statusId, $apptId]);

    echo json_encode(['success' => true]);
    exit;
}

// ── CANCEL (patient cancels own) ──────────────────────────
if ($method === 'POST' && $action === 'cancel') {
    requireRole('patient');

    $input  = json_decode(file_get_contents('php://input'), true) ?? $_POST;
    $apptId = (int)($input['appointment_id'] ?? 0);
    $pid    = getPatientId($db, (int)$_SESSION['user_id']);

    $upd = $db->prepare(
        'UPDATE appointments SET status_id = 4
         WHERE  appointment_id = ? AND patient_id = ? AND status_id IN (1,2)'
    );
    $upd->execute([$apptId, $pid]);

    echo json_encode(['success' => true, 'affected' => $upd->rowCount()]);
    exit;
}

// ── DELETE (admin only) ────────────────────────────────────
if ($method === 'POST' && $action === 'delete') {
    requireRole('admin');

    $input  = json_decode(file_get_contents('php://input'), true) ?? $_POST;
    $apptId = (int)($input['appointment_id'] ?? 0);

    $del = $db->prepare('DELETE FROM appointments WHERE appointment_id = ?');
    $del->execute([$apptId]);

    echo json_encode(['success' => true]);
    exit;
}

// ── DOCTORS LIST for booking form ─────────────────────────
if ($method === 'GET' && $action === 'doctors') {
    $stmt = $db->query(
        'SELECT d.doctor_id,
                CONCAT(u.first_name," ",u.last_name) AS doctor_name,
                s.specialisation_name
         FROM   doctors d
         JOIN   users u         ON u.user_id = d.user_id
         JOIN   specialisations s ON s.specialisation_id = d.specialisation_id
         WHERE  u.is_active = 1
         ORDER  BY u.last_name'
    );
    echo json_encode(['success' => true, 'data' => $stmt->fetchAll()]);
    exit;
}

http_response_code(400);
echo json_encode(['error' => 'Unknown action.']);
