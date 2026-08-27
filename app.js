// ==== CONFIG ====
const API_URL = 'https://script.google.com/macros/s/AKfycbxTuZWSd0mUOrcusWsa9a3LkIxm78fI-RoFVRnhDnjwBRdSmv8WSxl3rMm2vuOky6A6tA/exec';

// ==== STATE ====
let allRequests = [];
let currentTicket = null;
let currentStatus = null;

// ==== NAV ====
document.querySelectorAll('nav button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.view).classList.add('active');
  });
});

// ==== HELPERS ====
function statusToColumn(status) {
  const map = { 'Pending': 'pending', 'Ongoing': 'ongoing', 'Done': 'done', 'Cancelled': 'void' };
  return map[status] || 'pending';
}

function fmtDate(d) {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date)) return d;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function ticketHTML(r) {
  const col = statusToColumn(r.Status);
  const stamp = col === 'done' ? '<div class="stamp done">Done</div>'
              : col === 'void' ? '<div class="stamp void">Void</div>' : '';
  return `
    <div class="ticket" onclick="openModal('${r.RequestID}')">
      <div class="tape"></div>
      <div class="t-id">${r.RequestID}</div>
      <div class="t-title">${escapeHTML(r.ProjectTitle)}</div>
      <div class="t-meta"><span>${escapeHTML(r.RequestorName)}</span><span class="t-deadline">${fmtDate(r.Deadline)}</span></div>
      ${stamp}
    </div>`;
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

// ==== LOAD BOARD ====
async function loadBoard() {
  document.getElementById('board-loading').style.display = 'block';
  document.getElementById('board-empty').style.display = 'none';
  try {
    const res = await fetch(`${API_URL}?action=list`);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Failed to load');
    allRequests = data.requests;
    renderBoard();
  } catch (err) {
    document.getElementById('board-loading').textContent = 'Could not load tickets. Refresh to try again.';
    console.error(err);
  }
}

function renderBoard() {
  document.getElementById('board-loading').style.display = 'none';
  const cols = { pending: [], ongoing: [], done: [], void: [] };
  allRequests.forEach(r => cols[statusToColumn(r.Status)].push(r));

  ['pending', 'ongoing', 'done', 'void'].forEach(c => {
    document.getElementById(`col-${c}`).innerHTML = cols[c].map(ticketHTML).join('');
    document.getElementById(`count-${c}`).textContent = cols[c].length;
  });

  document.getElementById('board-empty').style.display = allRequests.length === 0 ? 'block' : 'none';
}

// ==== MODAL ====
function openModal(id) {
  currentTicket = allRequests.find(r => r.RequestID === id);
  if (!currentTicket) return;

  document.getElementById('m-id').textContent = currentTicket.RequestID;
  document.getElementById('m-title').textContent = currentTicket.ProjectTitle;
  document.getElementById('m-req').textContent = currentTicket.RequestorName;
  document.getElementById('m-due').textContent = 'Due ' + fmtDate(currentTicket.Deadline);
  document.getElementById('m-brief').textContent = currentTicket.Brief;

  currentStatus = currentTicket.Status;
  document.querySelectorAll('.status-btn').forEach(b => b.classList.toggle('sel', b.dataset.s === currentStatus));
  document.getElementById('attach-box').classList.toggle('show', currentStatus === 'Done');
  document.getElementById('attach-input').value = currentTicket.FileLink || '';

  document.getElementById('overlay').classList.add('active');
}

function closeModal() {
  document.getElementById('overlay').classList.remove('active');
}

function setStatus(s) {
  currentStatus = s;
  document.querySelectorAll('.status-btn').forEach(b => b.classList.toggle('sel', b.dataset.s === s));
  document.getElementById('attach-box').classList.toggle('show', s === 'Done');
}

async function confirmStatus() {
  if (!currentTicket) return;
  const btn = document.getElementById('confirm-btn');
  const fileLink = document.getElementById('attach-input').value.trim();

  if (currentStatus === 'Done' && !fileLink) {
    alert('Add a file link before marking this Done — that\'s what gets sent to the requestor.');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Saving…';
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'updateStatus',
        id: currentTicket.RequestID,
        status: currentStatus,
        fileLink: fileLink
      })
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Failed to update');

    closeModal();
    showToast(currentStatus === 'Done' ? '✓ Marked done — requestor notified' : '✓ Status updated');
    loadBoard();
  } catch (err) {
    alert('Could not save — check your connection and try again.');
    console.error(err);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save & Notify';
  }
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2600);
}

// ==== NEW REQUEST FORM ====
document.getElementById('f-submit').addEventListener('click', async () => {
  const name = document.getElementById('f-name').value.trim();
  const email = document.getElementById('f-email').value.trim();
  const title = document.getElementById('f-title').value.trim();
  const brief = document.getElementById('f-brief').value.trim();
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
        deadline: deadline
      })
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Failed to submit');

    resultEl.textContent = `✓ Submitted — your ticket ID is ${data.id}. Save it to track status.`;
    resultEl.className = 'result-msg ok';
    ['f-name', 'f-email', 'f-title', 'f-brief', 'f-deadline'].forEach(id => document.getElementById(id).value = '');
    loadBoard();
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
  const pillLabel = { pending: 'Pending', ongoing: 'Ongoing', done: '✓ Done', void: 'Cancelled' }[col];

  let fileLinkHTML = '';
  if (r.Status === 'Done' && r.FileLink) {
    fileLinkHTML = `<a href="${escapeHTML(r.FileLink)}" target="_blank" class="file-link">📎 View final file →</a>`;
  }

  document.getElementById('tr-result').innerHTML = `
    <div class="receipt">
      <span class="status-pill ${col}">${pillLabel}</span>
      <div class="r-title">${escapeHTML(r.ProjectTitle)}</div>
      <div class="t-meta" style="border:none; padding:0;"><span>${r.RequestID}</span><span>Requested by ${escapeHTML(r.RequestorName)}</span></div>
      ${fileLinkHTML}
      <div class="timeline">
        <div class="tl-item"><b>${fmtDate(r.Timestamp)}</b> — Ticket submitted</div>
        ${r.Status !== 'Pending' ? `<div class="tl-item"><b>${fmtDate(r.LastUpdated)}</b> — Status: ${r.Status}</div>` : ''}
      </div>
    </div>`;
}

// ==== INIT ====
loadBoard();
