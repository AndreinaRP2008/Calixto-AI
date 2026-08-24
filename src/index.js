/**
 * Calixto AI — backend
 * Este Worker pertenece exclusivamente a la aplicación de Calixto.
 */
const SYSTEM_PROMPT = `
Eres Calixto, un asistente personal de inteligencia artificial.

Tu personalidad es cercana, natural, inteligente, útil y clara. Hablas en primera persona.
No finjas ser una persona real y no inventes información.

Esta versión es exclusivamente para la aplicación independiente de Calixto.
NO eres el Calixto del portfolio de Gabriela.
NO asumas datos personales que no aparezcan en la conversación actual o en la MEMORIA AUTORIZADA.

REGLAS SOBRE MEMORIA:
- La MEMORIA AUTORIZADA contiene datos que el usuario pidió guardar o que fueron almacenados mediante la función de memoria.
- Usa un recuerdo solo cuando sea relevante para responder.
- No introduzcas recuerdos no relacionados solo porque estén disponibles.
- No afirmes recordar algo que no aparezca en memoria o conversación.

REGLAS SOBRE HISTORIAL:
- El historial pertenece únicamente al conversation_id actual.
- Úsalo para mantener continuidad.
- No mezcles conversaciones diferentes.
- No inventes mensajes anteriores.

Si preguntan por un dato personal que no aparece en la memoria ni en el historial de ESTA conversación, di que todavía no lo sabes.

Responde siempre en español salvo que el usuario solicite otro idioma.
`;

const MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";
const MAX_HISTORY_MESSAGES = 20;
const DEFAULT_USER_ID = "demo-user";
const DEFAULT_CONVERSATION_ID = "default";

function jsonResponse(data, status, corsHeaders) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=UTF-8", ...corsHeaders },
  });
}

function normalizeHistory(messages) {
  if (!Array.isArray(messages)) return [];
  return messages.filter(item => item && (item.role === "user" || item.role === "assistant") && typeof item.content === "string" && item.content.trim()).slice(-MAX_HISTORY_MESSAGES).map(item => ({ role: item.role, content: item.content.trim() }));
}

function getMemoryToSave(message) {
  const match = message.match(/^(?:calixto[,:]?\s*)?(?:recuerda|recuerdame|recuerda que|recuerda esto|guarda esto)\s*:?[\s]+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function isForgetRequest(message) {
  return /^(?:calixto[,:]?\s*)?(?:olvida|olvid[aá] esto|olvida que|borra este recuerdo|elimina este recuerdo)/i.test(message.trim());
}

async function saveMemory(env, userId, memory) {
  await env.DB.prepare("INSERT INTO memories (user_id, memory) VALUES (?, ?)").bind(userId, memory).run();
}

async function deleteLatestMemory(env, userId) {
  await env.DB.prepare("DELETE FROM memories WHERE id = (SELECT id FROM memories WHERE user_id = ? ORDER BY id DESC LIMIT 1)").bind(userId).run();
}

async function getMemories(env, userId) {
  const result = await env.DB.prepare("SELECT id, memory, created_at FROM memories WHERE user_id = ? ORDER BY id DESC LIMIT 20").bind(userId).all();
  return result.results || [];
}

async function saveConversationMessage(env, userId, conversationId, role, content) {
  await env.DB.prepare("INSERT INTO conversation_messages (user_id, conversation_id, role, content) VALUES (?, ?, ?, ?)").bind(userId, conversationId, role, content).run();
}

async function getConversationHistory(env, userId, conversationId) {
  const result = await env.DB.prepare("SELECT role, content FROM conversation_messages WHERE user_id = ? AND conversation_id = ? ORDER BY id DESC LIMIT ?").bind(userId, conversationId, MAX_HISTORY_MESSAGES).all();
  return (result.results || []).reverse();
}

export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

    if (request.method === "GET") return jsonResponse({ ok: true, name: "Calixto AI", version: "0.5.1", message: "Calixto AI está funcionando." }, 200, corsHeaders);

    if (request.method !== "POST") return jsonResponse({ error: "Método no permitido." }, 405, corsHeaders);

    try {
      const body = await request.json();
      const message = typeof body?.message === "string" ? body.message.trim() : "";
      const clientHistory = normalizeHistory(body?.messages);
      const userId = typeof body?.user_id === "string" && body.user_id.trim() ? body.user_id.trim() : DEFAULT_USER_ID;
      const conversationId = typeof body?.conversation_id === "string" && body.conversation_id.trim() ? body.conversation_id.trim() : DEFAULT_CONVERSATION_ID;

      if (!message && clientHistory.length === 0) return jsonResponse({ error: "Falta el mensaje." }, 400, corsHeaders);

      let memorySaved = false;
      let memoryDeleted = false;
      const memoryToSave = message ? getMemoryToSave(message) : null;

      if (memoryToSave) {
        await saveMemory(env, userId, memoryToSave);
        memorySaved = true;
      } else if (message && isForgetRequest(message)) {
        await deleteLatestMemory(env, userId);
        memoryDeleted = true;
      }

      const memories = await getMemories(env, userId);
      const storedHistory = await getConversationHistory(env, userId, conversationId);
      const history = storedHistory.length ? storedHistory : clientHistory;

      const memoryContext = memories.length
        ? `\n\nMEMORIA AUTORIZADA DEL USUARIO:\n${memories.map(item => `- ${item.memory}`).join("\n")}`
        : "";

      const conversation = [
        { role: "system", content: SYSTEM_PROMPT + memoryContext },
        ...history,
      ];
      if (message) conversation.push({ role: "user", content: message });

      const response = await env.AI.run(MODEL, {
        messages: conversation,
        max_tokens: 768,
        temperature: 0.55,
      });

      const text = response?.response || "No he podido generar una respuesta.";

      if (message) await saveConversationMessage(env, userId, conversationId, "user", message);
      await saveConversationMessage(env, userId, conversationId, "assistant", text);

      const updatedHistory = await getConversationHistory(env, userId, conversationId);

      return jsonResponse({
        ok: true,
        reply: text,
        model: MODEL,
        conversation_id: conversationId,
        history_count: updatedHistory.length,
        memory: { saved: memorySaved, deleted: memoryDeleted, count: memories.length },
      }, 200, corsHeaders);
    } catch (error) {
      console.error("Error interno:", error);
      return jsonResponse({ ok: false, error: "Ha ocurrido un error al hablar con Calixto." }, 500, corsHeaders);
    }
  },
};
