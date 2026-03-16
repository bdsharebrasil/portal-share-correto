import React from 'react';
import { Layout } from '@/components/layout/Layout';
import { DashboardManutenção } from '@/components/manutencao';

export default function ManutencaoPreventiva() {
  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 relative overflow-hidden">
        {/* Background gradient orbs */}
        <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-orange-500/10 rounded-full blur-[120px] mix-blend-screen" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-red-500/5 rounded-full blur-[120px] mix-blend-screen" />
        </div>

        <div className="relative z-10 p-6">
          <DashboardManutenção />
        </div>
      </div>
    </Layout>
  );
}
