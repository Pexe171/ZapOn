import fs from "fs";
import path from "path";
import FormData from "form-data";
import axios from "axios";
import Setting from "../../models/Setting";

interface Response {
  transcribedText: string;
}

class TranscribeAudioMessageService {
  public async execute(
    fileName: string,
    companyId: number
  ): Promise<Response | { error: string }> {
    // Validação dos parâmetros de entrada
    if (!fileName || typeof fileName !== "string") {
      return { error: "fileName é obrigatório e deve ser uma string." };
    }
    if (!companyId || typeof companyId !== "number") {
      return { error: "companyId é obrigatório e deve ser um número." };
    }

    // Construção e verificação do caminho do arquivo
    const publicFolder = path.resolve(__dirname, "..", "..", "..", "public");
    const filePath = `${publicFolder}/company${companyId}/${fileName}`;

    if (!fs.existsSync(filePath)) {
      console.error(`Arquivo não encontrado: ${filePath}`);
      return { error: "Arquivo não encontrado" };
    }

    // Busca da chave da API no banco de dados
    const transcriptionSetting = await Setting.findOne({
      where: { key: "apiTranscription", companyId }
    });

    const apiKey = transcriptionSetting?.value;

    // 🔒 IMPORTANTE: transcrição global do chat normal deve usar SOMENTE OpenAI
    // (para não conflitar com Gemini do FlowBuilder e para manter o pipeline estável)
    if (!apiKey) {
      console.error(
        `Chave da API não encontrada para apiTranscription e companyId: ${companyId}`
      );
      return { error: "Chave da API não configurada" };
    }

    if (!apiKey.startsWith("sk-")) {
      console.error(
        `apiTranscription deve ser uma chave OpenAI (sk-...). Valor recebido: ${String(apiKey).slice(0, 8)}... companyId=${companyId}`
      );
      return { error: "apiTranscription deve ser uma chave OpenAI válida (sk-...)." };
    }

    try {
      const audioFile = fs.createReadStream(filePath);

      // ✅ OpenAI Transcription (gpt-4o-transcribe)
      const form = new FormData();
      form.append("file", audioFile);
      form.append("model", "gpt-4o-transcribe");
      form.append("response_format", "text");
      form.append("language", "pt");

      const response = await axios.post(
        "https://api.openai.com/v1/audio/transcriptions",
        form,
        {
          headers: {
            ...form.getHeaders(),
            Authorization: `Bearer ${apiKey}`
          }
        }
      );

      // A API com response_format=text retorna uma string em response.data
      const text =
        typeof response.data === "string"
          ? response.data
          : String(response.data ?? "");

      return { transcribedText: text };
    } catch (error) {
      console.error(
        `Erro ao transcrever áudio para fileName: ${fileName}, companyId: ${companyId}`,
        error
      );
      return { error: "Conversão para texto falhou" };
    }
  }
}

export default TranscribeAudioMessageService;
