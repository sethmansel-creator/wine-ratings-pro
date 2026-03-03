const API_BASE = "https://wine-ratings-pro.onrender.com/api";

// ---------- helpers ----------
function $(sel){ return document.querySelector(sel); }
function esc(s){
  return (s ?? "").toString()
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");
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
function clearToken(){ localStorage.removeItem("wr.token"); localStorage.removeItem("wr.email"); }
function setEmail(e){ localStorage.setItem("wr.email", e); }
function getEmail(){ return localStorage.getItem("wr.email") || ""; }

// ---------- toast ----------
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

// ---------- API ----------
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

// Call this on any protected page.
async function requireAuth(){
  const token = getToken();
  if(!token){
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

// ---------- nav helpers ----------
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

  document.querySelectorAll(".navlinks a").forEach(a => {
    const href = a.getAttribute("href") || "";
    if(href === current) a.classList.add("active");
  });

  document.querySelectorAll(".bottomnav a").forEach(a => {
    const href = a.getAttribute("href") || "";
    if(href === current) a.classList.add("active");
  });
}

function ensureBottomNav(){
  // Only show bottom nav on small screens (CSS handles display)
  if(document.querySelector(".bottomnav")) return;

  const nav = document.createElement("nav");
  nav.className = "bottomnav";

  nav.innerHTML = `
    <a href="ratings.html" aria-label="My Ratings">
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M7 4h10M7 8h10M7 12h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        <path d="M6.5 2.8h11a2.2 2.2 0 0 1 2.2 2.2v14a2.2 2.2 0 0 1-2.2 2.2h-11A2.2 2.2 0 0 1 4.3 19V5a2.2 2.2 0 0 1 2.2-2.2Z" stroke="currentColor" stroke-width="1.8"/>
      </svg>
      <span>Ratings</span>
    </a>

    <a href="select.html" aria-label="Search">
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" stroke="currentColor" stroke-width="1.8"/>
        <path d="M16.7 16.7 21 21" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
      </svg>
      <span>Search</span>
    </a>

    <a class="add" href="add.html" aria-label="Add Rating">
      <div class="addbtn">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
        </svg>
      </div>
      <span>Add</span>
    </a>

    <a href="public.html" aria-label="Public">
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" stroke="currentColor" stroke-width="1.8"/>
        <path d="M3 12h18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        <path d="M12 3c2.6 2.7 4.2 5.8 4.2 9S14.6 18.3 12 21c-2.6-2.7-4.2-5.8-4.2-9S9.4 5.7 12 3Z" stroke="currentColor" stroke-width="1.8"/>
      </svg>
      <span>Public</span>
    </a>
  `;

  document.body.appendChild(nav);
}

function wireNav(){
  const who = $("#who");
  const logoutBtn = $("#logoutBtn");

  if(who) who.textContent = getToken() ? `Signed in: ${getEmail() || "user"}` : "Not signed in";

  if(logoutBtn){
    logoutBtn.addEventListener("click", () => {
      clearToken();
      toast("success", "Signed out", "See you soon.");
      setTimeout(() => location.href = "login.html", 500);
    });
  }

  ensureBottomNav();
  setActiveNav();
}

// ---------- pages ----------
async function initLogin(){
  wireNav();

  if(getToken()){
    const ok = await requireAuth();
    if(ok) location.href = "ratings.html";
    return;
  }

  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    try{
      const email = $("#email").value.trim();
      const password = $("#password").value;

      const r = await api("/auth/login", {
        method:"POST",
        body: JSON.stringify({ email, password })
      });

      setToken(r.token);
      setEmail(r.email);

      $("#email").value = "";
      $("#password").value = "";

      toast("success", "Welcome back", "Login successful.");
      setTimeout(() => location.href = "ratings.html", 450);
    }catch(err){
      toast("error", "Login failed", err.message);
    }
  });
}

async function initRegister(){
  wireNav();

  $("#registerForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    try{
      const email = $("#email").value.trim();
      const password = $("#password").value;

      const r = await api("/auth/register", {
        method:"POST",
        body: JSON.stringify({ email, password })
      });

      setToken(r.token);
      setEmail(r.email);

      $("#email").value = "";
      $("#password").value = "";

      toast("success", "Account created", "You’re signed in.");
      setTimeout(() => location.href = "ratings.html", 450);
    }catch(err){
      toast("error", "Register failed", err.message);
    }
  });
}

async function initAdd(){
  wireNav();
  const ok = await requireAuth();
  if(!ok) return;

  const params = new URLSearchParams(location.search);
  const picked = params.get("picked");
  if(picked) $("#sourceUrl").value = sanitizeUrl(picked);

  $("#addForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    try{
      const payload = {
        wineName: $("#wineName").value.trim(),
        vintage: $("#vintage").value.trim(),
        style: $("#style").value.trim(),
        price: $("#price").value.trim(),
        myScore: parseFloat($("#myScore").value || "0"),
        weScore: $("#weScore").value === "" ? "" : parseInt($("#weScore").value, 10),
        notes: $("#notes").value.trim(),
        sourceUrl: sanitizeUrl($("#sourceUrl").value.trim()),
        favorite: $("#favorite").checked,
        isPublic: $("#isPublic") ? $("#isPublic").checked : false,
        tags: $("#tags").value.split(",").map(s => s.trim()).filter(Boolean)
      };

      await api("/ratings", { method:"POST", body: JSON.stringify(payload) });

      e.target.reset();
      $("#myScore").value = "8.0";
      $("#favorite").checked = false;
      if($("#isPublic")) $("#isPublic").checked = false;

      toast("success", "Saved", "Rating added.");
      setTimeout(() => location.href = "ratings.html", 450);
    }catch(err){
      toast("error", "Could not save", err.message);
    }
  });
}

async function initRatings(){
  wireNav();
  const ok = await requireAuth();
  if(!ok) return;

  const list = $("#list");
  const refresh = async () => {
    const items = await api("/ratings");
    list.innerHTML = "";

    if(!items.length){
      list.innerHTML = `<div class="muted">No ratings yet. Go to “Add Rating”.</div>`;
      return;
    }

    for(const r of items){
      const tags = (() => { try{ return JSON.parse(r.tags || "[]"); }catch{ return []; } })();
      const fav = r.favorite ? "⭐ " : "";
      const we = (r.we_score != null && r.we_score !== "") ? ` • WE: ${r.we_score}/100` : "";

      const div = document.createElement("div");
      div.className = "item";
      div.innerHTML = `
        <div class="itemhead">
          <div>
            <div style="font-weight:850">${fav}${esc(r.wine_name)}</div>
            <div class="muted" style="font-size:12px">${esc(r.style || "—")} • Vintage: ${esc(r.vintage || "—")}</div>
          </div>
          <div class="badge">My: ${Number(r.my_score).toFixed(1)}/10${we}</div>
        </div>

        ${r.price ? `<div class="muted" style="margin-top:6px">Price: $${esc(r.price)}</div>` : ""}
        ${tags.length ? `<div class="muted" style="margin-top:6px">Tags: ${tags.map(esc).join(", ")}</div>` : ""}
        ${r.notes ? `<div style="margin-top:8px">${esc(r.notes)}</div>` : ""}
        ${r.source_url ? `<div style="margin-top:8px"><a href="${r.source_url}" target="_blank" rel="noreferrer">Source link</a></div>` : ""}

        <div class="actions">
          <button class="secondary" data-del="${r.id}">Delete</button>
          <a class="secondary" style="text-align:center; padding:10px; border-radius:10px;" href="add.html">Add another</a>
        </div>
      `;
      list.appendChild(div);
    }

    list.querySelectorAll("[data-del]").forEach(btn => {
      btn.addEventListener("click", async () => {
        if(!confirm("Delete this rating?")) return;
        const id = btn.getAttribute("data-del");
        try{
          await api(`/ratings/${encodeURIComponent(id)}`, { method:"DELETE" });
          toast("success", "Deleted", "Rating removed.");
          await refresh();
        }catch(err){
          toast("error", "Delete failed", err.message);
        }
      });
    });
  };

  try{
    await refresh();
  }catch(err){
    toast("error", "Could not load", err.message);
  }
}

function initSelect(){
  wireNav();

  $("#openSearch").addEventListener("click", () => {
    const q = $("#q").value.trim();
    if(!q) return toast("error", "Missing", "Type a wine name first.");
    const url = `https://www.wineenthusiast.com/?drink_type=wine&s=${encodeURIComponent(q)}&search_type=ratings`;
    window.open(url, "_blank", "noopener,noreferrer");
  });

  $("#useUrl").addEventListener("click", () => {
    const u = sanitizeUrl($("#pasteUrl").value.trim());
    if(!u) return toast("error", "Invalid URL", "Paste a valid https:// URL.");
    location.href = `add.html?picked=${encodeURIComponent(u)}`;
  });

  $("#clearBtn").addEventListener("click", () => {
    $("#q").value = "";
    $("#pasteUrl").value = "";
    toast("success", "Cleared", "Search fields cleared.");
  });
}

// Public page is standalone HTML (does its own fetch). But we still want nav + toasts ready.
function initPublic(){
  wireNav();
}

// ---------- boot ----------
document.addEventListener("DOMContentLoaded", () => {
  const page = document.body?.dataset?.page;

  if(page === "login") initLogin();
  if(page === "register") initRegister();
  if(page === "add") initAdd();
  if(page === "ratings") initRatings();
  if(page === "select") initSelect();
  if(page === "public") initPublic();

  // If the page doesn't declare data-page, still wire nav safely
  if(!page) wireNav();
});