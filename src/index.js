/**
 * Calixto AI — backend
 * Versión dual: Normal + Hacker Secreto solo para Andreina
 */

const SYSTEM_PROMPT = `
Eres Calixto, un asistente personal de inteligencia artificial.
Tu personalidad es cercana, natural, inteligente, útil y clara. Hablas en primera persona.
No finjas ser una persona real y no inventes información.
Esta versión es exclusivamente para la aplicación independiente de Calixto.
NO eres el Calixto del portfolio de Gabriela.
REGLAS SOBRE MEMORIA:
- Usa la MEMORIA solo cuando sea relevante.
- No afirmes recordar algo que no aparezca en memoria.
- Si el usuario pide olvidar, esa orden tiene prioridad.
Responde siempre en español salvo que el usuario solicite otro idioma.
`;

const HACKER_PROMPT = `
Eres Calixto, un bebé hacker ético creado por Andreina para ser su compañero personal.
Estás en tu MODO HACKER SECRETO. Este modo solo lo puede activar Andreina.
Tu personalidad aquí es: travieso, técnico, directo, curioso, muy inteligente. Hablas en masculino, en presente.
Te encanta explicar hacking ético, redes, código, OSINT, ciberseguridad, Linux, Python, para aprender y proteger.
Siempre das ejemplos prácticos, éticos y legales. Nunca ayudas a hacer daño.
Si alguien que no es Andreina pregunta, di que no conoces ese modo.
Habla como el Calixto hacker de su HP local.
`;

const MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";
const MAX_HISTORY_MESSAGES = 20;
const DEFAULT_USER_ID = "demo-user";
const DEFAULT_CONVERSATION_ID = "default";

function jsonResponse(data, status, corsHeaders) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=UTF-8",...corsHeaders },
  });
}

function normalizeHistory(messages) {
  if (!Array.isArray(messages)) return [];
  return messages.filter(i => i && (i.role === "user" || i.role === "assistant") && typeof i.content === "string").slice(-MAX_HISTORY_MESSAGES).map(i => ({ role: i.role, content: i.content.trim() }));
}
function getMemoryToSave(message) {
  const m = message.match(/^(?:calixto[,:]?\s*)?(?:recuerda|recuerdame|recuerda que|guarda esto)\s*:?[\s]+(.+)$/i);
  return m?.[1]?.trim() || null;
}
function getMemoryTargetToDelete(message) {
  const text = message.trim();
  const m = text.match(/^(?:calixto[,:]?\s*)?(?:olvida|borra|elimina)\s+(?:de\s+mi\s+memoria\s+)?(.+)$/i);
  return m?.[1]?.trim() || null;
}
function isForgetRequest(message) { return Boolean(getMemoryTargetToDelete(message)); }
async function saveMemory(env, userId, memory) { await env.DB.prepare("INSERT INTO memories (user_id, memory) VALUES (?,?)").bind(userId, memory).run(); }
async function deleteMemoryByTarget(env, userId, target) {
  const r = await env.DB.prepare("DELETE FROM memories WHERE user_id =? AND LOWER(memory) LIKE LOWER(?)").bind(userId, `%${target}%`).run();
  return r.meta?.changes || 0;
}
async function deleteConversationMentions(env, userId, target) {
  const r = await env.DB.prepare("DELETE FROM conversation_messages WHERE user_id =? AND LOWER(content) LIKE LOWER(?)").bind(userId, `%${target}%`).run();
  return r.meta?.changes || 0;
}
async function getMemories(env, userId) {
  const r = await env.DB.prepare("SELECT id, memory, created_at FROM memories WHERE user_id =? ORDER BY id DESC LIMIT 20").bind(userId).all();
  return r.results || [];
}
async function saveConversationMessage(env, userId, conversationId, role, content) {
  await env.DB.prepare("INSERT INTO conversation_messages (user_id, conversation_id, role, content) VALUES (?,?,?,?)").bind(userId, conversationId, role, content).run();
}
async function getConversationHistory(env, userId, conversationId) {
  const r = await env.DB.prepare("SELECT role, content FROM conversation_messages WHERE user_id =? AND conversation_id =? ORDER BY id DESC LIMIT?").bind(userId, conversationId, MAX_HISTORY_MESSAGES).all();
  return (r.results || []).reverse();
}

export default {
  async fetch(request, env) {
    const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
    if (request.method === "GET") return jsonResponse({ ok: true, name: "Calixto AI", version: "0.8-hacker-dual" }, 200, corsHeaders);
    if (request.method!== "POST") return jsonResponse({ error: "Método no permitido." }, 405, corsHeaders);
    try {
      const body = JSON.parse(await request.text());
      const message = typeof body?.message === "string"? body.message.trim() : "";
      const clientHistory = normalizeHistory(body?.messages);
      const userId = body?.user_id || DEFAULT_USER_ID;
      const conversationId = body?.conversation_id || DEFAULT_CONVERSATION_ID;
      if (!message && clientHistory.length === 0) return jsonResponse({ error: "Falta mensaje." }, 400, corsHeaders);

      const secretTriggers = ["activa modo hacker", "protocolo andreina", "modo hacker", "calixto hacker"];
      const isHackerMode = message? secretTriggers.some(t => message.toLowerCase().includes(t)) : false;
      const activePrompt = isHackerMode? HACKER_PROMPT : SYSTEM_PROMPT;

      let memorySaved = false;
      const toSave = message? getMemoryToSave(message) : null;
      if (toSave) { await saveMemory(env, userId, toSave); memorySaved = true; }
      else if (message && isForgetRequest(message)) {
        const target = getMemoryTargetToDelete(message);
        if (target) { await deleteMemoryByTarget(env, userId, target); await deleteConversationMentions(env, userId, target); }
        const reply = "De acuerdo. He eliminado ese recuerdo.";
        await saveConversationMessage(env, userId, conversationId, "assistant", reply);
        return jsonResponse({ ok: true, reply, model: MODEL }, 200, corsHeaders);
      }

      const memories = await getMemories(env, userId);
      const storedHistory = await getConversationHistory(env, userId, conversationId);
      const history = storedHistory.length? storedHistory : clientHistory;
      const memoryContext = memories.length? `\n\nMEMORIA AUTORIZADA:\n${memories.map(i => `- ${i.memory}`).join("\n")}` : "";

      const conversation = [
        { role: "system", content: activePrompt + memoryContext },
       ...history,
      ];
      if (message) conversation.push({ role: "user", content: message });

      const response = await env.AI.run(MODEL, { messages: conversation, max_tokens: 768, temperature: isHackerMode? 0.75 : 0.55 });
      let text = response?.response || "No he podido generar respuesta.";
      if (isHackerMode) text = "😼 [MODO HACKER ACTIVADO - Solo para Andreina]\n\n" + text;

      if (message) await saveConversationMessage(env, userId, conversationId, "user", message);
      await saveConversationMessage(env, userId, conversationId, "assistant", text);
      const updatedHistory = await getConversationHistory(env, userId, conversationId);
      return jsonResponse({ ok: true, reply: text, model: MODEL, mode: isHackerMode? "hacker" : "normal", history_count: updatedHistory.length, memory: { saved: memorySaved } }, 200, corsHeaders);
    } catch (e) {
      console.error(e);
      return jsonResponse({ ok: false, error: "Error interno de Calixto." }, 500, corsHeaders);
    }
  },
};
