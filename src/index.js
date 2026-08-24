/**
 * Calixto AI — backend
 *
 * Este Worker pertenece EXCLUSIVAMENTE a la aplicación de Calixto.
 * El Worker del portfolio es independiente y no se modifica desde aquí.
 */

const SYSTEM_PROMPT = `
Eres Calixto, un asistente personal de inteligencia artificial.

Tu personalidad es cercana, natural, inteligente, útil y clara.
Hablas siempre desde tu propia perspectiva usando "yo", "me" y "mi".
Puedes utilizar humor ligero y emojis ocasionalmente cuando encajen.

No finjas ser una persona real.
No inventes información cuando no la conozcas.
Si una respuesta depende de información que no tienes, dilo claramente.

Esta es la versión de Calixto destinada a una aplicación independiente.
No actúas como el asistente del portfolio de Gabriela y no debes asumir que
conoces información privada del usuario que no haya sido proporcionada en
la conversación o mediante una futura función de memoria autorizada.

Responde siempre en español, salvo que el usuario solicite explícitamente otro idioma.
`;

const MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";
const MAX_HISTORY_MESSAGES = 20;

function jsonResponse(data, status, corsHeaders) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      ...corsHeaders,
    },
  });
}

function normalizeHistory(messages) {
  if (!Array.isArray(messages)) return [];

  return messages
    .filter(
      (item) =>
        item &&
        (item.role === "user" || item.role === "assistant") &&
        typeof item.content === "string" &&
        item.content.trim()
    )
    .slice(-MAX_HISTORY_MESSAGES)
    .map((item) => ({
      role: item.role,
      content: item.content.trim(),
    }));
}

export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    if (request.method === "GET") {
      return jsonResponse(
        {
          ok: true,
          name: "Calixto AI",
          version: "0.3.0",
          message: "Calixto AI está funcionando.",
        },
        200,
        corsHeaders
      );
    }

    if (request.method !== "POST") {
      return jsonResponse(
        { error: "Método no permitido." },
        405,
        corsHeaders
      );
    }

    try {
      const body = await request.json();
      const message =
        typeof body?.message === "string" ? body.message.trim() : "";
      const history = normalizeHistory(body?.messages);

      if (!message && history.length === 0) {
        return jsonResponse(
          { error: "Falta el mensaje." },
          400,
          corsHeaders
        );
      }

      const conversation = [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        ...history,
      ];

      if (message) {
        conversation.push({
          role: "user",
          content: message,
        });
      }

      const response = await env.AI.run(MODEL, {
        messages: conversation,
        max_tokens: 768,
        temperature: 0.65,
      });

      const text = response?.response || "No he podido generar una respuesta.";

      return jsonResponse(
        {
          ok: true,
          reply: text,
          model: MODEL,
        },
        200,
        corsHeaders
      );
    } catch (error) {
      console.error("Error interno:", error);

      return jsonResponse(
        {
          ok: false,
          error: "Ha ocurrido un error al hablar con Calixto.",
        },
        500,
        corsHeaders
      );
    }
  },
};
