import React from "react";
import Lottie from "lottie-react";
import { cn } from "@/lib/utils";

interface LottieAirplaneSpinnerProps {
  size?: "sm" | "md" | "lg";
  text?: string;
  className?: string;
}

const airplaneAnimation = {
  v: "5.7.0",
  fr: 25,
  op: 150,
  ip: 0,
  w: 1920,
  h: 1080,
  nm: "Airplane Animation",
  ddd: 0,
  assets: [],
  layers: [
    {
      ty: 4,
      nm: "Airplane",
      sr: 1,
      st: 0,
      op: 150,
      ip: 0,
      hd: false,
      ddd: 0,
      bm: 0,
      hasMask: false,
      ao: 0,
      ks: {
        a: { a: 0, k: [960, 540, 0], ix: 1 },
        s: { a: 0, k: [100, 100, 100], ix: 6 },
        sk: { a: 0, k: 0 },
        p: {
          a: 1,
          k: [
            { o: { x: 0.333, y: 0 }, i: { x: 0.667, y: 1 }, s: [980, 540, 0], t: 0 },
            { o: { x: 0.333, y: 0 }, i: { x: 0.667, y: 1 }, s: [960, 540, 0], t: 50 },
            { o: { x: 0.333, y: 0 }, i: { x: 0.667, y: 1 }, s: [980, 540, 0], t: 100 },
            { s: [960, 540, 0], t: 149 },
          ],
          ix: 2,
        },
        r: { a: 0, k: 0, ix: 10 },
        sa: { a: 0, k: 0 },
        o: { a: 0, k: 100, ix: 11 },
      },
      w: 1920,
      h: 1080,
      ind: 1,
      shapes: [
        {
          ty: "gr",
          it: [
            {
              ty: "el",
              d: 1,
              s: { a: 0, k: [40, 40] },
            },
            {
              ty: "st",
              c: { a: 0, k: [0.2, 0.6, 1, 1] },
              w: { a: 0, k: 8 },
            },
            {
              ty: "tr",
              p: { a: 0, k: [0, 0] },
              a: { a: 0, k: [0, 0] },
              s: { a: 0, k: [100, 100] },
              r: { a: 0, k: 0 },
              o: { a: 0, k: 100 },
              sk: { a: 0, k: 0 },
              sa: { a: 0, k: 0 },
            },
          ],
          nm: "Airplane Circle",
        },
      ],
    },
  ],
};

export function LottieAirplaneSpinner({
  size = "md",
  text = "Carregando...",
  className,
}: LottieAirplaneSpinnerProps) {
  const lottieSize = {
    sm: 120,
    md: 180,
    lg: 240,
  };

  const textClasses = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg",
  };

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4",
        className
      )}
    >
      <Lottie
        animationData={airplaneAnimation}
        loop
        autoplay
        style={{ width: lottieSize[size], height: lottieSize[size] }}
      />

      {text && (
        <p className={cn("text-muted-foreground font-medium", textClasses[size])}>
          {text}
        </p>
      )}
    </div>
  );
}
