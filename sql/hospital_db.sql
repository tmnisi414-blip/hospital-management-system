-- ============================================================
-- Hospital Appointment & Patient Management System
-- Database Script - MySQL
-- Normalised to 3NF
-- ============================================================

CREATE DATABASE IF NOT EXISTS hospital_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE hospital_db;

-- ============================================================
-- TABLE: roles (lookup table)
-- ============================================================
CREATE TABLE IF NOT EXISTS roles (
    role_id   INT AUTO_INCREMENT PRIMARY KEY,
    role_name VARCHAR(20) NOT NULL UNIQUE
);

INSERT INTO roles (role_name) VALUES ('admin'), ('doctor'), ('patient');

-- ============================================================
-- TABLE: users (core authentication table)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    user_id       INT AUTO_INCREMENT PRIMARY KEY,
    role_id       INT NOT NULL,
    first_name    VARCHAR(50) NOT NULL,
    last_name     VARCHAR(50) NOT NULL,
    email         VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    phone         VARCHAR(20),
    is_active     TINYINT(1) NOT NULL DEFAULT 1,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(role_id)
);

-- ============================================================
-- TABLE: specialisations
-- ============================================================
CREATE TABLE IF NOT EXISTS specialisations (
    specialisation_id   INT AUTO_INCREMENT PRIMARY KEY,
    specialisation_name VARCHAR(100) NOT NULL UNIQUE
);

INSERT INTO specialisations (specialisation_name) VALUES
    ('General Practice'),
    ('Cardiology'),
    ('Neurology'),
    ('Orthopaedics'),
    ('Paediatrics');

-- ============================================================
-- TABLE: doctors (extends users where role = doctor)
-- ============================================================
CREATE TABLE IF NOT EXISTS doctors (
    doctor_id         INT AUTO_INCREMENT PRIMARY KEY,
    user_id           INT NOT NULL UNIQUE,
    specialisation_id INT NOT NULL,
    licence_number    VARCHAR(50) NOT NULL UNIQUE,
    bio               TEXT,
    CONSTRAINT fk_doctors_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_doctors_spec FOREIGN KEY (specialisation_id) REFERENCES specialisations(specialisation_id)
);

-- ============================================================
-- TABLE: patients (extends users where role = patient)
-- ============================================================
CREATE TABLE IF NOT EXISTS patients (
    patient_id    INT AUTO_INCREMENT PRIMARY KEY,
    user_id       INT NOT NULL UNIQUE,
    date_of_birth DATE NOT NULL,
    gender        ENUM('male','female','other') NOT NULL,
    blood_type    VARCHAR(5),
    address       VARCHAR(255),
    CONSTRAINT fk_patients_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- ============================================================
-- TABLE: appointment_statuses (lookup)
-- ============================================================
CREATE TABLE IF NOT EXISTS appointment_statuses (
    status_id   INT AUTO_INCREMENT PRIMARY KEY,
    status_name VARCHAR(20) NOT NULL UNIQUE
);

INSERT INTO appointment_statuses (status_name) VALUES
    ('requested'), ('confirmed'), ('completed'), ('cancelled');

-- ============================================================
-- TABLE: appointments
-- ============================================================
CREATE TABLE IF NOT EXISTS appointments (
    appointment_id   INT AUTO_INCREMENT PRIMARY KEY,
    patient_id       INT NOT NULL,
    doctor_id        INT NOT NULL,
    status_id        INT NOT NULL DEFAULT 1,
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    reason           TEXT,
    notes            TEXT,
    created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_appt_patient FOREIGN KEY (patient_id) REFERENCES patients(patient_id),
    CONSTRAINT fk_appt_doctor  FOREIGN KEY (doctor_id)  REFERENCES doctors(doctor_id),
    CONSTRAINT fk_appt_status  FOREIGN KEY (status_id)  REFERENCES appointment_statuses(status_id)
);

-- ============================================================
-- TABLE: medical_records
-- ============================================================
CREATE TABLE IF NOT EXISTS medical_records (
    record_id      INT AUTO_INCREMENT PRIMARY KEY,
    patient_id     INT NOT NULL,
    doctor_id      INT NOT NULL,
    appointment_id INT,
    diagnosis      TEXT NOT NULL,
    prescription   TEXT,
    record_date    DATE NOT NULL,
    created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_rec_patient FOREIGN KEY (patient_id)     REFERENCES patients(patient_id),
    CONSTRAINT fk_rec_doctor  FOREIGN KEY (doctor_id)      REFERENCES doctors(doctor_id),
    CONSTRAINT fk_rec_appt    FOREIGN KEY (appointment_id) REFERENCES appointments(appointment_id) ON DELETE SET NULL
);

-- ============================================================
-- TABLE: doctor_schedules
-- ============================================================
CREATE TABLE IF NOT EXISTS doctor_schedules (
    schedule_id  INT AUTO_INCREMENT PRIMARY KEY,
    doctor_id    INT NOT NULL,
    day_of_week  ENUM('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday') NOT NULL,
    start_time   TIME NOT NULL,
    end_time     TIME NOT NULL,
    is_available TINYINT(1) NOT NULL DEFAULT 1,
    CONSTRAINT fk_sched_doctor FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id) ON DELETE CASCADE,
    CONSTRAINT uq_sched UNIQUE (doctor_id, day_of_week)
);

-- ============================================================
-- SAMPLE DATA
-- ============================================================

-- Admin user (password: Admin@123)
INSERT INTO users (role_id, first_name, last_name, email, password_hash, phone) VALUES
(1, 'Admin', 'System', 'admin@hospital.com',
 '$2y$12$Lx5TwJ8nQ1R7K9P2M4sOuObJvgNhXcYdWeAkFqImzSrBpDlEtCG0u', '0800000000');

-- Doctor users (password: Doctor@123)
INSERT INTO users (role_id, first_name, last_name, email, password_hash, phone) VALUES
(2, 'Sarah',   'Dlamini', 'sarah.dlamini@hospital.com',
 '$2y$12$Lx5TwJ8nQ1R7K9P2M4sOuObJvgNhXcYdWeAkFqImzSrBpDlEtCG0u', '0311000001'),
(2, 'James',   'Nkosi',   'james.nkosi@hospital.com',
 '$2y$12$Lx5TwJ8nQ1R7K9P2M4sOuObJvgNhXcYdWeAkFqImzSrBpDlEtCG0u', '0311000002');

-- Patient users (password: Patient@123)
INSERT INTO users (role_id, first_name, last_name, email, password_hash, phone) VALUES
(3, 'Thabo',   'Mokoena', 'thabo@email.com',
 '$2y$12$Lx5TwJ8nQ1R7K9P2M4sOuObJvgNhXcYdWeAkFqImzSrBpDlEtCG0u', '0821111111'),
(3, 'Lerato',  'Sithole',  'lerato@email.com',
 '$2y$12$Lx5TwJ8nQ1R7K9P2M4sOuObJvgNhXcYdWeAkFqImzSrBpDlEtCG0u', '0832222222');

-- Doctor profiles
INSERT INTO doctors (user_id, specialisation_id, licence_number, bio) VALUES
(2, 1, 'DOC-2024-001', 'Dr Dlamini has 10 years of experience in general practice.'),
(3, 2, 'DOC-2024-002', 'Dr Nkosi specialises in cardiac care and preventive cardiology.');

-- Patient profiles
INSERT INTO patients (user_id, date_of_birth, gender, blood_type, address) VALUES
(4, '1990-05-15', 'male',   'O+', '12 Umgeni Road, Durban'),
(5, '1995-11-22', 'female', 'A+', '7 Berea Drive, Durban');

-- Doctor schedules
INSERT INTO doctor_schedules (doctor_id, day_of_week, start_time, end_time) VALUES
(1, 'Monday',    '08:00:00', '16:00:00'),
(1, 'Tuesday',   '08:00:00', '16:00:00'),
(1, 'Wednesday', '08:00:00', '16:00:00'),
(1, 'Thursday',  '08:00:00', '16:00:00'),
(1, 'Friday',    '08:00:00', '13:00:00'),
(2, 'Monday',    '09:00:00', '17:00:00'),
(2, 'Wednesday', '09:00:00', '17:00:00'),
(2, 'Friday',    '09:00:00', '17:00:00');

-- Appointments
INSERT INTO appointments (patient_id, doctor_id, status_id, appointment_date, appointment_time, reason) VALUES
(1, 1, 2, CURDATE() + INTERVAL 1 DAY,  '09:00:00', 'Annual check-up'),
(2, 2, 1, CURDATE() + INTERVAL 3 DAYS, '10:30:00', 'Chest pain evaluation'),
(1, 1, 4, CURDATE() - INTERVAL 7 DAYS, '14:00:00', 'Follow-up consultation'),
(2, 1, 3, CURDATE() - INTERVAL 14 DAYS,'11:00:00', 'Flu symptoms');

-- Medical records
INSERT INTO medical_records (patient_id, doctor_id, appointment_id, diagnosis, prescription, record_date) VALUES
(2, 1, 4, 'Acute upper respiratory infection',
 'Amoxicillin 500mg TDS x 5 days; Ibuprofen 400mg PRN', CURDATE() - INTERVAL 14 DAYS);
