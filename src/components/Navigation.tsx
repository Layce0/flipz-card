import { memo, useMemo, useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Home, BookOpen, Package, Shield, LogIn, ShoppingBag, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useNewCardIndicator } from '@/hooks/useNewCardIndicator';
import { useSfx } from '@/hooks/useSfx';

export const Navigation = memo(() => {
  const location = useLocation();
  const { user, isAdmin } = useAuth();
  const { t } = useTranslation();
  const { hasNewCards } = useNewCardIndicator();
  const { play } = useSfx();

  const [hideAdmin, setHideAdmin] = useState(() => localStorage.getItem('flipz_hide_admin') === 'true');

  useEffect(() => {
    const handler = () => setHideAdmin(localStorage.getItem('flipz_hide_admin') === 'true');
    window.addEventListener('flipz:admin-visibility-changed', handler);
    return () => window.removeEventListener('flipz:admin-visibility-changed', handler);
  }, []);

  const navItems = useMemo(() => [
    { path: '/', icon: Home, labelKey: 'nav.home', show: true, badge: false, tour: 'nav-home' },
    { path: '/collection', icon: BookOpen, labelKey: 'nav.collection', show: true, badge: hasNewCards, tour: 'nav-collection' },
    { path: '/packs', icon: Package, labelKey: 'nav.packs', show: true, badge: false, tour: 'nav-packs' },
    { path: '/shop', icon: ShoppingBag, labelKey: 'nav.shop', show: !!user, badge: false, tour: 'nav-shop' },
    { path: '/admin', icon: Shield, labelKey: 'nav.admin', show: isAdmin && !hideAdmin, badge: false, tour: '' },
    { path: '/profile', icon: User, labelKey: 'nav.profile', show: !!user, badge: false, tour: 'nav-profile' },
    { path: '/auth', icon: LogIn, labelKey: 'nav.login', show: !user, badge: false, tour: 'nav-login' },
  ], [user, isAdmin, hideAdmin, hasNewCards]);

  const visibleItems = useMemo(() => navItems.filter(item => item.show), [navItems]);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/90 backdrop-blur-lg border-t border-border safe-area-bottom">
      <div className="flex items-center justify-around py-2 px-4 max-w-lg mx-auto">
        {visibleItems.map(({ path, icon: Icon, labelKey, badge, tour }) => {
          const isActive = location.pathname === path;
          return (
            <Link
              key={path}
              to={path}
              onClick={() => {
                if (!isActive) play('navClick');
              }}
              data-tour={tour || undefined}
              className={cn(
                "relative flex flex-col items-center gap-1 py-2 px-4 rounded-xl transition-all duration-300",
                isActive 
                  ? "text-primary bg-primary/10" 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <Icon className={cn("w-5 h-5", isActive && "drop-shadow-[0_0_8px_hsl(45_90%_55%)]")} />
              <span className="text-xs font-medium">{t(labelKey)}</span>
              {badge && (
                <span className="absolute top-1 right-2 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center animate-pulse">
                  !
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
});

Navigation.displayName = 'Navigation';
