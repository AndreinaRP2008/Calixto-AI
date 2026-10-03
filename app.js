const messagesEl=document.getElementById("messages");
const input=document.getElementById("messageInput");
const composer=document.getElementById("composer");
const sendBtn=document.getElementById("sendBtn");
const thinking=document.getElementById("thinking");
const statusEl=document.getElementById("status");
const settingsBtn=document.getElementById("settingsBtn");
const dialog=document.getElementById("settingsDialog");
const settingsForm=document.getElementById("settingsForm");
const apiInput=document.getElementById("apiUrl");
const clearConfig=document.getElementById("clearConfig");
const settingsNote=document.getElementById("settingsNote");

const STORAGE_KEY="calixto_api_url";
const DEFAULT_API_URL="https://ai-calixto.g17346900.workers.dev";
const USER_KEY="calixto_user_id";
const CONVERSATION_KEY="calixto_conversation_id";

const OLLAMA_API_URL="http://127.0.0.1:11434/api/chat";
const OLLAMA_MODEL="calixto-hacker";

const HACKER_TRIGGERS=[
  "modo hacker",
  "activa modo hacker",
  "protocolo andreina",
  "calixto hacker"
];

const NORMAL_TRIGGERS=[
  "modo normal",
  "salir modo hacker",
  "desactiva modo hacker",
  "sal del modo hacker"
];

const apiUrl=()=>localStorage.getItem(STORAGE_KEY)||DEFAULT_API_URL;
const userId=()=>localStorage.getItem(USER_KEY)||"demo-user";

let conversationId=localStorage.getItem(CONVERSATION_KEY)||"default";
let mode="cloud";
let cloudHistory=[];
let localHistory=[];

function setStatus(online,text){
  statusEl.classList.toggle("offline",!online);
  statusEl.querySelector("span").style.background="";
  statusEl.lastChild.textContent=text;
}

function addMessage(role,text){
  const row=document.createElement("div");
  row.className=`message ${role}`;
  if(role==="assistant"){
    const avatar=document.createElement("div");
    avatar.className="message-avatar";
    avatar.textContent="C";
    row.appendChild(avatar);
  }
  const bubble=document.createElement("div");
  bubble.className="message-bubble";
  bubble.textContent=text;
  row.appendChild(bubble);
  messagesEl.appendChild(row);
  messagesEl.parentElement.scrollTo({
    top:messagesEl.parentElement.scrollHeight,
    behavior:"smooth"
  });
}

function setThinking(value){
  thinking.hidden=!value;
  sendBtn.disabled=value;
}

function resizeInput(){
  input.style.height="auto";
  input.style.height=Math.min(input.scrollHeight,170)+"px";
}

function openSettings(message=""){
  apiInput.value=apiUrl();
  settingsNote.textContent=message;
  dialog.showModal();
}

function saveUrl(){
  const value=apiInput.value.trim().replace(/\/$/,"");
  if(!value){
    localStorage.removeItem(STORAGE_KEY);
    return false;
  }
  try{
    new URL(value);
  }catch{
    settingsNote.textContent="Introduce una URL válida.";
    return false;
  }
  localStorage.setItem(STORAGE_KEY,value);
  return true;
}

async function healthCheck(){
  if(!apiUrl()){
    setStatus(false,"Configura la API");
    return;
  }
  try{
    const response=await fetch(apiUrl(),{method:"GET"});
    if(!response.ok) throw new Error();
    setStatus(true,"Conectado · Cloud");
  }catch{
    setStatus(false,"Sin conexión");
  }
}

function containsTrigger(text,triggers){
  const value=text.toLowerCase();
  return triggers.some(trigger=>value.includes(trigger));
}

function updateModeFromMessage(text){
  if(containsTrigger(text,NORMAL_TRIGGERS)){
    mode="cloud";
    setStatus(true,"Conectado · Cloud");
    return;
  }

  if(containsTrigger(text,HACKER_TRIGGERS)){
    mode="local";
    setStatus(true,"😼 Hacker · Local");
  }
}

async function sendToCloud(clean){
  const response=await fetch(apiUrl(),{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      message:clean,
      user_id:userId(),
      conversation_id:conversationId,
      history:cloudHistory.slice(-20)
    })
  });

  const data=await response.json().catch(()=>({}));

  if(!response.ok||!data.ok){
    throw new Error(data.error||"No se pudo obtener respuesta de Cloudflare.");
  }

  conversationId=data.conversation_id||conversationId;
  localStorage.setItem(CONVERSATION_KEY,conversationId);

  return data.reply||"No recibí una respuesta.";
}

async function sendToOllama(clean){
  const messages=[
    ...localHistory.slice(-20),
    {role:"user",content:clean}
  ];

  const response=await fetch(OLLAMA_API_URL,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      model:OLLAMA_MODEL,
      messages,
      stream:false
    })
  });

  const data=await response.json().catch(()=>({}));

  if(!response.ok){
    throw new Error(data.error||"Ollama no respondió.");
  }

  return data?.message?.content?.trim()||"Calixto Hacker no devolvió texto.";
}

async function sendMessage(text){
  const clean=text.trim();
  if(!clean) return;

  updateModeFromMessage(clean);

  if(mode==="cloud"&&!apiUrl()){
    openSettings("Primero conecta tu Worker.");
    return;
  }

  addMessage("user",clean);
  input.value="";
  resizeInput();
  setThinking(true);

  const activeHistory=mode==="local"?localHistory:cloudHistory;
  activeHistory.push({role:"user",content:clean});

  setStatus(true,mode==="local"?"😼 Hacker · Local":"Calixto está pensando...");

  try{
    let reply;

    if(mode==="local"){
      reply=await sendToOllama(clean);
    }else{
      reply=await sendToCloud(clean);
    }

    activeHistory.push({role:"assistant",content:reply});
    addMessage("assistant",reply);

    setStatus(
      true,
      mode==="local"?"😼 Hacker · Local":"Conectado · Cloud"
    );
  }catch(error){
    activeHistory.pop();

    const prefix=mode==="local"
      ? "No pude conectar con Calixto Hacker localmente."
      : "No pude conectar con el cerebro de Cloudflare.";

    addMessage(
      "assistant",
      `${prefix} ${error.message||""}`.trim()
    );

    setStatus(false,mode==="local"?"Hacker local · Error":"Error de conexión");
  }finally{
    setThinking(false);
    input.focus();
  }
}

composer.addEventListener("submit",e=>{
  e.preventDefault();
  sendMessage(input.value);
});

input.addEventListener("input",resizeInput);

input.addEventListener("keydown",e=>{
  if(e.key==="Enter"&&!e.shiftKey){
    e.preventDefault();
    composer.requestSubmit();
  }
});

settingsBtn.addEventListener("click",()=>openSettings());

clearConfig.addEventListener("click",()=>{
  localStorage.removeItem(STORAGE_KEY);
  setStatus(false,"Configurada por defecto");
  settingsNote.textContent="Se restauró la URL oficial del Worker.";
  apiInput.value=DEFAULT_API_URL;
  healthCheck();
});

settingsForm.addEventListener("submit",e=>{
  e.preventDefault();
  if(saveUrl()){
    dialog.close();
    healthCheck();
    input.focus();
  }
});

dialog.addEventListener("click",e=>{
  if(e.target===dialog) dialog.close();
});

healthCheck();
resizeInput();