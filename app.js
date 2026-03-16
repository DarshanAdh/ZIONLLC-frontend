const state = {
  returnPageAfterAuth: null,
  selectedShipmentService: 'standard',
  shipmentPrices: null,
  currentShipStep: 1,
  trackingResult: null,
  lastShipments: [],
};

function escapeHtml(str = '') {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function showToast(message, type = 'success') {
  const stack = document.getElementById('toast-stack');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  stack.appendChild(el);
  window.setTimeout(() => el.remove(), 3600);
}

function showModal({ title, content, confirmText, onConfirm }) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `
    <div class="modal-overlay" id="modal-overlay">
      <div class="modal-card" role="dialog" aria-modal="true">
        <h3>${escapeHtml(title || 'Details')}</h3>
        <div>${content || ''}</div>
        <div class="form-actions">
          <button id="modal-cancel" class="btn btn-outline">Cancel</button>
          ${confirmText ? `<button id="modal-confirm" class="btn btn-cta">${escapeHtml(confirmText)}</button>` : ''}
        </div>
      </div>
    </div>
  `;
  const close = () => { root.innerHTML = ''; };
  const overlay = document.getElementById('modal-overlay');
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.getElementById('modal-cancel').addEventListener('click', close);
  if (confirmText) {
    document.getElementById('modal-confirm').addEventListener('click', async () => {
      if (onConfirm) await onConfirm();
      close();
    });
  }
  const onEsc = (e) => {
    if (e.key === 'Escape') {
      close();
      document.removeEventListener('keydown', onEsc);
    }
  };
  document.addEventListener('keydown', onEsc);
}

function showLoading(container) {
  if (!container) return;
  container.dataset.loading = '1';
  container.innerHTML = '<div class="loading-spinner"></div>';
}

function hideLoading(container) {
  if (!container) return;
  delete container.dataset.loading;
}

function statusBadge(status) {
  const map = {
    created: { text: 'Created', class: 'sp-pending' },
    picked_up: { text: 'Picked Up', class: 'sp-pending' },
    in_transit: { text: 'In Transit', class: 'sp-transit' },
    out_for_delivery: { text: 'Out for Delivery', class: 'sp-transit' },
    delivered: { text: 'Delivered', class: 'sp-delivered' },
    failed: { text: 'Failed', class: 'sp-failed' },
    returned: { text: 'Returned', class: 'sp-failed' },
    scheduled: { text: 'Scheduled', class: 'sp-pending' },
    confirmed: { text: 'Confirmed', class: 'sp-transit' },
    completed: { text: 'Completed', class: 'sp-delivered' },
    cancelled: { text: 'Cancelled', class: 'sp-failed' },
    open: { text: 'Open', class: 'sp-pending' },
    in_progress: { text: 'In Progress', class: 'sp-transit' },
    resolved: { text: 'Resolved', class: 'sp-delivered' },
    closed: { text: 'Closed', class: 'sp-failed' },
  };
  const s = map[status] || { text: status, class: 'sp-pending' };
  return `<span class="status-pill ${s.class}">${escapeHtml(s.text)}</span>`;
}

const Auth = {
  init() {
    if (this.isLoggedIn()) this.updateNavForLoggedIn();
    else this.updateNavForGuest();
  },
  isLoggedIn() { return API.isLoggedIn(); },
  getUser() { return API.getUser(); },
  updateNavForLoggedIn() {
    const user = this.getUser();
    const navActions = document.querySelector('.nav-actions');
    navActions.innerHTML = `
      <div class="user-menu" id="user-menu" style="position:relative">
        <button class="btn btn-outline" onclick="toggleUserMenu()">
          <span class="logo-square">${escapeHtml(user?.firstName?.[0] || 'U')}</span>
          ${escapeHtml(user?.firstName || 'Account')} ▾
        </button>
        <div class="card" id="user-dropdown" style="display:none;position:absolute;right:0;top:48px;min-width:210px;z-index:1010">
          <a href="#" onclick="showPage('dashboard')">📊 My Dashboard</a><br>
          <a href="#" onclick="showPage('dashboard');showDashSection('profile')">👤 Profile</a><br>
          <a href="#" onclick="handleLogout()" style="color:var(--danger)">🚪 Sign Out</a>
        </div>
      </div>
    `;
  },
  updateNavForGuest() {
    const navActions = document.querySelector('.nav-actions');
    navActions.innerHTML = `
      <a class="btn btn-outline" href="#" onclick="showPage('auth')">Sign In</a>
      <a class="btn btn-cta" href="#" onclick="showPage('auth')">Get Started</a>
    `;
  },
};

function toggleUserMenu() {
  const dd = document.getElementById('user-dropdown');
  if (!dd) return;
  dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
}

function handleLogout() {
  API.logout();
  Auth.updateNavForGuest();
  showPage('home');
  showToast('You have been signed out.', 'info');
}

function normalize401(err) {
  if (String(err?.message || '').toLowerCase().includes('unauthorized')
      || String(err?.message || '').toLowerCase().includes('token')
      || String(err?.message || '').toLowerCase().includes('expired')) {
    API.logout();
    Auth.updateNavForGuest();
    showPage('auth');
    showToast('Session expired. Please sign in again.', 'error');
    return true;
  }
  return false;
}

function showPage(pageId) {
  document.querySelectorAll('.page').forEach((p) => p.classList.remove('active'));
  document.getElementById(`page-${pageId}`)?.classList.add('active');
  document.querySelectorAll('.nav-links a').forEach((a) => a.classList.remove('active'));
  document.getElementById(`nav-${pageId}`)?.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  const menu = document.getElementById('nav-menu');
  menu.classList.remove('open');
  onPageLoad(pageId);
}

function onPageLoad(pageId) {
  switch (pageId) {
    case 'dashboard':
      if (!API.isLoggedIn()) {
        state.returnPageAfterAuth = 'dashboard';
        showPage('auth');
        return;
      }
      loadDashboardShipments();
      loadDashboardPickups();
      loadProfile();
      loadAddresses();
      break;
    case 'support':
      renderSupportPage();
      loadFAQ();
      if (API.isLoggedIn()) loadMyTickets();
      break;
    case 'locations':
      loadLocations();
      break;
    case 'shipping':
      renderShippingPage();
      if (API.isLoggedIn()) loadSavedAddresses();
      break;
    default:
      break;
  }
}

function validateEmail(v) { return /.+@.+\..+/.test(v); }
function validatePhone(v) { return !v || /^[\d\s\-()+]+$/.test(v); }
function validateZip(v) { return /^\d{5}$/.test(v); }
function validateName(v) { return !!v && v.trim().length >= 2; }
function validateWeight(v) { return Number(v) > 0; }
function validateSupportMessage(v) { return !!v && v.trim().length >= 20; }

function setFieldError(input, msg) {
  let error = input.parentElement.querySelector('.field-error');
  if (!error) {
    error = document.createElement('div');
    error.className = 'field-error';
    input.parentElement.appendChild(error);
  }
  error.textContent = msg || '';
}

function clearFieldErrors(scope) {
  scope.querySelectorAll('.field-error').forEach((el) => el.remove());
}

function renderShippingPage() {
  const createPanel = document.getElementById('ship-create');
  const pickupPanel = document.getElementById('ship-pickups');
  const suppliesPanel = document.getElementById('ship-supplies');

  createPanel.innerHTML = `
    <div class="card">
      <h3>Create a Shipment</h3>
      <div id="ship-stepper">Step ${state.currentShipStep} of 3</div>
      <form id="shipment-form">
        <div id="ship-step-1" ${state.currentShipStep === 1 ? '' : 'style="display:none"'}>
          <h4>Step 1 - Package Details</h4>
          <div class="grid-3">
            <label>Package Type
              <select name="packageType">
                <option>Small Box</option><option>Medium Box</option><option>Large Box</option><option>Envelope</option><option>Tube</option>
              </select>
            </label>
            <label>Weight (lbs)<input name="weight" id="ship-weight" type="number" min="0.1" step="0.1"></label>
            <label>Declared Value<input name="declaredValue" type="number" min="0"></label>
          </div>
          <div class="grid-3 mt-12">
            <label>Length<input name="length" type="number" min="1"></label>
            <label>Width<input name="width" type="number" min="1"></label>
            <label>Height<input name="height" type="number" min="1"></label>
          </div>
          <label class="mt-12">Special Instructions<textarea name="instructions"></textarea></label>
        </div>
        <div id="ship-step-2" ${state.currentShipStep === 2 ? '' : 'style="display:none"'}>
          <h4>Step 2 - Addresses</h4>
          <div class="grid-2">
            <div>
              <h5>Sender</h5>
              <input name="senderFirstName" placeholder="First Name">
              <input name="senderLastName" placeholder="Last Name" class="mt-12">
              <input name="senderStreet" placeholder="Street" class="mt-12">
              <div class="grid-3 mt-12">
                <input name="senderCity" placeholder="City">
                <input name="senderState" placeholder="State">
                <input name="senderZip" placeholder="ZIP">
              </div>
              <input name="senderPhone" placeholder="Phone" class="mt-12">
            </div>
            <div>
              <h5>Recipient</h5>
              <select id="saved-address-select"><option value="">Use saved address</option></select>
              <input name="recipientFirstName" placeholder="First Name" class="mt-12">
              <input name="recipientLastName" placeholder="Last Name" class="mt-12">
              <input name="recipientStreet" placeholder="Street" class="mt-12">
              <div class="grid-3 mt-12">
                <input name="recipientCity" placeholder="City">
                <input name="recipientState" placeholder="State">
                <input name="recipientZip" placeholder="ZIP">
              </div>
              <input name="recipientPhone" placeholder="Phone" class="mt-12">
              <label class="mt-12"><input type="checkbox" name="saveRecipient"> Save this address</label>
            </div>
          </div>
        </div>
        <div id="ship-step-3" ${state.currentShipStep === 3 ? '' : 'style="display:none"'}>
          <h4>Step 3 - Service & Review</h4>
          <div id="price-cards" class="grid-3">
            <button type="button" class="card service-choice" data-service="standard">📦 Standard - <span id="price-standard">--</span></button>
            <button type="button" class="card service-choice" data-service="express">⚡ Express - <span id="price-express">--</span></button>
            <button type="button" class="card service-choice" data-service="overnight">🌙 Overnight - <span id="price-overnight">--</span></button>
          </div>
          <div id="ship-review" class="card mt-12">Complete package and address details to review.</div>
        </div>
        <div class="form-actions mt-12">
          <button id="ship-prev" class="btn btn-outline" type="button">Back</button>
          <button id="ship-next" class="btn btn-cta" type="button">${state.currentShipStep < 3 ? 'Next' : 'Create Shipment'}</button>
        </div>
      </form>
    </div>
  `;

  pickupPanel.innerHTML = `
    <div class="card">
      <h3>Schedule Pickup</h3>
      <form id="pickup-form" class="grid-2">
        <label>Address<input name="address" required></label>
        <label>Date<input id="pickup-date" name="date" type="date" required></label>
        <label>Time Window
          <select name="timeWindow">
            <option>8:00 AM - 12:00 PM</option>
            <option>12:00 PM - 4:00 PM</option>
            <option>4:00 PM - 7:00 PM</option>
          </select>
        </label>
        <label>Package Count<input name="packageCount" type="number" min="1" required></label>
        <label>Estimated Weight<input name="totalWeight" type="number" min="0.1" step="0.1" required></label>
        <label>Special Instructions<textarea name="instructions"></textarea></label>
      </form>
      <button class="btn btn-cta mt-12" onclick="submitPickup()">Schedule Pickup</button>
    </div>
    <div class="card mt-24">
      <h3>My Scheduled Pickups</h3>
      <div id="pickup-list">Loading...</div>
    </div>
  `;

  suppliesPanel.innerHTML = `
    <div class="grid-2">
      <article class="card"><h3>Boxes</h3><p>Durable corrugated options for all package sizes.</p></article>
      <article class="card"><h3>Tape & Packaging</h3><p>Secure and weather-resistant packaging supplies.</p></article>
      <article class="card"><h3>Label Sheets</h3><p>Printable sheets for high-volume processing.</p></article>
      <article class="card"><h3>Bubble Wrap & Padding</h3><p>Protect fragile products in transit.</p></article>
    </div>
  `;

  setupShippingInteractions();
  loadMyPickups();
}

function setupShippingInteractions() {
  document.querySelectorAll('#page-shipping .pill').forEach((p) => {
    p.onclick = () => {
      document.querySelectorAll('#page-shipping .pill').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('#page-shipping .tab-panel').forEach((panel) => panel.classList.remove('active'));
      p.classList.add('active');
      document.getElementById(p.dataset.tab).classList.add('active');
    };
  });

  const form = document.getElementById('shipment-form');
  if (!form) return;
  const next = document.getElementById('ship-next');
  const prev = document.getElementById('ship-prev');

  prev.onclick = () => {
    if (state.currentShipStep <= 1) return;
    state.currentShipStep -= 1;
    renderShippingPage();
  };
  next.onclick = async () => {
    if (state.currentShipStep < 3) {
      state.currentShipStep += 1;
      renderShippingPage();
      return;
    }
    await submitShipment();
  };

  const choices = document.querySelectorAll('.service-choice');
  choices.forEach((btn) => {
    if (btn.dataset.service === state.selectedShipmentService) {
      btn.style.borderColor = 'var(--amber)';
    }
    btn.onclick = () => {
      state.selectedShipmentService = btn.dataset.service;
      renderShippingReview();
      choices.forEach((b) => { b.style.borderColor = 'var(--border)'; });
      btn.style.borderColor = 'var(--amber)';
    };
  });

  const weightInput = document.getElementById('ship-weight');
  const debounced = debounce(async () => {
    const weight = Number(weightInput.value);
    if (!validateWeight(weight) || !API.isLoggedIn()) return;
    try {
      const data = await API.calculatePrice(weight, state.selectedShipmentService);
      state.shipmentPrices = data.prices || data;
      renderShipmentPrices();
    } catch (err) {
      if (!normalize401(err)) showToast(`❌ ${err.message}`, 'error');
    }
  }, 500);
  if (weightInput) weightInput.addEventListener('input', debounced);
}

function renderShipmentPrices() {
  if (!state.shipmentPrices) return;
  const fmt = (n) => (Number.isFinite(Number(n)) ? `$${Number(n).toFixed(2)}` : '--');
  document.getElementById('price-standard').textContent = fmt(state.shipmentPrices.standard);
  document.getElementById('price-express').textContent = fmt(state.shipmentPrices.express);
  document.getElementById('price-overnight').textContent = fmt(state.shipmentPrices.overnight);
}

function renderShippingReview() {
  const review = document.getElementById('ship-review');
  if (!review) return;
  const form = document.getElementById('shipment-form');
  const fd = new FormData(form);
  review.innerHTML = `
    <h4>Order Summary</h4>
    <p><strong>Service:</strong> ${escapeHtml(state.selectedShipmentService)}</p>
    <p><strong>Weight:</strong> ${escapeHtml(fd.get('weight') || '--')} lbs</p>
    <p><strong>From:</strong> ${escapeHtml(fd.get('senderCity') || '--')} to ${escapeHtml(fd.get('recipientCity') || '--')}</p>
  `;
}

async function submitShipment() {
  if (!API.isLoggedIn()) {
    state.returnPageAfterAuth = 'shipping';
    showPage('auth');
    return;
  }
  const form = document.getElementById('shipment-form');
  clearFieldErrors(form);
  const fd = new FormData(form);

  const senderZip = String(fd.get('senderZip') || '').trim();
  const recipientZip = String(fd.get('recipientZip') || '').trim();
  const weight = Number(fd.get('weight'));
  if (!validateZip(senderZip) || !validateZip(recipientZip) || !validateWeight(weight)) {
    showToast('❌ Please check weight and ZIP values.', 'error');
    return;
  }

  const payload = {
    sender: {
      firstName: fd.get('senderFirstName'),
      lastName: fd.get('senderLastName'),
      street: fd.get('senderStreet'),
      city: fd.get('senderCity'),
      state: fd.get('senderState'),
      zip: senderZip,
      phone: fd.get('senderPhone'),
    },
    recipient: {
      firstName: fd.get('recipientFirstName'),
      lastName: fd.get('recipientLastName'),
      street: fd.get('recipientStreet'),
      city: fd.get('recipientCity'),
      state: fd.get('recipientState'),
      zip: recipientZip,
      phone: fd.get('recipientPhone'),
    },
    package: {
      type: fd.get('packageType'),
      weight,
      dimensions: {
        length: Number(fd.get('length') || 0),
        width: Number(fd.get('width') || 0),
        height: Number(fd.get('height') || 0),
      },
      declaredValue: Number(fd.get('declaredValue') || 0),
      instructions: fd.get('instructions'),
    },
    service: { type: state.selectedShipmentService },
  };

  try {
    const data = await API.createShipment(payload);
    if (fd.get('saveRecipient')) {
      await API.addAddress({
        label: 'Recipient',
        street: payload.recipient.street,
        city: payload.recipient.city,
        state: payload.recipient.state,
        zip: payload.recipient.zip,
      });
    }
    const shipment = data.shipment || data;
    const trackNum = shipment.trackingNumber || shipment.tracking || 'Created';
    showModal({
      title: 'Shipment Created',
      content: `<p>Your shipment is confirmed.</p><p><strong>Tracking:</strong> ${escapeHtml(trackNum)}</p><p>🎉🎉🎉</p>`,
      confirmText: 'Go to Tracking',
      onConfirm: () => {
        showPage('tracking');
        document.getElementById('track-number').value = trackNum;
        runTrackingSearch(trackNum);
      },
    });
  } catch (err) {
    if (!normalize401(err)) showToast(`❌ ${err.message}`, 'error');
  }
}

async function loadSavedAddresses() {
  const select = document.getElementById('saved-address-select');
  if (!select || !API.isLoggedIn()) return;
  try {
    const data = await API.getAddresses();
    const addresses = data.addresses || [];
    select.innerHTML = '<option value="">Use saved address</option>';
    addresses.forEach((a) => {
      const value = JSON.stringify(a);
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = `${a.label || 'Address'} - ${a.street}, ${a.city}`;
      select.appendChild(opt);
    });
    select.onchange = () => {
      if (!select.value) return;
      const a = JSON.parse(select.value);
      const form = document.getElementById('shipment-form');
      form.recipientStreet.value = a.street || '';
      form.recipientCity.value = a.city || '';
      form.recipientState.value = a.state || '';
      form.recipientZip.value = a.zip || '';
    };
  } catch (err) {
    if (!normalize401(err)) showToast(`❌ ${err.message}`, 'error');
  }
}

async function submitPickup() {
  if (!API.isLoggedIn()) {
    state.returnPageAfterAuth = 'shipping';
    showPage('auth');
    return;
  }
  const form = document.getElementById('pickup-form');
  const fd = new FormData(form);
  const date = String(fd.get('date'));
  const today = new Date().toISOString().slice(0, 10);
  if (date < today) {
    showToast('❌ Pickup date must be today or a future date.', 'error');
    return;
  }
  try {
    const data = await API.schedulePickup({
      address: fd.get('address'),
      date,
      timeWindow: fd.get('timeWindow'),
      packageCount: Number(fd.get('packageCount')),
      totalWeight: Number(fd.get('totalWeight')),
      instructions: fd.get('instructions') || '',
    });
    showToast(`Pickup scheduled. Code: ${data.confirmationCode || 'N/A'}`);
    form.reset();
    loadMyPickups();
  } catch (err) {
    if (!normalize401(err)) showToast(`❌ ${err.message}`, 'error');
  }
}

async function loadMyPickups() {
  const list = document.getElementById('pickup-list');
  if (!list) return;
  if (!API.isLoggedIn()) {
    list.innerHTML = '<p>Sign in to see your pickups.</p>';
    return;
  }
  showLoading(list);
  try {
    const data = await API.getMyPickups();
    const pickups = data.pickups || [];
    if (!pickups.length) {
      list.innerHTML = '<p>No pickups scheduled.</p>';
      return;
    }
    list.innerHTML = pickups.map((p) => {
      const blocked = ['completed', 'cancelled'].includes(p.status);
      return `
        <div class="card">
          <p><strong>${escapeHtml(p.date || '')}</strong> - ${escapeHtml(p.address || '')}</p>
          <p>${escapeHtml(p.timeWindow || '')} ${statusBadge(p.status || 'scheduled')}</p>
          <div class="form-actions">
            <button class="btn btn-outline" ${blocked ? 'disabled' : ''} onclick="modifyPickupPrompt('${p._id}')">Modify</button>
            <button class="btn btn-outline" ${blocked ? 'disabled' : ''} onclick="cancelPickupPrompt('${p._id}')">Cancel</button>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    list.innerHTML = '<p>Unable to load pickups.</p>';
    if (!normalize401(err)) showToast(`❌ ${err.message}`, 'error');
  }
}

function modifyPickupPrompt(id) {
  showModal({
    title: 'Modify Pickup',
    content: `
      <label>New Date <input id="modal-pickup-date" type="date"></label>
      <label class="mt-12">Instructions <input id="modal-pickup-instructions"></label>
    `,
    confirmText: 'Save',
    onConfirm: async () => {
      try {
        await API.modifyPickup(id, {
          date: document.getElementById('modal-pickup-date').value,
          instructions: document.getElementById('modal-pickup-instructions').value,
        });
        showToast('Pickup updated.');
        loadMyPickups();
      } catch (err) {
        if (!normalize401(err)) showToast(`❌ ${err.message}`, 'error');
      }
    },
  });
}

function cancelPickupPrompt(id) {
  showModal({
    title: 'Cancel Pickup',
    content: '<p>Are you sure you want to cancel this pickup?</p>',
    confirmText: 'Cancel Pickup',
    onConfirm: async () => {
      try {
        await API.cancelPickup(id);
        showToast('Pickup canceled.', 'info');
        loadMyPickups();
      } catch (err) {
        if (!normalize401(err)) showToast(`❌ ${err.message}`, 'error');
      }
    },
  });
}

async function runTrackingSearch(value) {
  const tracking = (value || '').trim().toUpperCase();
  if (!tracking) return;
  const target = document.getElementById('tracking-result');
  showLoading(target);
  try {
    const data = await API.trackPackage(tracking);
    const shipment = data.shipment || data.tracking || data;
    state.trackingResult = shipment;
    renderTrackingResult(shipment);
  } catch (err) {
    target.innerHTML = '';
    if (!normalize401(err)) showToast(`❌ ${err.message}`, 'error');
  }
}

function renderTrackingResult(shipment) {
  const target = document.getElementById('tracking-result');
  const timeline = shipment.timeline || shipment.events || [];
  const status = shipment.status || 'created';
  const trackingId = shipment.trackingNumber || shipment.tracking || '';
  const route = `${shipment.origin?.city || 'Origin'} → ${shipment.destination?.city || 'Destination'}`;
  target.innerHTML = `
    <div class="card">
      <p><strong style="font-family:monospace;color:var(--amber)">${escapeHtml(trackingId)}</strong> ${statusBadge(status)}</p>
      <p>${escapeHtml(shipment.serviceType || shipment.service?.type || 'Standard')} · ${escapeHtml(route)}</p>
      <p>Estimated Delivery: ${escapeHtml(shipment.estimatedDelivery || 'TBD')}</p>
      <div class="timeline">
        ${timeline.map((t, idx) => `
          <div class="timeline-item" style="animation-delay:${idx * 0.08}s">
            <strong>${escapeHtml(t.status || '')}</strong>
            <div>${escapeHtml(t.timestamp || '')} - ${escapeHtml(t.location || '')}</div>
            <small>${escapeHtml(t.message || '')}</small>
          </div>
        `).join('')}
      </div>
      ${API.isLoggedIn() ? `
      <div class="form-actions mt-12">
        <button class="btn btn-outline" onclick="openManageDelivery('reschedule')">📅 Reschedule Delivery</button>
        <button class="btn btn-outline" onclick="openManageDelivery('hold')">🏢 Hold at Location</button>
        <button class="btn btn-outline" onclick="openManageDelivery('instructions')">📝 Leave Instructions</button>
        <button class="btn btn-outline" onclick="openManageDelivery('change_address')">📍 Change Address</button>
      </div>` : ''}
    </div>
  `;
}

function openManageDelivery(action) {
  if (!state.trackingResult) return;
  const trackingId = state.trackingResult.trackingNumber || state.trackingResult.tracking;
  const labels = {
    reschedule: 'New delivery date',
    hold: 'Hold location',
    instructions: 'Delivery instructions',
    change_address: 'New address (street,city,state,zip)',
  };
  showModal({
    title: 'Manage Delivery',
    content: `<label>${labels[action]}<input id="manage-value"></label>`,
    confirmText: 'Submit',
    onConfirm: async () => {
      const raw = document.getElementById('manage-value').value;
      const value = action === 'change_address'
        ? (() => {
          const [street, city, stateCode, zip] = raw.split(',');
          return { street: (street || '').trim(), city: (city || '').trim(), state: (stateCode || '').trim(), zip: (zip || '').trim() };
        })()
        : raw;
      try {
        await API.manageDelivery(trackingId, { action, value });
        showToast('Delivery preference updated.');
        runTrackingSearch(trackingId);
      } catch (err) {
        if (!normalize401(err)) showToast(`❌ ${err.message}`, 'error');
      }
    },
  });
}

async function loadDashboardShipments() {
  const section = document.getElementById('dash-shipments');
  if (!section) return;
  showLoading(section);
  try {
    const data = await API.getMyShipments();
    const shipments = data.shipments || [];
    state.lastShipments = shipments;
    if (!shipments.length) {
      section.innerHTML = '<div class="card"><p>No shipments yet. Create your first shipment.</p><button class="btn btn-cta" onclick="showPage(\'shipping\')">Create Shipment</button></div>';
      return;
    }
    section.innerHTML = `
      <div class="card">
        <h3>Recent Shipments</h3>
        ${shipments.map((s) => `
          <div class="card mt-12">
            <p><strong style="color:var(--amber);cursor:pointer" onclick="jumpToTracking('${escapeHtml(s.trackingNumber || s.tracking || '')}')">${escapeHtml(s.trackingNumber || s.tracking || '')}</strong></p>
            <p>${escapeHtml(s.recipient?.city || '')} - ${new Date(s.createdAt || Date.now()).toLocaleDateString()} - ${statusBadge(s.status || 'created')}</p>
            ${s.status === 'created' ? `<button class="btn btn-outline" onclick="cancelShipment('${s._id}')">Cancel</button>` : ''}
          </div>
        `).join('')}
      </div>
    `;
  } catch (err) {
    section.innerHTML = '<p>Unable to load shipments.</p>';
    if (!normalize401(err)) showToast(`❌ ${err.message}`, 'error');
  }
}

async function cancelShipment(id) {
  try {
    await API.cancelShipment(id);
    showToast('Shipment canceled.', 'info');
    loadDashboardShipments();
  } catch (err) {
    if (!normalize401(err)) showToast(`❌ ${err.message}`, 'error');
  }
}

function jumpToTracking(num) {
  showPage('tracking');
  document.getElementById('track-number').value = num;
  runTrackingSearch(num);
}

async function loadDashboardPickups() {
  const section = document.getElementById('dash-pickups');
  if (!section) return;
  try {
    const data = await API.getMyPickups();
    const pickups = data.pickups || [];
    section.innerHTML = `
      <div class="card">
        <h3>My Pickups</h3>
        ${pickups.length ? pickups.map((p) => `<p>${escapeHtml(p.date || '')} - ${escapeHtml(p.address || '')} ${statusBadge(p.status || 'scheduled')}</p>`).join('') : '<p>No pickups found.</p>'}
      </div>
    `;
  } catch (err) {
    if (!normalize401(err)) showToast(`❌ ${err.message}`, 'error');
  }
}

async function loadProfile() {
  const section = document.getElementById('dash-profile');
  if (!section) return;
  try {
    const data = await API.getProfile();
    const user = data.user || {};
    section.innerHTML = `
      <div class="card">
        <h3>My Profile</h3>
        <form id="profile-form" class="grid-2">
          <label>First Name<input name="firstName" value="${escapeHtml(user.firstName || '')}"></label>
          <label>Last Name<input name="lastName" value="${escapeHtml(user.lastName || '')}"></label>
          <label>Phone<input name="phone" value="${escapeHtml(user.phone || '')}"></label>
        </form>
        <button class="btn btn-cta mt-12" onclick="saveProfile()">Save Profile</button>
        <h4 class="mt-24">Change Password</h4>
        <form id="password-form" class="grid-3">
          <input type="password" name="currentPassword" placeholder="Current password" autocomplete="current-password">
          <input type="password" name="newPassword" placeholder="New password" autocomplete="new-password">
          <input type="password" name="confirmPassword" placeholder="Confirm new password" autocomplete="new-password">
        </form>
        <button class="btn btn-outline mt-12" onclick="savePassword()">Update Password</button>
      </div>
    `;
  } catch (err) {
    if (!normalize401(err)) showToast(`❌ ${err.message}`, 'error');
  }
}

async function saveProfile() {
  const form = document.getElementById('profile-form');
  const fd = new FormData(form);
  if (!validateName(fd.get('firstName')) || !validateName(fd.get('lastName')) || !validatePhone(fd.get('phone'))) {
    showToast('❌ Invalid profile data.', 'error');
    return;
  }
  try {
    const data = await API.updateProfile({
      firstName: fd.get('firstName'),
      lastName: fd.get('lastName'),
      phone: fd.get('phone'),
    });
    localStorage.setItem('zion_user', JSON.stringify(data.user || API.getUser()));
    Auth.updateNavForLoggedIn();
    showToast('Profile updated.');
  } catch (err) {
    if (!normalize401(err)) showToast(`❌ ${err.message}`, 'error');
  }
}

async function savePassword() {
  const form = document.getElementById('password-form');
  const fd = new FormData(form);
  if ((fd.get('newPassword') || '').length < 8 || fd.get('newPassword') !== fd.get('confirmPassword')) {
    showToast('❌ Password requirements not met.', 'error');
    return;
  }
  try {
    await API.changePassword({ currentPassword: fd.get('currentPassword'), newPassword: fd.get('newPassword') });
    showToast('Password changed successfully.');
    form.reset();
  } catch (err) {
    if (!normalize401(err)) showToast(`❌ ${err.message}`, 'error');
  }
}

async function loadAddresses() {
  const section = document.getElementById('dash-addresses');
  if (!section) return;
  try {
    const data = await API.getAddresses();
    const addresses = data.addresses || [];
    section.innerHTML = `
      <div class="card">
        <h3>Saved Addresses</h3>
        ${addresses.map((a) => `<p>${escapeHtml(a.label || '')} - ${escapeHtml(a.street || '')}, ${escapeHtml(a.city || '')} <button class="btn btn-outline" onclick="deleteAddress('${a._id}')">Delete</button></p>`).join('')}
        <div class="grid-3 mt-12">
          <input id="addr-label" placeholder="Label">
          <input id="addr-street" placeholder="Street">
          <input id="addr-city" placeholder="City">
          <input id="addr-state" placeholder="State">
          <input id="addr-zip" placeholder="ZIP">
          <button class="btn btn-cta" onclick="createAddress()">Add Address</button>
        </div>
      </div>
    `;
  } catch (err) {
    if (!normalize401(err)) showToast(`❌ ${err.message}`, 'error');
  }
}

async function createAddress() {
  const payload = {
    label: document.getElementById('addr-label').value,
    street: document.getElementById('addr-street').value,
    city: document.getElementById('addr-city').value,
    state: document.getElementById('addr-state').value,
    zip: document.getElementById('addr-zip').value,
  };
  if (!validateZip(payload.zip)) {
    showToast('❌ ZIP must be 5 digits.', 'error');
    return;
  }
  try {
    await API.addAddress(payload);
    showToast('Address saved.');
    loadAddresses();
    loadSavedAddresses();
  } catch (err) {
    if (!normalize401(err)) showToast(`❌ ${err.message}`, 'error');
  }
}

async function deleteAddress(id) {
  try {
    await API.deleteAddress(id);
    showToast('Address removed.', 'info');
    loadAddresses();
    loadSavedAddresses();
  } catch (err) {
    if (!normalize401(err)) showToast(`❌ ${err.message}`, 'error');
  }
}

function showDashSection(id) {
  document.querySelectorAll('.dash-section').forEach((s) => s.classList.remove('active'));
  const target = document.getElementById(`dash-${id}`);
  if (target) target.classList.add('active');
  if (id === 'addresses') loadAddresses();
}

function renderSupportPage() {
  const customer = document.getElementById('support-customer');
  const faq = document.getElementById('support-faq');
  const guide = document.getElementById('support-guide');
  const user = API.getUser() || {};
  customer.innerHTML = `
    <div class="card">
      <h3>Customer Support</h3>
      <form id="support-form">
        <div class="grid-2">
          <label>Name<input name="name" value="${escapeHtml(`${user.firstName || ''} ${user.lastName || ''}`.trim())}"></label>
          <label>Email<input name="email" value="${escapeHtml(user.email || '')}"></label>
        </div>
        <label class="mt-12">Subject
          <select name="subject">
            <option>General Inquiry</option><option>Shipment Problem</option><option>Billing</option><option>Feedback</option><option>Other</option>
          </select>
        </label>
        <label class="mt-12">Tracking Number (optional)<input name="trackingNumber"></label>
        <label class="mt-12">Message<textarea name="message"></textarea></label>
      </form>
      <button class="btn btn-cta mt-12" onclick="submitSupport()">Submit Ticket</button>
      <div id="my-tickets" class="mt-24"></div>
    </div>
  `;
  faq.innerHTML = '<div class="card"><h3>Frequently Asked Questions</h3><div id="faq-list">Loading...</div></div>';
  guide.innerHTML = `
    <div class="card">
      <h3>Zion Service Guide</h3>
      <p><strong>Standard:</strong> 5-7 days from $8.99</p>
      <p><strong>Express:</strong> 2-3 days from $18.99</p>
      <p><strong>Overnight:</strong> Next day from $34.99</p>
      <details><summary>Prohibited items</summary><p>Hazardous goods, illegal items, and restricted materials.</p></details>
    </div>
  `;
  bindSupportTabs();
}

function bindSupportTabs() {
  document.querySelectorAll('#page-support .pill').forEach((p) => {
    p.onclick = () => {
      document.querySelectorAll('#page-support .pill').forEach((x) => x.classList.remove('active'));
      document.querySelectorAll('#page-support .tab-panel').forEach((x) => x.classList.remove('active'));
      p.classList.add('active');
      document.getElementById(p.dataset.tab).classList.add('active');
    };
  });
}

async function submitSupport() {
  const form = document.getElementById('support-form');
  const fd = new FormData(form);
  if (!validateName(fd.get('name')) || !validateEmail(fd.get('email')) || !validateSupportMessage(fd.get('message'))) {
    showToast('❌ Please complete all required support fields.', 'error');
    return;
  }
  try {
    const data = await API.submitTicket({
      name: fd.get('name'),
      email: fd.get('email'),
      subject: fd.get('subject'),
      message: fd.get('message'),
      trackingNumber: fd.get('trackingNumber') || undefined,
    });
    showToast(`Ticket created: ${data.ticketNumber || 'Submitted'}`);
    form.reset();
    if (API.isLoggedIn()) loadMyTickets();
  } catch (err) {
    if (!normalize401(err)) showToast(`❌ ${err.message}`, 'error');
  }
}

async function loadMyTickets() {
  const box = document.getElementById('my-tickets');
  if (!box || !API.isLoggedIn()) return;
  try {
    const data = await API.getMyTickets();
    const tickets = data.tickets || [];
    box.innerHTML = `
      <h4>My Tickets</h4>
      ${tickets.length ? tickets.map((t) => `<p>${escapeHtml(t.ticketNumber || '')} - ${escapeHtml(t.subject || '')} ${statusBadge(t.status || 'open')}</p>`).join('') : '<p>No tickets yet.</p>'}
    `;
  } catch (err) {
    if (!normalize401(err)) showToast(`❌ ${err.message}`, 'error');
  }
}

async function loadFAQ() {
  const list = document.getElementById('faq-list');
  if (!list) return;
  try {
    const data = await API.getFAQ();
    const faqs = data.faqs || [];
    list.innerHTML = faqs.map((f) => `
      <details class="mt-12">
        <summary>${escapeHtml(f.question || 'Question')}</summary>
        <p>${escapeHtml(f.answer || '')}</p>
      </details>
    `).join('') || '<p>No FAQ items available.</p>';
  } catch (err) {
    if (!normalize401(err)) showToast(`❌ ${err.message}`, 'error');
    list.innerHTML = '<p>Unable to load FAQ.</p>';
  }
}

async function loadLocations() {
  const grid = document.getElementById('locations-grid');
  if (!grid) return;
  showLoading(grid);
  try {
    const query = {};
    const city = document.getElementById('loc-city').value.trim();
    const zip = document.getElementById('loc-zip').value.trim();
    const type = document.getElementById('loc-type').value.trim();
    if (city) query.city = city;
    if (zip) query.zip = zip;
    if (type) query.type = type;
    const data = await API.searchLocations(query);
    const locations = data.locations || [];
    grid.innerHTML = locations.length ? locations.map((l) => {
      const status = l.openNow ? '<span style="color:var(--success)">● Open Now</span>' : '<span style="color:var(--danger)">● Closed</span>';
      const mapLink = `https://www.google.com/maps?q=${encodeURIComponent(`${l.address || ''} ${l.city || ''}`)}`;
      return `
        <article class="card">
          <h3>${escapeHtml(l.name || 'Location')}</h3>
          <p>${status}</p>
          <p>${escapeHtml(l.address || '')}</p>
          <p>${escapeHtml(l.phone || '')}</p>
          <p>${escapeHtml(typeof l.hours === 'string' ? l.hours : (l.hours?.weekday || ''))}</p>
          <a class="btn btn-outline" href="${mapLink}" target="_blank" rel="noreferrer">Get Directions</a>
        </article>
      `;
    }).join('') : '<p>No locations found.</p>';
  } catch (err) {
    if (!normalize401(err)) showToast(`❌ ${err.message}`, 'error');
    grid.innerHTML = '<p>Unable to load locations.</p>';
  }
}

function setupAuthForms() {
  const signin = document.getElementById('signin-form');
  const signup = document.getElementById('signup-form');
  signin.innerHTML = `
    <label>Email<input name="email" type="email" autocomplete="username"></label>
    <label class="mt-12">Password<input name="password" type="password" autocomplete="current-password"></label>
    <a href="#" class="mt-12" onclick="showToast('Reset link sent to your email', 'info')">Forgot password?</a>
    <button class="btn btn-cta mt-12" type="submit">Sign In</button>
    <button class="btn btn-outline mt-12" type="button">Continue with Google</button>
  `;
  signup.innerHTML = `
    <div class="grid-2">
      <label>First Name<input name="firstName" autocomplete="given-name"></label>
      <label>Last Name<input name="lastName" autocomplete="family-name"></label>
    </div>
    <label class="mt-12">Email<input name="email" type="email" autocomplete="email"></label>
    <label class="mt-12">Phone<input name="phone" autocomplete="tel"></label>
    <label class="mt-12">Password<input id="signup-password" name="password" type="password" autocomplete="new-password"></label>
    <small id="pw-strength">Strength: -</small>
    <label class="mt-12">Confirm Password<input name="confirmPassword" type="password" autocomplete="new-password"></label>
    <label class="mt-12"><input type="checkbox" name="terms"> I agree to Terms of Service and Privacy Policy</label>
    <button class="btn btn-cta mt-12" type="submit">Create Account</button>
    <button class="btn btn-outline mt-12" type="button">Continue with Google</button>
  `;

  document.querySelectorAll('#page-auth .pill').forEach((p) => {
    p.onclick = () => {
      document.querySelectorAll('#page-auth .pill').forEach((x) => x.classList.remove('active'));
      p.classList.add('active');
      const signinActive = p.dataset.auth === 'signin';
      signin.classList.toggle('active', signinActive);
      signup.classList.toggle('active', !signinActive);
    };
  });

  signin.onsubmit = async (e) => {
    e.preventDefault();
    clearFieldErrors(signin);
    const fd = new FormData(signin);
    const email = String(fd.get('email') || '').trim();
    const password = String(fd.get('password') || '');
    if (!validateEmail(email) || password.length < 8) {
      signin.classList.add('shake');
      window.setTimeout(() => signin.classList.remove('shake'), 260);
      showToast('❌ Invalid credentials format.', 'error');
      return;
    }
    try {
      await API.login({ email, password });
      Auth.updateNavForLoggedIn();
      showToast('Signed in successfully.');
      showPage(state.returnPageAfterAuth || 'dashboard');
      state.returnPageAfterAuth = null;
    } catch (err) {
      signin.classList.add('shake');
      window.setTimeout(() => signin.classList.remove('shake'), 260);
      showToast(`❌ ${err.message}`, 'error');
    }
  };

  const pwInput = document.getElementById('signup-password');
  pwInput.addEventListener('input', () => {
    const v = pwInput.value;
    let strength = 'Weak';
    if (v.length >= 10 && /[A-Z]/.test(v) && /\d/.test(v) && /[^A-Za-z0-9]/.test(v)) strength = 'Strong';
    else if (v.length >= 8 && /[A-Z]/.test(v) && /\d/.test(v)) strength = 'Fair';
    document.getElementById('pw-strength').textContent = `Strength: ${strength}`;
  });

  signup.onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(signup);
    const payload = {
      firstName: String(fd.get('firstName') || '').trim(),
      lastName: String(fd.get('lastName') || '').trim(),
      email: String(fd.get('email') || '').trim(),
      phone: String(fd.get('phone') || '').trim(),
      password: String(fd.get('password') || ''),
      confirmPassword: String(fd.get('confirmPassword') || ''),
      terms: !!fd.get('terms'),
    };
    if (!validateName(payload.firstName) || !validateName(payload.lastName) || !validateEmail(payload.email)
      || !validatePhone(payload.phone) || payload.password.length < 8 || payload.password !== payload.confirmPassword || !payload.terms) {
      signup.classList.add('shake');
      window.setTimeout(() => signup.classList.remove('shake'), 260);
      showToast('❌ Please fix signup fields.', 'error');
      return;
    }
    try {
      await API.signup({
        firstName: payload.firstName,
        lastName: payload.lastName,
        email: payload.email,
        phone: payload.phone,
        password: payload.password,
      });
      Auth.updateNavForLoggedIn();
      showToast('Account created successfully.');
      showPage(state.returnPageAfterAuth || 'dashboard');
      state.returnPageAfterAuth = null;
    } catch (err) {
      showToast(`❌ ${err.message}`, 'error');
    }
  };
}

function setupTrackingHandlers() {
  document.getElementById('track-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = document.getElementById('track-number').value;
    runTrackingSearch(v);
  });
  document.getElementById('hero-track-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = document.getElementById('hero-track-number').value;
    runTrackingSearch(v);
    showPage('tracking');
  });
}

function setupLocationsHandlers() {
  document.getElementById('locations-form').addEventListener('submit', (e) => {
    e.preventDefault();
    loadLocations();
  });
}

function setupDesignHandlers() {
  const form = document.getElementById('label-form');
  const update = () => {
    const from = document.getElementById('label-from-input').value;
    const to = document.getElementById('label-to-input').value;
    const service = document.getElementById('label-service-input').value;
    document.getElementById('lp-from').textContent = from || 'Sender Address';
    document.getElementById('lp-to').textContent = to || 'Recipient Address';
    document.getElementById('lp-service').textContent = service;
    JsBarcode('#lp-barcode', `ZN-${Math.random().toString(36).slice(2, 9).toUpperCase()}`, { displayValue: false, height: 40 });
  };
  form.addEventListener('input', update);
  document.getElementById('label-autofill').onclick = () => {
    if (!state.lastShipments.length) {
      showToast('No shipment history available.', 'info');
      return;
    }
    const recent = state.lastShipments[0];
    document.getElementById('label-from-input').value = `${recent.sender?.firstName || ''} ${recent.sender?.lastName || ''}, ${recent.sender?.street || ''}`;
    document.getElementById('label-to-input').value = `${recent.recipient?.firstName || ''} ${recent.recipient?.lastName || ''}, ${recent.recipient?.street || ''}`;
    update();
  };
  update();
}

function captureBatchInterest() {
  const email = document.getElementById('batch-email').value.trim();
  if (!validateEmail(email)) {
    showToast('❌ Enter a valid email.', 'error');
    return;
  }
  showToast('Thanks! We will notify you when batch labels launch.');
}

function debounce(fn, wait) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

function initCounters() {
  const els = document.querySelectorAll('[data-counter]');
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const target = Number(el.dataset.counter);
      const isFloat = String(el.dataset.counter).includes('.');
      const duration = 900;
      const start = performance.now();
      const step = (t) => {
        const p = Math.min(1, (t - start) / duration);
        const value = target * p;
        el.textContent = isFloat ? `${value.toFixed(1)}%` : `${Math.floor(value).toLocaleString()}+`;
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      obs.unobserve(el);
    });
  }, { threshold: 0.35 });
  els.forEach((e) => obs.observe(e));
}

function initDateMins() {
  const today = new Date().toISOString().slice(0, 10);
  const el = document.getElementById('pickup-date');
  if (el) el.setAttribute('min', today);
}

function initNav() {
  const menuBtn = document.getElementById('mobile-menu-btn');
  const menu = document.getElementById('nav-menu');
  menuBtn.addEventListener('click', () => menu.classList.toggle('open'));
  window.addEventListener('scroll', () => {
    const nav = document.getElementById('navbar');
    nav.classList.toggle('scrolled', window.scrollY > 60);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  Auth.init();
  initNav();
  setupAuthForms();
  setupTrackingHandlers();
  setupLocationsHandlers();
  setupDesignHandlers();
  renderShippingPage();
  renderSupportPage();
  initCounters();
  initDateMins();
  showPage('home');
});
