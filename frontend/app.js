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
const USER_KEY="calixto_user_id";
const CONVERSATION_KEY="calixto_conversation_id";

const apiUrl=()=>localStorage.getItem(STORAGE_KEY)||"";
const userId=()=>localStorage.getItem(USER_KEY)||"demo-user";

let conversationId=localStorage.getItem(CONVERSATION_KEY)||"default";
let history=[];

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
  messagesEl.parentElement.scrollTo({top:messagesEl.parentElement.scrollHeight,behavior:"smooth"});
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
  if(!value){ localStorage.removeItem(STORAGE_KEY); return false; }
  try{ new URL(value); }catch{ settingsNote.textContent="Introduce una URL válida."; return false; }
  localStorage.setItem(STORAGE_KEY,value);
  return true;
}
async function healthCheck(){
  if(!apiUrl()){setStatus(false,"Configura la API");return}
  try{
    const response=await fetch(apiUrl(),{method:"GET"});
    if(!response.ok) throw new Error();
    setStatus(true,"Conectado");
  }catch{setStatus(false,"Sin conexión")}
}
async function sendMessage(text){
  const clean=text.trim();
  if(!clean||!apiUrl()) { if(!apiUrl()) openSettings("Primero conecta tu Worker."); return; }
  addMessage("user",clean);
  history.push({role:"user",content:clean});
  input.value=""; resizeInput(); setThinking(true); setStatus(true,"Calixto está pensando...");
  try{
    const response=await fetch(apiUrl(),{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        message:clean,
        user_id:userId(),
        conversation_id:conversationId,
        history:history.slice(-20)
      })
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok||!data.ok) throw new Error(data.error||"No se pudo obtener respuesta.");
    conversationId=data.conversation_id||conversationId;
    localStorage.setItem(CONVERSATION_KEY,conversationId);
    const reply=data.reply||"No recibí una respuesta.";
    history.push({role:"assistant",content:reply});
    addMessage("assistant",reply);
    setStatus(true,"Conectado");
  }catch(error){
    history.pop();
    addMessage("assistant",`No pude conectar con mi cerebro ahora mismo. ${error.message||""}`.trim());
    setStatus(false,"Error de conexión");
  }finally{setThinking(false); input.focus();}
}
composer.addEventListener("submit",e=>{e.preventDefault();sendMessage(input.value)});
input.addEventListener("input",resizeInput);
input.addEventListener("keydown",e=>{
  if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();composer.requestSubmit();}
});
settingsBtn.addEventListener("click",()=>openSettings());
clearConfig.addEventListener("click",()=>{
  localStorage.removeItem(STORAGE_KEY);
  setStatus(false,"Configura la API");
  settingsNote.textContent="Conexión eliminada.";
  apiInput.value="";
});
settingsForm.addEventListener("submit",e=>{
  e.preventDefault();
  if(saveUrl()){dialog.close();healthCheck();input.focus();}
});
dialog.addEventListener("click",e=>{
  if(e.target===dialog)dialog.close();
});

if(apiUrl()) healthCheck(); else openSettings("Necesitamos la URL del Worker para empezar.");
resizeInput();
