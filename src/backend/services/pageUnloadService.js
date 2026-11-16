/**
 * Remember operations blocked by beforeunload so the frontend confirmation
 * can resume the same operation after the user has made a decision.
 */
export function createPageUnloadController({ quit }) {
  const windows = new Map();
  let quitRequested = false;

  function registerWindow(window) {
    const contents = window.webContents;
    const contentsId = contents.id;
    const state = { window, pendingAction: null, closeRequested: false };
    windows.set(contentsId, state);

    window.on('close', () => {
      state.closeRequested = true;
    });

    contents.on('will-prevent-unload', () => {
      // Electron keeps the page open. Its renderer can now show the custom
      // modal, then explicitly resume this operation through IPC.
      state.pendingAction = quitRequested ? 'quit' : state.closeRequested ? 'close' : 'reload';
      state.closeRequested = false;
      quitRequested = false;
    });

    contents.on('did-finish-load', () => {
      state.pendingAction = null;
      state.closeRequested = false;
    });

    window.on('closed', () => {
      windows.delete(contentsId);
    });
  }

  function requestQuit() {
    quitRequested = true;
  }

  function respondToUnload(contents, confirmed) {
    const state = windows.get(contents.id);
    if (!state || state.window.isDestroyed() || !state.pendingAction) return;

    const action = state.pendingAction;
    state.pendingAction = null;
    if (!confirmed) return;

    if (action === 'quit') {
      quit();
    } else if (action === 'close') {
      state.window.close();
    } else {
      contents.reload();
    }
  }

  return { registerWindow, requestQuit, respondToUnload };
}
