import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useLoading } from '@/contexts/LoadingContext';

export function RouteChangeListener() {
  const location = useLocation();
  const { setIsLoading } = useLoading();

  useEffect(() => {
    // Mostra o loading quando muda de rota
    setIsLoading(true);

    // Esconde o loading após um pequeno delay (permite que a página comece a renderizar)
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 800);

    return () => clearTimeout(timer);
  }, [location.pathname, setIsLoading]);

  return null;
}
