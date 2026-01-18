import React, { useState, useEffect } from "react";
import Lottie from "lottie-react";
import { cn } from "@/lib/utils";

interface InlineLottieSpinnerProps {
  size?: "sm" | "md";
  className?: string;
}

const smallSpinnerData = {
  v: "5.12.2",
  fr: 60,
  ip: 0,
  op: 300,
  w: 200,
  h: 200,
  nm: "Small Spinner",
  ddd: 0,
  assets: [],
  layers: [
    {
      ddd: 0,
      ind: 1,
      ty: 4,
      nm: "Spinner",
      sr: 1,
      ks: {
        o: { a: 0, k: 100 },
        r: {
          a: 1,
          k: [
            { t: 0, s: [0], to: [60], ti: [0] },
            { t: 300, s: [360], to: [0], ti: [0] },
          ],
        },
        p: { a: 0, k: [100, 100, 0] },
        a: { a: 0, k: [100, 100, 0] },
        s: { a: 0, k: [100, 100, 100] },
      },
      ao: 0,
      shapes: [
        {
          ty: "gr",
          it: [
            {
              ty: "el",
              d: 1,
              s: { a: 0, k: [50, 50] },
            },
            {
              ty: "st",
              c: { a: 0, k: [0.22, 0.85, 1, 1] },
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
          nm: "Circle",
        },
      ],
      ip: 0,
      op: 300,
      st: 0,
      bm: 0,
    },
  ],
  markers: [],
};

export function InlineLottieSpinner({
  size = "sm",
  className,
}: InlineLottieSpinnerProps) {
  const [animationData, setAnimationData] = useState<any>(null);

  useEffect(() => {
    setAnimationData(smallSpinnerData);
  }, []);

  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
  };

  if (!animationData) {
    return (
      <div className={cn(sizeClasses[size], "bg-muted rounded-full animate-pulse", className)} />
    );
  }

  return (
    <div className={cn(sizeClasses[size], className)}>
      <Lottie
        animationData={animationData}
        loop={true}
        autoplay={true}
      />
    </div>
  );
}
