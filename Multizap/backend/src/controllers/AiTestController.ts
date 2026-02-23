// src/controllers/AiTestController.ts
import { Request, Response } from "express";
import AppError from "../errors/AppError";
import logger from "../utils/logger";
import OpenAI from "openai";
import axios from "axios";

const ALLOWED_MODELS = ["gpt-4.1-mini", "gpt-4o", "gemini-2.0-flash"];

class AiTestController {
  public async handle(req: Request, res: Response): Promise<Response> {
    try {
      const {
        model,
        apiKey,
        prompt,
        message,
        temperature = 1,
        maxTokens = 100
      } = req.body;

      if (!model || !apiKey || !prompt || !message) {
        throw new AppError("Dados incompletos para teste de prompt.", 400);
      }

      if (!ALLOWED_MODELS.includes(model)) {
        throw new AppError("Modelo não suportado para teste de prompt.", 400);
      }

      let answer = "";

      // 🔹 OpenAI (GPT 4.1 Mini / GPT 4o)
      if (model === "gpt-4.1-mini" || model === "gpt-4o") {
        const client = new OpenAI({ apiKey });

        // Usando o endpoint /responses (nova API)
        const response: any = await client.responses.create({
          model,
          input: [
            { role: "system", content: prompt },
            { role: "user", content: message }
          ],
          max_output_tokens: Number(maxTokens) || 100,
          temperature: Number(temperature) ?? 1
        });

        const output = response?.output?.[0]?.content;

        if (Array.isArray(output) && output.length > 0) {
          const textPart =
            output.find(
              (p: any) => p.type === "output_text" || p.type === "text"
            ) || output[0];

          if (textPart?.text) {
            answer = textPart.text;
          }
        }

        // fallback para formato antigo (caso mude algo na lib)
        if (!answer && response?.choices?.[0]?.message?.content) {
          answer = response.choices[0].message.content;
        }
      }

      // 🔹 Gemini 2.0 Flash
      if (model === "gemini-2.0-flash") {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const { data } = await axios.post(url, {
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `${prompt}\n\nUsuário: ${message}`
                }
              ]
            }
          ],
          generationConfig: {
            temperature: Number(temperature) ?? 1,
            maxOutputTokens: Number(maxTokens) || 100
          }
        });

        answer =
          data?.candidates?.[0]?.content?.parts?.[0]?.text ||
          JSON.stringify(data, null, 2);
      }

      if (!answer) {
        answer = "Não foi possível extrair a resposta do modelo.";
      }

      return res.json({ answer });
    } catch (err: any) {
      logger.error("Erro em AiTestController", {
        message: err?.message,
        stack: err?.stack,
        response: err?.response?.data
      });

      // Se já for AppError, respeita o status
      if (err instanceof AppError) {
        return res.status(err.statusCode).json({ error: err.message });
      }

      return res.status(500).json({
        error: "Erro ao testar prompt.",
        message: err?.message || "Erro interno no teste de prompt."
      });
    }
  }
}

export default new AiTestController();
