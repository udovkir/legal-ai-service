const express = require('express');
const { query } = require('../database/connection');
const { getFromS3, deleteFromS3 } = require('../services/fileService');
const logger = require('../utils/logger');

const router = express.Router();

// Получить информацию о файлах запроса
router.get('/query/:queryId', async (req, res) => {
  try {
    const { queryId } = req.params;
    const userId = req.user.id;

    const result = await query(`
      SELECT 
        pf.id,
        pf.original_filename,
        pf.s3_path,
        pf.file_type,
        pf.processing_status,
        pf.created_at
      FROM processed_files pf
      JOIN queries q ON pf.query_id = q.id
      WHERE pf.query_id = $1 AND q.user_id = $2
      ORDER BY pf.created_at DESC
    `, [queryId, userId]);

    res.json(result.rows);
  } catch (error) {
    logger.error('Error fetching files:', error);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

// Скачать файл
router.get('/download/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.user.id;

    // Получаем информацию о файле
    const result = await query(`
      SELECT 
        pf.original_filename,
        pf.s3_path,
        pf.file_type
      FROM processed_files pf
      JOIN queries q ON pf.query_id = q.id
      WHERE pf.id = $1 AND q.user_id = $2
    `, [fileId, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const file = result.rows[0];

    // Получаем файл из S3
    const fileBuffer = await getFromS3(file.s3_path);

    // Устанавливаем заголовки для скачивания
    res.setHeader('Content-Type', file.file_type);
    res.setHeader('Content-Disposition', `attachment; filename="${file.original_filename}"`);
    res.setHeader('Content-Length', fileBuffer.length);

    res.send(fileBuffer);
  } catch (error) {
    logger.error('Error downloading file:', error);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

// Удалить файл
router.delete('/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.user.id;

    // Получаем информацию о файле
    const result = await query(`
      SELECT 
        pf.s3_path,
        pf.query_id
      FROM processed_files pf
      JOIN queries q ON pf.query_id = q.id
      WHERE pf.id = $1 AND q.user_id = $2
    `, [fileId, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const file = result.rows[0];

    // Удаляем файл из S3
    await deleteFromS3(file.s3_path);

    // Удаляем запись из базы данных
    await query(`
      DELETE FROM processed_files WHERE id = $1
    `, [fileId]);

    logger.info('File deleted successfully:', { fileId, userId });

    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    logger.error('Error deleting file:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

module.exports = router;

