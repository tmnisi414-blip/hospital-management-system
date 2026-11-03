// js/doctor.js  –  Doctor dashboard logic
'use strict';

let SESSION = {};
let selectedApptId = null;

document.addEventListener('DOMContentLoaded', async () => {
  const res = await apiFetch('../php/session_data.php');
  if (res.error || res.role !== 'doctor') {
    location.href = '../html/login.html';
    return;
  }
  SESSION = res;
  document.getElementById('nav-user').textContent      = SESSION.full_name;
  document.getElementById('greeting-name').textContent = 'Dr ' + SESSION.full_name.split(' ')[1];

  initSidebar();
  await loadSchedule();
  await loadPatients();

  // Record form date default
  const recDate = document.getElementById('rec-date');
  if (recDate) recDate.value = new Date().toISOString().split('T')[0];

  // Status filter
  const statusFilter = document.getElementById('status-filter');
  if (statusFilter) {
    statusFilter.addEventListener('change', () => renderScheduleTable(statusFilter.value));
  }

  // Patient search
  const patSearch = document.getElementById('patient-search');
  if (patSearch) {
    patSearch.addEventListener('input', () => renderPatientTable(patSearch.value));
  }

  // Record form
  attachValidation('record-form');
  document.getElementById('record-form').addEventListener('submit', submitRecord);
});

let _scheduleData = [];
let _patientsData = [];

async function loadSchedule() {
  const data = await apiFetch('../php/appointments.php?action=list');
  if (!data.success) return;
  AppointmentStore.load(data.data);
  _scheduleData = data.data;

  const today = new Date().toISOString().split('T')[0];
  const todayAppts = _scheduleData.filter(a => a.appointment_date === today);

  document.getElementById('stat-today').textContent  = todayAppts.length;
  document.getElementById('stat-pending').textContent= AppointmentStore.countByStatus('requested');
  document.getElementById('stat-cancelled').textContent = todayAppts.filter(a => a.status_name === 'cancelled').length;

  const uniquePatients = new Set(_scheduleData.map(a => a.patient_name));
  document.getElementById('stat-patients').textContent = uniquePatients.size;

  renderTodaySchedule(todayAppts);
  renderScheduleTable();
}

function renderTodaySchedule(appts) {
  const wrap = document.getElementById('today-schedule');
  if (!wrap) return;
  if (!appts.length) {
    wrap.innerHTML = '<p class="text-muted" style="padding:1rem;">No appointments today.</p>';
    return;
  }
  wrap.innerHTML = buildScheduleTable(appts);
}

function renderScheduleTable(filter = '') {
  const wrap = document.getElementById('schedule-table');
  if (!wrap) return;
  const data = filter
    ? _scheduleData.filter(a => a.status_name === filter)
    : _scheduleData;
  wrap.innerHTML = data.length ? buildScheduleTable(data)
    : '<p class="text-muted" style="padding:1rem;">No appointments found.</p>';
}

function buildScheduleTable(appts) {
  const rows = appts.map(a => `
    <tr>
      <td>${formatDate(a.appointment_date)}</td>
      <td>${formatTime(a.appointment_time)}</td>
      <td>${a.patient_name || '–'}</td>
      <td>${a.reason || '–'}</td>
      <td>${statusBadge(a.status_name)}</td>
      <td>
        <button class="btn btn-secondary btn-sm"
                onclick="openStatusModal(${a.appointment_id}, ${getStatusId(a.status_name)})">
          <i class="ti ti-edit"></i> Update
        </button>
      </td>
    </tr>`).join('');
  return `<table><thead><tr>
    <th>Date</th><th>Time</th><th>Patient</th><th>Reason</th><th>Status</th><th>Action</th>
  </tr></thead><tbody>${rows}</tbody></table>`;
}

function getStatusId(name) {
  return { requested: 1, confirmed: 2, completed: 3, cancelled: 4 }[name] || 1;
}

async function loadPatients() {
  const data = await apiFetch('../php/patients.php?action=list');
  if (!data.success) return;
  _patientsData = data.data;
  renderPatientTable();
  // Populate patient select in record form
  const sel = document.getElementById('rec-patient');
  if (sel) {
    sel.innerHTML = '<option value="">Select patient…</option>' +
      _patientsData.map(p =>
        `<option value="${p.patient_id}">${p.first_name} ${p.last_name}</option>`
      ).join('');
  }
}

function renderPatientTable(search = '') {
  const wrap = document.getElementById('patients-table');
  if (!wrap) return;
  const list = search
    ? _patientsData.filter(p =>
        `${p.first_name} ${p.last_name} ${p.email}`.toLowerCase().includes(search.toLowerCase())
      )
    : _patientsData;

  if (!list.length) {
    wrap.innerHTML = '<p class="text-muted" style="padding:1rem;">No patients found.</p>';
    return;
  }
  const rows = list.map(p => `
    <tr>
      <td>${p.first_name} ${p.last_name}</td>
      <td>${p.email}</td>
      <td>${p.phone || '–'}</td>
      <td>${p.gender}</td>
      <td>${p.blood_type || '–'}</td>
    </tr>`).join('');
  wrap.innerHTML = `<table><thead><tr>
    <th>Name</th><th>Email</th><th>Phone</th><th>Gender</th><th>Blood Type</th>
  </tr></thead><tbody>${rows}</tbody></table>`;
}

function openStatusModal(apptId, currentStatusId) {
  selectedApptId = apptId;
  document.getElementById('modal-appt-id').textContent = apptId;
  document.getElementById('modal-status').value = currentStatusId;
  document.getElementById('status-modal').classList.add('open');
}

function closeModal() {
  document.getElementById('status-modal').classList.remove('open');
  selectedApptId = null;
}

async function submitStatusUpdate() {
  if (!selectedApptId) return;
  const statusId = parseInt(document.getElementById('modal-status').value, 10);

  const result = await apiFetch('../php/appointments.php?action=update_status', {
    method: 'POST',
    body: JSON.stringify({ appointment_id: selectedApptId, status_id: statusId }),
  });

  closeModal();
  if (result.success) {
    showFlash('flash-area', 'Status updated successfully.', 'success');
    await loadSchedule();
  } else {
    showFlash('flash-area', result.error || 'Update failed.', 'error');
  }
}

async function submitRecord(e) {
  e.preventDefault();
  if (!validateForm(e.target)) return;

  const patientId  = document.getElementById('rec-patient').value;
  const date       = document.getElementById('rec-date').value;
  const diagnosis  = document.getElementById('rec-diagnosis').value;
  const presc      = document.getElementById('rec-prescription').value;

  const result = await apiFetch('../php/patients.php?action=add_record', {
    method: 'POST',
    body: JSON.stringify({
      patient_id:   parseInt(patientId, 10),
      diagnosis,
      prescription: presc,
      record_date:  date,
    }),
  });

  if (result.success) {
    showFlash('flash-area', 'Medical record saved.', 'success');
    e.target.reset();
    document.getElementById('rec-date').value = new Date().toISOString().split('T')[0];
  } else {
    showFlash('flash-area', result.error || 'Save failed.', 'error');
  }
}

// Close modal on overlay click
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('status-modal')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });
});
