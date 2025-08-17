const express = require('express');
const { body, validationResult } = require('express-validator');
const { query, transaction } = require('../database/connection');
const { requireRole } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Получить профиль пользователя
router.get('/profile', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        id,
        email,
        first_name,
        last_name,
        role,
        created_at,
        updated_at
      FROM users 
      WHERE id = $1
    `, [req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// Обновить профиль пользователя
router.put('/profile', [
  body('firstName').optional().trim().isLength({ min: 2 }).withMessage('First name must be at least 2 characters'),
  body('lastName').optional().trim().isLength({ min: 2 }).withMessage('Last name must be at least 2 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { firstName, lastName } = req.body;
    const userId = req.user.id;

    const result = await transaction(async (client) => {
      const updateResult = await client.query(`
        UPDATE users 
        SET 
          first_name = COALESCE($1, first_name),
          last_name = COALESCE($2, last_name),
          updated_at = NOW()
        WHERE id = $3
        RETURNING id, email, first_name, last_name, role, updated_at
      `, [firstName, lastName, userId]);

      // Логируем обновление профиля
      await client.query(`
        INSERT INTO activity_logs (user_id, action, details)
        VALUES ($1, 'update_profile', $2)
      `, [userId, JSON.stringify({ firstName, lastName })]);

      return updateResult.rows[0];
    });

    logger.info('User profile updated:', { userId });

    res.json(result);
  } catch (error) {
    logger.error('Error updating user profile:', error);
    res.status(500).json({ error: 'Failed to update user profile' });
  }
});

// Получить статистику пользователя
router.get('/stats', async (req, res) => {
  try {
    const userId = req.user.id;

    const stats = await query(`
      SELECT 
        COUNT(DISTINCT q.id) as total_queries,
        COUNT(DISTINCT r.id) as total_responses,
        AVG(r.rating) as average_rating,
        COUNT(CASE WHEN q.status = 'completed' THEN 1 END) as completed_queries,
        COUNT(CASE WHEN q.status = 'processing' THEN 1 END) as processing_queries,
        COUNT(CASE WHEN q.status = 'failed' THEN 1 END) as failed_queries,
        COUNT(CASE WHEN q.audio_path IS NOT NULL THEN 1 END) as voice_queries,
        COUNT(CASE WHEN q.files_path IS NOT NULL AND array_length(q.files_path, 1) > 0 THEN 1 END) as file_queries
      FROM users u
      LEFT JOIN queries q ON u.id = q.user_id
      LEFT JOIN responses r ON q.id = r.query_id
      WHERE u.id = $1
    `, [userId]);

    res.json(stats.rows[0]);
  } catch (error) {
    logger.error('Error fetching user stats:', error);
    res.status(500).json({ error: 'Failed to fetch user statistics' });
  }
});

// Получить активность пользователя
router.get('/activity', async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const result = await query(`
      SELECT 
        action,
        details,
        created_at
      FROM activity_logs 
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `, [userId, limit, offset]);

    // Получить общее количество записей
    const countResult = await query(`
      SELECT COUNT(*) as total
      FROM activity_logs 
      WHERE user_id = $1
    `, [userId]);

    res.json({
      activity: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].total),
        pages: Math.ceil(countResult.rows[0].total / limit)
      }
    });
  } catch (error) {
    logger.error('Error fetching user activity:', error);
    res.status(500).json({ error: 'Failed to fetch user activity' });
  }
});

// Получить все пользователи (только для админов)
router.get('/', requireRole(['admin']), async (req, res) => {
  try {
    const { page = 1, limit = 20, role, isActive } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    let params = [];
    let paramIndex = 1;

    if (role) {
      whereClause += ` AND role = $${paramIndex}`;
      params.push(role);
      paramIndex++;
    }

    if (isActive !== undefined) {
      whereClause += ` AND is_active = $${paramIndex}`;
      params.push(isActive === 'true');
      paramIndex++;
    }

    const result = await query(`
      SELECT 
        id,
        email,
        first_name,
        last_name,
        role,
        is_active,
        created_at,
        updated_at
      FROM users 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, [...params, limit, offset]);

    // Получить общее количество пользователей
    const countResult = await query(`
      SELECT COUNT(*) as total
      FROM users 
      ${whereClause}
    `, params);

    res.json({
      users: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].total),
        pages: Math.ceil(countResult.rows[0].total / limit)
      }
    });
  } catch (error) {
    logger.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Обновить пользователя (только для админов)
router.put('/:userId', requireRole(['admin']), [
  body('role').optional().isIn(['user', 'moderator', 'admin']).withMessage('Invalid role'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId } = req.params;
    const { role, isActive } = req.body;

    const result = await transaction(async (client) => {
      const updateResult = await client.query(`
        UPDATE users 
        SET 
          role = COALESCE($1, role),
          is_active = COALESCE($2, is_active),
          updated_at = NOW()
        WHERE id = $3
        RETURNING id, email, first_name, last_name, role, is_active, updated_at
      `, [role, isActive, userId]);

      // Логируем обновление пользователя
      await client.query(`
        INSERT INTO activity_logs (user_id, action, details)
        VALUES ($1, 'update_user', $2)
      `, [req.user.id, JSON.stringify({ targetUserId: userId, role, isActive })]);

      return updateResult.rows[0];
    });

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    logger.info('User updated by admin:', { targetUserId: userId, adminId: req.user.id });

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Удалить пользователя (только для админов)
router.delete('/:userId', requireRole(['admin']), async (req, res) => {
  try {
    const { userId } = req.params;

    // Проверяем, что пользователь не удаляет сам себя
    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const result = await transaction(async (client) => {
      // Логируем удаление пользователя
      await client.query(`
        INSERT INTO activity_logs (user_id, action, details)
        VALUES ($1, 'delete_user', $2)
      `, [req.user.id, JSON.stringify({ targetUserId: userId })]);

      // Удаляем пользователя
      const deleteResult = await client.query(`
        DELETE FROM users WHERE id = $1 RETURNING id
      `, [userId]);

      return deleteResult.rows[0];
    });

    if (!result) {
      return res.status(404).json({ error: 'User not found' });
    }

    logger.info('User deleted by admin:', { targetUserId: userId, adminId: req.user.id });

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    logger.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Получить статистику по всем пользователям (только для админов)
router.get('/stats/overview', requireRole(['admin']), async (req, res) => {
  try {
    const stats = await query(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN is_active = true THEN 1 END) as active_users,
        COUNT(CASE WHEN role = 'admin' THEN 1 END) as admin_users,
        COUNT(CASE WHEN role = 'moderator' THEN 1 END) as moderator_users,
        COUNT(CASE WHEN role = 'user' THEN 1 END) as regular_users,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as new_users_week,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as new_users_month
      FROM users
    `);

    res.json(stats.rows[0]);
  } catch (error) {
    logger.error('Error fetching user overview stats:', error);
    res.status(500).json({ error: 'Failed to fetch user overview statistics' });
  }
});

module.exports = router;

