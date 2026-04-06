import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'en' | 'es';
type Theme = 'dark' | 'light';

interface SettingsContextType {
  language: Language;
  theme: Theme;
  setLanguage: (l: Language) => void;
  setTheme: (t: Theme) => void;
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    // Nav
    'nav.home':      'HOME',
    'nav.feed':      'FEED',
    'nav.gear':      'GEAR',
    'nav.profile':   'PROFILE',

    // Home
    'home.greeting':      'Ready for the show?',
    'home.subtitle':      'Find or share gear in your area',
    'home.search':        'Search gear nearby...',
    'home.nearby':        'Nearby Gear',
    'home.requests':      'Open Requests',
    'home.noGear':        'No gear nearby yet.',
    'home.noRequests':    'No open requests nearby.',
    'home.addGear':       'Add yours',
    'home.createRequest': 'Create one',
    'home.seeAll':        'See all',

    // Feed
    'feed.title':       'Requests Feed',
    'feed.empty':       'No open requests nearby.',
    'feed.emptyHint':   'Be the first to post one!',
    'feed.create':      'Create Request',
    'feed.nearby':      'Nearby',
    'feed.all':         'All',

    // RequestDetail
    'request.respondNow':     'Respond Now',
    'request.cancelRequest':  'Cancel My Request',
    'request.cancelConfirm':  'Cancel Request?',
    'request.cancelBody':     'Your request will be removed from the feed.',
    'request.cancelYes':      'Yes, Cancel Request',
    'request.keepIt':         'Keep It',
    'request.cancelling':     'Cancelling...',
    'request.matchFound':     'Match Found',
    'request.gearSecured':    'Gear Secured',
    'request.viewDeal':       'VIEW DEAL',
    'request.location':       'Location',
    'request.crisisZone':     'Crisis Zone',
    'request.requestedBy':    'Requested by',
    'request.qty':            'Qty',
    'request.selectGear':     'Select Gear to Offer',
    'request.yourGear':       'Your Gear',
    'request.noGear':         'No gear available',
    'request.terms':          'Set Terms',
    'request.price':          'Price',
    'request.duration':       'Duration',
    'request.confirmOffer':   'Confirm Offer',
    'request.back':           'Back',

    // Transaction
    'tx.active':        'Active',
    'tx.pending':       'Pending',
    'tx.completed':     'Completed',
    'tx.cancelled':     'Cancelled',
    'tx.deliveryPin':   'Delivery PIN',
    'tx.returnPin':     'Return PIN',
    'tx.confirmDelivery': 'Confirm Delivery',
    'tx.confirmReturn': 'Confirm Return',
    'tx.enterPin':      'Enter PIN',
    'tx.photos':        'Add Photos',
    'tx.submit':        'Submit',

    // Gear / Inventory
    'gear.title':       'My Inventory',
    'gear.add':         'Add Gear',
    'gear.empty':       'No items yet.',
    'gear.emptyHint':   'Add your first piece of gear to start lending.',
    'gear.available':   'Available',
    'gear.lent':        'Lent Out',
    'gear.delete':      'Delete',
    'gear.edit':        'Edit',

    // Profile
    'profile.rating':   'Rating',
    'profile.reviews':  'Reviews',
    'profile.items':    'Items',
    'profile.noReviews': 'No reviews yet.',
    'profile.noReviewsHint': 'Complete transactions to collect reviews.',
    'profile.editProfile': 'Edit Profile',
    'profile.settings': 'Settings',
    'profile.signOut':  'Sign Out',
    'profile.editName': 'Display Name',
    'profile.editBio':  'Bio',
    'profile.editPhone': 'Phone (optional)',
    'profile.save':     'Save Changes',
    'profile.saving':   'Saving...',
    'profile.photo':    'Profile Photo',
    'profile.changePhoto': 'Change photo',
    'profile.uploadPhoto': 'Upload photo',

    // Settings
    'settings.title':   'Settings',
    'settings.language': 'Language',
    'settings.theme':   'Appearance',
    'settings.dark':    'Dark',
    'settings.light':   'Light',
    'settings.english': 'English',
    'settings.spanish': 'Spanish',

    // Auth
    'auth.login':       'Log In',
    'auth.signup':      'Sign Up',
    'auth.email':       'Email',
    'auth.password':    'Password',
    'auth.name':        'Full Name',
    'auth.continue':    'Continue',
    'auth.haveAccount': 'Already have an account?',
    'auth.noAccount':   "Don't have an account?",

    // Common
    'common.loading':   'Loading...',
    'common.error':     'Something went wrong.',
    'common.back':      'Back',
    'common.cancel':    'Cancel',
    'common.confirm':   'Confirm',
    'common.save':      'Save',
    'common.close':     'Close',
    'common.anonymous': 'Anonymous',
  },
  es: {
    // Nav
    'nav.home':      'INICIO',
    'nav.feed':      'FEED',
    'nav.gear':      'EQUIPO',
    'nav.profile':   'PERFIL',

    // Home
    'home.greeting':      '¿Listo para el show?',
    'home.subtitle':      'Encuentra o comparte equipo cerca de ti',
    'home.search':        'Buscar equipo cercano...',
    'home.nearby':        'Equipo Cercano',
    'home.requests':      'Pedidos Abiertos',
    'home.noGear':        'Aún no hay equipo cercano.',
    'home.noRequests':    'No hay pedidos abiertos cerca.',
    'home.addGear':       'Agrega el tuyo',
    'home.createRequest': 'Crear uno',
    'home.seeAll':        'Ver todo',

    // Feed
    'feed.title':       'Feed de Pedidos',
    'feed.empty':       'No hay pedidos abiertos cerca.',
    'feed.emptyHint':   '¡Sé el primero en publicar uno!',
    'feed.create':      'Crear Pedido',
    'feed.nearby':      'Cercanos',
    'feed.all':         'Todos',

    // RequestDetail
    'request.respondNow':     'Responder Ahora',
    'request.cancelRequest':  'Cancelar Mi Pedido',
    'request.cancelConfirm':  '¿Cancelar Pedido?',
    'request.cancelBody':     'Tu pedido será eliminado del feed.',
    'request.cancelYes':      'Sí, Cancelar Pedido',
    'request.keepIt':         'Conservar',
    'request.cancelling':     'Cancelando...',
    'request.matchFound':     'Coincidencia Encontrada',
    'request.gearSecured':    'Equipo Asegurado',
    'request.viewDeal':       'VER TRATO',
    'request.location':       'Ubicación',
    'request.crisisZone':     'Zona de Crisis',
    'request.requestedBy':    'Pedido por',
    'request.qty':            'Cant.',
    'request.selectGear':     'Seleccionar Equipo a Ofrecer',
    'request.yourGear':       'Mi Equipo',
    'request.noGear':         'Sin equipo disponible',
    'request.terms':          'Definir Términos',
    'request.price':          'Precio',
    'request.duration':       'Duración',
    'request.confirmOffer':   'Confirmar Oferta',
    'request.back':           'Atrás',

    // Transaction
    'tx.active':        'Activo',
    'tx.pending':       'Pendiente',
    'tx.completed':     'Completado',
    'tx.cancelled':     'Cancelado',
    'tx.deliveryPin':   'PIN de Entrega',
    'tx.returnPin':     'PIN de Devolución',
    'tx.confirmDelivery': 'Confirmar Entrega',
    'tx.confirmReturn': 'Confirmar Devolución',
    'tx.enterPin':      'Ingresar PIN',
    'tx.photos':        'Agregar Fotos',
    'tx.submit':        'Enviar',

    // Gear / Inventory
    'gear.title':       'Mi Inventario',
    'gear.add':         'Agregar Equipo',
    'gear.empty':       'Sin artículos aún.',
    'gear.emptyHint':   'Agrega tu primer equipo para empezar a prestar.',
    'gear.available':   'Disponible',
    'gear.lent':        'Prestado',
    'gear.delete':      'Eliminar',
    'gear.edit':        'Editar',

    // Profile
    'profile.rating':   'Calificación',
    'profile.reviews':  'Reseñas',
    'profile.items':    'Artículos',
    'profile.noReviews': 'Sin reseñas aún.',
    'profile.noReviewsHint': 'Completa transacciones para acumular reseñas.',
    'profile.editProfile': 'Editar Perfil',
    'profile.settings': 'Configuración',
    'profile.signOut':  'Cerrar Sesión',
    'profile.editName': 'Nombre de usuario',
    'profile.editBio':  'Biografía',
    'profile.editPhone': 'Teléfono (opcional)',
    'profile.save':     'Guardar Cambios',
    'profile.saving':   'Guardando...',
    'profile.photo':    'Foto de Perfil',
    'profile.changePhoto': 'Cambiar foto',
    'profile.uploadPhoto': 'Subir foto',

    // Settings
    'settings.title':   'Configuración',
    'settings.language': 'Idioma',
    'settings.theme':   'Apariencia',
    'settings.dark':    'Oscuro',
    'settings.light':   'Claro',
    'settings.english': 'Inglés',
    'settings.spanish': 'Español',

    // Auth
    'auth.login':       'Iniciar Sesión',
    'auth.signup':      'Registrarse',
    'auth.email':       'Correo',
    'auth.password':    'Contraseña',
    'auth.name':        'Nombre Completo',
    'auth.continue':    'Continuar',
    'auth.haveAccount': '¿Ya tienes cuenta?',
    'auth.noAccount':   '¿No tienes cuenta?',

    // Common
    'common.loading':   'Cargando...',
    'common.error':     'Algo salió mal.',
    'common.back':      'Atrás',
    'common.cancel':    'Cancelar',
    'common.confirm':   'Confirmar',
    'common.save':      'Guardar',
    'common.close':     'Cerrar',
    'common.anonymous': 'Anónimo',
  },
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(
    () => (localStorage.getItem('app_language') as Language) ?? 'en'
  );
  const [theme, setThemeState] = useState<Theme>(
    () => (localStorage.getItem('app_theme') as Theme) ?? 'dark'
  );

  const setLanguage = (l: Language) => {
    localStorage.setItem('app_language', l);
    setLanguageState(l);
  };

  const setTheme = (t: Theme) => {
    localStorage.setItem('app_theme', t);
    setThemeState(t);
  };

  // Apply theme to root element
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('light-mode');
    } else {
      root.classList.remove('light-mode');
    }
  }, [theme]);

  const t = (key: string): string => {
    return translations[language][key] ?? translations['en'][key] ?? key;
  };

  return (
    <SettingsContext.Provider value={{ language, theme, setLanguage, setTheme, t }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
};
