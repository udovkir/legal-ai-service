const OpenAI = require('openai');
const { query } = require('../database/connection');
const logger = require('../utils/logger');
const { getEmbedding } = require('./embeddingService');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Промт для юридических запросов
const LEGAL_PROMPT = `Ты профессиональный юрист РФ с многолетним опытом работы. 
Твоя задача - анализировать документы пользователя и отвечать на его юридические вопросы.

ПРАВИЛА ОТВЕТА:
1. Всегда ссылайся на конкретные статьи законов РФ
2. Приводи примеры из судебной практики
3. Давай практические рекомендации
4. В конце обязательно добавь: "ВАЖНО: Это не юридическая консультация. Для получения квалифицированной помощи обратитесь к юристу."

СТРУКТУРА ОТВЕТА:
{
  "text": "Основной ответ на вопрос",
  "laws": [
    {
      "article": "Статья 123 ГК РФ",
      "description": "Описание статьи"
    }
  ],
  "practice": [
    {
      "case": "Постановление Пленума ВС РФ №123",
      "description": "Описание практики"
    }
  ],
  "recommendations": [
    "Практическая рекомендация 1",
    "Практическая рекомендация 2"
  ],
  "confidence": 0.95
}

Вопрос пользователя: {question}

Документы пользователя: {documents}`;

// Обработка запроса через AI
const processQuery = async (queryId, text, audioPath = null, filePaths = null, userId) => {
  try {
    logger.info('Processing AI query:', { queryId, textLength: text.length });

    // Поиск похожих запросов для контекста
    const similarQueries = await findSimilarQueries(text);
    
    // Формируем контекст из похожих запросов
    let context = '';
    if (similarQueries.length > 0) {
      context = '\n\nПохожие случаи:\n' + similarQueries.map(q => q.text).join('\n');
    }

    // Формируем промт
    const prompt = LEGAL_PROMPT
      .replace('{question}', text)
      .replace('{documents}', filePaths ? `Загружены документы: ${filePaths.join(', ')}` : 'Документы не загружены')
      + context;

    // Вызываем OpenAI API
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'Ты профессиональный юрист РФ. Отвечай только на русском языке в формате JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 2000,
      response_format: { type: "json_object" }
    });

    const responseText = completion.choices[0].message.content;
    let aiResponse;

    try {
      aiResponse = JSON.parse(responseText);
    } catch (parseError) {
      logger.error('Failed to parse AI response:', parseError);
      // Fallback response
      aiResponse = {
        text: responseText,
        laws: [],
        practice: [],
        recommendations: [],
        confidence: 0.7
      };
    }

    // Получаем эмбеддинг для семантического поиска
    const embedding = await getEmbedding(text + ' ' + aiResponse.text);

    // Сохраняем эмбеддинг в базу данных
    await query(`
      UPDATE responses 
      SET embedding = $1 
      WHERE query_id = $2
    `, [embedding, queryId]);

    // Автоматически определяем теги
    await autoTagQuery(queryId, text, aiResponse);

    // Отправляем webhook в n8n для автоматизации
    await sendN8nWebhook('new-response', {
      queryId,
      userId,
      response: aiResponse,
      hasFiles: !!filePaths,
      hasAudio: !!audioPath
    });

    logger.info('AI query processed successfully:', { queryId });
    return aiResponse;

  } catch (error) {
    logger.error('Error processing AI query:', error);
    throw new Error('Failed to process query with AI');
  }
};

// Поиск похожих запросов
const findSimilarQueries = async (text, threshold = 0.8) => {
  try {
    const embedding = await getEmbedding(text);
    
    const result = await query(`
      SELECT 
        q.text,
        1 - (r.embedding <=> $1) as similarity
      FROM responses r
      JOIN queries q ON r.query_id = q.id
      WHERE 1 - (r.embedding <=> $1) > $2
      ORDER BY r.embedding <=> $1
      LIMIT 5
    `, [embedding, threshold]);

    return result.rows;
  } catch (error) {
    logger.error('Error finding similar queries:', error);
    return [];
  }
};

// Автоматическое определение тегов
const autoTagQuery = async (queryId, text, aiResponse) => {
  try {
    const tagKeywords = {
      'Наследство': ['наследство', 'наследник', 'завещание', 'наследование'],
      'ДТП': ['дтп', 'авария', 'страховка', 'осаго', 'каско'],
      'Трудовые споры': ['трудовой', 'увольнение', 'отпуск', 'зарплата', 'работодатель'],
      'Недвижимость': ['недвижимость', 'квартира', 'дом', 'земля', 'регистрация'],
      'Семейное право': ['брак', 'развод', 'алименты', 'дети', 'семья'],
      'Уголовное право': ['уголовный', 'преступление', 'наказание', 'суд'],
      'Гражданское право': ['договор', 'обязательство', 'иск', 'сделка'],
      'Административное право': ['административный', 'штраф', 'госорган', 'жалоба']
    };

    const textLower = (text + ' ' + aiResponse.text).toLowerCase();
    const matchedTags = [];

    for (const [tagName, keywords] of Object.entries(tagKeywords)) {
      if (keywords.some(keyword => textLower.includes(keyword))) {
        matchedTags.push(tagName);
      }
    }

    // Добавляем теги к запросу
    for (const tagName of matchedTags) {
      await query(`
        INSERT INTO query_tags (query_id, tag_id)
        SELECT $1, id FROM tags WHERE name = $2
        ON CONFLICT DO NOTHING
      `, [queryId, tagName]);
    }

    logger.info('Auto-tagged query:', { queryId, tags: matchedTags });
  } catch (error) {
    logger.error('Error auto-tagging query:', error);
  }
};

// Генерация SEO статьи
const generateSEOArticle = async (queryId, aiResponse) => {
  try {
    const seoPrompt = `Создай SEO-оптимизированную статью на основе юридического ответа. 
    
    Структура:
    1. Заголовок H1 (включай ключевые слова)
    2. Введение (2-3 предложения)
    3. Основные разделы с подзаголовками H2, H3
    4. Заключение
    5. FAQ (вопросы-ответы)
    
    Используй HTML разметку. Длина статьи: 1500-2000 слов.
    
    Ответ юриста: ${JSON.stringify(aiResponse)}`;

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'Ты SEO-копирайтер. Создавай качественные статьи для юридического сайта.'
        },
        {
          role: 'user',
          content: seoPrompt
        }
      ],
      temperature: 0.7,
      max_tokens: 3000
    });

    const seoArticle = completion.choices[0].message.content;

    // Сохраняем SEO статью
    await query(`
      UPDATE responses 
      SET seo_article = $1 
      WHERE query_id = $2
    `, [seoArticle, queryId]);

    logger.info('SEO article generated:', { queryId });
    return seoArticle;

  } catch (error) {
    logger.error('Error generating SEO article:', error);
    throw error;
  }
};

// Отправка webhook в n8n
const sendN8nWebhook = async (event, data) => {
  try {
    const webhookUrl = process.env.N8N_WEBHOOK_URL;
    if (!webhookUrl) {
      logger.warn('N8N webhook URL not configured');
      return;
    }

    const response = await fetch(`${webhookUrl}/${event}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        event,
        data
      })
    });

    if (!response.ok) {
      throw new Error(`N8N webhook failed: ${response.status}`);
    }

    logger.info('N8N webhook sent successfully:', { event });
  } catch (error) {
    logger.error('Error sending N8N webhook:', error);
  }
};

// Исправление текста через Яндекс.Спеллер
const correctText = async (text) => {
  try {
    const yandexApiKey = process.env.YANDEX_SPELLER_API_KEY;
    if (!yandexApiKey) {
      return text; // Возвращаем исходный текст если API ключ не настроен
    }

    const response = await fetch('https://speller.yandex.net/services/spellservice.json/checkText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `text=${encodeURIComponent(text)}&lang=ru&options=512`
    });

    if (!response.ok) {
      throw new Error(`Yandex Speller API failed: ${response.status}`);
    }

    const corrections = await response.json();
    let correctedText = text;

    // Применяем исправления в обратном порядке
    for (let i = corrections.length - 1; i >= 0; i--) {
      const correction = corrections[i];
      const word = correction.word;
      const suggestion = correction.s[0]; // Берем первое предложение

      correctedText = correctedText.replace(new RegExp(word, 'g'), suggestion);
    }

    return correctedText;
  } catch (error) {
    logger.error('Error correcting text:', error);
    return text; // Возвращаем исходный текст при ошибке
  }
};

module.exports = {
  processQuery,
  findSimilarQueries,
  generateSEOArticle,
  correctText
};

