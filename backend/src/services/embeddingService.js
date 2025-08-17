const OpenAI = require('openai');
const logger = require('../utils/logger');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Получение эмбеддинга для текста
const getEmbedding = async (text) => {
  try {
    // Ограничиваем длину текста для API
    const truncatedText = text.length > 8000 ? text.substring(0, 8000) : text;

    const response = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: truncatedText,
      encoding_format: 'float'
    });

    return response.data[0].embedding;
  } catch (error) {
    logger.error('Error getting embedding:', error);
    throw new Error('Failed to get embedding');
  }
};

// Получение эмбеддингов для массива текстов
const getEmbeddings = async (texts) => {
  try {
    const truncatedTexts = texts.map(text => 
      text.length > 8000 ? text.substring(0, 8000) : text
    );

    const response = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: truncatedTexts,
      encoding_format: 'float'
    });

    return response.data.map(item => item.embedding);
  } catch (error) {
    logger.error('Error getting embeddings:', error);
    throw new Error('Failed to get embeddings');
  }
};

// Вычисление косинусного сходства между двумя векторами
const cosineSimilarity = (vectorA, vectorB) => {
  if (vectorA.length !== vectorB.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vectorA.length; i++) {
    dotProduct += vectorA[i] * vectorB[i];
    normA += vectorA[i] * vectorA[i];
    normB += vectorB[i] * vectorB[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
};

// Поиск наиболее похожих документов
const findSimilarDocuments = async (queryEmbedding, documentEmbeddings, threshold = 0.8) => {
  try {
    const similarities = documentEmbeddings.map((docEmbedding, index) => ({
      index,
      similarity: cosineSimilarity(queryEmbedding, docEmbedding)
    }));

    // Фильтруем по порогу сходства и сортируем
    const filtered = similarities
      .filter(item => item.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity);

    return filtered;
  } catch (error) {
    logger.error('Error finding similar documents:', error);
    throw new Error('Failed to find similar documents');
  }
};

// Кластеризация документов по сходству
const clusterDocuments = async (embeddings, similarityThreshold = 0.85) => {
  try {
    const clusters = [];
    const used = new Set();

    for (let i = 0; i < embeddings.length; i++) {
      if (used.has(i)) continue;

      const cluster = [i];
      used.add(i);

      for (let j = i + 1; j < embeddings.length; j++) {
        if (used.has(j)) continue;

        const similarity = cosineSimilarity(embeddings[i], embeddings[j]);
        if (similarity >= similarityThreshold) {
          cluster.push(j);
          used.add(j);
        }
      }

      if (cluster.length > 1) {
        clusters.push(cluster);
      }
    }

    return clusters;
  } catch (error) {
    logger.error('Error clustering documents:', error);
    throw new Error('Failed to cluster documents');
  }
};

// Нормализация вектора
const normalizeVector = (vector) => {
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  if (magnitude === 0) return vector;
  return vector.map(val => val / magnitude);
};

// Создание центроида кластера
const createClusterCentroid = (embeddings) => {
  if (embeddings.length === 0) return null;

  const dimension = embeddings[0].length;
  const centroid = new Array(dimension).fill(0);

  for (const embedding of embeddings) {
    for (let i = 0; i < dimension; i++) {
      centroid[i] += embedding[i];
    }
  }

  for (let i = 0; i < dimension; i++) {
    centroid[i] /= embeddings.length;
  }

  return normalizeVector(centroid);
};

module.exports = {
  getEmbedding,
  getEmbeddings,
  cosineSimilarity,
  findSimilarDocuments,
  clusterDocuments,
  normalizeVector,
  createClusterCentroid
};

