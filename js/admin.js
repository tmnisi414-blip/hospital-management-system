// js/admin.js  –  Admin panel logic
'use strict';

let SESSION = {};
let _allAppts    = [];
let _allPatients = [];

document.addEventListener('DOMContentLoaded', async () => {
  const res = await apiFetch('../php/session_data.php');
  if (res.error || res.role !== 'admin') {
    location.href = '../html/login.html';
    return;
  }
  SESSION = res;
  document.getElementById('nav-user').textContent = SESSION.full_name;

  initSidebar();
  await loadAll();

  // Search + filter listeners
  document.getElementById('appt-search')?.addEventListener('input', filterAppts);
  document.getElementById('appt-status-filter')?.addEventListener('change', filterAppts);
  document.getElementById('pat-search')?.addEventListener('input', filterPatients);
});

async function loadAll() {
  const [apptData, patData] = await Promise.all([
    apiFetch('../php/appointments.php?action=list'),
    apiFetch('../php/patients.php?action=list'),
  ]);

  if (apptData.success) {
    _allAppts = apptData.data;
    AppointmentStore.load(_allAppts);
    renderStats();
    renderRecentAppts();
    renderAllAppts(_allAppts);
  }

  if (patData.success) {
    _allPatients = patData.data;
    renderPatientsTable(_allPatients);
    renderUsersTable(_allPatients);
    document.getElementById('stat-patients').textContent = _allPatients.length;
  }
}

function renderStats() {
  document.getElementById('stat-total').textContent  = _allAppts.length;
  document.getElementById('stat-pending').textContent= AppointmentStore.countByStatus('requested');
  // Doctors count (distinct)
  const doctors = new Set(_allAppts.map(a => a.doctor_name));
  document.getElementById('stat-doctors').textContent = doctors.size;
}

function renderRecentAppts() {
  const wrap = document.getElementById('recent-appts');
  if (!wrap) return;
  const recent = [..._allAppts].slice(0, 8);
  if (!recent.length) {
    wrap.innerHTML = '<p class="text-muted" style="padding:1rem;">No appointments yet.</p>';
    return;
  }
  wrap.innerHTML = buildAdminApptTable(recent);
}

function filterAppts() {
  const search = (document.getElementById('appt-search')?.value || '').toLowerCase();
  const status = document.getElementById('appt-status-filter')?.value || '';
  let data = _allAppts;
  if (status) data = data.filter(a => a.status_name === status);
  if (search) data = data.filter(a =>
    `${a.patient_name} ${a.doctor_name} ${a.reason}`.toLowerCase().includes(search)
  );
  renderAllAppts(data);
}

function renderAllAppts(data) {
  const wrap = document.getElementById('all-appts-table');
  if (!wrap) return;
  if (!data.length) {
    wrap.innerHTML = '<p class="text-muted" style="padding:1rem;">No appointments found.</p>';
    return;
  }
  wrap.innerHTML = buildAdminApptTable(data);
}

function buildAdminApptTable(appts) {
  const rows = appts.map(a => `
    <tr>
      <td>${a.appointment_id}</td>
      <td>${formatDate(a.appointment_date)}</td>
      <td>${formatTime(a.appointment_time)}</td>
      <td>${a.patient_name || '–'}</td>
      <td>${a.doctor_name || '–'}</td>
      <td>${a.reason || '–'}</td>
      <td>${statusBadge(a.status_name)}</td>
      <td>
        <button class="btn btn-danger btn-sm"
                onclick="deleteAppointment(${a.appointment_id})">
          <i class="ti ti-trash"></i>
        </button>
      </td>
    </tr>`).join('');
  return `<table><thead><tr>
    <th>#</th><th>Date</th><th>Time</th><th>Patient</th><th>Doctor</th>
    <th>Reason</th><th>Status</th><th>Del</th>
  </tr></thead><tbody>${rows}</tbody></table>`;
}

function filterPatients() {
  const q = (document.getElementById('pat-search')?.value || '').toLowerCase();
  const filtered = q
    ? _allPatients.filter(p =>
        `${p.first_name} ${p.last_name} ${p.email}`.toLowerCase().includes(q)
      )
    : _allPatients;
  renderPatientsTable(filtered);
}

function renderPatientsTable(list) {
  const wrap = document.getElementById('patients-table');
  if (!wrap) return;
  if (!list.length) {
    wrap.innerHTML = '<p class="text-muted" style="padding:1rem;">No patients found.</p>';
    return;
  }
  const rows = list.map(p => `
    <tr>
      <td>${p.patient_id}</td>
      <td>${p.first_name} ${p.last_name}</td>
      <td>${p.email}</td>
      <td>${p.phone || '–'}</td>
      <td>${p.gender}</td>
      <td>${p.blood_type || '–'}</td>
      <td><span class="badge ${p.is_active ? 'badge-confirmed' : 'badge-cancelled'}">${p.is_active ? 'Active' : 'Suspended'}</span></td>
    </tr>`).join('');
  wrap.innerHTML = `<table><thead><tr>
    <th>ID</th><th>Name</th><th>Email</th><th>Phone</th>
    <th>Gender</th><th>Blood</th><th>Status</th>
  </tr></thead><tbody>${rows}</tbody></table>`;
}

function renderUsersTable(patients) {
  const wrap = document.getElementById('users-table');
  if (!wrap) return;
  const rows = patients.map(p => `
    <tr>
      <td>${p.first_name} ${p.last_name}</td>
      <td>${p.email}</td>
      <td><span class="badge badge-confirmed">patient</span></td>
      <td><span class="badge ${p.is_active ? 'badge-completed' : 'badge-cancelled'}">${p.is_active ? 'Active' : 'Suspended'}</span></td>
      <td>
        <button class="btn btn-secondary btn-sm"
                onclick="toggleUser(${p.patient_id})">
          <i class="ti ti-${p.is_active ? 'lock' : 'lock-open'}"></i>
          ${p.is_active ? 'Suspend' : 'Activate'}
        </button>
      </td>
    </tr>`).join('');
  wrap.innerHTML = `<table><thead><tr>
    <th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Action</th>
  </tr></thead><tbody>${rows}</tbody></table>`;
}

async function deleteAppointment(apptId) {
  if (!confirm(`Delete appointment #${apptId}? This cannot be undone.`)) return;
  const result = await apiFetch('../php/appointments.php?action=delete', {
    method: 'POST',
    body: JSON.stringify({ csrf_token: SESSION.csrf_token, appointment_id: apptId }),
  });
  if (result.success) {
    showFlash('flash-area', `Appointment #${apptId} deleted.`, 'success');
    _allAppts = _allAppts.filter(a => a.appointment_id !== apptId);
    renderRecentAppts();
    filterAppts();
    renderStats();
  } else {
    showFlash('flash-area', result.error || 'Delete failed.', 'error');
  }
}

async function toggleUser(patientId) {
  // We need user_id — fetch from patient list
  const patient = _allPatients.find(p => p.patient_id === patientId);
  if (!patient) return;

  const result = await apiFetch('../php/patients.php?action=toggle_active', {
    method: 'POST',
    body: JSON.stringify({ user_id: patientId }),
  });
  if (result.success) {
    patient.is_active = patient.is_active ? 0 : 1;
    renderPatientsTable(_allPatients);
    renderUsersTable(_allPatients);
    showFlash('flash-area', 'User status updated.', 'success');
  }
}
