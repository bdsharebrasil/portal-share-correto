import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from '@react-pdf/renderer';

const getLogoUrl = () => {
  if (typeof window !== 'undefined') return `${window.location.origin}/logo.share.png`;
  return '/logo.share.png';
};

const getSignatureUrl = () => {
  if (typeof window !== 'undefined') return `${window.location.origin}/assinatura-para-recibo.png`;
  return '/assinatura-para-recibo.png';
};

const signatureUrl = getSignatureUrl();
const logoUrl = getLogoUrl();

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 9,
    fontFamily: 'Helvetica',
    backgroundColor: '#FFFFFF',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  logoHeader: { width: 80, height: 40, objectFit: 'contain' },
  titleArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  reciboTitle: { fontSize: 16, fontWeight: 'bold', color: '#1F2937', textDecoration: 'underline' },
  receiptNumberAndValor: { alignItems: 'flex-end' },
  receiptNumberLabel: { fontSize: 7, color: '#6B7280', fontWeight: 'bold' },
  receiptNumberValue: { fontSize: 10, fontWeight: 'bold', color: '#1F2937', marginBottom: 6 },
  valorBox: { border: '1.5px solid #000000', padding: 8, minWidth: 100, alignItems: 'center' },
  valorText: { fontSize: 12, fontWeight: 'bold', color: '#000000' },
  infoRow: { flexDirection: 'row', marginTop: 10, marginBottom: 10, gap: 20 },
  infoColumn: { flex: 1 },
  infoLabel: { fontSize: 7, color: '#6B7280', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 2 },
  infoValue: { fontSize: 9, color: '#1F2937', marginBottom: 1, lineHeight: 1.4 },
  infoValueBold: { fontSize: 10, color: '#1F2937', fontWeight: 'bold', marginBottom: 2 },
  separator: { height: 1, backgroundColor: '#D1D5DB', marginVertical: 8 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#E5E7EB', borderBottom: '1px solid #000' },
  tableHeaderCell: { padding: 6, fontSize: 8, fontWeight: 'bold', color: '#1F2937', textAlign: 'center' },
  tableRow: { flexDirection: 'row', borderBottom: '1px solid #E5E7EB' },
  tableCell: { padding: 6, fontSize: 9, color: '#374151', textAlign: 'center' },
  prazoRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 6, marginBottom: 10, gap: 4 },
  prazoLabel: { fontSize: 8, fontWeight: 'bold', color: '#1F2937', backgroundColor: '#E5E7EB', padding: 5, paddingHorizontal: 8 },
  prazoValue: { fontSize: 9, fontWeight: 'bold', color: '#1F2937', padding: 5, border: '1px solid #E5E7EB', minWidth: 70, textAlign: 'center' },
  obsSection: { marginTop: 15, marginBottom: 15, padding: 10, border: '0.5px solid #E5E7EB' },
  obsText: { fontSize: 8, color: '#374151', lineHeight: 1.6, textAlign: 'justify' },
  signatureArea: { marginTop: 40, alignItems: 'center' },
  signatureDateLine: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 30 },
  signatureDateText: { fontSize: 10, color: '#1F2937' },
  signatureDateUnderline: { borderBottom: '1px solid #000', minWidth: 40, textAlign: 'center', fontSize: 10, paddingBottom: 2 },
  signatureLine: { width: 200, borderBottom: '1px solid #000000', marginBottom: 5 },
  signatureImage: { width: 180, height: 70, objectFit: 'contain', marginBottom: 5 },
  logoSignature: { width: 70, height: 28, objectFit: 'contain', marginTop: 8 },
  signatureCaption: { fontSize: 8, color: '#6B7280', marginTop: 2 },
  signatureNameBold: { fontSize: 9, fontWeight: 'bold', color: '#1F2937', marginTop: 6 },
  signatureRole: { fontSize: 8, color: '#6B7280' },
  descriptionHeader: { backgroundColor: '#E5E7EB', padding: 6, marginBottom: 4 },
  descriptionHeaderText: { fontSize: 9, fontWeight: 'bold', color: '#1F2937' },
  descriptionContent: { padding: 8, minHeight: 60, border: '1px solid #E5E7EB' },
  descriptionText: { fontSize: 9, color: '#374151', lineHeight: 1.6 },
  totalRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4, marginBottom: 10 },
  totalBox: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  totalLabel: { fontSize: 9, fontWeight: 'bold', color: '#1F2937', backgroundColor: '#E5E7EB', padding: 6, paddingHorizontal: 12 },
  totalValue: { fontSize: 11, fontWeight: 'bold', color: '#1F2937', padding: 6, border: '1px solid #E5E7EB', minWidth: 100, textAlign: 'right' },
});

export const ReciboDocument = ({ data }: { data: any }) => {
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const formatDocumento = (doc: string) => {
    if (!doc) return '';
    const d = doc.replace(/\D/g, '');
    if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    return doc;
  };

  const formatDateBR = (dateStr: string | null | undefined) => {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0].slice(-2)}`;
      return dateStr;
    } catch { return dateStr; }
  };

  const isReembolso = data.receipt_type === 'reembolso';
  const emissor = data.emissor;

  const issueDate = data.issue_date ? new Date(data.issue_date + 'T12:00:00') : new Date();
  const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const day = issueDate.getDate();
  const month = months[issueDate.getMonth()];
  const year = issueDate.getFullYear();
  const cityName = emissor?.cidade || 'VÁRZEA GRANDE';

  const disclaimerPagamento = 'Para maior clareza, firmo(amos) o presente recibo para que produza os seus efeitos legais, dando plena e rasa quitação.';
  const disclaimerReembolso = 'Declaro, para os devidos fins, que o presente recibo é emitido antecipadamente a título de solicitação de reembolso referente às despesas efetuadas por esta empresa em benefício do cliente acima identificado. Ressalta-se que o presente documento somente terá validade e produzirá seus efeitos legais após a efetiva quitação do valor indicado, mediante comprovação do respectivo pagamento. Para maior clareza e segurança das partes, firmo o presente recibo, que permanecerá condicionado ao cumprimento integral da obrigação de pagamento até a data de quitação.';

  const docNumber = data.numero_documento_decea || data.numero_documento_infraero || data.documento_number || '';
  const competencia = data.competencia_decea || data.competencia_infraero || '';
  const hasCompetencia = !!competencia;
  const prazoQuitacao = data.max_payment_date || data.data_vencimento_boleto || '';

  const SignatureBlock = () => (
    <View style={styles.signatureArea}>
      <View style={styles.signatureDateLine}>
        <Text style={styles.signatureDateText}>{cityName},</Text>
        <Text style={styles.signatureDateUnderline}>{String(day).padStart(2, ' ')}</Text>
        <Text style={styles.signatureDateText}>de</Text>
        <Text style={styles.signatureDateUnderline}>{month}</Text>
        <Text style={styles.signatureDateText}>de</Text>
        <Text style={styles.signatureDateUnderline}>{year}</Text>
      </View>
      <View style={styles.signatureLine} />
      <Image src={logoUrl} style={styles.logoSignature} cache={false} />
      <Text style={styles.signatureCaption}>setor financeiro Share Brasil</Text>
      <Image src={signatureUrl} style={styles.signatureImage} cache={false} />
      <Text style={styles.signatureNameBold}>Rolffe de Lima Erbe</Text>
      <Text style={styles.signatureRole}>Gestor Responsável</Text>
    </View>
  );

  // ──────────── REEMBOLSO ────────────
  if (isReembolso) {
    return (
      <Document>
        <Page size="A4" style={styles.page}>
          {/* Header */}
          <View style={styles.headerRow}>
            <Image src={logoUrl} style={styles.logoHeader} cache={false} />
            <View style={styles.titleArea}>
              <Text style={styles.reciboTitle}>RECIBO</Text>
            </View>
            <View style={styles.receiptNumberAndValor}>
              <Text style={styles.receiptNumberLabel}>Número do recibo:</Text>
              <Text style={styles.receiptNumberValue}>{data.receipt_number}</Text>
              <View style={styles.valorBox}>
                <Text style={styles.valorText}>{formatCurrency(data.valor)}</Text>
              </View>
            </View>
          </View>

          {/* Emissor / Pagador */}
          <View style={styles.infoRow}>
            <View style={styles.infoColumn}>
              <Text style={styles.infoLabel}>EMISSOR</Text>
              {emissor ? (
                <>
                  <Text style={styles.infoValueBold}>{emissor.razao_social || 'SHARE BRASIL SERVIÇOS AERONAUTICOS'}</Text>
                  <Text style={styles.infoValue}>CNPJ: {emissor.cnpj ? formatDocumento(emissor.cnpj) : '—'}</Text>
                  {emissor.telefone && <Text style={styles.infoValue}>{emissor.telefone}</Text>}
                  {emissor.endereco && <Text style={styles.infoValue}>{emissor.endereco}</Text>}
                  {emissor.cidade && <Text style={styles.infoValue}>{emissor.cidade}{emissor.cep ? ` - ${emissor.cep}` : ''}</Text>}
                </>
              ) : (
                <Text style={styles.infoValue}>Dados do emissor não disponíveis</Text>
              )}
            </View>
            <View style={{ ...styles.infoColumn, flex: 1.5 }}>
              <Text style={styles.infoLabel}>PAGADOR</Text>
              <Text style={styles.infoValueBold}>{data.payer_name || '—'}</Text>
              {data.payer_document && (
                <Text style={styles.infoValue}>CNPJ: {formatDocumento(data.payer_document)}</Text>
              )}
              {data.payer_address && <Text style={styles.infoValue}>{data.payer_address}</Text>}
              {data.payer_city && (
                <Text style={styles.infoValue}>{data.payer_city}{data.payer_uf ? ` - ${data.payer_uf}` : ''}</Text>
              )}
            </View>
          </View>

          <View style={styles.separator} />

          {/* Table */}
          <View>
            <View style={styles.tableHeader}>
              <Text style={{ ...styles.tableHeaderCell, flex: 3, textAlign: 'left' }}>Descrição do Serviço</Text>
              <Text style={{ ...styles.tableHeaderCell, flex: 1.2 }}>Nº Documento</Text>
              {hasCompetencia && <Text style={{ ...styles.tableHeaderCell, flex: 1 }}>Competência</Text>}
              <Text style={{ ...styles.tableHeaderCell, flex: 1 }}>Valor</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={{ ...styles.tableCell, flex: 3, textAlign: 'left' }}>{data.service_description || '—'}</Text>
              <Text style={{ ...styles.tableCell, flex: 1.2 }}>{docNumber || '—'}</Text>
              {hasCompetencia && <Text style={{ ...styles.tableCell, flex: 1 }}>{competencia}</Text>}
              <Text style={{ ...styles.tableCell, flex: 1 }}>{formatCurrency(data.valor)}</Text>
            </View>
          </View>

          {prazoQuitacao && (
            <View style={styles.prazoRow}>
              <Text style={styles.prazoLabel}>Data Prazo Máximo Quitação:</Text>
              <Text style={styles.prazoValue}>{formatDateBR(prazoQuitacao)}</Text>
            </View>
          )}

          <View style={styles.obsSection}>
            <Text style={styles.obsText}>{disclaimerReembolso}</Text>
          </View>

          <SignatureBlock />
        </Page>
      </Document>
    );
  }

  // ──────────── PAGAMENTO ────────────
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.headerRow}>
          <Image src={logoUrl} style={styles.logoHeader} cache={false} />
          <View style={styles.titleArea}>
            <Text style={styles.reciboTitle}>RECIBO</Text>
          </View>
          <View style={styles.receiptNumberAndValor}>
            <Text style={styles.receiptNumberLabel}>Número do recibo:</Text>
            <Text style={styles.receiptNumberValue}>{data.receipt_number}</Text>
            <View style={styles.valorBox}>
              <Text style={styles.valorText}>{formatCurrency(data.valor)}</Text>
            </View>
          </View>
        </View>

        {/* Emissor / Recebedor */}
        <View style={styles.infoRow}>
          {/* Emissor = Share Brasil (pagador fixo) */}
          <View style={styles.infoColumn}>
            <Text style={styles.infoLabel}>PAGADOR</Text>
            {emissor ? (
              <>
                <Text style={styles.infoValueBold}>{emissor.razao_social || 'SHARE BRASIL SERVIÇOS AERONAUTICOS'}</Text>
                <Text style={styles.infoValue}>CNPJ: {emissor.cnpj ? formatDocumento(emissor.cnpj) : '—'}</Text>
                {emissor.telefone && <Text style={styles.infoValue}>{emissor.telefone}</Text>}
                {emissor.endereco && <Text style={styles.infoValue}>{emissor.endereco}</Text>}
                {emissor.cidade && <Text style={styles.infoValue}>{emissor.cidade}{emissor.cep ? ` - ${emissor.cep}` : ''}</Text>}
              </>
            ) : (
              <Text style={styles.infoValue}>Dados do pagador não disponíveis</Text>
            )}
          </View>

          {/* Recebedor – always shown for pagamento */}
          <View style={{ ...styles.infoColumn, flex: 1.5 }}>
            <Text style={styles.infoLabel}>RECEBEDOR</Text>
            <Text style={styles.infoValueBold}>{data.receiver_name || '—'}</Text>
            {data.receiver_document && (
              <Text style={styles.infoValue}>CPF/CNPJ: {formatDocumento(data.receiver_document)}</Text>
            )}
            {data.receiver_address && (
              <Text style={styles.infoValue}>{data.receiver_address}</Text>
            )}
            {data.receiver_city && (
              <Text style={styles.infoValue}>
                {data.receiver_city}{data.receiver_uf ? ` - ${data.receiver_uf}` : ''}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.separator} />

        {/* Descrição */}
        <View style={styles.descriptionHeader}>
          <Text style={styles.descriptionHeaderText}>DESCRIÇÃO</Text>
        </View>
        <View style={{ flexDirection: 'row' }}>
          <View style={{ ...styles.descriptionContent, flex: 1 }}>
            <Text style={styles.descriptionText}>{data.service_description || '—'}</Text>
          </View>
          <View style={{ alignItems: 'flex-end', paddingLeft: 10 }}>
            <View style={styles.totalBox}>
              <Text style={styles.totalLabel}>TOTAL</Text>
              <Text style={styles.totalValue}>{formatCurrency(data.valor)}</Text>
            </View>
          </View>
        </View>

        {/* Disclaimer */}
        <View style={{ marginTop: 15, marginBottom: 15 }}>
          <Text style={{ fontSize: 8, color: '#374151', lineHeight: 1.6, fontStyle: 'italic' }}>
            {disclaimerPagamento}
          </Text>
        </View>

        <SignatureBlock />
      </Page>
    </Document>
  );
};