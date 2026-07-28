import { useState } from "react";
import FluxoCaixaTab from "./FluxoCaixaTab";

export default function GestaoFiscal() {
  return (
    <div
      className="min-h-screen font-sans text-slate-100"
      style={{
        background:
          "radial-gradient(circle at top left, rgba(14,165,233,0.10), transparent 30%), linear-gradient(135deg, #030712 0%, #07111f 45%, #0f172a 100%)",
      }}
    >
      <main className="px-[5px] py-5 lg:py-6 max-w-[1600px] mx-auto">
        <FluxoCaixaTab />
      </main>
    </div>
  );
}
