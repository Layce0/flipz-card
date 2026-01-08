import { Link, useLocation } from 'react-router-dom';
import { Home, BookOpen, Shield, LogIn, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

export const Navigation = () => {
  const location = useLocation();
  const { user, isAdmin, signOut } = useAuth();

  const navItems = [
    { path: '/', icon: Home, label: 'Accueil', show: true },
    { path: '/collection', icon: BookOpen, label: 'Collection', show: true },
    { path: '/admin', icon: Shield, label: 'Admin', show: isAdmin },
    { path: '/auth', icon: LogIn, label: 'Connexion', show: !user },
  ];

  const handleLogout = async () => {
    await signOut();
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/90 backdrop-blur-lg border-t border-border safe-area-bottom">
      <div className="flex items-center justify-around py-2 px-4 max-w-lg mx-auto">
        {navItems.filter(item => item.show).map(({ path, icon: Icon, label }) => {
          const isActive = location.pathname === path;
          return (
            <Link
              key={path}
              to={path}
              className={cn(
                "flex flex-col items-center gap-1 py-2 px-4 rounded-xl transition-all duration-300",
                isActive 
                  ? "text-primary bg-primary/10" 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <Icon className={cn("w-5 h-5", isActive && "drop-shadow-[0_0_8px_hsl(45_90%_55%)]")} />
              <span className="text-xs font-medium">{label}</span>
            </Link>
          );
        })}
        
        {user && (
          <button
            onClick={handleLogout}
            className="flex flex-col items-center gap-1 py-2 px-4 rounded-xl transition-all duration-300 text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <LogOut className="w-5 h-5" />
            <span className="text-xs font-medium">Déconnexion</span>
          </button>
        )}
      </div>
    </nav>
  );
};
