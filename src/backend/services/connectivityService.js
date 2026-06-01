/**
 * Network connectivity probe service for tracking online/offline state and
 * broadcasting status changes to renderer windows.
 *
 * @namespace backend.services.connectivityService
 * @memberof backend.services
 */
import { net } from 'electron';
import { lookup as dnsLookup } from 'dns/promises';
import { sendToAllWindows } from './windowNotifierService.js';

const CONNECTIVITY_PROBE_HOSTS = (process.env.CONNECTIVITY_PROBE_HOSTS || 'cloudflare.com,google.com,microsoft.com')
  .split(',')
  .map((h) => h.trim())
  .filter(Boolean);

const PROBE_INTERVAL_MS = 10000;
const PROBE_TIMEOUT_MS = 3000;
const PROBE_FAILURE_THRESHOLD = 2;

let currentNetworkStatus = { online: true, source: 'startup', ts: Date.now() };
let probeTimer = null;
let probeRunning = false;
let consecutiveFailures = 0;

/**
 * Get the latest cached network status.
 * @memberof backend.services.connectivityService
 * @returns {Object}
 */
export function getCurrentNetworkStatus() {
  return currentNetworkStatus;
}

/**
 * Replace the cached network status without broadcasting it.
 * @memberof backend.services.connectivityService
 * @param {boolean} online - Whether the app is online.
 * @param {string} source - Status source label.
 * @returns {void}
 */
export function setNetworkStatus(online, source) {
  currentNetworkStatus = { online: !!online, source, ts: Date.now() };
}

/**
 * Update and broadcast the network status to all renderer windows.
 * @memberof backend.services.connectivityService
 * @param {boolean} online - Whether the app is online.
 * @param {string} [source='electron'] - Status source label.
 * @returns {void}
 */
export function broadcastNetworkStatus(online, source = 'electron') {
  const next = { online: !!online, source, ts: Date.now() };
  if (currentNetworkStatus.online === next.online && currentNetworkStatus.source === next.source) return;
  currentNetworkStatus = next;
  sendToAllWindows('network-status-changed', currentNetworkStatus);
}

function withTimeout(promise, timeoutMs, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
      timeoutMs
    );
    promise
      .then((v) => { clearTimeout(timer); resolve(v); })
      .catch((e) => { clearTimeout(timer); reject(e); });
  });
}

async function probeConnectivity() {
  if (!net.isOnline()) return false;
  await Promise.any(
    CONNECTIVITY_PROBE_HOSTS.map((host) =>
      withTimeout(dnsLookup(host), PROBE_TIMEOUT_MS, `dns:${host}`)
    )
  );
  return true;
}

async function runProbe() {
  if (probeRunning) return;
  probeRunning = true;
  try {
    const online = await probeConnectivity();
    consecutiveFailures = 0;
    if (!currentNetworkStatus.online) broadcastNetworkStatus(online, 'connectivity-probe');
  } catch (error) {
    consecutiveFailures += 1;
    if (currentNetworkStatus.online && consecutiveFailures >= PROBE_FAILURE_THRESHOLD) {
      broadcastNetworkStatus(false, 'connectivity-probe');
    }
  } finally {
    probeRunning = false;
  }
}

/**
 * Start the recurring DNS-based connectivity probe.
 * @memberof backend.services.connectivityService
 * @returns {void}
 */
export function startConnectivityProbe() {
  if (probeTimer) return;
  void runProbe();
  probeTimer = setInterval(() => void runProbe(), PROBE_INTERVAL_MS);
}

/**
 * Stop the recurring connectivity probe and reset probe state.
 * @memberof backend.services.connectivityService
 * @returns {void}
 */
export function stopConnectivityProbe() {
  if (!probeTimer) return;
  clearInterval(probeTimer);
  probeTimer = null;
  probeRunning = false;
  consecutiveFailures = 0;
}
