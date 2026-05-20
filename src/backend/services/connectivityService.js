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

export function getCurrentNetworkStatus() {
  return currentNetworkStatus;
}

export function setNetworkStatus(online, source) {
  currentNetworkStatus = { online: !!online, source, ts: Date.now() };
}

export function broadcastNetworkStatus(online, source = 'electron') {
  const next = { online: !!online, source, ts: Date.now() };
  if (currentNetworkStatus.online === next.online && currentNetworkStatus.source === next.source) {
    console.log('[Network] status unchanged', next);
    return;
  }
  currentNetworkStatus = next;
  console.log('[Network] status changed', currentNetworkStatus);
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
    console.log('[Network] connectivity probe failed', {
      consecutiveFailures,
      message: error?.message || error
    });
    if (currentNetworkStatus.online && consecutiveFailures >= PROBE_FAILURE_THRESHOLD) {
      broadcastNetworkStatus(false, 'connectivity-probe');
    }
  } finally {
    probeRunning = false;
  }
}

export function startConnectivityProbe() {
  if (probeTimer) return;
  void runProbe();
  probeTimer = setInterval(() => void runProbe(), PROBE_INTERVAL_MS);
}

export function stopConnectivityProbe() {
  if (!probeTimer) return;
  clearInterval(probeTimer);
  probeTimer = null;
  probeRunning = false;
  consecutiveFailures = 0;
}
