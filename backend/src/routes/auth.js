const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { query, transaction } = require('../database/connection');
const logger = require('../utils/logger');

const router = express.Router();

// Регистрация пользователя
router.post('/register', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
  body('firstName').trim().isLength({ min: 2 }).withMessage('First name is required'),
  body('lastName').trim().isLength({ min: 2 }).withMessage('Last name is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, firstName, lastName } = req.body;

    // Проверяем, существует ли пользователь
    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    // Хешируем пароль
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Создаем пользователя
    const result = await transaction(async (client) => {
      const userInsert = await client.query(`
        INSERT INTO users (email, password_hash, first_name, last_name)
        VALUES ($1, $2, $3, $4)
        RETURNING id, email, first_name, last_name, role, created_at
      `, [email, passwordHash, firstName, lastName]);

      const user = userInsert.rows[0];

      // Логируем регистрацию
      await client.query(`
        INSERT INTO activity_logs (user_id, action, details)
        VALUES ($1, 'register', $2)
      `, [user.id, JSON.stringify({ email, firstName, lastName })]);

      return user;
    });

    // Создаем JWT токен
    const token = jwt.sign(
      { userId: result.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    logger.info('User registered successfully:', { email: result.email });

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: result.id,
        email: result.email,
        firstName: result.first_name,
        lastName: result.last_name,
        role: result.role
      },
      token
    });
  } catch (error) {
    logger.error('Error registering user:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

// Вход пользователя
router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Находим пользователя
    const result = await query(`
      SELECT id, email, password_hash, first_name, last_name, role, is_active
      FROM users WHERE email = $1
    `, [email]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];

    // Проверяем активность аккаунта
    if (!user.is_active) {
      return res.status(401).json({ error: 'Account is deactivated' });
    }

    // Проверяем пароль
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Создаем JWT токен
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Логируем вход
    await query(`
      INSERT INTO activity_logs (user_id, action, details)
      VALUES ($1, 'login', $2)
    `, [user.id, JSON.stringify({ email, ip: req.ip })]);

    logger.info('User logged in successfully:', { email: user.email });

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role
      },
      token
    });
  } catch (error) {
    logger.error('Error logging in user:', error);
    res.status(500).json({ error: 'Failed to log in' });
  }
});

// Обновление токена
router.post('/refresh', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Проверяем, что пользователь существует и активен
    const result = await query(`
      SELECT id, email, first_name, last_name, role, is_active
      FROM users WHERE id = $1
    `, [decoded.userId]);

    if (result.rows.length === 0 || !result.rows[0].is_active) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const user = result.rows[0];

    // Создаем новый токен
    const newToken = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      message: 'Token refreshed successfully',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role
      },
      token: newToken
    });
  } catch (error) {
    logger.error('Error refreshing token:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

// Выход пользователя
router.post('/logout', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Логируем выход
        await query(`
          INSERT INTO activity_logs (user_id, action, details)
          VALUES ($1, 'logout', $2)
        `, [decoded.userId, JSON.stringify({ ip: req.ip })]);
      } catch (error) {
        // Игнорируем ошибки верификации токена при выходе
      }
    }

    res.json({ message: 'Logout successful' });
  } catch (error) {
    logger.error('Error during logout:', error);
    res.status(500).json({ error: 'Failed to logout' });
  }
});

// Изменение пароля
router.post('/change-password', [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters long')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    // Получаем текущий пароль
    const result = await query(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    // Проверяем текущий пароль
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    // Хешируем новый пароль
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // Обновляем пароль
    await transaction(async (client) => {
      await client.query(`
        UPDATE users SET password_hash = $1 WHERE id = $2
      `, [newPasswordHash, userId]);

      // Логируем изменение пароля
      await client.query(`
        INSERT INTO activity_logs (user_id, action, details)
        VALUES ($1, 'change_password', $2)
      `, [userId, JSON.stringify({ ip: req.ip })]);
    });

    logger.info('Password changed successfully:', { userId });

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    logger.error('Error changing password:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Запрос на сброс пароля
router.post('/forgot-password', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email } = req.body;

    // Проверяем, существует ли пользователь
    const result = await query(
      'SELECT id, email FROM users WHERE email = $1 AND is_active = true',
      [email]
    );

    if (result.rows.length > 0) {
      const user = result.rows[0];
      
      // Генерируем токен для сброса пароля
      const resetToken = jwt.sign(
        { userId: user.id, type: 'password_reset' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      // Здесь можно отправить email с токеном
      // Для простоты просто логируем
      logger.info('Password reset requested:', { email, resetToken });

      // Логируем запрос на сброс пароля
      await query(`
        INSERT INTO activity_logs (user_id, action, details)
        VALUES ($1, 'forgot_password', $2)
      `, [user.id, JSON.stringify({ email, ip: req.ip })]);
    }

    // Всегда возвращаем успех для безопасности
    res.json({ message: 'If the email exists, a password reset link has been sent' });
  } catch (error) {
    logger.error('Error processing forgot password:', error);
    res.status(500).json({ error: 'Failed to process password reset request' });
  }
});

// Сброс пароля
router.post('/reset-password', [
  body('token').notEmpty().withMessage('Reset token is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters long')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { token, newPassword } = req.body;

    // Верифицируем токен
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.type !== 'password_reset') {
      return res.status(400).json({ error: 'Invalid reset token' });
    }

    // Хешируем новый пароль
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // Обновляем пароль
    await transaction(async (client) => {
      await client.query(`
        UPDATE users SET password_hash = $1 WHERE id = $2
      `, [newPasswordHash, decoded.userId]);

      // Логируем сброс пароля
      await client.query(`
        INSERT INTO activity_logs (user_id, action, details)
        VALUES ($1, 'reset_password', $2)
      `, [decoded.userId, JSON.stringify({ ip: req.ip })]);
    });

    logger.info('Password reset successfully:', { userId: decoded.userId });

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    logger.error('Error resetting password:', error);
    
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }
    
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

module.exports = router;

