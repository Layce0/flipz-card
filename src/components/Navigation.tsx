import { memo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Home, BookOpen, Package, Shield, LogIn, Store, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useNewCardIndicator } from '@/hooks/useNewCardIndicator';

export const Navigation = memo(() => {
  const location = useLocation();
  const { user, isAdmin } = useAuth();
  const { t } = useTranslation();
  const { hasNewCards } = useNewCardIndicator();

  const navItems = [
    { path: '/', icon: Home, labelKey: 'nav.home', show: true, badge: false },
    { path: '/collection', icon: BookOpen, labelKey: 'nav.collection', show: true, badge: hasNewCards },
    { path: '/packs', icon: Package, labelKey: 'nav.packs', show: true, badge: false },
    { path: '/shop', icon: Store, labelKey: 'nav.shop', show: !!user, badge: false },
    { path: '/admin', icon: Shield, labelKey: 'nav.admin', show: isAdmin, badge: false },
    { path: '/profile', icon: User, labelKey: 'nav.profile', show: !!user, badge: false },
    { path: '/auth', icon: LogIn, labelKey: 'nav.login', show: !user, badge: false },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/90 backdrop-blur-lg border-t border-border safe-area-bottom">
      <div className="flex items-center justify-around py-2 px-4 max-w-lg mx-auto">
        {navItems.filter(item => item.show).map(({ path, icon: Icon, labelKey, badge }) => {
          const isActive = location.pathname === path;
          return (
            <Link
              key={path}
              to={path}
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
