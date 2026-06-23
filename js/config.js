// CreaQR - Configuración JSONBin
const JSONBIN_API_KEY = '$2a$10$YohijmJms8cH8Wcz7UPRoeLVTcuLN9GArGOh4xg3lwW8HWDTuBjlu';
const JSONBIN_BASE = 'https://api.jsonbin.io/v3';

// ─── USUARIOS ───────────────────────────────────────────────
async function getBin(binId) {
  const r = await fetch(`${JSONBIN_BASE}/b/${binId}/latest`, {
    headers: { 'X-Master-Key': JSONBIN_API_KEY }
  });
  const d = await r.json();
  return d.record;
}

async function updateBin(binId, data) {
  await fetch(`${JSONBIN_BASE}/b/${binId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Master-Key': JSONBIN_API_KEY
    },
    body: JSON.stringify(data)
  });
}

async function createBin(data, name) {
  const r = await fetch(`${JSONBIN_BASE}/b`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Master-Key': JSONBIN_API_KEY,
      'X-Bin-Name': name,
      'X-Bin-Private': 'true'
    },
    body: JSON.stringify(data)
  });
  const d = await r.json();
  return d.metadata.id;
}

// ─── AUTH ────────────────────────────────────────────────────
async function getUsersBinId() {
  // Guardamos el ID del bin de usuarios en localStorage
  let id = localStorage.getItem('creaQR_usersBin');
  if (!id) {
    // Buscar bins existentes
    try {
      const r = await fetch(`${JSONBIN_BASE}/b`, {
        headers: { 'X-Master-Key': JSONBIN_API_KEY }
      });
      const d = await r.json();
      const found = d.find && d.find(b => b.snippetMeta?.name === 'creaQR_users');
      if (found) { id = found.id; localStorage.setItem('creaQR_usersBin', id); }
    } catch(e) {}
  }
  if (!id) {
    id = await createBin({ users: [] }, 'creaQR_users');
    localStorage.setItem('creaQR_usersBin', id);
  }
  return id;
}

async function register(name, email, password) {
  const binId = await getUsersBinId();
  const data = await getBin(binId);
  const users = data.users || [];
  if (users.find(u => u.email === email)) throw new Error('Este email ya está registrado');
  const user = { id: 'u_' + Date.now(), name, email, password: btoa(password), qrsBinId: null, createdAt: new Date().toISOString() };
  users.push(user);
  await updateBin(binId, { users });
  const sessionUser = { id: user.id, name: user.name, email: user.email, qrsBinId: null };
  localStorage.setItem('creaQR_session', JSON.stringify(sessionUser));
  return sessionUser;
}

async function login(email, password) {
  const binId = await getUsersBinId();
  const data = await getBin(binId);
  const users = data.users || [];
  const user = users.find(u => u.email === email && u.password === btoa(password));
  if (!user) throw new Error('Email o contraseña incorrectos');
  const sessionUser = { id: user.id, name: user.name, email: user.email, qrsBinId: user.qrsBinId };
  localStorage.setItem('creaQR_session', JSON.stringify(sessionUser));
  return sessionUser;
}

function logout() {
  localStorage.removeItem('creaQR_session');
  window.location.href = 'login.html';
}

function getSession() {
  const s = localStorage.getItem('creaQR_session');
  return s ? JSON.parse(s) : null;
}

function requireAuth() {
  const s = getSession();
  if (!s) window.location.href = 'login.html';
  return s;
}

// ─── QRs ─────────────────────────────────────────────────────
async function getUserQrsBinId(user) {
  if (user.qrsBinId) return user.qrsBinId;
  // Crear bin de QRs para este usuario
  const binId = await createBin({ qrs: [] }, `creaQR_qrs_${user.id}`);
  // Actualizar usuario en users bin
  const usersBinId = await getUsersBinId();
  const data = await getBin(usersBinId);
  const users = data.users || [];
  const idx = users.findIndex(u => u.id === user.id);
  if (idx !== -1) { users[idx].qrsBinId = binId; await updateBin(usersBinId, { users }); }
  // Actualizar sesión
  user.qrsBinId = binId;
  localStorage.setItem('creaQR_session', JSON.stringify(user));
  return binId;
}

async function getMyQRs() {
  const user = getSession();
  if (!user) return [];
  const binId = await getUserQrsBinId(user);
  const data = await getBin(binId);
  return data.qrs || [];
}

async function saveQR(qrData) {
  const user = getSession();
  const binId = await getUserQrsBinId(user);
  const data = await getBin(binId);
  const qrs = data.qrs || [];
  const newQR = { id: 'qr_' + Date.now(), ...qrData, userId: user.id, createdAt: new Date().toISOString(), scans: 0 };
  qrs.unshift(newQR);
  await updateBin(binId, { qrs });
  return newQR;
}

async function deleteQR(qrId) {
  const user = getSession();
  const binId = await getUserQrsBinId(user);
  const data = await getBin(binId);
  const qrs = (data.qrs || []).filter(q => q.id !== qrId);
  await updateBin(binId, { qrs });
}

async function updateQR(qrId, updates) {
  const user = getSession();
  const binId = await getUserQrsBinId(user);
  const data = await getBin(binId);
  const qrs = data.qrs || [];
  const idx = qrs.findIndex(q => q.id === qrId);
  if (idx !== -1) { qrs[idx] = { ...qrs[idx], ...updates, updatedAt: new Date().toISOString() }; }
  await updateBin(binId, { qrs });
}
