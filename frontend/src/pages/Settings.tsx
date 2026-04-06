import { ArrowLeft, Moon, Sun, Globe } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../store/SettingsContext';

const Settings = () => {
  const navigate = useNavigate();
  const { language, theme, setLanguage, setTheme, t } = useSettings();

  return (
    <div className="flex flex-col h-full bg-bg-primary animate-slide-up">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-12 pb-6 border-b border-bg-glass-border">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-black">{t('settings.title')}</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">

        {/* Language */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Globe size={16} className="text-accent-cyan" />
            <span className="text-xs font-black uppercase tracking-widest text-muted">{t('settings.language')}</span>
          </div>
          <div className="flex rounded-2xl overflow-hidden border border-bg-glass-border">
            <button
              onClick={() => setLanguage('en')}
              className={`flex-1 py-3.5 text-sm font-bold transition-colors ${
                language === 'en'
                  ? 'bg-accent-cyan text-black'
                  : 'bg-bg-secondary text-secondary hover:text-white'
              }`}
            >
              🇺🇸 {t('settings.english')}
            </button>
            <button
              onClick={() => setLanguage('es')}
              className={`flex-1 py-3.5 text-sm font-bold transition-colors border-l border-bg-glass-border ${
                language === 'es'
                  ? 'bg-accent-cyan text-black'
                  : 'bg-bg-secondary text-secondary hover:text-white'
              }`}
            >
              🇪🇸 {t('settings.spanish')}
            </button>
          </div>
        </div>

        {/* Theme */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            {theme === 'dark' ? <Moon size={16} className="text-accent-purple" /> : <Sun size={16} className="text-yellow-400" />}
            <span className="text-xs font-black uppercase tracking-widest text-muted">{t('settings.theme')}</span>
          </div>
          <div className="flex rounded-2xl overflow-hidden border border-bg-glass-border">
            <button
              onClick={() => setTheme('dark')}
              className={`flex-1 py-3.5 text-sm font-bold transition-colors flex items-center justify-center gap-2 ${
                theme === 'dark'
                  ? 'bg-accent-purple text-white'
                  : 'bg-bg-secondary text-secondary hover:text-white'
              }`}
            >
              <Moon size={15} /> {t('settings.dark')}
            </button>
            <button
              onClick={() => setTheme('light')}
              className={`flex-1 py-3.5 text-sm font-bold transition-colors border-l border-bg-glass-border flex items-center justify-center gap-2 ${
                theme === 'light'
                  ? 'bg-yellow-400 text-black'
                  : 'bg-bg-secondary text-secondary hover:text-white'
              }`}
            >
              <Sun size={15} /> {t('settings.light')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
