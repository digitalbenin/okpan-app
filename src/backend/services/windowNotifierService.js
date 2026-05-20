/**
 * Window notification service for broadcasting backend events to renderer
 * processes.
 *
 * @namespace backend.services.windowNotifierService
 * @memberof backend.services
 */
import { BrowserWindow } from 'electron';
import { getProjectPresence } from './p2pService.js';

/**
 * Broadcast a payload to every live renderer window.
 * @memberof backend.services.windowNotifierService
 * @param {string} channel - IPC channel name.
 * @param {*} payload - Message payload.
 * @returns {void}
 */
export function sendToAllWindows(channel, payload) {
  for (const window of BrowserWindow.getAllWindows()) {
    if (window.isDestroyed() || window.webContents.isDestroyed()) continue;
    window.webContents.send(channel, payload);
  }
}

/**
 * Send a payload back to the IPC sender when possible.
 * @memberof backend.services.windowNotifierService
 * @param {Electron.IpcMainInvokeEvent|Object} event - IPC event object.
 * @param {string} channel - IPC channel name.
 * @param {*} payload - Message payload.
 * @param {string} warningMessage - Warning text used when send fails.
 * @returns {boolean}
 */
export function sendToEventSender(event, channel, payload, warningMessage) {
  const sender = event?.sender;
  if (!sender || sender.isDestroyed()) return false;
  try {
    sender.send(channel, payload);
    return true;
  } catch (error) {
    console.warn(warningMessage, error);
    return false;
  }
}

/**
 * Notify the renderer that project data changed.
 * @memberof backend.services.windowNotifierService
 * @param {Electron.IpcMainInvokeEvent|Object} event - IPC event object.
 * @param {string} projectId - Project identifier.
 * @param {string} origin - Change origin label.
 * @returns {boolean}
 */
export function notifyProjectDataChanged(event, projectId, origin) {
  return sendToEventSender(
    event,
    'data-changed',
    { projectId, origin },
    'Failed to notify frontend of data change'
  );
}

/**
 * Notify the renderer of the current project presence state.
 * @memberof backend.services.windowNotifierService
 * @param {Electron.IpcMainInvokeEvent|Object} event - IPC event object.
 * @param {string} projectId - Project identifier.
 * @returns {boolean}
 */
export function notifyProjectPresence(event, projectId) {
  return sendToEventSender(
    event,
    'project-presence-changed',
    { projectId, presence: getProjectPresence(projectId) },
    'Failed to notify frontend of project presence'
  );
}
