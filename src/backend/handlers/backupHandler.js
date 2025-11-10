import { dialog } from 'electron';
import { createProjectBackup, restoreProjectBackup, checkProjectExists } from '../services/backupService.js';

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

export async function handleSelectBackupFile(event) {
  try {
    const result = await dialog.showOpenDialog({
      title: 'Select Project Backup File',
      filters: [
        { name: 'DB Connection Tool Backup', extensions: ['dctx'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    });

    if (result.canceled) {
      return { canceled: true };
    }

    return {
      success: true,
      filePath: result.filePaths[0]
    };
  } catch (error) {
    console.error('Error selecting backup file:', error);
    throw error;
  }
}

export async function handleCheckBackupFile(event, options, { db }) {
  try {
    const { filePath } = options || {};

    if (!filePath) {
      throw new Error('filePath is required');
    }

    const fs = await import('fs');
    const path = await import('path');

    if (!fs.existsSync(filePath)) {
      throw new Error('Backup file not found');
    }

    const yauzl = await import('yauzl');
    
    return new Promise((resolve, reject) => {
      yauzl.open(filePath, { lazyEntries: true }, (err, zipfile) => {
        if (err) return reject(err);

        let metadataContent = null;
        
        zipfile.readEntry();
        
        zipfile.on('entry', (entry) => {
          if (entry.fileName === 'metadata.json') {
            zipfile.openReadStream(entry, (err, readStream) => {
              if (err) return reject(err);
              
              const chunks = [];
              readStream.on('data', (chunk) => chunks.push(chunk));
              readStream.on('end', async () => {
                try {
                  metadataContent = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
                  const projectExists = await checkProjectExists(metadataContent.project_id, { db });
                  
                  zipfile.close();
                  
                  resolve({
                    success: true,
                    metadata: metadataContent,
                    projectExists
                  });
                } catch (parseErr) {
                  reject(parseErr);
                }
              });
            });
          } else {
            zipfile.readEntry();
          }
        });
        
        zipfile.on('end', () => {
          if (!metadataContent) {
            reject(new Error('Invalid backup file: missing metadata.json'));
          }
        });
        
        zipfile.on('error', reject);
      });
    });
  } catch (error) {
    console.error('Error checking backup file:', error);
    throw error;
  }
}

export async function handleRestoreBackup(event, options, { db }) {
  try {
    const { filePath, strategy = 'merge' } = options || {};

    if (!filePath) {
      throw new Error('filePath is required');
    }

    if (!['merge', 'overwrite'].includes(strategy)) {
      throw new Error('strategy must be "merge" or "overwrite"');
    }

    const restoreResult = await restoreProjectBackup(
      { filePath, strategy },
      { db }
    );

    return {
      success: true,
      ...restoreResult
    };
  } catch (error) {
    console.error('Error restoring backup:', error);
    throw error;
  }
}
