const express = require('express');
const multer = require('multer');
const { body, validationResult } = require('express-validator');
const { query, transaction } = require('../database/connection');
const { requireRole } = require('../middleware/auth');
const logger = require('../utils/logger');
const { processQuery } = require('../services/aiService');
const { uploadToS3, extractTextFromFile } = require('../services/fileService');
const { transcribeAudio } = require('../services/audioService');

const router = express.Router();

// Настройка multer для загрузки файлов
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB
    files: 5 // максимум 5 файлов
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = (process.env.ALLOWED_FILE_TYPES || 'pdf,docx,doc,jpg,jpeg,png').split(',');
    const fileExtension = file.originalname.split('.').pop().toLowerCase();
    
    if (allowedTypes.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error(`File type .${fileExtension} is not allowed`), false);
    }
  }
});

// Получить все запросы пользователя
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, status, tag } = req.query;
    const offset = (page - 1) * limit;
    
    let whereClause = 'WHERE q.user_id = $1';
    let params = [req.user.id];
    let paramIndex = 2;

    if (status) {
      whereClause += ` AND q.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (tag) {
      whereClause += ` AND EXISTS (
        SELECT 1 FROM query_tags qt 
        JOIN tags t ON qt.tag_id = t.id 
        WHERE qt.query_id = q.id AND t.name = $${paramIndex}
      )`;
      params.push(tag);
      paramIndex++;
    }

    const result = await query(`
      SELECT 
        q.id,
        q.text,
        q.audio_path,
        q.files_path,
        q.status,
        q.created_at,
        r.id as response_id,
        r.rating,
        array_agg(DISTINCT t.name) as tags
      FROM queries q
      LEFT JOIN responses r ON q.id = r.query_id
      LEFT JOIN query_tags qt ON q.id = qt.query_id
      LEFT JOIN tags t ON qt.tag_id = t.id
      ${whereClause}
      GROUP BY q.id, r.id
      ORDER BY q.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, [...params, limit, offset]);

    // Получить общее количество запросов
    const countResult = await query(`
      SELECT COUNT(DISTINCT q.id) as total
      FROM queries q
      LEFT JOIN query_tags qt ON q.id = qt.query_id
      LEFT JOIN tags t ON qt.tag_id = t.id
      ${whereClause}
    `, params);

    res.json({
      queries: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].total),
        pages: Math.ceil(countResult.rows[0].total / limit)
      }
    });
  } catch (error) {
    logger.error('Error fetching queries:', error);
    res.status(500).json({ error: 'Failed to fetch queries' });
  }
});

// Получить конкретный запрос
router.get('/:id', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        q.*,
        r.id as response_id,
        r.ai_response,
        r.rating,
        r.is_published,
        r.seo_article,
        array_agg(DISTINCT t.name) as tags,
        array_agg(DISTINCT pf.original_filename) as processed_files
      FROM queries q
      LEFT JOIN responses r ON q.id = r.query_id
      LEFT JOIN query_tags qt ON q.id = qt.query_id
      LEFT JOIN tags t ON qt.tag_id = t.id
      LEFT JOIN processed_files pf ON q.id = pf.query_id
      WHERE q.id = $1 AND q.user_id = $2
      GROUP BY q.id, r.id
    `, [req.params.id, req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Query not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error fetching query:', error);
    res.status(500).json({ error: 'Failed to fetch query' });
  }
});

// Создать новый запрос (текст)
router.post('/text', [
  body('text').trim().isLength({ min: 10, max: 5000 }).withMessage('Text must be between 10 and 5000 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { text } = req.body;
    const io = req.app.get('io');

    // Создаем запрос в базе данных
    const queryResult = await transaction(async (client) => {
      const queryInsert = await client.query(`
        INSERT INTO queries (user_id, text, status)
        VALUES ($1, $2, 'processing')
        RETURNING id
      `, [req.user.id, text]);

      const queryId = queryInsert.rows[0].id;

      // Логируем действие
      await client.query(`
        INSERT INTO activity_logs (user_id, action, details)
        VALUES ($1, 'create_query', $2)
      `, [req.user.id, JSON.stringify({ queryId, type: 'text' })]);

      return queryId;
    });

    // Отправляем уведомление через Socket.IO
    io.to(req.user.id).emit('query-status', {
      queryId: queryResult,
      status: 'processing',
      message: 'Анализируем ваш запрос...'
    });

    // Обрабатываем запрос асинхронно
    processQuery(queryResult, text, null, null, req.user.id)
      .then(async (aiResponse) => {
        // Сохраняем ответ
        await transaction(async (client) => {
          await client.query(`
            UPDATE queries SET status = 'completed' WHERE id = $1
          `, [queryResult]);

          await client.query(`
            INSERT INTO responses (query_id, ai_response)
            VALUES ($1, $2)
          `, [queryResult, aiResponse]);
        });

        // Отправляем результат
        io.to(req.user.id).emit('query-completed', {
          queryId: queryResult,
          response: aiResponse
        });
      })
      .catch(async (error) => {
        logger.error('Error processing query:', error);
        
        await transaction(async (client) => {
          await client.query(`
            UPDATE queries SET status = 'failed' WHERE id = $1
          `, [queryResult]);
        });

        io.to(req.user.id).emit('query-error', {
          queryId: queryResult,
          error: 'Ошибка при обработке запроса'
        });
      });

    res.json({ 
      message: 'Query submitted successfully',
      queryId: queryResult
    });
  } catch (error) {
    logger.error('Error creating text query:', error);
    res.status(500).json({ error: 'Failed to create query' });
  }
});

// Создать новый запрос (голос)
router.post('/voice', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Audio file is required' });
    }

    const io = req.app.get('io');

    // Загружаем аудио в S3
    const audioPath = await uploadToS3(req.file.buffer, `audio/${Date.now()}_${req.file.originalname}`);

    // Создаем запрос в базе данных
    const queryResult = await transaction(async (client) => {
      const queryInsert = await client.query(`
        INSERT INTO queries (user_id, text, audio_path, status)
        VALUES ($1, 'Processing audio...', $2, 'processing')
        RETURNING id
      `, [req.user.id, audioPath]);

      const queryId = queryInsert.rows[0].id;

      await client.query(`
        INSERT INTO activity_logs (user_id, action, details)
        VALUES ($1, 'create_query', $2)
      `, [req.user.id, JSON.stringify({ queryId, type: 'voice' })]);

      return queryId;
    });

    // Отправляем уведомление
    io.to(req.user.id).emit('query-status', {
      queryId: queryResult,
      status: 'processing',
      message: 'Транскрибируем аудио...'
    });

    // Транскрибируем аудио и обрабатываем запрос
    transcribeAudio(audioPath)
      .then(async (transcribedText) => {
        // Обновляем текст запроса
        await query(`
          UPDATE queries SET text = $1 WHERE id = $2
        `, [transcribedText, queryResult]);

        // Обрабатываем запрос
        return processQuery(queryResult, transcribedText, audioPath, null, req.user.id);
      })
      .then(async (aiResponse) => {
        await transaction(async (client) => {
          await client.query(`
            UPDATE queries SET status = 'completed' WHERE id = $1
          `, [queryResult]);

          await client.query(`
            INSERT INTO responses (query_id, ai_response)
            VALUES ($1, $2)
          `, [queryResult, aiResponse]);
        });

        io.to(req.user.id).emit('query-completed', {
          queryId: queryResult,
          response: aiResponse
        });
      })
      .catch(async (error) => {
        logger.error('Error processing voice query:', error);
        
        await transaction(async (client) => {
          await client.query(`
            UPDATE queries SET status = 'failed' WHERE id = $1
          `, [queryResult]);
        });

        io.to(req.user.id).emit('query-error', {
          queryId: queryResult,
          error: 'Ошибка при обработке аудио'
        });
      });

    res.json({ 
      message: 'Voice query submitted successfully',
      queryId: queryResult
    });
  } catch (error) {
    logger.error('Error creating voice query:', error);
    res.status(500).json({ error: 'Failed to create voice query' });
  }
});

// Создать новый запрос (файлы)
router.post('/files', upload.array('files', 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'At least one file is required' });
    }

    const { text } = req.body;
    const io = req.app.get('io');

    // Загружаем файлы в S3 и извлекаем текст
    const filePaths = [];
    const extractedTexts = [];

    for (const file of req.files) {
      const filePath = await uploadToS3(file.buffer, `files/${Date.now()}_${file.originalname}`);
      filePaths.push(filePath);
      
      const extractedText = await extractTextFromFile(file.buffer, file.originalname);
      extractedTexts.push(extractedText);
    }

    // Создаем запрос в базе данных
    const queryResult = await transaction(async (client) => {
      const queryInsert = await client.query(`
        INSERT INTO queries (user_id, text, files_path, status)
        VALUES ($1, $2, $3, 'processing')
        RETURNING id
      `, [req.user.id, text || 'Analyzing uploaded files...', filePaths]);

      const queryId = queryInsert.rows[0].id;

      // Сохраняем информацию о файлах
      for (let i = 0; i < req.files.length; i++) {
        await client.query(`
          INSERT INTO processed_files (query_id, original_filename, s3_path, file_type, extracted_text, processing_status)
          VALUES ($1, $2, $3, $4, $5, 'completed')
        `, [queryId, req.files[i].originalname, filePaths[i], req.files[i].mimetype, extractedTexts[i]]);
      }

      await client.query(`
        INSERT INTO activity_logs (user_id, action, details)
        VALUES ($1, 'create_query', $2)
      `, [req.user.id, JSON.stringify({ queryId, type: 'files', fileCount: req.files.length })]);

      return queryId;
    });

    // Отправляем уведомление
    io.to(req.user.id).emit('query-status', {
      queryId: queryResult,
      status: 'processing',
      message: 'Анализируем документы...'
    });

    // Обрабатываем запрос с извлеченным текстом
    const combinedText = extractedTexts.join('\n\n');
    const finalText = text ? `${text}\n\nДокументы:\n${combinedText}` : combinedText;

    processQuery(queryResult, finalText, null, filePaths, req.user.id)
      .then(async (aiResponse) => {
        await transaction(async (client) => {
          await client.query(`
            UPDATE queries SET status = 'completed' WHERE id = $1
          `, [queryResult]);

          await client.query(`
            INSERT INTO responses (query_id, ai_response)
            VALUES ($1, $2)
          `, [queryResult, aiResponse]);
        });

        io.to(req.user.id).emit('query-completed', {
          queryId: queryResult,
          response: aiResponse
        });
      })
      .catch(async (error) => {
        logger.error('Error processing files query:', error);
        
        await transaction(async (client) => {
          await client.query(`
            UPDATE queries SET status = 'failed' WHERE id = $1
          `, [queryResult]);
        });

        io.to(req.user.id).emit('query-error', {
          queryId: queryResult,
          error: 'Ошибка при анализе документов'
        });
      });

    res.json({ 
      message: 'Files query submitted successfully',
      queryId: queryResult
    });
  } catch (error) {
    logger.error('Error creating files query:', error);
    res.status(500).json({ error: 'Failed to create files query' });
  }
});

// Удалить запрос (только владелец или админ)
router.delete('/:id', requireRole(['user', 'admin']), async (req, res) => {
  try {
    const result = await query(`
      DELETE FROM queries 
      WHERE id = $1 AND (user_id = $2 OR $3 = 'admin')
      RETURNING id
    `, [req.params.id, req.user.id, req.user.role]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Query not found or access denied' });
    }

    res.json({ message: 'Query deleted successfully' });
  } catch (error) {
    logger.error('Error deleting query:', error);
    res.status(500).json({ error: 'Failed to delete query' });
  }
});

module.exports = router;

