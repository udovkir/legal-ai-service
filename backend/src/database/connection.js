const { Pool } = require('pg');
const logger = require('../utils/logger');

// Создание пула соединений с PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20, // максимальное количество соединений в пуле
  idleTimeoutMillis: 30000, // время жизни неактивного соединения
  connectionTimeoutMillis: 2000, // время ожидания соединения
});

// Обработка ошибок подключения
pool.on('error', (err) => {
  logger.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Проверка подключения
const testConnection = async () => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    logger.info('Database connected successfully');
    return true;
  } catch (err) {
    logger.error('Database connection failed:', err);
    return false;
  }
};

// Функция для выполнения запросов
const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (err) {
    logger.error('Query error:', { text, params, error: err.message });
    throw err;
  }
};

// Функция для получения одного клиента (для транзакций)
const getClient = async () => {
  const client = await pool.connect();
  const query = client.query.bind(client);
  const release = client.release.bind(client);
  
  // Перехватываем ошибки для автоматического освобождения клиента
  client.release = () => {
    logger.error('A client has been checked out for too long. Make sure to call release() on the client.');
    release();
  };
  
  return client;
};

// Функция для выполнения транзакций
const transaction = async (callback) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

module.exports = {
  pool,
  query,
  getClient,
  transaction,
  testConnection
};

