/**
 * Utilitário para conversão de HTML para PDF no cliente
 */

export async function convertHtmlToPdf(
  htmlContent: string,
  fileName: string
): Promise<Blob> {
  // Importar html2pdf dinamicamente para evitar bundle size
  const { default: html2pdf } = await import(
    "https://esm.sh/html2pdf.js@0.10.1"
  );

  return new Promise((resolve, reject) => {
    try {
      const element = document.createElement("div");
      element.innerHTML = htmlContent;
      element.style.display = "none";
      document.body.appendChild(element);

      const opt = {
        margin: 0,
        filename: fileName,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { format: "a4", orientation: "portrait" },
      };

      html2pdf()
        .set(opt)
        .from(element)
        .toPdf()
        .get("blob")
        .then((blob: Blob) => {
          document.body.removeChild(element);
          resolve(blob);
        })
        .catch((err: Error) => {
          document.body.removeChild(element);
          reject(err);
        });
    } catch (error) {
      reject(error);
    }
  });
}

export async function uploadPdfToStorage(
  supabase: any,
  pdfBlob: Blob,
  receiptId: string
): Promise<string> {
  const fileName = `recibos/${receiptId}_${Date.now()}.pdf`;

  const { error: uploadError } = await supabase.storage
    .from("receipts")
    .upload(fileName, pdfBlob, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage
    .from("receipts")
    .getPublicUrl(fileName);

  return urlData.publicUrl;
}
