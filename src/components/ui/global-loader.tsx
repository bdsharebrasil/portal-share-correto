import { useLoading } from "@/contexts/LoadingContext";
import Lottie from "lottie-react";

const loaderAnimation = {
  v: "5.12.2",
  fr: 60,
  ip: 0,
  op: 300,
  w: 200,
  h: 200,
  nm: "Loader",
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

export function GlobalLoader() {
  const { isLoading } = useLoading();

  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-2">
        <Lottie
          animationData={loaderAnimation}
          loop
          autoplay
          style={{ width: 180, height: 180 }}
        />
        <span className="text-sm text-muted-foreground">Carregando...</span>
      </div>
    </div>
  );
}
