'use strict';

const checklistItems = [
  'Backup kit + spawn kit verteilt',
  'Cryos, Med Brews & Food geprüft',
  'Ammo, C4 und Werkzeug gezählt',
  'Scouts online, Ausweichroute klar',
  'Push- und Defend-Rollen verteilt',
  'Tribute / Upload-Limits geprüft',
  'Kit-Cache außerhalb der Base gesetzt',
  'Raid-Ziel und Abbruchsignal bestätigt'
];
const safeRead = (key, fallback) => {
  try { const value = JSON.parse(localStorage.getItem(key)); return value ?? fallback; }
  catch { return fallback; }
};
const safeWrite = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch { return false; }
};

const raidChecklist = document.querySelector('#raidChecklist');
const savedChecks = new Set(safeRead('fieldops-raid-checks', []));
function renderChecklist() {
  raidChecklist.innerHTML = '';
  checklistItems.forEach((label, index) => {
    const li = document.createElement('li');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = savedChecks.has(index);
    input.setAttribute('aria-label', label);
    const text = document.createElement('span');
    text.textContent = label;
    li.classList.toggle('done', input.checked);
    input.addEventListener('change', () => {
      if (input.checked) savedChecks.add(index); else savedChecks.delete(index);
      li.classList.toggle('done', input.checked);
      safeWrite('fieldops-raid-checks', [...savedChecks]);
      updateProgress();
    });
    li.addEventListener('click', event => {
      if (event.target !== input) input.click();
    });
    li.append(input, text);
    raidChecklist.append(li);
  });
  updateProgress();
}
function updateProgress() {
  const complete = savedChecks.size;
  document.querySelector('#checkProgress').textContent = `${complete} / ${checklistItems.length} COMPLETE`;
  document.querySelector('#progressBar').style.width = `${complete / checklistItems.length * 100}%`;
}
document.querySelector('#resetChecklist').addEventListener('click', () => {
  savedChecks.clear();
  safeWrite('fieldops-raid-checks', []);
  renderChecklist();
});
renderChecklist();

const rosterList = document.querySelector('#rosterList');
let roster = safeRead('fieldops-roster', []);
if (!Array.isArray(roster)) roster = [];
function renderRoster() {
  document.querySelector('#memberCount').textContent = roster.length;
  rosterList.replaceChildren();
  if (!roster.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-roster';
    empty.textContent = 'Noch keine Survivors eingetragen. Trag dein Squad lokal ein.';
    rosterList.append(empty);
    return;
  }
  roster.forEach((member, index) => {
    const row = document.createElement('div');
    row.className = 'roster-row';
    const avatar = document.createElement('span');
    avatar.className = 'roster-avatar';
    avatar.textContent = member.name.trim().slice(0, 2).toUpperCase();
    const name = document.createElement('span');
    name.className = 'roster-name';
    name.textContent = member.name;
    const role = document.createElement('span');
    role.className = 'roster-role';
    role.textContent = member.role;
    const remove = document.createElement('button');
    remove.className = 'remove-member';
    remove.type = 'button';
    remove.setAttribute('aria-label', `${member.name} entfernen`);
    remove.textContent = '×';
    remove.addEventListener('click', () => {
      roster.splice(index, 1);
      safeWrite('fieldops-roster', roster);
      renderRoster();
    });
    row.append(avatar, name, role, remove);
    rosterList.append(row);
  });
}
document.querySelector('#memberForm').addEventListener('submit', event => {
  event.preventDefault();
  const input = document.querySelector('#memberName');
  const name = input.value.trim();
  if (!name) return;
  roster.push({ name, role: document.querySelector('#memberRole').value });
  safeWrite('fieldops-roster', roster);
  input.value = '';
  input.focus();
  renderRoster();
});
renderRoster();

document.querySelectorAll('.filter-chip').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.filter-chip').forEach(chip => chip.classList.toggle('selected', chip === button));
    document.querySelectorAll('.tool-card').forEach(card => {
      card.hidden = button.dataset.filter !== 'all' && card.dataset.category !== button.dataset.filter;
    });
  });
});

const menuToggle = document.querySelector('.menu-toggle');
const mainNav = document.querySelector('.main-nav');
menuToggle.addEventListener('click', () => {
  const open = mainNav.classList.toggle('open');
  menuToggle.setAttribute('aria-expanded', String(open));
  menuToggle.setAttribute('aria-label', open ? 'Menü schließen' : 'Menü öffnen');
});
mainNav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
  mainNav.classList.remove('open');
  menuToggle.setAttribute('aria-expanded', 'false');
}));

