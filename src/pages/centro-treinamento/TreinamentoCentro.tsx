import { Link } from "react-router-dom";
import { ArrowLeft, GraduationCap } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/card";

export default function TreinamentoCentro() {
  return <Layout><div className="mx-auto max-w-5xl space-y-7 px-4 py-6"><Link to="/centro-treinamento" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Voltar ao Centro Treinamento</Link><Card className="overflow-hidden border-sky-200/20"><div className="bg-gradient-to-br from-sky-950 via-slate-900 to-slate-950 p-8 text-white"><GraduationCap className="size-10 text-sky-300" /><h1 className="mt-4 text-3xl font-semibold">Treinamento</h1><p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">Este espaço está reservado para trilhas, conteúdos e acompanhamento de capacitação da equipe.</p></div><CardContent className="p-6"><p className="text-sm text-muted-foreground">O catálogo de treinamentos será criado nesta área em uma próxima etapa.</p></CardContent></Card></div></Layout>;
}
