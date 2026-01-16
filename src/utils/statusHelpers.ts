export const getBookingStatusBadge = (status: string) => {
  const statusConfig: Record<string, { label: string; className: string; icon: string }> = {
    pendente: {
      label: 'Pendente',
      className: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/30',
      icon: '⏳'
    },
    confirmado: {
      label: 'Confirmado',
      className: 'bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30',
      icon: '✅'
    },
    em_voo: {
      label: 'Em Voo',
      className: 'bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/30',
      icon: '🛫'
    },
    rejeitado: {
      label: 'Rejeitado',
      className: 'bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30',
      icon: '❌'
    },
    cancelado: {
      label: 'Cancelado',
      className: 'bg-gray-500/20 text-gray-700 dark:text-gray-400 border-gray-500/30',
      icon: '🚫'
    },
    concluido: {
      label: 'Concluído',
      className: 'bg-purple-500/20 text-purple-700 dark:text-purple-400 border-purple-500/30',
      icon: '✔️'
    }
  };

  return statusConfig[status] || statusConfig.pendente;
};

export const getAircraftStatusConfig = (status: string) => {
  const statusConfig: Record<string, { label: string; className: string; icon: string }> = {
    disponivel: {
      label: 'Disponível',
      className: 'bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30',
      icon: '✅'
    },
    indisponivel: {
      label: 'Indisponível',
      className: 'bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30',
      icon: '❌'
    },
    em_voo: {
      label: 'Em Voo',
      className: 'bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/30 animate-pulse',
      icon: '🛫'
    },
    manutencao: {
      label: 'Manutenção',
      className: 'bg-orange-500/20 text-orange-700 dark:text-orange-400 border-orange-500/30',
      icon: '🔧'
    },
    reservado: {
      label: 'Reservado',
      className: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/30',
      icon: '📅'
    }
  };

  return statusConfig[status] || statusConfig.indisponivel;
};

export const getFlightCycleStatusConfig = (status: string) => {
  const statusConfig: Record<string, { label: string; className: string; icon: string }> = {
    em_execucao: {
      label: 'Em Execução',
      className: 'bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/30',
      icon: '🛫'
    },
    confirmado: {
      label: 'Confirmado',
      className: 'bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30',
      icon: '✅'
    },
    concluido: {
      label: 'Concluído',
      className: 'bg-purple-500/20 text-purple-700 dark:text-purple-400 border-purple-500/30',
      icon: '✔️'
    },
    cancelado: {
      label: 'Cancelado',
      className: 'bg-gray-500/20 text-gray-700 dark:text-gray-400 border-gray-500/30',
      icon: '🚫'
    }
  };

  return statusConfig[status] || statusConfig.confirmado;
};
