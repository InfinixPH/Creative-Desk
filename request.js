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
    </div>`;
}
