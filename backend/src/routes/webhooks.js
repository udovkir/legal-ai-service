const express = require('express');
const { query } = require('../database/connection');
const logger = require('../utils/logger');

const router = express.Router();

// Webhook для новых запросов
router.post('/new-query', async (req, res) => {
  try {
    const { queryId, userId, type } = req.body;

    logger.info('N8N webhook received - new query:', { queryId, userId, type });

    // Здесь можно добавить логику для автоматизации
    // Например, отправка уведомлений, создание задач и т.д.

    res.json({ 
      success: true, 
      message: 'New query webhook processed',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error processing new query webhook:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

// Webhook для завершенных ответов
router.post('/response-completed', async (req, res) => {
  try {
    const { queryId, userId, response } = req.body;

    logger.info('N8N webhook received - response completed:', { queryId, userId });

    // Здесь можно добавить логику для автоматизации
    // Например, отправка уведомлений пользователю, создание SEO статей и т.д.

    res.json({ 
      success: true, 
      message: 'Response completed webhook processed',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error processing response completed webhook:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

// Webhook для высоко оцененных ответов
router.post('/high-rated-response', async (req, res) => {
  try {
    const { queryId, userId, rating } = req.body;

    logger.info('N8N webhook received - high rated response:', { queryId, userId, rating });

    // Здесь можно добавить логику для автоматизации
    // Например, автоматическое создание SEO статей, публикация в блоге и т.д.

    res.json({ 
      success: true, 
      message: 'High rated response webhook processed',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error processing high rated response webhook:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

// Webhook для публикации статей
router.post('/publish-article', async (req, res) => {
  try {
    const { queryId, seoArticle } = req.body;

    logger.info('N8N webhook received - publish article:', { queryId });

    // Здесь можно добавить логику для автоматизации
    // Например, публикация в CMS, отправка в социальные сети и т.д.

    res.json({ 
      success: true, 
      message: 'Publish article webhook processed',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error processing publish article webhook:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

// Webhook для запросов на консультацию
router.post('/consultation-request', async (req, res) => {
  try {
    const { queryId, userId, message } = req.body;

    logger.info('N8N webhook received - consultation request:', { queryId, userId });

    // Здесь можно добавить логику для автоматизации
    // Например, отправка уведомления юристу, создание задачи в CRM и т.д.

    res.json({ 
      success: true, 
      message: 'Consultation request webhook processed',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error processing consultation request webhook:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

// Webhook для мониторинга системы
router.post('/system-health', async (req, res) => {
  try {
    const { status, metrics } = req.body;

    logger.info('N8N webhook received - system health:', { status, metrics });

    // Здесь можно добавить логику для мониторинга
    // Например, отправка алертов при проблемах, логирование метрик и т.д.

    res.json({ 
      success: true, 
      message: 'System health webhook processed',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error processing system health webhook:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

module.exports = router;

