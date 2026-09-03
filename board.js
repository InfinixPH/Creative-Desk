// ==== PIN GATE ====
const BOARD_PIN = '1234'; // change this to whatever you like

function checkPin() {
  const input = document.getElementById('pin-input').value.trim();
  const errEl = document.getElementById('pin-error');
  if (input === BOARD_PIN) {
    sessionStorage.setItem('board-unlocked', 'yes');
    document.getElementById('pin-gate').style.display = 'none';
    document.getElementById('board-app').style.display = 'block';
    loadBoard();
  } else {
    errEl.textContent = 'Wrong PIN.';
  }
}

document.getElementById('pin-submit').addEventListener('click', checkPin);
document.getElementById('pin-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') checkPin();
});

if (sessionStorage.getItem('board-unlocked') === 'yes') {
  document.getElementById('pin-gate').style.display = 'none';
  document.getElementById('board-app').style.display = 'block';
  loadBoard();
}

// ==== STATE ====
let allRequests = [];
let currentTicket = null;
let currentStatus = null;
let showingArchive = false;
let searchTerm = '';

const COLUMNS = [
  { key: 'pending', label: 'Pending' },
  { key: 'ongoing', label: 'Ongoing' },
  { key: 'review', label: 'For Review' },
  { key: 'done', label: 'Done' },
  { key: 'void', label: 'Cancelled' }
];

// ==== FLAG HELPERS ====
function isTrue(v) { return v === true || v === 'TRUE' || v === 'true'; }

// ==== TICKET RENDER ====
function ticketHTML(r, i) {
  const col = statusToColumn(r.Status);
  const stamp = col === 'done' ? '<div class="stamp done">Done</div>'
              : col === 'void' ? '<div class="stamp void">Void</div>'
              : col === 'review' ? '<div class="stamp review">Review</div>' : '';
  const overdue = isOverdue(r.Deadline, r.Status);
  const deadlineLabel = overdue ? `⚠ ${fmtDate(r.Deadline)}` : fmtDate(r.Deadline);
  const flame = isTrue(r.Priority) ? '🔥 ' : '';
  const followCount = Number(r.FollowUpCount) || 0;
  const bell = followCount > 0 ? `<span class="followup-badge">🔔 ${followCount}</span>` : '';
  const revisionCount = Number(r.RevisionCount) || 0;
  const revBadge = revisionCount > 0 ? `<span class="revision-badge">↺ ${revisionCount}</span>` : '';
  const rot = (i % 2 === 0) ? '-0.6deg' : '0.7deg';
  const delay = Math.min((i || 0) * 0.04, 0.3);
  return `
    <div class="ticket" data-request-id="${escapeHTML(r.RequestID)}" style="--rot:${rot}; animation-delay:${delay}s;">
      <div class="tape"></div>
      <div class="t-id">${r.RequestID} ${bell}${revBadge}</div>
      <div class="t-title">${flame}${escapeHTML(r.ProjectTitle)}</div>
      <div class="t-meta"><span>${escapeHTML(r.RequestorName)}</span><span class="t-deadline${overdue ? ' soon' : ''}">${deadlineLabel}</span></div>
      ${stamp}
    </div>`;
}

// ==== LOAD BOARD ====
const BOARD_LOADING_MESSAGES = ['Sorting the inbox tray…', 'Dusting off the ledger…', 'Flipping through job tickets…', 'Stamping in progress…'];

async function loadBoard() {
  const loadingEl = document.getElementById('board-loading');
  loadingEl.textContent = randomLoadingMessage(BOARD_LOADING_MESSAGES);
  loadingEl.style.display = 'block';
  document.getElementById('board-empty').style.display = 'none';
  try {
    const data = await fetchRequestList(true);
    if (!data.ok) throw new Error(data.error || 'Failed to load');
    allRequests = data.requests;
    renderStats();
    renderBoard();
  } catch (err) {
    loadingEl.textContent = 'Could not load tickets. Refresh to try again.';
    console.error(err);
  }
}

// ==== STATS ====
function renderStats() {
  const active = allRequests.filter(r => !isTrue(r.Archived));
  const open = active.filter(r => r.Status === 'Pending' || r.Status === 'Ongoing').length;
  const overdue = active.filter(r => isOverdue(r.Deadline, r.Status)).length;

  const now = new Date();
  const doneThisMonth = active.filter(r => {
    if (r.Status !== 'Done') return false;
    const d = new Date(r.LastUpdated);
    return !isNaN(d) && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const doneWithDates = active.filter(r => r.Status === 'Done' && r.Timestamp && r.LastUpdated);
  let avgTurnaround = '—';
  if (doneWithDates.length > 0) {
    const totalDays = doneWithDates.reduce((sum, r) => {
      const start = new Date(r.Timestamp), end = new Date(r.LastUpdated);
      if (isNaN(start) || isNaN(end)) return sum;
      return sum + Math.max(0, (end - start) / (1000 * 60 * 60 * 24));
    }, 0);
    avgTurnaround = (totalDays / doneWithDates.length).toFixed(1);
  }

  document.getElementById('stat-open').textContent = open;
  document.getElementById('stat-overdue').textContent = overdue;
  document.getElementById('stat-done-month').textContent = doneThisMonth;
  document.getElementById('stat-avg').textContent = avgTurnaround;
}

// ==== SORT ====
function sortTickets(list) {
  return list.slice().sort((a, b) => {
    const pa = isTrue(a.Priority) ? 0 : 1;
    const pb = isTrue(b.Priority) ? 0 : 1;
    if (pa !== pb) return pa - pb;
    const da = new Date(a.Deadline), db = new Date(b.Deadline);
    const va = isNaN(da) ? Infinity : da.getTime();
    const vb = isNaN(db) ? Infinity : db.getTime();
    return va - vb;
  });
}

// ==== FILTER ====
function matchesSearch(r) {
  if (!searchTerm) return true;
  const t = searchTerm.toLowerCase();
  return (r.RequestorName || '').toLowerCase().includes(t) ||
         (r.ProjectTitle || '').toLowerCase().includes(t) ||
         (r.RequestID || '').toLowerCase().includes(t);
}

// ==== RENDER BOARD (dynamic columns) ====
function renderBoard() {
  document.getElementById('board-loading').style.display = 'none';

  const pool = allRequests.filter(r => isTrue(r.Archived) === showingArchive).filter(matchesSearch);

  const boardEl = document.getElementById('board');
  boardEl.innerHTML = COLUMNS.map(c => `
    <div>
      <div class="col-head"><span class="col-title">${c.label}</span><span class="col-line"></span><span class="col-count" id="count-${c.key}">0</span></div>
      <div id="col-${c.key}"></div>
    </div>`).join('');

  COLUMNS.forEach(c => {
    const list = sortTickets(pool.filter(r => statusToColumn(r.Status) === c.key));
    document.getElementById(`col-${c.key}`).innerHTML = list.map(ticketHTML).join('');
    document.getElementById(`count-${c.key}`).textContent = list.length;
  });

  document.getElementById('board-empty').style.display = pool.length === 0 ? 'block' : 'none';
  document.getElementById('board-empty').textContent = showingArchive ? 'Nothing archived yet.' : 'No tickets yet.';
}

document.getElementById('board').addEventListener('click', (e) => {
  const card = e.target.closest('.ticket');
  if (card && card.dataset.requestId) {
    openModal(card.dataset.requestId);
  }
});

// ==== SEARCH ====
document.getElementById('search-input').addEventListener('input', (e) => {
  searchTerm = e.target.value.trim();
  renderBoard();
});

// ==== ARCHIVE TOGGLE (view) ====
document.getElementById('archive-toggle').addEventListener('click', () => {
  showingArchive = !showingArchive;
  document.getElementById('archive-toggle').textContent = showingArchive ? 'Back to board' : 'View archive';
  renderBoard();
});

// ==== MODAL ====
function openModal(id) {
  currentTicket = allRequests.find(r => r.RequestID === id);
  if (!currentTicket) return;

  document.getElementById('m-id').textContent = currentTicket.RequestID;
  document.getElementById('m-title').textContent = currentTicket.ProjectTitle;
  document.getElementById('m-req').textContent = currentTicket.RequestorName;
  document.getElementById('m-due').textContent = 'Due ' + fmtDate(currentTicket.Deadline);
  document.getElementById('m-brief').textContent = currentTicket.Brief;

  const refRow = document.getElementById('m-ref-row');
  if (currentTicket.ReferenceLink) {
    refRow.style.display = 'block';
    refRow.innerHTML = `<a href="${escapeHTML(normalizeUrl(currentTicket.ReferenceLink))}" target="_blank" class="file-link">📎 View reference →</a>`;
  } else {
    refRow.style.display = 'none';
  }

  const followRow = document.getElementById('m-follow-row');
  const followCount = Number(currentTicket.FollowUpCount) || 0;
  if (followCount > 0) {
    followRow.style.display = 'block';
    followRow.innerHTML = `🔔 Followed up ${followCount} time${followCount > 1 ? 's' : ''} — last on ${fmtDate(currentTicket.LastFollowUp)}` +
      (currentTicket.LastFollowUpMessage ? `<br><i>"${escapeHTML(currentTicket.LastFollowUpMessage)}"</i>` : '');
  } else {
    followRow.style.display = 'none';
  }

  const revisionRow = document.getElementById('m-revision-row');
  const revisionCount = Number(currentTicket.RevisionCount) || 0;
  if (revisionCount > 0) {
    revisionRow.style.display = 'block';
    revisionRow.innerHTML = `↺ Revised ${revisionCount} time${revisionCount > 1 ? 's' : ''}` +
      (currentTicket.RevisionNotes ? `<br><i>"${escapeHTML(currentTicket.RevisionNotes)}"</i>` : '');
  } else {
    revisionRow.style.display = 'none';
  }

  currentStatus = currentTicket.Status;
  document.querySelectorAll('.status-btn').forEach(b => b.classList.toggle('sel', b.dataset.s === currentStatus));
  document.getElementById('attach-box').classList.toggle('show', currentStatus === 'Done' || currentStatus === 'For Review');
  document.getElementById('attach-input').value = currentTicket.FileLink || '';
  document.getElementById('notes-input').value = currentTicket.Notes || '';
  document.getElementById('reopen-btn').style.display = currentTicket.Status === 'Done' ? 'block' : 'none';

  const priorityBtn = document.getElementById('priority-btn');
  priorityBtn.classList.toggle('on', isTrue(currentTicket.Priority));

  const archiveBtn = document.getElementById('archive-btn');
  const canArchive = currentTicket.Status === 'Done' || currentTicket.Status === 'Cancelled';
  archiveBtn.style.display = canArchive ? 'inline-block' : 'none';
  archiveBtn.textContent = isTrue(currentTicket.Archived) ? '🗄 Unarchive' : '🗄 Archive';

  document.getElementById('overlay').classList.add('active');
}

function closeModal() {
  document.getElementById('overlay').classList.remove('active');
}

function setStatus(s) {
  currentStatus = s;
  document.querySelectorAll('.status-btn').forEach(b => b.classList.toggle('sel', b.dataset.s === s));
  document.getElementById('attach-box').classList.toggle('show', s === 'Done' || s === 'For Review');
}

function reopenTicket() {
  setStatus('Ongoing');
  confirmStatus();
}

async function togglePriority() {
  if (!currentTicket) return;
  const newVal = !isTrue(currentTicket.Priority);
  await postFlags(currentTicket.RequestID, { priority: newVal });
  currentTicket.Priority = newVal;
  document.getElementById('priority-btn').classList.toggle('on', newVal);
  showToast(newVal ? '🔥 Marked priority' : 'Priority removed');
  loadBoard();
}

async function toggleArchive() {
  if (!currentTicket) return;
  const newVal = !isTrue(currentTicket.Archived);
  await postFlags(currentTicket.RequestID, { archived: newVal });
  closeModal();
  showToast(newVal ? '🗄 Archived' : 'Restored from archive');
  loadBoard();
}

async function postFlags(id, flags) {
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'setFlags', id, ...flags })
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Failed to update');
  } catch (err) {
    alert('Could not save — check your connection and try again.');
    console.error(err);
  }
}

async function confirmStatus() {
  if (!currentTicket) return;
  const btn = document.getElementById('confirm-btn');
  const fileLink = document.getElementById('attach-input').value.trim();
  const notes = document.getElementById('notes-input').value.trim();

  if ((currentStatus === 'Done' || currentStatus === 'For Review') && !fileLink) {
    alert('Add a file link first — that\'s what gets sent to the requestor.');
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
        fileLink: fileLink,
        notes: notes
      })
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Failed to update');

    closeModal();
    const msg = currentStatus === 'Done' ? '✓ Marked done — requestor notified'
              : currentStatus === 'For Review' ? '✓ Sent for review — requestor notified'
              : '✓ Status updated';
    showToast(msg);
    loadBoard();
  } catch (err) {
    alert('Could not save — check your connection and try again.');
    console.error(err);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save & Notify';
  }
}
