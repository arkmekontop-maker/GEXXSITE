'use strict';
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const e = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const dialog = $('#accountDialog');
  const content = $('#accountContent');
  const profile = $('#profileButton');
  const avatar = $('#profileAvatar');
  const label = $('#profileLabel');
  let user = null;

  async function api(path, options = {}) {
    const res = await fetch(path, {credentials:'same-origin', ...options, headers:{'Content-Type':'application/json', ...(options.headers||{})}});
    let data = {};
    try { data = await res.json(); } catch {}
    if (!res.ok) throw new Error(data.error || 'Etwas ist schiefgelaufen.');
    return data;
  }

  function updateHeader() {
    if (!profile) return;
    if (user) {
      avatar.textContent = (user.name || user.username || 'A').trim().slice(0,1).toUpperCase();
      label.textContent = user.name || user.username;
      profile.setAttribute('aria-label', 'Mein Konto öffnen');
    } else {
      avatar.textContent = 'A';
      label.textContent = 'Anmelden';
      profile.setAttribute('aria-label', 'Anmelden oder registrieren');
    }
  }

  function form(mode = 'login', error = '') {
    const register = mode === 'register';
    content.innerHTML = `<div class="auth-box">
      <div class="eyebrow">ATHAR · ${register ? 'REGISTRIEREN' : 'WILLKOMMEN ZURÜCK'}</div>
      <h3>${register ? 'Dein Konto erstellen.' : 'Schön, dich wiederzusehen.'}</h3>
      <p class="muted">${register ? 'Erstelle ein Konto und nutze deinen persönlichen Lernbereich auf allen Geräten.' : 'Melde dich an, um deinen persönlichen Bereich und die Gemeinschaft zu nutzen.'}</p>
      ${error ? `<div class="auth-error" role="alert">${e(error)}</div>` : ''}
      <form id="authForm" novalidate>
        ${register ? `<label class="auth-label">Anzeigename<input class="large-input" name="name" maxlength="40" required autocomplete="name" placeholder="Dein Name"></label>` : ''}
        <label class="auth-label">Benutzername<input class="large-input" name="username" maxlength="30" required autocomplete="username" autocapitalize="none" placeholder="z. B. abdullah_01"></label>
        <label class="auth-label">Passwort<input class="large-input" name="password" type="password" minlength="10" maxlength="128" required autocomplete="${register ? 'new-password' : 'current-password'}" placeholder="Mindestens 10 Zeichen"></label>
        <button class="button gold auth-submit" type="submit">${register ? 'Konto erstellen' : 'Anmelden'} ${register ? '→' : '→'}</button>
      </form>
      <button class="text-link auth-switch" type="button">${register ? 'Ich habe bereits ein Konto → Anmelden' : 'Noch kein Konto? → Registrieren'}</button>
    </div>`;
    $('#authForm').addEventListener('submit', async ev => {
      ev.preventDefault();
      const data = Object.fromEntries(new FormData(ev.currentTarget));
      const button = $('.auth-submit');
      button.disabled = true;
      try {
        const result = await api(register ? '/api/register' : '/api/login', {method:'POST', body:JSON.stringify(data)});
        user = result.user;
        updateHeader();
        dialog.close();
        if (window.ATHAR_AUTH_CHANGED) window.ATHAR_AUTH_CHANGED(user);
        if (window.ATHAR_TOAST) window.ATHAR_TOAST(`Willkommen, ${user.name || user.username}!`);
      } catch (err) {
        button.disabled = false;
        form(mode, err.message);
      }
    });
    $('.auth-switch').addEventListener('click', () => form(register ? 'login' : 'register'));
  }

  function account() {
    if (user) {
      content.innerHTML = `<div class="auth-box">
        <div class="profile-large"><span class="profile-avatar">${e((user.name || user.username).slice(0,1).toUpperCase())}</span><div><div class="eyebrow">ANGEMELDET</div><h3>${e(user.name || user.username)}</h3><p class="muted">@${e(user.username)}</p></div></div>
        <div class="account-actions"><button class="button secondary" id="logoutButton">Abmelden</button></div>
      </div>`;
      $('#logoutButton').addEventListener('click', async () => {
        try { await api('/api/logout', {method:'POST', body:'{}'}); } catch {}
        user = null;
        updateHeader();
        dialog.close();
        if (window.ATHAR_AUTH_CHANGED) window.ATHAR_AUTH_CHANGED(null);
      });
    } else form('login');
    dialog.showModal();
  }

  if (profile) {
    const clean = profile.cloneNode(true);
    profile.replaceWith(clean);
    clean.addEventListener('click', account);
  }

  updateHeader();
  api('/api/session').then(data => { user = data.user || null; updateHeader(); if (window.ATHAR_AUTH_CHANGED) window.ATHAR_AUTH_CHANGED(user); }).catch(() => {});
})();
