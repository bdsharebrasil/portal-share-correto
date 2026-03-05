import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { BenefitCalculator } from "@/components/benefit/BenefitCalculator";

const ValeAlimentacao = () => {
  const [initialBalance, setInitialBalance] = useState(500.00);

  const currentDate = new Date();
  const monthName = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'][currentDate.getMonth()];
  const currentYear = currentDate.getFullYear();

  return (
    <Layout>
      <div className="p-6">
        <BenefitCalculator
          title={`Vale Alimentação - ${monthName} ${currentYear}`}
          month={`${monthName} ${currentYear}`}
          initialBalance={initialBalance}
          onInitialBalanceChange={setInitialBalance}
        />
      </div>
    </Layout>
  );
};

export default ValeAlimentacao;
