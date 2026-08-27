// ==== SHARED CONFIG ====
const API_URL = 'https://script.google.com/macros/s/AKfycbxTuZWSd0mUOrcusWsa9a3LkIxm78fI-RoFVRnhDnjwBRdSmv8WSxl3rMm2vuOky6A6tA/exec';

// ==== SHARED HELPERS ====
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

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function isOverdue(deadline, status) {
  if (!deadline || status === 'Done' || status === 'Cancelled') return false;
  const d = new Date(deadline);
  if (isNaN(d)) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2600);
}
