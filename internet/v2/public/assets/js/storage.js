import { cloneStateForSave } from './game-state.js';

const STORAGE_KEY = 'stack-ou-pas-stack-v2-state';
const REMOTE_SEAT_PREFIX = 'stack-ou-pas-stack-v2-seat-';
const API_BASE = './api/games.php';

export function saveLocalState(state) {
  if (!state) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cloneStateForSave(state)));
}

export function loadLocalState() {
  const json = window.localStorage.getItem(STORAGE_KEY);
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch (error) {
    return null;
  }
}

export function exportStateToClipboard(state) {
  try {
    const text = JSON.stringify(cloneStateForSave(state));
    navigator.clipboard?.writeText(text);
    return text;
  } catch (error) {
    return null;
  }
}

export function importStateFromJson(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
}

export async function detectApi() {
  try {
    const response = await fetch(`${API_BASE}?action=pong`, { method: 'GET' });
    const json = await response.json();
    return json?.status === 'pong';
  } catch (error) {
    return false;
  }
}

export async function createRemoteGame(state) {
  if (!state) return null;
  try {
    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', state: cloneStateForSave(state) })
    });
    return response.ok ? await response.json() : null;
  } catch (error) {
    return null;
  }
}

export async function joinRemoteGame(code) {
  const normalizedCode = String(code || '').trim().toUpperCase();
  try {
    const response = await fetch(`${API_BASE}?action=load&code=${encodeURIComponent(normalizedCode)}`, { method: 'GET' });
    return response.ok ? await response.json() : null;
  } catch (error) {
    return null;
  }
}

export async function saveRemoteGame(code, state) {
  if (!code || !state) return null;
  const normalizedCode = String(code).trim().toUpperCase();
  try {
    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save', code: normalizedCode, state: cloneStateForSave(state) })
    });
    return response.ok ? await response.json() : null;
  } catch (error) {
    return null;
  }
}

export async function loadRemoteGame(code) {
  if (!code) return null;
  const normalizedCode = String(code).trim().toUpperCase();
  try {
    const response = await fetch(`${API_BASE}?action=load&code=${encodeURIComponent(normalizedCode)}`, { method: 'GET' });
    return response.ok ? await response.json() : null;
  } catch (error) {
    return null;
  }
}

export function saveRemoteSeat(code, seat) {
  const normalizedCode = String(code || '').trim().toUpperCase();
  if (!normalizedCode || ![0, 1].includes(seat)) return;
  window.sessionStorage.setItem(`${REMOTE_SEAT_PREFIX}${normalizedCode}`, String(seat));
}

export function loadRemoteSeat(code) {
  const normalizedCode = String(code || '').trim().toUpperCase();
  if (!normalizedCode) return null;
  const value = window.sessionStorage.getItem(`${REMOTE_SEAT_PREFIX}${normalizedCode}`);
  const seat = Number(value);
  return [0, 1].includes(seat) ? seat : null;
}
