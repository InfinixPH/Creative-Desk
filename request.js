// ==== NAV ====
document.querySelectorAll('nav button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.view).classList.add('active');
  });
});

// ==== PUBLIC STATS ====
async function loadPublicStats() {
  try {
    const res = await fetch(`${API_URL}?action=list`);
    const data = await res.json();
    if (!data.ok) return;

    const active = data.requests.filter(r => r.Archived !== true && r.Archived !== 'TRUE' && r.Archived !== 'true');
    const open = active.filter(r => r.Status === 'Pending' || r.Status === 'Ongoing').length;

    const now = new Date();
    const doneThisMonth = active.filter(r => {
      if (r.Status !== 'Done') return false;
      const d = new Date(r.LastUpdated);
      return !isNaN(d) && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;

    document.getElementById('sm-open').textContent = open;
    document.getElementById('sm-done').textContent = doneThisMonth;
  } catch (err) {
    console.error(err);
  }
}
loadPublicStats();

// ==== STATUS LIST ====
const STATUS_GROUPS = [
  { status: 'Done', label: '✓ Complete / Done' },
  { status: 'Ongoing', label: 'Ongoing' },
  { status: 'Pending', label: 'Pending' },
  { status: 'Cancelled', label: 'Cancelled' }
];

let statusListLoaded = false;
let statusListData = [];

function statusRowHTML(r) {
  const overdue = isOverdue(r.Deadline, r.Status);
  return `
    <div class="status-row-item" onclick="openStatusDetail('${r.RequestID}')">
      <div class="status-row-title">${escapeHTML(r.ProjectTitle)}</div>
      <div class="status-row-meta">
        <span>${escapeHTML(r.RequestorName)}</span>
        <span class="status-row-id">${r.RequestID}</span>
        <span class="${overdue ? 'status-row-overdue' : ''}">${overdue ? '⚠ ' : ''}${fmtDate(r.Deadline)}</span>
        <span class="status-row-arrow">view →</span>
      </div>
    </div>`;
}

async function loadStatusList() {
  const loadingEl = document.getElementById('status-loading');
  const listEl = document.getElementById('status-list');
  loadingEl.style.display = 'block';
  listEl.innerHTML = '';
  try {
    const res = await fetch(`${API_URL}?action=list`);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Failed to load');

    const active = data.requests.filter(r => r.Archived !== true && r.Archived !== 'TRUE' && r.Archived !== 'true');
    statusListData = active;

    loadingEl.style.display = 'none';
    listEl.innerHTML = STATUS_GROUPS.map(g => {
      const items = active
        .filter(r => r.Status === g.status)
        .sort((a, b) => new Date(a.Deadline) - new Date(b.Deadline));
      if (items.length === 0) return '';
      return `
        <div class="status-group">
          <div class="status-group-title">${g.label} <span class="col-count">${items.length}</span></div>
          ${items.map(statusRowHTML).join('')}
        </div>`;
    }).join('') || '<div class="empty-msg">No tickets yet.</div>';
  } catch (err) {
    loadingEl.textContent = 'Could not load status list.';
    console.error(err);
  }
}

function openStatusDetail(id) {
  const r = statusListData.find(x => x.RequestID === id);
  if (!r) return;

  document.getElementById('sd-id').textContent = r.RequestID;
  document.getElementById('sd-title').textContent = r.ProjectTitle;
  document.getElementById('sd-req').textContent = r.RequestorName;
  document.getElementById('sd-due').textContent = 'Due ' + fmtDate(r.Deadline);
  document.getElementById('sd-brief').textContent = r.Brief || '(no brief provided)';

  const refRow = document.getElementById('sd-ref-row');
  if (r.ReferenceLink) {
    refRow.style.display = 'block';
    refRow.innerHTML = `<a href="${escapeHTML(r.ReferenceLink)}" target="_blank" class="file-link">📎 View reference →</a>`;
  } else {
    refRow.style.display = 'none';
  }

  const fileRow = document.getElementById('sd-file-row');
  if (r.Status === 'Done' && r.FileLink) {
    fileRow.style.display = 'block';
    fileRow.innerHTML = `<a href="${escapeHTML(r.FileLink)}" target="_blank" class="file-link">📎 View final file →</a>`;
  } else {
    fileRow.style.display = 'none';
  }

  const notesRow = document.getElementById('sd-notes-row');
  if (r.Notes) {
    notesRow.style.display = 'block';
    notesRow.innerHTML = `<div class="modal-brief">${escapeHTML(r.Notes)}</div>`;
  } else {
    notesRow.style.display = 'none';
  }

  document.getElementById('status-overlay').classList.add('active');
}

function closeStatusDetail() {
  document.getElementById('status-overlay').classList.remove('active');
}

document.querySelector('nav button[data-view="status"]').addEventListener('click', () => {
  if (!statusListLoaded) {
    statusListLoaded = true;
    loadStatusList();
  }
});

// ==== NEW REQUEST FORM ====
document.getElementById('f-submit').addEventListener('click', async () => {
  const name = document.getElementById('f-name').value.trim();
  const email = document.getElementById('f-email').value.trim();
  const title = document.getElementById('f-title').value.trim();
  const brief = document.getElementById('f-brief').value.trim();
  const referenceLink = document.getElementById('f-reference').value.trim();
  const deadline = document.getElementById('f-deadline').value;
  const resultEl = document.getElementById('f-result');

  if (!name || !title || !brief) {
    resultEl.textContent = 'Fill in your name, a title, and a brief at least.';
    resultEl.className = 'result-msg err';
    return;
  }

  const btn = document.getElementById('f-submit');
  btn.disabled = true;
  btn.textContent = 'Submitting…';

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'create',
        requestorName: name,
        requestorEmail: email,
        projectTitle: title,
        brief: brief,
        referenceLink: referenceLink,
        deadline: deadline
      })
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Failed to submit');

    resultEl.textContent = `✓ Submitted — your ticket ID is ${data.id}. Save it to track status.`;
    resultEl.className = 'result-msg ok';
    ['f-name', 'f-email', 'f-title', 'f-brief', 'f-reference', 'f-deadline'].forEach(id => document.getElementById(id).value = '');
  } catch (err) {
    resultEl.textContent = 'Something went wrong — try again.';
    resultEl.className = 'result-msg err';
    console.error(err);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Submit Ticket →';
  }
});

// ==== TRACK STATUS ====
document.getElementById('tr-check').addEventListener('click', async () => {
  const id = document.getElementById('tr-id').value.trim();
  const resultEl = document.getElementById('tr-result');
  if (!id) return;

  resultEl.innerHTML = '<div class="empty-msg">Checking…</div>';
  try {
    const res = await fetch(`${API_URL}?action=get&id=${encodeURIComponent(id)}`);
    const data = await res.json();
    if (!data.ok) {
      resultEl.innerHTML = `<div class="tr-notfound">No ticket found for "${escapeHTML(id)}" — double-check the ID.</div>`;
      return;
    }
    renderReceipt(data.request);
  } catch (err) {
    resultEl.innerHTML = `<div class="tr-notfound">Could not check status — try again.</div>`;
    console.error(err);
  }
});

function renderReceipt(r) {
  const col = statusToColumn(r.Status);
  const overdue = isOverdue(r.Deadline, r.Status);
  const pillLabel = { pending: 'Pending', ongoing: 'Ongoing', done: '✓ Done', void: 'Cancelled' }[col];

  let fileLinkHTML = '';
  if (r.Status === 'Done' && r.FileLink) {
    fileLinkHTML = `<a href="${escapeHTML(r.FileLink)}" target="_blank" class="file-link">📎 View final file →</a>`;
  }

  let notesHTML = '';
  if (r.Notes) {
    notesHTML = `<div class="modal-brief" style="margin-top:14px;">${escapeHTML(r.Notes)}</div>`;
  }

  let tipHTML = '';
  if (r.Status === 'Done') {
    tipHTML = `
      <div class="tip-jar">
        <div class="tip-title">${escapeHTML(COFFEE_TITLE)}</div>
        <div class="tip-text">${escapeHTML(COFFEE_MESSAGE)}</div>
        <div class="tip-details">
          <a href="${COFFEE_QR_IMAGE}" target="_blank" class="tip-qr-link">
            <img src="${COFFEE_QR_IMAGE}" alt="GCash QR" class="tip-qr" onerror="this.parentElement.style.display='none'">
          </a>
          <div class="tip-qr-hint">Tap the QR to view full size</div>
          <div class="tip-number">GCash: <b>${escapeHTML(COFFEE_NUMBER)}</b></div>
        </div>
      </div>`;
  }

  let followUpHTML = '';
  if (r.Status === 'Pending' || r.Status === 'Ongoing') {
    const count = Number(r.FollowUpCount) || 0;
    followUpHTML = `
      <div class="followup-box">
        ${count > 0 ? `<div class="followup-note">🔔 Followed up ${count} time${count > 1 ? 's' : ''} — last on ${fmtDate(r.LastFollowUp)}</div>` : ''}
        <textarea id="fu-message" placeholder="Optional note for the artist (e.g. 'just checking in', 'need this sooner')..."></textarea>
        <button id="fu-send" onclick="sendFollowUp('${r.RequestID}')">🔔 Send follow-up</button>
        <div id="fu-result" class="result-msg"></div>
      </div>`;
  }

  document.getElementById('tr-result').innerHTML = `
    <div class="receipt">
      <span class="status-pill ${col}">${pillLabel}</span>
      ${overdue ? '<span class="status-pill void" style="margin-left:6px;">⚠ Past deadline</span>' : ''}
      <div class="r-title">${escapeHTML(r.ProjectTitle)}</div>
      <div class="t-meta" style="border:none; padding:0;"><span>${r.RequestID}</span><span>Requested by ${escapeHTML(r.RequestorName)}</span></div>
      ${fileLinkHTML}
      ${notesHTML}
      <div class="timeline">
        <div class="tl-item"><b>${fmtDate(r.Timestamp)}</b> — Ticket submitted</div>
        ${r.Status !== 'Pending' ? `<div class="tl-item"><b>${fmtDate(r.LastUpdated)}</b> — Status: ${r.Status}</div>` : ''}
      </div>
      ${followUpHTML}
      ${tipHTML}
    </div>`;
}

async function sendFollowUp(id) {
  const btn = document.getElementById('fu-send');
  const resultEl = document.getElementById('fu-result');
  const message = document.getElementById('fu-message').value.trim();

  btn.disabled = true;
  btn.textContent = 'Sending…';
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'followUp', id: id, message: message })
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Failed to send');

    resultEl.textContent = '✓ Follow-up sent — the artist has been notified.';
    resultEl.className = 'result-msg ok';
    btn.textContent = '🔔 Send follow-up';
    btn.disabled = false;
    document.getElementById('fu-message').value = '';
  } catch (err) {
    resultEl.textContent = err.message || 'Could not send — try again.';
    resultEl.className = 'result-msg err';
    btn.textContent = '🔔 Send follow-up';
    btn.disabled = false;
    console.error(err);
  }
}
