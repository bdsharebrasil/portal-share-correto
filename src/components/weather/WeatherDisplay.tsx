import { MapPin, Cloud, Sun, CloudRain, Wind } from "lucide-react";
import { useWeather } from "@/hooks/useWeather";

export function WeatherDisplay() {
  const { weather, loading } = useWeather();

  if (loading) {
    return (
      <div className="hidden md:flex items-center space-x-2 text-sm">
        <MapPin className="h-4 w-4 text-primary animate-pulse" />
        <span className="text-muted-foreground">Carregando clima...</span>
      </div>
    );
  }

  if (!weather) {
    return (
      <div className="hidden md:flex items-center space-x-2 text-sm">
        <MapPin className="h-4 w-4 text-primary" />
        <span className="text-muted-foreground">Clima indisponível</span>
      </div>
    );
  }

  // Map weather icons
  const getWeatherIcon = (icon: string) => {
    if (icon.includes('01')) return <Sun className="h-4 w-4 text-yellow-400" />;
    if (icon.includes('02') || icon.includes('03') || icon.includes('04')) return <Cloud className="h-4 w-4 text-gray-400" />;
    if (icon.includes('09') || icon.includes('10') || icon.includes('11')) return <CloudRain className="h-4 w-4 text-blue-400" />;
    return <Cloud className="h-4 w-4 text-gray-400" />;
  };

  return (
    <div className="hidden md:flex items-center space-x-3 text-sm">
      <div className="flex items-center space-x-1">
        <MapPin className="h-4 w-4 text-primary" />
        <span className="text-muted-foreground max-w-[120px] truncate">{weather.location}</span>
      </div>
      
      <div className="flex items-center space-x-1 bg-gradient-to-r from-primary/10 to-primary/5 px-2 py-1 rounded-lg">
        {getWeatherIcon(weather.icon)}
        <span className="text-foreground font-semibold">{weather.temperature}°C</span>
      </div>

      <div className="flex items-center space-x-1 text-xs text-muted-foreground" title={`Umidade: ${weather.humidity}%`}>
        <Wind className="h-3 w-3" />
        <span>{weather.humidity}%</span>
      </div>
    </div>
  );
}
