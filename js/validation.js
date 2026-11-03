// js/validation.js  –  Reusable client-side validation (Question 9)
'use strict';

/**
 * Validate a single input element; show/hide its paired .form-error element.
 * Returns true if valid.
 */
function validateField(input) {
  const errEl = document.getElementById('err-' + input.id.replace(/^(reg-|login-|book-|rec-)/, ''));
  if (!errEl) return true;

  let valid = true;
  const val = input.value.trim();

  // Required
  if (input.required && val === '') {
    valid = false;
  }
  // Email
  if (input.type === 'email' && val !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
    valid = false;
  }
  // minlength
  if (input.minLength > 0 && val.length < input.minLength && val !== '') {
    valid = false;
  }
  // Password strength: 8+ chars, 1 uppercase, 1 number
  if (input.id === 'reg-pass') {
    if (!/^(?=.*[A-Z])(?=.*[0-9]).{8,}$/.test(val)) valid = false;
  }
  // Confirm password
  if (input.id === 'reg-pass2') {
    const pass1 = document.getElementById('reg-pass');
    if (pass1 && val !== pass1.value) valid = false;
  }
  // Date must not be in the past (for booking)
  if (input.id === 'book-date' && val !== '') {
    const today = new Date();
    today.setHours(0,0,0,0);
    if (new Date(val) < today) valid = false;
  }
  // Time in range 08:00–17:00
  if (input.id === 'book-time' && val !== '') {
    const [h, m] = val.split(':').map(Number);
    const mins = h * 60 + m;
    if (mins < 480 || mins > 1020) valid = false;
  }

  input.classList.toggle('invalid', !valid);
  errEl.classList.toggle('show', !valid);
  return valid;
}

/**
 * Validate all inputs in a form. Returns true only if every field passes.
 */
function validateForm(form) {
  const inputs = form.querySelectorAll('input[required], select[required], textarea[required]');
  let allValid = true;
  inputs.forEach(inp => {
    if (!validateField(inp)) allValid = false;
  });
  return allValid;
}

/**
 * Attach real-time validation listeners to every required field in a form.
 */
function attachValidation(formId) {
  const form = document.getElementById(formId);
  if (!form) return;
  form.querySelectorAll('input, select, textarea').forEach(inp => {
    inp.addEventListener('blur',  () => validateField(inp));
    inp.addEventListener('input', () => inp.classList.contains('invalid') && validateField(inp));
  });
}

// ── Appointment list management (array/object-based, Q9.2) ──────────────────
const AppointmentStore = (() => {
  let _appointments = [];  // in-memory array of appointment objects

  return {
    /**
     * Load appointments from the API into the store.
     * @param {Array} data
     */
    load(data) {
      _appointments = data.map(a => ({ ...a }));  // shallow clone each object
    },

    /**
     * Get all appointments, optionally filtered by status.
     * @param {string} status – filter by status_name (empty = all)
     */
    filter(status = '') {
      if (!status) return _appointments;
      return _appointments.filter(a => a.status_name === status);
    },

    /**
     * Search by any string field.
     */
    search(query) {
      const q = query.toLowerCase();
      return _appointments.filter(a =>
        Object.values(a).some(v => String(v).toLowerCase().includes(q))
      );
    },

    /**
     * Count by status.
     */
    countByStatus(status) {
      return _appointments.filter(a => a.status_name === status).length;
    },

    /**
     * Count upcoming (confirmed or requested, date >= today).
     */
    countUpcoming() {
      const today = new Date().toISOString().split('T')[0];
      return _appointments.filter(a =>
        (a.status_name === 'confirmed' || a.status_name === 'requested') &&
        a.appointment_date >= today
      ).length;
    },

    all() { return _appointments; },
  };
})();

// ── Utility helpers ─────────────────────────────────────────────────────────

function statusBadge(status) {
  return `<span class="badge badge-${status}">${status}</span>`;
}

function formatDate(dateStr) {
  if (!dateStr) return '–';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-ZA', { day:'2-digit', month:'short', year:'numeric' });
}

function formatTime(timeStr) {
  if (!timeStr) return '–';
  const [h, m] = timeStr.split(':');
  const hNum = parseInt(h, 10);
  return `${hNum % 12 || 12}:${m} ${hNum >= 12 ? 'PM' : 'AM'}`;
}

function showFlash(containerId, message, type = 'success') {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = `<div class="alert alert-${type}"><i class="ti ti-${type==='success'?'check':'alert-circle'}"></i>${message}</div>`;
  setTimeout(() => { el.innerHTML = ''; }, 5000);
}

async function apiFetch(url, options = {}) {
  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
    });
    return res.json();
  } catch {
    return { error: 'Network error. Please try again.' };
  }
}

// Sidebar section switcher (shared by all dashboards)
function initSidebar() {
  document.querySelectorAll('.sidebar-item').forEach(item => {
    item.addEventListener('click', () => {
      const section = item.dataset.section;
      showSection(section);
    });
  });
}

function showSection(name) {
  document.querySelectorAll('.sidebar-item').forEach(i => {
    i.classList.toggle('active', i.dataset.section === name);
  });
  document.querySelectorAll('main > section').forEach(s => {
    s.classList.toggle('d-none', s.id !== 'sec-' + name);
  });
}
