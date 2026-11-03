// js/auth.js  –  Login page logic
'use strict';

document.addEventListener('DOMContentLoaded', async () => {

  // ── Set max DOB (today) ──────────────────────────────────
  const dobInput = document.getElementById('reg-dob');
  if (dobInput) dobInput.max = new Date().toISOString().split('T')[0];

  // ── Load CSRF tokens ─────────────────────────────────────
  try {
    const res  = await fetch('../php/session_data.php');
    if (res.ok) {
      const data = await res.json();
      const lc = document.getElementById('login-csrf');
      const rc = document.getElementById('reg-csrf');
      if (lc) lc.value = data.csrf_token;
      if (rc) rc.value = data.csrf_token;
    }
  } catch { /* no session yet – CSRF injected by PHP on next request */ }

  // ── Flash message from PHP session ──────────────────────
  // PHP sets flash in session; we read it via a lightweight endpoint.
  // Simpler: PHP echoes it in a <meta> tag — but we do it JS-friendly:
  const flashMeta = document.querySelector('meta[name="flash-msg"]');
  if (flashMeta) {
    const flashEl = document.getElementById('flash-msg');
    if (flashEl) {
      const type = flashMeta.dataset.type || 'info';
      flashEl.innerHTML = `<div class="alert alert-${type}">${flashMeta.content}</div>`;
      flashEl.classList.remove('d-none');
    }
  }

  // ── Tabs ──────────────────────────────────────────────────
  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      document.querySelectorAll('.auth-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === target));
      document.querySelectorAll('.auth-form').forEach(f => f.classList.toggle('active', f.id === target + '-form'));
    });
  });

  // ── Password toggle ───────────────────────────────────────
  const toggleBtn  = document.getElementById('toggle-pass');
  const passInput  = document.getElementById('login-pass');
  if (toggleBtn && passInput) {
    toggleBtn.addEventListener('click', () => {
      const isText = passInput.type === 'text';
      passInput.type = isText ? 'password' : 'text';
      toggleBtn.innerHTML = isText ? '<i class="ti ti-eye"></i>' : '<i class="ti ti-eye-off"></i>';
    });
  }

  // ── Attach validation ─────────────────────────────────────
  attachValidation('login-form');
  attachValidation('register-form');

  // ── Login form submit ─────────────────────────────────────
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', e => {
      if (!validateForm(loginForm)) e.preventDefault();
    });
  }

  // ── Register form submit ──────────────────────────────────
  const regForm = document.getElementById('register-form');
  if (regForm) {
    regForm.addEventListener('submit', e => {
      if (!validateForm(regForm)) e.preventDefault();
    });
  }
});
