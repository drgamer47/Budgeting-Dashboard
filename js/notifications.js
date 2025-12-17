/**
 * Persistent Notification Center
 * Stores notifications in localStorage and renders a small panel in the header.
 */

import { logger } from './logger.js';

const STORAGE_KEY = 'budgetDashboard.notifications.v1';
const MAX_NOTIFICATIONS = 200;

function safeJsonParse(str, fallback) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

function loadNotifications() {
  const raw = localStorage.getItem(STORAGE_KEY);
  const list = safeJsonParse(raw, []);
  return Array.isArray(list) ? list : [];
}

function saveNotifications(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_NOTIFICATIONS)));
}

function nowIso() {
  return new Date().toISOString();
}

function makeId() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function getUnreadCount(list) {
  return list.reduce((n, item) => n + (!item.read ? 1 : 0), 0);
}

function renderBadge() {
  const badge = document.getElementById('notificationsBadge');
  if (!badge) return;

  const list = loadNotifications();
  const unread = getUnreadCount(list);
  if (unread <= 0) {
    badge.style.display = 'none';
    badge.textContent = '0';
    return;
  }
  badge.style.display = '';
  badge.textContent = String(Math.min(unread, 99));
}

function renderList() {
  const container = document.getElementById('notificationsList');
  if (!container) return;

  const list = loadNotifications();
  container.innerHTML = '';

  if (list.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'notifications-empty';
    empty.textContent = 'No notifications yet.';
    container.appendChild(empty);
    return;
  }

  for (const item of list) {
    const row = document.createElement('div');
    row.className = `notification-item ${item.read ? 'read' : 'unread'} level-${item.level || 'info'}`;
    row.dataset.id = item.id;

    const meta = document.createElement('div');
    meta.className = 'notification-meta';
    meta.textContent = new Date(item.createdAt || nowIso()).toLocaleString();

    const msg = document.createElement('div');
    msg.className = 'notification-message';
    // Preserve line breaks
    msg.textContent = String(item.message || '');

    row.appendChild(meta);
    row.appendChild(msg);

    row.addEventListener('click', () => {
      markAsRead(item.id);
      row.classList.remove('unread');
      row.classList.add('read');
      renderBadge();
    });

    container.appendChild(row);
  }
}

function setPanelOpen(open) {
  const panel = document.getElementById('notificationsPanel');
  const wrapper = document.getElementById('notificationsWrapper');
  if (!panel || !wrapper) return;

  if (open) {
    wrapper.classList.add('active');
    panel.setAttribute('aria-hidden', 'false');
    // Mark all visible as read when opening
    markAllAsRead();
    renderList();
    renderBadge();
  } else {
    wrapper.classList.remove('active');
    panel.setAttribute('aria-hidden', 'true');
  }
}

export function closeNotificationsPanel() {
  setPanelOpen(false);
}

export function openNotificationsPanel() {
  setPanelOpen(true);
}

export function toggleNotificationsPanel() {
  const wrapper = document.getElementById('notificationsWrapper');
  const isOpen = !!wrapper?.classList.contains('active');
  setPanelOpen(!isOpen);
}

export function clearNotifications() {
  saveNotifications([]);
  renderList();
  renderBadge();
}

export function markAsRead(id) {
  const list = loadNotifications();
  const idx = list.findIndex(n => n.id === id);
  if (idx >= 0) {
    list[idx] = { ...list[idx], read: true };
    saveNotifications(list);
  }
}

export function markAllAsRead() {
  const list = loadNotifications();
  const updated = list.map(n => ({ ...n, read: true }));
  saveNotifications(updated);
}

/**
 * Add a notification.
 * @param {string} message
 * @param {{level?: 'info'|'success'|'warning'|'error', dedupeKey?: string}} [opts]
 */
export function addNotification(message, opts = {}) {
  const level = opts.level || 'info';
  const dedupeKey = opts.dedupeKey;

  const list = loadNotifications();

  if (dedupeKey) {
    const existing = list.find(n => n.dedupeKey === dedupeKey);
    if (existing) {
      // Refresh timestamp + message, keep it unread
      const updated = list.map(n => (n.id === existing.id
        ? { ...n, message, level, createdAt: nowIso(), read: false }
        : n
      ));
      saveNotifications(updated);
      renderBadge();
      return;
    }
  }

  const entry = {
    id: makeId(),
    message,
    level,
    createdAt: nowIso(),
    read: false,
    dedupeKey: dedupeKey || null
  };

  saveNotifications([entry, ...list]);
  renderBadge();
}

export function initNotifications() {
  const btn = document.getElementById('notificationsBtn');
  const panel = document.getElementById('notificationsPanel');
  const clearBtn = document.getElementById('clearNotificationsBtn');

  if (!btn || !panel) {
    logger.warn('Notifications UI not found; skipping initNotifications()');
    return;
  }

  // Expose a tiny API for other modules (e.g. profile menu) without tight coupling
  window.closeNotificationsPanel = closeNotificationsPanel;

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    // Close profile dropdown if open
    const profileMenu = document.querySelector('.profile-menu');
    if (profileMenu) profileMenu.classList.remove('active');
    toggleNotificationsPanel();
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      clearNotifications();
    });
  }

  // Close panel when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#notificationsWrapper')) {
      closeNotificationsPanel();
    }
  });

  renderBadge();
}


