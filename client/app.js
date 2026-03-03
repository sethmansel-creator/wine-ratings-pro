const API_BASE = "https://wine-ratings-pro.onrender.com/api";

/* ===============================
   HELPERS
================================= */

function $(sel){ return document.querySelector(sel); }

function esc(s){
  return (s ?? "").toString()
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function sanitizeUrl(url){
  if(!url) return "";
  try{
    const u = new URL(url);
    return u.protocol === "https:" ? u.toString() : "";
  }catch{ return ""; }
}

function getToken(){ return localStorage.getItem("wr.token") || ""; }
function setToken(t){ localStorage.setItem("wr.token", t); }
function clearToken(){
  localStorage.removeItem("wr.token");
  localStorage.removeItem("wr.email");
}
function setEmail(e){ localStorage.setItem("wr.email", e); }
function getEmail(){ return localStorage.getItem("wr.email") || ""; }

/* ===============================
   TOAST SYSTEM
================================= */

function ensureToastWrap(){
  let wrap = document.querySelector(".toast-wrap");
  if(!wrap){
    wrap = document.createElement("div");
    wrap.className = "toast-wrap";
    document.body.appendChild(wrap);
  }
  return wrap;
}

function toast(type, title, msg, ms = 2600){
  const wrap = ensureToastWrap();
  const t = document.createElement("div");
  t.className = `toast ${type || ""}`.trim();
  t.innerHTML = `
    <div class="t-title">${esc(title || "")}</div>
    <div class="t-msg">${esc(msg || "")}</div>
  `;
  wrap.appendChild(t);

  setTimeout(() => {
    t.style.opacity = "0";
    t.style.transform = "translateY(-6px)";
    t.style.transition = "all 180ms ease";
    setTimeout(() => t.remove(), 200);
  }, ms);
}

/* ===============================
   API WRAPPER
================================= */

async function api(path, opts = {}){
  const headers = { "Content-Type":"application/json", ...(opts.headers||{}) };
  const token = getToken();
  if(token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });
  const ct = res.headers.get("content-type") || "";
  const body = ct.includes("application/json") ? await res.json() : await res.text();

  if(!res.ok){
    const msg = body?.error ? body.error : `Request failed: ${res.status}`;
    throw new Error(msg);
  }

  return body;
}

async function requireAuth(){
  if(!getToken()){
    location.href = "login.html";
    return false;
  }
  try{
    await api("/ratings");
    return true;
  }catch{
    clearToken();
    location.href = "login.html";
    return false;
  }
}

/* ===============================
   PREMIUM BOTTOM NAV
================================= */

function ensureBottomNav(){
  if(document.querySelector(".bottomnav")) return;

  const nav = document.createElement("nav");
  nav.className = "bottomnav";

  nav.innerHTML = `
    <a href="ratings.html" aria-label="My Ratings">
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M7 4h10M7 8h10M7 12h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        <path d="M6.5 2.8h11a2.2 2.2 0 0 1 2.2 2.2v14a2.2 2.2 0 0 1-2.2 2.2h-11A2.2 2.2 0 0 1 4.3 19V5a2.2 2.2 0 0 1 2.2-2.2Z" stroke="currentColor" stroke-width="1.8"/>
      </svg>
      <span>Ratings</span>
    </a>

    <a href="select.html" aria-label="Search">
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" stroke="currentColor" stroke-width="1.8"/>
        <path d="M16.7 16.7 21 21" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
      </svg>
      <span>Search</span>
    </a>

    <a class="add" href="add.html" aria-label="Add Rating">
      <div class="addbtn">
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
        </svg>
      </div>
      <span>Add</span>
    </a>

    <a href="public.html" aria-label="Public">
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" stroke="currentColor" stroke-width="1.8"/>
        <path d="M3 12h18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        <path d="M12 3c2.6 2.7 4.2 5.8 4.2 9S14.6 18.3 12 21c-2.6-2.7-4.2-5.8-4.2-9S9.4 5.7 12 3Z" stroke="currentColor" stroke-width="1.8"/>
      </svg>
      <span>Public</span>
    </a>

    <a href="login.html" aria-label="Account">
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M12 12a4.2 4.2 0 1 0-4.2-4.2A4.2 4.2 0 0 0 12 12Z" stroke="currentColor" stroke-width="1.8"/>
        <path d="M4.5 21a7.5 7.5 0 0 1 15 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
      </svg>
      <span>Account</span>
    </a>
  `;

  document.body.appendChild(nav);
}

function setActiveNav(){
  const page = document.body?.dataset?.page || "";
  const map = {
    login: "login.html",
    register: "register.html",
    ratings: "ratings.html",
    add: "add.html",
    select: "select.html",
    public: "public.html"
  };
  const current = map[page] || "";

  document.querySelectorAll(".bottomnav a").forEach(a=>{
    if(a.getAttribute("href") === current){
      a.classList.add("active");
    }
  });
}

/* ===============================
   PAGE INIT
================================= */

document.addEventListener("DOMContentLoaded", () => {
  ensureBottomNav();
  setActiveNav();
});