import { useState, useEffect } from "react";
import { Clock, Thermometer, MapPin } from "lucide-react";
interface LocationData {
  lat: number;
  lon: number;
  city: string;
  timezone: string;
}
interface WeatherData {
  temperature: number;
  condition: string;
  location: string;
}
export function Header() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [weather, setWeather] = useState<WeatherData>({
    temperature: 24,
    condition: "Carregando...",
    location: "Localizando..."
  });
  const [userLocation, setUserLocation] = useState<LocationData | null>(null);

  // Atualizar relógio baseado no fuso horário
  useEffect(() => {
    const timer = setInterval(() => {
      if (userLocation?.timezone) {
        const now = new Date();
        setCurrentTime(now);
      } else {
        setCurrentTime(new Date());
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [userLocation]);

  const API_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY;

  // Obter localização do usuário
  useEffect(() => {
    const getLocation = () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async position => {
          const {
            latitude,
            longitude
          } = position.coords;
          try {
            // Usar OpenWeatherMap API para obter dados climáticos e localização
            const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${API_KEY}&units=metric&lang=pt_br`);
            if (response.ok) {
              const data = await response.json();
              const locationData: LocationData = {
                lat: latitude,
                lon: longitude,
                city: data.name,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
              };
              setUserLocation(locationData);
              setWeather({
                temperature: Math.round(data.main.temp),
                condition: data.weather[0].description,
                location: data.name
              });
            } else {
              // Fallback para dados simulados se a API falhar
              setWeather({
                temperature: 24,
                condition: "Sem dados de clima",
                location: "Localização não disponível"
              });
            }
          } catch (error) {
            console.log("Erro ao obter dados climáticos:", error);
            // Fallback para simulação local
            simulateLocalWeather();
          }
        }, error => {
          console.log("Erro ao obter localização:", error);
          simulateLocalWeather();
        }, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5 minutos
        });
      } else {
        simulateLocalWeather();
      }
    };
    const simulateLocalWeather = () => {
      const hour = new Date().getHours();
      let temp = 20;
      if (hour >= 6 && hour < 12) {
        temp = 20 + (hour - 6) * 2;
      } else if (hour >= 12 && hour < 18) {
        temp = 32 - (hour - 12) * 1;
      } else if (hour >= 18 && hour < 24) {
        temp = 26 - (hour - 18) * 1;
      } else {
        temp = 20 - hour * 0.5;
      }
      setWeather({
        temperature: Math.round(temp),
        condition: "Simulado - Céu limpo",
        location: "Local (simulado)"
      });
    };
    getLocation();
  }, []);

  // Atualizar dados climáticos a cada 10 minutos
  useEffect(() => {
    if (userLocation) {
      const weatherTimer = setInterval(async () => {
        try {
          const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${userLocation.lat}&lon=${userLocation.lon}&appid=${API_KEY}&units=metric&lang=pt_br`);
          if (response.ok) {
            const data = await response.json();
            setWeather({
              temperature: Math.round(data.main.temp),
              condition: data.weather[0].description,
              location: data.name
            });
          }
        } catch (error) {
          console.log("Erro ao atualizar dados climáticos:", error);
        }
      }, 600000); // 10 minutos

      return () => clearInterval(weatherTimer);
    }
  }, [userLocation]);
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('pt-BR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };
  return <header className="h-[73px] bg-gray-900/95 backdrop-blur-sm border-b border-gray-700/50 px-6 flex items-center flex-shrink-0">
      <div className="flex items-center justify-between w-full">
        <div>
          <h1 className="text-xl font-semibold text-white">Sistema de Gestão Financeira</h1>
          
        </div>
        
        <div className="flex items-center space-x-6">
           {/* Localização e Temperatura */}
           <div className="flex items-center space-x-2 text-white">
             <div className="flex items-center space-x-1">
               <MapPin className="w-4 h-4 text-green-400" />
               <Thermometer className="w-5 h-5 text-orange-400" />
             </div>
             <div className="text-right">
               <span className="text-xl font-bold">{weather.temperature}°C</span>
               <p className="text-xs text-gray-400">{weather.location}</p>
               <p className="text-xs text-gray-500 capitalize">{weather.condition}</p>
             </div>
           </div>
          
          {/* Relógio */}
          <div className="text-right">
            <div className="flex items-center space-x-2 text-white">
              <Clock className="w-5 h-5 text-blue-400" />
              <span className="text-2xl font-mono font-bold tracking-wider">
                {formatTime(currentTime)}
              </span>
            </div>
            <p className="text-xs text-gray-400 capitalize">
              {formatDate(currentTime)}
            </p>
          </div>
        </div>
      </div>
    </header>;
}