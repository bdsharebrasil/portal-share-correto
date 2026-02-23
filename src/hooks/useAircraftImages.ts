import { supabase } from "@/integrations/supabase/client";

const AIRCRAFT_IMAGES_BUCKET = "flight-documents";
const AIRCRAFT_IMAGES_FOLDER = "aircraft-images";

export const useAircraftImages = () => {
  const uploadAircraftImage = async (aircraftId: string, file: File) => {
    try {
      // Gerar nome único para o arquivo
      const fileExt = file.name.split(".").pop();
      const fileName = `${aircraftId}-${Date.now()}.${fileExt}`;
      const filePath = `${AIRCRAFT_IMAGES_FOLDER}/${fileName}`;

      // Upload para o bucket flight-documents
      const { error: uploadError } = await supabase.storage
        .from(AIRCRAFT_IMAGES_BUCKET)
        .upload(filePath, file, { upsert: false });

      if (uploadError) throw uploadError;

      // Obter URL pública
      const { data: urlData } = supabase.storage
        .from(AIRCRAFT_IMAGES_BUCKET)
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;

      // Salvar URL da imagem no banco de dados
      const { error: updateError } = await supabase
        .from("aircraft")
        .update({ image_url: publicUrl })
        .eq("id", aircraftId);

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

  const deleteAircraftImage = async (aircraftId: string, filePath: string) => {
    try {
      // Remover do storage
      const { error: storageError } = await supabase.storage
        .from(AIRCRAFT_IMAGES_BUCKET)
        .remove([filePath]);

      if (storageError) throw storageError;

      // Remover URL do banco de dados
      const { error: updateError } = await supabase
        .from("aircraft")
        .update({ image_url: null })
        .eq("id", aircraftId);

      if (updateError) throw updateError;

      return { success: true };
    } catch (error) {
      console.error("Erro ao deletar imagem:", error);
      throw error;
    }
  };

  return {
    uploadAircraftImage,
    deleteAircraftImage,
  };
};
