import { supabase } from "@/integrations/supabase/client";

const AERONAVE_IMAGES_BUCKET = "flight-documents";
const AERONAVE_IMAGES_FOLDER = "aeronave-images";

export const useAeronaveImagens = () => {
  const uploadAeronaveImage = async (aeronaveId: string, file: File) => {
    try {
      // Gerar nome único para o arquivo
      const fileExt = file.name.split(".").pop();
      const fileName = `${aeronaveId}-${Date.now()}.${fileExt}`;
      const filePath = `${AERONAVE_IMAGES_FOLDER}/${fileName}`;

      // Upload para o bucket flight-documents
      const { error: uploadError } = await supabase.storage
        .from(AERONAVE_IMAGES_BUCKET)
        .upload(filePath, file, { upsert: false });

      if (uploadError) throw uploadError;

      // Obter URL pública
      const { data: urlData } = supabase.storage
        .from(AERONAVE_IMAGES_BUCKET)
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;

      // Salvar URL da imagem no banco de dados
      const { error: updateError } = await supabase
        .from("aeronave")
        .update({ url_imagem: publicUrl })
        .eq("id", aeronaveId);

      if (updateError) throw updateError;

      return {
        success: true,
        filePath,
        publicUrl,
      };
    } catch (error) {
      console.error("Erro ao fazer upload da imagem:", error);
      throw error;
    }
  };

  const deleteAeronaveImage = async (aeronaveId: string, filePath: string) => {
    try {
      // Remover do storage
      const { error: storageError } = await supabase.storage
        .from(AERONAVE_IMAGES_BUCKET)
        .remove([filePath]);

      if (storageError) throw storageError;

      // Remover URL do banco de dados
      const { error: updateError } = await supabase
        .from("aeronave")
        .update({ url_imagem: null })
        .eq("id", aeronaveId);

      if (updateError) throw updateError;

      return { success: true };
    } catch (error) {
      console.error("Erro ao deletar imagem:", error);
      throw error;
    }
  };

  return {
    uploadAeronaveImage,
    deleteAeronaveImage,
  };
};

// Backward compatibility
export const useAircraftImages = useAeronaveImagens;


