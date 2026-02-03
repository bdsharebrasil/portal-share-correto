import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  Font,
} from '@react-pdf/renderer';
import { formatDateToBR } from './date-utils';

// Get logo URL - works on both server and client
const getLogoUrl = () => {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/logo.share.png`;
  }
  return '/logo.share.png';
};

const logoUrl = getLogoUrl();

// PDF Styles
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    backgroundColor: '#FFFFFF',
  },

  // Header Styles
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
    alignItems: 'flex-start',
    borderBottom: '2px solid #E5E7EB',
    paddingBottom: 20,
  },
  headerLeft: {
    flexDirection: 'column',
    justifyContent: 'center',
    flex: 1,
  },

  // Logo Style
  logoHeader: {
    width: 120,
    height: 50,
    objectFit: 'contain',
    marginBottom: 10,
  },

  reciboTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginTop: 5,
  },

  headerRight: {
    alignItems: 'flex-end',
    flex: 1,
  },

  label: {
    color: '#6B7280',
    fontSize: 8,
    marginBottom: 4,
    textTransform: 'uppercase',
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },

  valueBox: {
    border: '2px solid #000000',
    padding: 12,
    width: 180,
    alignItems: 'center',
    marginTop: 10,
  },

  valueText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
  },

  // Content Styles
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 25,
    marginBottom: 15,
    gap: 20,
  },

  column: {
    flex: 1,
    paddingRight: 10,
  },

  bold: {
    fontWeight: 'bold',
    fontSize: 11,
    marginBottom: 4,
    color: '#1F2937',
  },

  boldLabel: {
    fontWeight: 'bold',
    fontSize: 9,
    marginBottom: 3,
    color: '#1F2937',
  },

  text: {
    fontSize: 10,
    marginBottom: 3,
    color: '#374151',
    lineHeight: 1.4,
  },

  sectionHeader: {
    backgroundColor: '#F3F4F6',
    padding: 10,
    marginTop: 20,
    marginBottom: 10,
    fontWeight: 'bold',
    fontSize: 11,
    color: '#1F2937',
    borderLeft: '4px solid #3B82F6',
  },

  descriptionBox: {
    fontSize: 10,
    lineHeight: 1.6,
    minHeight: 80,
    padding: 10,
    backgroundColor: '#F9FAFB',
    border: '1px solid #E5E7EB',
    borderRadius: 4,
    marginTop: 10,
    marginBottom: 10,
    color: '#374151',
  },

  // Footer Styles
  footer: {
    marginTop: 50,
    borderTop: '1px solid #E5E7EB',
    paddingTop: 20,
  },

  disclaimer: {
    fontSize: 8,
    color: '#6B7280',
    fontStyle: 'italic',
    marginBottom: 20,
    lineHeight: 1.5,
  },

  signatureArea: {
    marginTop: 40,
    alignItems: 'center',
  },

  signatureLine: {
    width: 200,
    borderBottom: '1px solid #000000',
    marginBottom: 8,
    marginTop: 15,
  },

  signatureName: {
    fontWeight: 'bold',
    fontSize: 10,
    color: '#1F2937',
    marginTop: 5,
  },

  // Logo na Assinatura
  logoSignature: {
    width: 80,
    height: 32,
    objectFit: 'contain',
    marginTop: 15,
    opacity: 0.6,
  },

  // Info Box
  infoBox: {
    backgroundColor: '#EFF6FF',
    border: '1px solid #93C5FD',
    padding: 10,
    marginTop: 15,
    marginBottom: 15,
    borderRadius: 4,
  },

  infoBoxText: {
    fontSize: 9,
    color: '#1E40AF',
    lineHeight: 1.5,
  },

  // Separator
  separator: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 15,
  },

  // Data Grid
  dataGrid: {
    display: 'flex',
    flexDirection: 'row',
    marginVertical: 10,
    gap: 20,
  },

  dataItem: {
    flex: 1,
  },

  dataLabel: {
    fontSize: 8,
    color: '#6B7280',
    marginBottom: 2,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },

  dataValue: {
    fontSize: 10,
    color: '#1F2937',
    fontWeight: '500',
  },
});

// Receipt PDF Component
export const ReciboDocument = React.forwardRef(
  (props: { data: any }, ref) => {
    const { data } = props;

    const formatCurrency = (value: number) => {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(value);
    };

    const formatDocumento = (doc: string) => {
      // Format CPF/CNPJ
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

    return (
      <Document ref={ref}>
        <Page size="A4" style={styles.page}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Image
                src={logoUrl}
                style={styles.logoHeader}
                cache={false}
              />
              <Text style={styles.reciboTitle}>
                {isReembolso ? 'RECIBO DE REEMBOLSO' : 'RECIBO DE PAGAMENTO'}
              </Text>
            </View>

            <View style={styles.headerRight}>
              <Text style={styles.label}>Nº DO RECIBO</Text>
              <View style={styles.valueBox}>
                <Text style={styles.valueText}>{data.receipt_number}</Text>
              </View>
            </View>
          </View>

          {/* Data do Recibo */}
          <View style={styles.dataGrid}>
            <View style={styles.dataItem}>
              <Text style={styles.dataLabel}>Data de Emissão</Text>
              <Text style={styles.dataValue}>
                {formatDateToBR(data.issue_date)}
              </Text>
            </View>
            <View style={styles.dataItem}>
              <Text style={styles.dataLabel}>Data do Documento</Text>
              <Text style={styles.dataValue}>
                {data.max_payment_date
                  ? formatDateToBR(data.max_payment_date)
                  : '—'}
              </Text>
            </View>
          </View>

          <View style={styles.separator} />

          {/* Pagador / Beneficiário */}
          <Text style={styles.sectionHeader}>
            {isReembolso ? 'BENEFICIÁRIO' : 'PAGADOR'}
          </Text>

          <View style={styles.row}>
            <View style={styles.column}>
              <Text style={styles.boldLabel}>Nome/Razão Social</Text>
              <Text style={styles.text}>{data.payer_name}</Text>
            </View>
            <View style={styles.column}>
              <Text style={styles.boldLabel}>CPF/CNPJ</Text>
              <Text style={styles.text}>
                {data.payer_document
                  ? formatDocumento(data.payer_document)
                  : '—'}
              </Text>
            </View>
          </View>

          {data.payer_address && (
            <View style={styles.row}>
              <View style={styles.column}>
                <Text style={styles.boldLabel}>Endereço</Text>
                <Text style={styles.text}>{data.payer_address}</Text>
              </View>
              <View style={styles.column}>
                <Text style={styles.boldLabel}>Cidade/UF</Text>
                <Text style={styles.text}>
                  {data.payer_city} {data.payer_uf ? `- ${data.payer_uf}` : ''}
                </Text>
              </View>
            </View>
          )}

          <View style={styles.separator} />

          {/* Valor */}
          <View style={styles.row}>
            <View style={styles.column}>
              <Text style={styles.boldLabel}>Valor do Recibo</Text>
              <Text style={{ ...styles.text, fontSize: 16, fontWeight: 'bold', color: '#059669' }}>
                {formatCurrency(data.amount)}
              </Text>
            </View>
            <View style={styles.column}>
              <Text style={styles.boldLabel}>Forma de Pagamento</Text>
              <Text style={styles.text}>
                {data.payment_method || '—'}
              </Text>
            </View>
          </View>

          {/* Descrição do Serviço */}
          <Text style={styles.sectionHeader}>
            {isReembolso ? 'DESCRIÇÃO DO REEMBOLSO' : 'DESCRIÇÃO DO SERVIÇO'}
          </Text>
          <View style={styles.descriptionBox}>
            <Text style={styles.text}>{data.service_description}</Text>
          </View>

          {/* Reembolso Info */}
          {isReembolso && data.doc_number && (
            <View style={styles.infoBox}>
              <Text style={styles.infoBoxText}>
                <Text style={{ fontWeight: 'bold' }}>Nº do Documento: </Text>
                {data.doc_number}
              </Text>
            </View>
          )}

          {/* Info Box */}
          <View style={styles.infoBox}>
            <Text style={styles.infoBoxText}>
              Este recibo serve como comprovante de{' '}
              {isReembolso ? 'reembolso' : 'pagamento'} e deve ser conservado como
              documento de valor.
            </Text>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.disclaimer}>
              O presente recibo é emitido de acordo com a Lei nº 9.069/1995 e
              constitui prova de {isReembolso ? 'reembolso' : 'quitação'} do valor
              acima especificado. Sem emendas ou rasuras.
            </Text>

            <View style={styles.signatureArea}>
              <View style={styles.signatureLine} />
              <Text style={styles.signatureName}>
                {isReembolso ? 'Beneficiário' : 'Pagador'}
              </Text>

              <Image
                src={logoUrl}
                style={styles.logoSignature}
                cache={false}
              />
            </View>
          </View>
        </Page>
      </Document>
    );
  }
);

ReciboDocument.displayName = 'ReciboDocument';
