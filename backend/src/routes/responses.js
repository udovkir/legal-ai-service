const express = require('express');
const { body, validationResult } = require('express-validator');
const { query, transaction } = require('../database/connection');
const { requireRole } = require('../middleware/auth');
const logger = require('../utils/logger');
const { generateSEOArticle } = require('../services/aiService');

const router = express.Router();

// Получить ответ по ID запроса
router.get('/:queryId', async (req, res) => {
  try {
    const { queryId } = req.params;
    const userId = req.user.id;

    const result = await query(`
      SELECT 
        r.*,
        q.text as query_text,
        q.status as query_status
      FROM responses r
      JOIN queries q ON r.query_id = q.id
      WHERE r.query_id = $1 AND q.user_id = $2
    `, [queryId, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Response not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error fetching response:', error);
    res.status(500).json({ error: 'Failed to fetch response' });
  }
});

// Оценить ответ
router.post('/:queryId/rate', [
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { queryId } = req.params;
    const { rating } = req.body;
    const userId = req.user.id;

    // Проверяем, что пользователь является владельцем запроса
    const queryResult = await query(`
      SELECT id FROM queries WHERE id = $1 AND user_id = $2
    `, [queryId, userId]);

    if (queryResult.rows.length === 0) {
      return res.status(404).json({ error: 'Query not found' });
    }

    // Обновляем рейтинг
    await transaction(async (client) => {
      await client.query(`
        UPDATE responses 
        SET rating = $1 
        WHERE query_id = $2
      `, [rating, queryId]);

      // Логируем оценку
      await client.query(`
        INSERT INTO activity_logs (user_id, action, details)
        VALUES ($1, 'rate_response', $2)
      `, [userId, JSON.stringify({ queryId, rating })]);

      // Если рейтинг высокий (4-5), генерируем SEO статью
      if (rating >= 4) {
        const responseResult = await client.query(`
          SELECT ai_response FROM responses WHERE query_id = $1
        `, [queryId]);

        if (responseResult.rows.length > 0) {
          const aiResponse = responseResult.rows[0].ai_response;
          
          // Генерируем SEO статью асинхронно
          generateSEOArticle(queryId, aiResponse)
            .then(async (seoArticle) => {
              await query(`
                UPDATE responses 
                SET seo_article = $1 
                WHERE query_id = $2
              `, [seoArticle, queryId]);
              
              logger.info('SEO article generated for high-rated response:', { queryId, rating });
            })
            .catch(error => {
              logger.error('Error generating SEO article:', error);
            });
        }
      }
    });

    logger.info('Response rated successfully:', { queryId, rating, userId });

    res.json({ message: 'Response rated successfully' });
  } catch (error) {
    logger.error('Error rating response:', error);
    res.status(500).json({ error: 'Failed to rate response' });
  }
});

// Публикация ответа (только для админов/модераторов)
router.post('/:queryId/publish', requireRole(['admin', 'moderator']), async (req, res) => {
  try {
    const { queryId } = req.params;
    const { isPublished } = req.body;

    const result = await query(`
      UPDATE responses 
      SET is_published = $1 
      WHERE query_id = $2
      RETURNING id
    `, [isPublished, queryId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Response not found' });
    }

    // Логируем публикацию
    await query(`
      INSERT INTO activity_logs (user_id, action, details)
      VALUES ($1, 'publish_response', $2)
    `, [req.user.id, JSON.stringify({ queryId, isPublished })]);

    logger.info('Response publication status updated:', { queryId, isPublished, userId: req.user.id });

    res.json({ message: `Response ${isPublished ? 'published' : 'unpublished'} successfully` });
  } catch (error) {
    logger.error('Error updating response publication status:', error);
    res.status(500).json({ error: 'Failed to update response publication status' });
  }
});

// Получить статистику ответов
router.get('/stats/overview', async (req, res) => {
  try {
    const userId = req.user.id;

    const stats = await query(`
      SELECT 
        COUNT(*) as total_responses,
        AVG(r.rating) as average_rating,
        COUNT(CASE WHEN r.rating >= 4 THEN 1 END) as high_rated_count,
        COUNT(CASE WHEN r.is_published = true THEN 1 END) as published_count
      FROM responses r
      JOIN queries q ON r.query_id = q.id
      WHERE q.user_id = $1
    `, [userId]);

    res.json(stats.rows[0]);
  } catch (error) {
    logger.error('Error fetching response stats:', error);
    res.status(500).json({ error: 'Failed to fetch response statistics' });
  }
});

// Получить популярные теги
router.get('/stats/tags', async (req, res) => {
  try {
    const userId = req.user.id;

    const tags = await query(`
      SELECT 
        t.name,
        t.color,
        COUNT(qt.query_id) as usage_count
      FROM tags t
      JOIN query_tags qt ON t.id = qt.tag_id
      JOIN queries q ON qt.query_id = q.id
      WHERE q.user_id = $1
      GROUP BY t.id, t.name, t.color
      ORDER BY usage_count DESC
      LIMIT 10
    `, [userId]);

    res.json(tags.rows);
  } catch (error) {
    logger.error('Error fetching tag stats:', error);
    res.status(500).json({ error: 'Failed to fetch tag statistics' });
  }
});

// Экспорт ответа в PDF (заглушка)
router.post('/:queryId/export-pdf', async (req, res) => {
  try {
    const { queryId } = req.params;
    const userId = req.user.id;

    // Проверяем, что пользователь является владельцем запроса
    const queryResult = await query(`
      SELECT id FROM queries WHERE id = $1 AND user_id = $2
    `, [queryId, userId]);

    if (queryResult.rows.length === 0) {
      return res.status(404).json({ error: 'Query not found' });
    }

    // Здесь должна быть логика генерации PDF
    // Для простоты возвращаем заглушку
    const pdfUrl = `/api/responses/${queryId}/pdf`;

    // Логируем экспорт
    await query(`
      INSERT INTO activity_logs (user_id, action, details)
      VALUES ($1, 'export_pdf', $2)
    `, [userId, JSON.stringify({ queryId })]);

    logger.info('PDF export requested:', { queryId, userId });

    res.json({ 
      message: 'PDF export initiated',
      downloadUrl: pdfUrl
    });
  } catch (error) {
    logger.error('Error exporting PDF:', error);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

// Получить похожие ответы
router.get('/:queryId/similar', async (req, res) => {
  try {
    const { queryId } = req.params;
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 5;

    // Получаем эмбеддинг текущего ответа
    const currentResponse = await query(`
      SELECT r.embedding, q.text
      FROM responses r
      JOIN queries q ON r.query_id = q.id
      WHERE r.query_id = $1 AND q.user_id = $2
    `, [queryId, userId]);

    if (currentResponse.rows.length === 0) {
      return res.status(404).json({ error: 'Response not found' });
    }

    const embedding = currentResponse.rows[0].embedding;

    if (!embedding) {
      return res.json({ similar: [] });
    }

    // Ищем похожие ответы
    const similar = await query(`
      SELECT 
        q.id as query_id,
        q.text as query_text,
        r.ai_response,
        1 - (r.embedding <=> $1) as similarity
      FROM responses r
      JOIN queries q ON r.query_id = q.id
      WHERE r.query_id != $2 
        AND r.embedding IS NOT NULL
        AND 1 - (r.embedding <=> $1) > 0.7
      ORDER BY r.embedding <=> $1
      LIMIT $3
    `, [embedding, queryId, limit]);

    res.json({ similar: similar.rows });
  } catch (error) {
    logger.error('Error finding similar responses:', error);
    res.status(500).json({ error: 'Failed to find similar responses' });
  }
});

// Заказать консультацию юриста
router.post('/:queryId/request-consultation', [
  body('message').optional().trim().isLength({ max: 1000 }).withMessage('Message too long')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { queryId } = req.params;
    const { message } = req.body;
    const userId = req.user.id;

    // Проверяем, что пользователь является владельцем запроса
    const queryResult = await query(`
      SELECT id FROM queries WHERE id = $1 AND user_id = $2
    `, [queryId, userId]);

    if (queryResult.rows.length === 0) {
      return res.status(404).json({ error: 'Query not found' });
    }

    // Логируем запрос на консультацию
    await query(`
      INSERT INTO activity_logs (user_id, action, details)
      VALUES ($1, 'request_consultation', $2)
    `, [userId, JSON.stringify({ queryId, message })]);

    // Здесь можно добавить логику отправки уведомления юристу
    // Например, через Telegram бота или email

    logger.info('Consultation requested:', { queryId, userId, message });

    res.json({ 
      message: 'Consultation request submitted successfully',
      estimatedResponseTime: '24 hours'
    });
  } catch (error) {
    logger.error('Error requesting consultation:', error);
    res.status(500).json({ error: 'Failed to request consultation' });
  }
});

module.exports = router;

