import { AirplaneSpinner } from "./airplane-spinner";

interface LoadingPlaneProps {
  size?: "sm" | "md" | "lg";
}

export const LoadingPlane = ({ size = "md" }: LoadingPlaneProps) => {
  return <AirplaneSpinner size={size} text="" />;
};