import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from '@react-pdf/renderer';
import { formatDateToBR } from './date-utils';

// Get logo URL
const getLogoUrl = () => {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/logo.share.png`;
  }
  return '/logo.share.png';
};

const logoUrl = getLogoUrl();

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 9,
    fontFamily: 'Helvetica',
    backgroundColor: '#FFFFFF',
  },
  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  logoHeader: {
    width: 80,
    height: 40,
    objectFit: 'contain',
  },
  titleArea: {
    flex: 1,
    alignItems: 'center',
  },
  reciboTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    textDecoration: 'underline',
  },
  valorBox: {
    border: '1.5px solid #000000',
    padding: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  valorText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000000',
  },
  // Emissor / Pagador row
  infoRow: {
    flexDirection: 'row',
    marginTop: 10,
    marginBottom: 10,
    gap: 20,
  },
  infoColumn: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 7,
    color: '#6B7280',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 9,
    color: '#1F2937',
    marginBottom: 1,
    lineHeight: 1.4,
  },
  infoValueBold: {
    fontSize: 10,
    color: '#1F2937',
    fontWeight: 'bold',
    marginBottom: 2,
  },
  receiptNumberBox: {
    alignItems: 'flex-end',
  },
  receiptNumberLabel: {
    fontSize: 7,
    color: '#6B7280',
    fontWeight: 'bold',
  },
  receiptNumberValue: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  // Separator
  separator: {
    height: 1,
    backgroundColor: '#D1D5DB',
    marginVertical: 8,
  },
  separatorThick: {
    height: 2,
    backgroundColor: '#1F2937',
    marginVertical: 8,
  },
  // Description section
  descriptionHeader: {
    backgroundColor: '#E5E7EB',
    padding: 6,
    marginBottom: 4,
  },
  descriptionHeaderText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  descriptionContent: {
    padding: 8,
    minHeight: 60,
    border: '1px solid #E5E7EB',
  },
  descriptionText: {
    fontSize: 9,
    color: '#374151',
    lineHeight: 1.6,
  },
  // Total row
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4,
    marginBottom: 10,
  },
  totalBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  totalLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#1F2937',
    backgroundColor: '#E5E7EB',
    padding: 6,
    paddingHorizontal: 12,
  },
  totalValue: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#1F2937',
    padding: 6,
    border: '1px solid #E5E7EB',
    minWidth: 100,
    textAlign: 'right',
  },
  // OBS / Disclaimer
  obsSection: {
    marginTop: 15,
    marginBottom: 15,
  },
  obsLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  obsText: {
    fontSize: 8,
    color: '#374151',
    lineHeight: 1.6,
    fontStyle: 'italic',
  },
  // Signature
  signatureArea: {
    marginTop: 40,
    alignItems: 'center',
  },
  signatureDateLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 30,
  },
  signatureDateText: {
    fontSize: 10,
    color: '#1F2937',
  },
  signatureDateUnderline: {
    borderBottom: '1px solid #000',
    minWidth: 40,
    textAlign: 'center',
    fontSize: 10,
    paddingBottom: 2,
  },
  signatureLine: {
    width: 200,
    borderBottom: '1px solid #000000',
    marginBottom: 5,
  },
  logoSignature: {
    width: 70,
    height: 28,
    objectFit: 'contain',
    marginTop: 8,
  },
  signatureCaption: {
    fontSize: 8,
    color: '#6B7280',
    marginTop: 2,
  },
});

// Receipt PDF Component
export const ReciboDocument = ({ data }: { data: any }) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDocumento = (doc: string) => {
    if (doc && doc.length === 11) {
      return doc.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/g, '$1.$2.$3-$4');
    }
    if (doc && doc.length === 14) {
      return doc.replace(
        /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/g,
        '$1.$2.$3/$4-$5'
      );
    }
    return doc;
  };

  const isReembolso = data.receipt_type === 'reembolso';
  const emissor = data.emissor;

  // Parse issue date for signature
  const issueDate = data.issue_date ? new Date(data.issue_date + 'T12:00:00') : new Date();
  const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const day = issueDate.getDate();
  const month = months[issueDate.getMonth()];
  const year = issueDate.getFullYear();
  const cityName = emissor?.cidade || 'Várzea Grande';

  const disclaimerPagamento = 'Para maior clareza, firmo(amos) o presente recibo para que produza os seus efeitos legais, dando plena e rasa quitação.';
  const disclaimerReembolso = `OBS: Declaro, para os devidos fins, que o presente recibo é emitido antecipadamente a título de solicitação de reembolso referente às despesas efetuadas por esta empresa em benefício do cliente acima identificado.\nRessalta-se que o presente documento somente terá validade e produzirá seus efeitos legais após a efetiva quitação do valor nele indicado, mediante comprovação do respectivo pagamento.\nPara maior clareza e segurança das partes, firmo o presente recibo, que permanecerá condicionado ao cumprimento integral da obrigação de pagamento até a data de quitação.`;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* HEADER: Logo | Title | Valor */}
        <View style={styles.headerRow}>
          <Image src={logoUrl} style={styles.logoHeader} cache={false} />
          <View style={styles.titleArea}>
            <Text style={styles.reciboTitle}>
              {isReembolso ? 'RECIBO DE REEMBOLSO' : 'RECIBO DE PAGAMENTO'}
            </Text>
          </View>
          <View style={styles.valorBox}>
            <Text style={styles.valorText}>{formatCurrency(data.amount)}</Text>
          </View>
        </View>

        <View style={styles.separatorThick} />

        {/* EMISSOR / PAGADOR / Nº RECIBO */}
        <View style={styles.infoRow}>
          {/* Emissor */}
          <View style={styles.infoColumn}>
            <Text style={styles.infoLabel}>Emissor</Text>
            {emissor ? (
              <>
                <Text style={styles.infoValueBold}>{emissor.razao_social || 'SHARE BRASIL SERVIÇOS AERONAUTICOS'}</Text>
                <Text style={styles.infoValue}>CNPJ: {emissor.cnpj ? formatDocumento(emissor.cnpj.replace(/\D/g, '')) : '—'}</Text>
                {emissor.telefone && <Text style={styles.infoValue}>{emissor.telefone}</Text>}
                {emissor.endereco && <Text style={styles.infoValue}>{emissor.endereco}</Text>}
                {emissor.cidade && <Text style={styles.infoValue}>{emissor.cidade}{emissor.cep ? ` - ${emissor.cep}` : ''}</Text>}
              </>
            ) : (
              <Text style={styles.infoValue}>Dados do emissor não disponíveis</Text>
            )}
          </View>

          {/* Pagador */}
          <View style={{ ...styles.infoColumn, flex: 1.5 }}>
            <Text style={styles.infoLabel}>Pagador</Text>
            <Text style={styles.infoValueBold}>{data.payer_name || '—'}</Text>
            <Text style={styles.infoValue}>
              {data.payer_document ? `CNPJ: ${formatDocumento(data.payer_document)}` : ''}
            </Text>
            {data.payer_address && <Text style={styles.infoValue}>{data.payer_address}</Text>}
            {data.payer_city && (
              <Text style={styles.infoValue}>
                {data.payer_city}{data.payer_uf ? ` - ${data.payer_uf}` : ''}
              </Text>
            )}
          </View>

          {/* Nº do Recibo */}
          <View style={styles.receiptNumberBox}>
            <Text style={styles.receiptNumberLabel}>Número do recibo:</Text>
            <Text style={styles.receiptNumberValue}>{data.receipt_number}</Text>
          </View>
        </View>

        <View style={styles.separator} />

        {/* DESCRIÇÃO */}
        <View style={styles.descriptionHeader}>
          <Text style={styles.descriptionHeaderText}>
            {isReembolso ? 'DESCRIÇÃO' : 'DESCRIÇÃO'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row' }}>
          <View style={{ ...styles.descriptionContent, flex: 1 }}>
            <Text style={styles.descriptionText}>{data.service_description || '—'}</Text>
          </View>
          <View style={{ alignItems: 'flex-end', paddingLeft: 10 }}>
            <View style={styles.totalBox}>
              <Text style={styles.totalLabel}>TOTAL</Text>
              <Text style={styles.totalValue}>{formatCurrency(data.amount)}</Text>
            </View>
          </View>
        </View>

        {/* Reembolso - Doc Number */}
        {isReembolso && data.doc_number && (
          <View style={{ marginTop: 8, padding: 6, backgroundColor: '#F3F4F6', border: '1px solid #E5E7EB' }}>
            <Text style={{ fontSize: 8, color: '#374151' }}>
              <Text style={{ fontWeight: 'bold' }}>Nº do Documento: </Text>
              {data.doc_number}
            </Text>
          </View>
        )}

        {/* OBS / DISCLAIMER */}
        <View style={styles.obsSection}>
          <Text style={styles.obsLabel}>
            {isReembolso ? 'OBS:' : ''}
          </Text>
          <Text style={styles.obsText}>
            {isReembolso ? disclaimerReembolso : disclaimerPagamento}
          </Text>
        </View>

        {/* SIGNATURE AREA */}
        <View style={styles.signatureArea}>
          {/* Date line */}
          <View style={styles.signatureDateLine}>
            <Text style={styles.signatureDateText}>{cityName},</Text>
            <Text style={styles.signatureDateUnderline}>{String(day).padStart(2, ' ')}</Text>
            <Text style={styles.signatureDateText}>de</Text>
            <Text style={styles.signatureDateUnderline}>{month}</Text>
            <Text style={styles.signatureDateText}>de</Text>
            <Text style={styles.signatureDateUnderline}>{year}</Text>
          </View>

          <View style={styles.signatureLine} />

          {/* Logo at signature */}
          <Image src={logoUrl} style={styles.logoSignature} cache={false} />
          <Text style={styles.signatureCaption}>setor financeiro Share Brasil</Text>
        </View>
      </Page>
    </Document>
  );
};
