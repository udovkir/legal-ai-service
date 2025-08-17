import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ChatBubbleLeftRightIcon, 
  MicrophoneIcon, 
  DocumentIcon,
  ArrowRightIcon,
  StarIcon,
  UserGroupIcon,
  ShieldCheckIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import TextInputWithSpeech from '../components/TextInputWithSpeech';
import { useAuth } from '../contexts/AuthContext';

const HomePage: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState<'text' | 'voice' | 'files'>('text');
  const [searchText, setSearchText] = useState('');

  const exampleQueries = [
    { text: 'Как оформить наследство?', tag: 'Наследство' },
    { text: 'Что делать при ДТП?', tag: 'ДТП' },
    { text: 'Увольнение без объяснения причин', tag: 'Трудовые споры' },
    { text: 'Раздел имущества при разводе', tag: 'Семейное право' },
    { text: 'Права потребителя при покупке', tag: 'Гражданское право' },
    { text: 'Штраф за нарушение ПДД', tag: 'Административное право' },
  ];

  const features = [
    {
      icon: ChatBubbleLeftRightIcon,
      title: 'AI-юрист 24/7',
      description: 'Получайте юридические консультации в любое время дня и ночи',
      color: 'text-primary-600',
      bgColor: 'bg-primary-50',
    },
    {
      icon: MicrophoneIcon,
      title: 'Голосовой ввод',
      description: 'Задавайте вопросы голосом - система распознает и обработает',
      color: 'text-success-600',
      bgColor: 'bg-success-50',
    },
    {
      icon: DocumentIcon,
      title: 'Анализ документов',
      description: 'Загружайте документы и получайте их юридический анализ',
      color: 'text-warning-600',
      bgColor: 'bg-warning-50',
    },
    {
      icon: ShieldCheckIcon,
      title: 'Безопасность',
      description: 'Все данные защищены и не передаются третьим лицам',
      color: 'text-error-600',
      bgColor: 'bg-error-50',
    },
  ];

  const stats = [
    { number: '10,000+', label: 'Обработанных запросов' },
    { number: '99.9%', label: 'Точность ответов' },
    { number: '< 30 сек', label: 'Время ответа' },
    { number: '24/7', label: 'Доступность' },
  ];

  const handleSearch = (text: string) => {
    if (isAuthenticated) {
      // Перенаправляем в чат с предзаполненным вопросом
      window.location.href = `/chat?q=${encodeURIComponent(text)}`;
    } else {
      // Показываем форму регистрации
      window.location.href = '/register';
    }
  };

  const handleExampleClick = (query: string) => {
    setSearchText(query);
    handleSearch(query);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header */}
      <header className="relative z-10">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <ChatBubbleLeftRightIcon className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">LegalAI</span>
            </div>
            
            <div className="flex items-center space-x-4">
              {isAuthenticated ? (
                <Link to="/dashboard" className="btn-primary">
                  Личный кабинет
                </Link>
              ) : (
                <>
                  <Link to="/login" className="text-gray-600 hover:text-gray-900">
                    Войти
                  </Link>
                  <Link to="/register" className="btn-primary">
                    Регистрация
                  </Link>
                </>
              )}
            </div>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="text-5xl md:text-6xl font-bold text-gray-900 mb-6"
            >
              <span className="gradient-text">AI-юрист</span> для ваших
              <br />
              юридических вопросов
            </motion.h1>
            
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="text-xl text-gray-600 mb-12 max-w-3xl mx-auto"
            >
              Получайте профессиональные юридические консультации в любое время. 
              Анализируйте документы, задавайте вопросы голосом или текстом.
            </motion.p>

            {/* Поисковая строка */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="max-w-2xl mx-auto mb-8"
            >
              <TextInputWithSpeech
                onSubmit={handleSearch}
                placeholder="Задайте ваш юридический вопрос..."
                className="shadow-strong"
              />
            </motion.div>

            {/* Примеры запросов */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="flex flex-wrap justify-center gap-2 mb-12"
            >
              {exampleQueries.map((query, index) => (
                <button
                  key={index}
                  onClick={() => handleExampleClick(query.text)}
                  className="inline-flex items-center px-4 py-2 bg-white border border-gray-200 rounded-full text-sm text-gray-700 hover:border-primary-300 hover:text-primary-700 transition-colors duration-200"
                >
                  <span className="mr-2">{query.text}</span>
                  <span className="badge-primary">{query.tag}</span>
                </button>
              ))}
            </motion.div>
          </div>
        </div>

        {/* Анимированные элементы фона */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
            animate={{ 
              y: [0, -20, 0],
              rotate: [0, 5, 0]
            }}
            transition={{ 
              duration: 6,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="absolute top-20 left-10 w-20 h-20 bg-primary-200 rounded-full opacity-20"
          />
          <motion.div
            animate={{ 
              y: [0, 20, 0],
              rotate: [0, -5, 0]
            }}
            transition={{ 
              duration: 8,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="absolute top-40 right-20 w-16 h-16 bg-success-200 rounded-full opacity-20"
          />
          <motion.div
            animate={{ 
              y: [0, -15, 0],
              x: [0, 10, 0]
            }}
            transition={{ 
              duration: 7,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="absolute bottom-20 left-1/4 w-12 h-12 bg-warning-200 rounded-full opacity-20"
          />
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Возможности платформы
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Используйте современные технологии для решения юридических вопросов
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="text-center"
              >
                <div className={`w-16 h-16 ${feature.bgColor} rounded-full flex items-center justify-center mx-auto mb-4`}>
                  <feature.icon className={`w-8 h-8 ${feature.color}`} />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="text-center"
              >
                <div className="text-3xl md:text-4xl font-bold text-primary-600 mb-2">
                  {stat.number}
                </div>
                <div className="text-gray-600">
                  {stat.label}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl font-bold text-white mb-4">
              Готовы получить юридическую консультацию?
            </h2>
            <p className="text-xl text-primary-100 mb-8">
              Присоединяйтесь к тысячам пользователей, которые уже используют AI-юриста
            </p>
            <Link
              to={isAuthenticated ? '/chat' : '/register'}
              className="inline-flex items-center px-8 py-3 bg-white text-primary-600 font-semibold rounded-lg hover:bg-gray-50 transition-colors duration-200"
            >
              {isAuthenticated ? 'Начать чат' : 'Зарегистрироваться'}
              <ArrowRightIcon className="w-5 h-5 ml-2" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                  <ChatBubbleLeftRightIcon className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold">LegalAI</span>
              </div>
              <p className="text-gray-400">
                Современная платформа для получения юридических консультаций с использованием искусственного интеллекта.
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold mb-4">Продукт</h3>
              <ul className="space-y-2 text-gray-400">
                <li><Link to="/chat" className="hover:text-white">AI-чат</Link></li>
                <li><Link to="/dashboard" className="hover:text-white">Личный кабинет</Link></li>
                <li><Link to="/profile" className="hover:text-white">Профиль</Link></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold mb-4">Поддержка</h3>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white">Помощь</a></li>
                <li><a href="#" className="hover:text-white">FAQ</a></li>
                <li><a href="#" className="hover:text-white">Контакты</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold mb-4">Правовая информация</h3>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white">Политика конфиденциальности</a></li>
                <li><a href="#" className="hover:text-white">Условия использования</a></li>
                <li><a href="#" className="hover:text-white">Отказ от ответственности</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2024 LegalAI. Все права защищены.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;

