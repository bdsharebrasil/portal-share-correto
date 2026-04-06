/**
 * Utilitário para conversão de HTML para PDF no cliente
 */

export async function convertHtmlToPdfViaApi(htmlContent: string): Promise<Blob> {
  // Usar uma API free de conversão HTML to PDF
  const response = await fetch("https://pdflayer.com/api/convert", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      api_key: "free",
      html: htmlContent,
      format: "A4",
      margin_bottom: "0",
      margin_top: "0",
      margin_left: "0",
      margin_right: "0",
    }).toString(),
  });

  if (!response.ok) {
    throw new Error(`Erro ao converter PDF: ${response.statusText}`);
  }

  return await response.blob();
}

export async function uploadPdfToStorage(
  supabase: any,
  pdfBlob: Blob,
  receiptId: string
): Promise<string> {
  const fileName = `recibos/${receiptId}_${Date.now()}.pdf`;

  const { error: uploadError } = await supabase.storage
    .from("recibos")
    .upload(fileName, pdfBlob, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage
    .from("recibos")
    .getPublicUrl(fileName);

  return urlData.publicUrl;
}
