// ==== SHARED CONFIG ====
const API_URL = 'https://script.google.com/macros/s/AKfycbxTuZWSd0mUOrcusWsa9a3LkIxm78fI-RoFVRnhDnjwBRdSmv8WSxl3rMm2vuOky6A6tA/exec';

// Tip jar — edit these anytime you want to change the number, QR image, or message.
// To change the QR: just replace the image file in your repo with the same filename below.
const COFFEE_NUMBER = '0917-XXX-XXXX'; // <-- your GCash number
const COFFEE_QR_IMAGE = 'coffee-qr.png'; // <-- filename of your QR image in the repo root
const COFFEE_TITLE = '☕ Happy with it?'; // <-- heading shown above the message
const COFFEE_MESSAGE = "If you'd like, you can send a coffee as a token of appreciation — totally optional, but always appreciated!"; // <-- the message itself

// ==== SHARED HELPERS ====
function statusToColumn(status) {
  const map = { 'Pending': 'pending', 'Ongoing': 'ongoing', 'For Review': 'review', 'Done': 'done', 'Cancelled': 'void' };
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

function normalizeUrl(url) {
  if (!url) return '';
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return 'https://' + trimmed;
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2600);
}
