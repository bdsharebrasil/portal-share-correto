import { LottieAirplaneSpinner } from "./lottie-airplane-spinner";

interface LoadingPlaneProps {
  size?: "sm" | "md" | "lg";
}

export const LoadingPlane = ({ size = "md" }: LoadingPlaneProps) => {
  return <LottieAirplaneSpinner size={size} text="" />;
};
