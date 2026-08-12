/**
 * Estrutura do Checklist de Preparação de Voo (Pré-Voo).
 * Cada etapa só é liberada após a conclusão da anterior.
 */

export type ItemKind = "check" | "oleo" | "abastecimento" | "documentos";

export interface ChecklistItem {
  id: string;
  label: string;
  kind?: ItemKind;
}

export interface ChecklistSection {
  id: string;
  title: string;
  subtitle?: string;
  items: ChecklistItem[];
}

export interface DocSubGroup {
  id: string;
  title: string;
  question: string;
  items: { id: string; label: string }[];
}

export const PRE_VOO_SECTIONS: ChecklistSection[] = [
  {
    id: "coordenacao",
    title: "Coordenação de Voo",
    subtitle: "Preparação documental e planejamento",
    items: [
      { id: "coord_plano_voo", label: "Plano de voo" },
      { id: "coord_doc_aeronave", label: "Documentação da aeronave atualizada" },
      { id: "coord_comissaria", label: "Comissaria" },
      { id: "coord_comissaria_reserva", label: "Comissaria reserva" },
      { id: "coord_ipads", label: "iPad's bateria / atualização" },
      { id: "coord_cartoes", label: "Atualizações dos cartões da aeronave" },
      { id: "coord_notam", label: "NOTAM" },
      { id: "coord_reservas_hotel", label: "Reservas de Hotel trip" },
    ],
  },
  {
    id: "despachante",
    title: "Despachante — Check Aeronave",
    subtitle: "Verificações externas e abastecimento",
    items: [
      { id: "desp_abastecimento", label: "Abastecimento", kind: "abastecimento" },
      { id: "desp_nivel_oleo", label: "Nível de óleo (LH / RH)", kind: "oleo" },
      { id: "desp_oleo_reserva", label: "Óleo reserva" },
      { id: "desp_estacas", label: "Estacas" },
      { id: "desp_corda", label: "Corda" },
      { id: "desp_funil_oleo", label: "Funil de óleo" },
      { id: "desp_protetores_motores", label: "Protetores de motores (remover)" },
      { id: "desp_capa_pitot", label: "Capa do pitot (remover e guardar)" },
      { id: "desp_calcos", label: "Calços (retirar e guardar)" },
      { id: "desp_dreno_combustivel", label: "Dreno do combustível (drenar e guardar)" },
      { id: "desp_tampas", label: "Verificar tampas de óleo e de combustível" },
      { id: "desp_tesoura", label: "Fixação da tesoura (somente no PT-OPC)" },
    ],
  },
  {
    id: "interno",
    title: "Aeronave — Check Interno",
    subtitle: "Cabine, equipamentos e comissaria",
    items: [
      { id: "int_documentos", label: "Documentos na aeronave", kind: "documentos" },
      { id: "int_ipads", label: "iPad's a bordo" },
      { id: "int_headsets", label: "Headset's (testar funcionamento e conferir pilhas)" },
      { id: "int_lanterna", label: "Lanterna (funcionando e com pilhas reservas)" },
      { id: "int_papeis", label: "Papéis / canetas / prancheta / check-list" },
      { id: "int_limpeza", label: "Limpeza interna" },
      { id: "int_toalha", label: "Toalha de rosto e almofada de pescoço" },
      { id: "int_primeiros_socorros", label: "Primeiros socorros e toalete descartável" },
      { id: "int_extintor", label: "Extintor de incêndio (a bordo e em dia)" },
      { id: "int_dados", label: "Verificar atualização de dados" },
      { id: "int_capa_parabrisas", label: "Capa de parabrisas (remover e guardar)" },
      { id: "int_comissaria_bordo", label: "Comissaria a bordo e gelo nas bebidas" },
      { id: "int_chaves", label: "Chaves com a tripulação" },
    ],
  },
];

export const DOC_SUBGROUPS: DocSubGroup[] = [
  {
    id: "documentacao",
    title: "Documentação",
    question: "Presente na aeronave",
    items: [
      { id: "doc_ca", label: "Certificado de Aeronavegabilidade (CA)" },
      { id: "doc_cm", label: "Certificado de Matrícula (CM)" },
      { id: "doc_diario", label: "Diário de bordo" },
      { id: "doc_anatel", label: "Licença de Estação (ANATEL) e comprovante pgto anual" },
      { id: "doc_seguro", label: "Apólice de Seguro Reta" },
      { id: "doc_cva", label: "Certificado de Verificação de Aeronavegabilidade (CVA)" },
      { id: "doc_lista_condensada", label: "Lista Condensada de Verificações" },
      { id: "doc_manuais", label: "Manuais exigidos (POH / AFM)" },
      { id: "doc_pbn", label: "PBN (F900)" },
    ],
  },
  {
    id: "seguranca",
    title: "Equipamento de Segurança",
    question: "Presente na aeronave",
    items: [
      { id: "seg_cinto", label: "Cinto de segurança" },
      { id: "seg_extintor", label: "Extintor de incêndio (peso anual dentro do arco verde)" },
      { id: "seg_elt", label: "ELT — Transmissor Localizador de Emergência" },
      { id: "seg_lanternas", label: "Lanternas (verificar bateria)" },
    ],
  },
  {
    id: "extras",
    title: "Extras",
    question: "Possui na aeronave",
    items: [
      { id: "ext_oleo_pistao", label: "3 litros de óleo reserva (motor pistão)" },
      { id: "ext_oleo_turbo", label: "1 litro de óleo reserva (motor turbo)" },
    ],
  },
  {
    id: "limpeza",
    title: "Limpeza da Aeronave",
    question: "Foi realizado",
    items: [
      { id: "lim_parabrisa_int", label: "Limpar parabrisa interno" },
      { id: "lim_parabrisa_ext", label: "Limpar parabrisa externo" },
      { id: "lim_fone", label: "Limpeza interna do fone de ouvido" },
      { id: "lim_aspirador_banco", label: "Passar aspirador no banco da aeronave" },
      { id: "lim_aspirador_chao", label: "Passar aspirador no chão da aeronave" },
      { id: "lim_banheiro", label: "Limpeza do banheiro (PT-OPC)" },
    ],
  },
  {
    id: "alimentos",
    title: "Alimentos e Bebidas",
    question: "Foi realizado",
    items: [
      { id: "ali_validade_snacks", label: "Verificar validade dos snacks" },
      { id: "ali_qtd_bebidas", label: "Verificar quantidade de bebidas" },
      { id: "ali_agua", label: "Colocar mais água (se necessário)" },
      { id: "ali_snacks", label: "Colocar mais snacks (se necessário)" },
    ],
  },
];

export const TOTAL_ITENS = PRE_VOO_SECTIONS.reduce((acc, s) => acc + s.items.length, 0);
