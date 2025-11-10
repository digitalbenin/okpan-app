import { dialog } from 'electron';
import { createProjectBackup } from '../services/backupService.js';

export async function handleCreateBackup(event, options, { db }) {
  try {
    const { project_id } = options || {};

    if (!project_id) {
      throw new Error('project_id is required');
    }

    const result = await dialog.showSaveDialog({
      title: 'Save Project Backup',
      defaultPath: `backup-${project_id}-${Date.now()}.dctx`,
      filters: [
        { name: 'DB Connection Tool Backup', extensions: ['dctx'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['createDirectory', 'showOverwriteConfirmation']
    });

    if (result.canceled) {
      return { canceled: true };
    }

    const backupResult = await createProjectBackup(
      { project_id, filePath: result.filePath },
      { db }
    );

    return {
      success: true,
      ...backupResult
    };
  } catch (error) {
    console.error('Error creating backup:', error);
    throw error;
  }
}
