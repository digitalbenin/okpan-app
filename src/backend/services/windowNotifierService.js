/**
 * Window notification service for broadcasting backend events to renderer
 * processes.
 *
 * @namespace backend.services.windowNotifierService
 * @memberof backend.services
 */
import { BrowserWindow } from 'electron';
import { getProjectPresence } from './p2pService.js';

export function sendToAllWindows(channel, payload) {
  for (const window of BrowserWindow.getAllWindows()) {
    if (window.isDestroyed() || window.webContents.isDestroyed()) continue;
    window.webContents.send(channel, payload);
  }
}

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

export function notifyProjectDataChanged(event, projectId, origin) {
  return sendToEventSender(
    event,
    'data-changed',
    { projectId, origin },
    'Failed to notify frontend of data change'
  );
}

export function notifyProjectPresence(event, projectId) {
  return sendToEventSender(
    event,
    'project-presence-changed',
    { projectId, presence: getProjectPresence(projectId) },
    'Failed to notify frontend of project presence'
  );
}
