// js/patient.js  –  Patient dashboard logic
'use strict';

let SESSION = {};

document.addEventListener('DOMContentLoaded', async () => {
  // ── Verify session ────────────────────────────────────────
  const res = await apiFetch('../php/session_data.php');
  if (res.error || res.role !== 'patient') {
    location.href = '../html/login.html';
    return;
  }
  SESSION = res;
  document.getElementById('nav-user').textContent   = SESSION.full_name;
  document.getElementById('greeting-name').textContent = SESSION.full_name.split(' ')[0];

  // ── Sidebar ───────────────────────────────────────────────
  initSidebar();

  // ── Set booking date min ──────────────────────────────────
  const dateInput = document.getElementById('book-date');
  if (dateInput) dateInput.min = new Date().toISOString().split('T')[0];

  // ── Load data ─────────────────────────────────────────────
  await loadAppointments();
  await loadProfile();
  await loadDoctors();

  // ── Attach validation ─────────────────────────────────────
  attachValidation('booking-form');
  attachValidation('profile-form');

  // ── Booking form ──────────────────────────────────────────
  document.getElementById('booking-form').addEventListener('submit', async e => {
    e.preventDefault();
    if (!validateForm(e.target)) return;

    const csrf = SESSION.csrf_token;
    document.getElementById('booking-csrf').value = csrf;

    const payload = {
      csrf_token:       csrf,
      doctor_id:        document.getElementById('book-doctor').value,
      appointment_date: document.getElementById('book-date').value,
      appointment_time: document.getElementById('book-time').value + ':00',
      reason:           document.getElementById('book-reason').value,
    };

    const result = await apiFetch('../php/appointments.php?action=create', {
      method: 'POST', body: JSON.stringify(payload),
    });

    if (result.success) {
      showFlash('flash-area', 'Appointment booked successfully!', 'success');
      e.target.reset();
      await loadAppointments();
      showSection('overview');
    } else {
      showFlash('flash-area', result.error || 'Booking failed.', 'error');
    }
  });

  // ── Profile form ──────────────────────────────────────────
  document.getElementById('profile-form').addEventListener('submit', async e => {
    e.preventDefault();

    const payload = {
      csrf_token: SESSION.csrf_token,
      phone:      document.getElementById('profile-phone').value,
      address:    document.getElementById('profile-address').value,
      blood_type: document.getElementById('profile-blood').value,
    };

    const result = await apiFetch('../php/patients.php?action=update_profile', {
      method: 'POST', body: JSON.stringify(payload),
    });

    showFlash('flash-area',
      result.success ? 'Profile updated!' : (result.error || 'Update failed.'),
      result.success ? 'success' : 'error'
    );
  });
});

async function loadAppointments() {
  const data = await apiFetch('../php/appointments.php?action=list');
  if (!data.success) return;

  AppointmentStore.load(data.data);

  // Stats
  document.getElementById('stat-upcoming').textContent  = AppointmentStore.countUpcoming();
  document.getElementById('stat-completed').textContent = AppointmentStore.countByStatus('completed');
  document.getElementById('stat-cancelled').textContent = AppointmentStore.countByStatus('cancelled');

  // Records stat (separate call)
  loadRecordCount();

  renderUpcomingTable();
  renderAllAppointments();
}

function renderUpcomingTable() {
  const today = new Date().toISOString().split('T')[0];
  const upcoming = AppointmentStore.filter()
    .filter(a => (a.status_name === 'confirmed' || a.status_name === 'requested') && a.appointment_date >= today)
    .slice(0, 5);

  const wrap = document.getElementById('upcoming-table-wrap');
  if (!upcoming.length) {
    wrap.innerHTML = '<p class="text-muted" style="padding:1rem;">No upcoming appointments.</p>';
    return;
  }
  wrap.innerHTML = buildApptTable(upcoming, true);
}

function renderAllAppointments() {
  const wrap = document.getElementById('all-appts-wrap');
  if (!wrap) return;
  const all = AppointmentStore.all();
  if (!all.length) {
    wrap.innerHTML = '<p class="text-muted" style="padding:1rem;">No appointments found.</p>';
    return;
  }
  wrap.innerHTML = buildApptTable(all, true);
}

function buildApptTable(appts, showCancel = false) {
  const rows = appts.map(a => `
    <tr>
      <td>${formatDate(a.appointment_date)}</td>
      <td>${formatTime(a.appointment_time)}</td>
      <td>${a.doctor_name || '–'}</td>
      <td>${a.specialisation_name || '–'}</td>
      <td>${a.reason || '–'}</td>
      <td>${statusBadge(a.status_name)}</td>
      ${showCancel && (a.status_name === 'requested' || a.status_name === 'confirmed') ? `
      <td>
        <button class="btn btn-danger btn-sm" onclick="cancelAppointment(${a.appointment_id})">
          <i class="ti ti-x"></i> Cancel
        </button>
      </td>` : '<td></td>'}
    </tr>`).join('');

  return `<table>
    <thead><tr>
      <th>Date</th><th>Time</th><th>Doctor</th><th>Specialisation</th>
      <th>Reason</th><th>Status</th><th>Action</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

async function cancelAppointment(apptId) {
  if (!confirm('Cancel this appointment?')) return;
  const result = await apiFetch('../php/appointments.php?action=cancel', {
    method: 'POST',
    body: JSON.stringify({ csrf_token: SESSION.csrf_token, appointment_id: apptId }),
  });
  if (result.success) {
    showFlash('flash-area', 'Appointment cancelled.', 'success');
    await loadAppointments();
  } else {
    showFlash('flash-area', result.error || 'Could not cancel.', 'error');
  }
}

async function loadProfile() {
  const data = await apiFetch('../php/patients.php?action=profile');
  if (!data.success) return;
  const p = data.data;
  document.getElementById('profile-name').value   = p.first_name + ' ' + p.last_name;
  document.getElementById('profile-email').value  = p.email;
  document.getElementById('profile-phone').value  = p.phone || '';
  document.getElementById('profile-address').value= p.address || '';
  const bloodSel = document.getElementById('profile-blood');
  if (bloodSel && p.blood_type) bloodSel.value = p.blood_type;

  // Also load medical records
  if (p.patient_id) loadRecords(p.patient_id);
}

async function loadRecordCount() {
  // We load the count from the already-fetched records
}

async function loadRecords(patientId) {
  const data = await apiFetch(`../php/patients.php?action=records&patient_id=${patientId}`);
  document.getElementById('stat-records').textContent = data.success ? data.data.length : '–';

  const wrap = document.getElementById('records-wrap');
  if (!wrap || !data.success || !data.data.length) {
    if (wrap) wrap.innerHTML = '<p class="text-muted" style="padding:1rem;">No medical records on file.</p>';
    return;
  }
  const rows = data.data.map(r => `
    <tr>
      <td>${formatDate(r.record_date)}</td>
      <td>${r.doctor_name}</td>
      <td>${r.diagnosis}</td>
      <td>${r.prescription || '–'}</td>
    </tr>`).join('');
  wrap.innerHTML = `<table><thead><tr>
    <th>Date</th><th>Doctor</th><th>Diagnosis</th><th>Prescription</th>
  </tr></thead><tbody>${rows}</tbody></table>`;
}

async function loadDoctors() {
  const data = await apiFetch('../php/appointments.php?action=doctors');
  const sel  = document.getElementById('book-doctor');
  if (!data.success || !sel) return;
  sel.innerHTML = '<option value="">Select a doctor…</option>' +
    data.data.map(d =>
      `<option value="${d.doctor_id}">Dr ${d.doctor_name} – ${d.specialisation_name}</option>`
    ).join('');
}
