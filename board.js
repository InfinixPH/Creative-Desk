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

// ==== TICKET RENDER ====
function ticketHTML(r) {
  const col = statusToColumn(r.Status);
  const stamp = col === 'done' ? '<div class="stamp done">Done</div>'
              : col === 'void' ? '<div class="stamp void">Void</div>' : '';
  const overdue = isOverdue(r.Deadline, r.Status);
  const deadlineLabel = overdue ? `⚠ ${fmtDate(r.Deadline)}` : fmtDate(r.Deadline);
  return `
    <div class="ticket" onclick="openModal('${r.RequestID}')">
      <div class="tape"></div>
      <div class="t-id">${r.RequestID}</div>
      <div class="t-title">${escapeHTML(r.ProjectTitle)}</div>
      <div class="t-meta"><span>${escapeHTML(r.RequestorName)}</span><span class="t-deadline${overdue ? ' soon' : ''}">${deadlineLabel}</span></div>
      ${stamp}
    </div>`;
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

function sortByDeadline(list) {
  return list.slice().sort((a, b) => {
    const da = new Date(a.Deadline), db = new Date(b.Deadline);
    const va = isNaN(da) ? Infinity : da.getTime();
    const vb = isNaN(db) ? Infinity : db.getTime();
    return va - vb;
  });
}

function renderBoard() {
  document.getElementById('board-loading').style.display = 'none';
  const cols = { pending: [], ongoing: [], done: [], void: [] };
  allRequests.forEach(r => cols[statusToColumn(r.Status)].push(r));
  ['pending', 'ongoing', 'done'].forEach(c => cols[c] = sortByDeadline(cols[c]));

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

  const refRow = document.getElementById('m-ref-row');
  if (currentTicket.ReferenceLink) {
    refRow.style.display = 'block';
    refRow.innerHTML = `<a href="${escapeHTML(currentTicket.ReferenceLink)}" target="_blank" class="file-link">📎 View reference →</a>`;
  } else {
    refRow.style.display = 'none';
  }

  currentStatus = currentTicket.Status;
  document.querySelectorAll('.status-btn').forEach(b => b.classList.toggle('sel', b.dataset.s === currentStatus));
  document.getElementById('attach-box').classList.toggle('show', currentStatus === 'Done');
  document.getElementById('attach-input').value = currentTicket.FileLink || '';
  document.getElementById('notes-input').value = currentTicket.Notes || '';
  document.getElementById('reopen-btn').style.display = currentTicket.Status === 'Done' ? 'block' : 'none';

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

function reopenTicket() {
  setStatus('Ongoing');
  confirmStatus();
}

async function confirmStatus() {
  if (!currentTicket) return;
  const btn = document.getElementById('confirm-btn');
  const fileLink = document.getElementById('attach-input').value.trim();
  const notes = document.getElementById('notes-input').value.trim();

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
        fileLink: fileLink,
        notes: notes
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
