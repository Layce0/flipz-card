import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { GlobalGifsManager } from '@/components/admin/GlobalGifsManager';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Layers, Loader2 } from 'lucide-react';

const CanvasStudio = () => {
  const { user, isAdmin, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && (!user || !isAdmin)) {
      navigate('/');
    }
  }, [user, isAdmin, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="shrink-0 h-14 border-b border-border bg-card/80 backdrop-blur flex items-center gap-3 px-4 z-50">
        <Button variant="ghost" size="icon" asChild className="shrink-0">
          <Link to="/admin">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-primary" />
          <h1 className="font-bold text-base">Canvas Studio</h1>
          <span className="hidden sm:inline text-xs text-muted-foreground">Editez les pages de l'app en temps reel</span>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto p-2 sm:p-4">
        <GlobalGifsManager />
      </div>
    </div>
  );
};

export default CanvasStudio;
