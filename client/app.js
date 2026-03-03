// IMPORTANT: keep this pointing at your local server
const API_BASE = "http://localhost:8080/api";

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
    // Verify token by calling a protected endpoint
    await api("/ratings");
    return true;
  }catch{
    clearToken();
    location.href = "login.html";
    return false;
  }
}

function wireNav(){
  const who = $("#who");
  const logoutBtn = $("#logoutBtn");
  if(who) who.textContent = getToken() ? `Signed in: ${getEmail() || "user"}` : "Not signed in";
  if(logoutBtn){
    logoutBtn.addEventListener("click", () => {
      clearToken();
      location.href = "login.html";
    });
  }
}

// ---------- pages ----------
async function initLogin(){
  wireNav();
  // If already logged in, go straight to ratings
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

      // clear fields (fixes “text stays”)
      $("#email").value = "";
      $("#password").value = "";

      location.href = "ratings.html";
    }catch(err){
      alert(err.message);
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

      location.href = "ratings.html";
    }catch(err){
      alert(err.message);
    }
  });
}

async function initAdd(){
  wireNav();
  const ok = await requireAuth();
  if(!ok) return;

  // If select.html sent back a picked URL
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
        tags: $("#tags").value.split(",").map(s => s.trim()).filter(Boolean)
      };

      await api("/ratings", { method:"POST", body: JSON.stringify(payload) });

      // clear fields after save (fixes “text stays”)
      e.target.reset();
      $("#myScore").value = "8.0";
      $("#favorite").checked = false;

      location.href = "ratings.html";
    }catch(err){
      alert(err.message);
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
            <div style="font-weight:750">${fav}${esc(r.wine_name)}</div>
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
          await refresh();
        }catch(err){
          alert(err.message);
        }
      });
    });
  };

  await refresh();
}

function initSelect(){
  wireNav();
  $("#openSearch").addEventListener("click", () => {
    const q = $("#q").value.trim();
    if(!q) return alert("Type a wine name first.");
    const url = `https://www.wineenthusiast.com/?drink_type=wine&s=${encodeURIComponent(q)}&search_type=ratings`;
    window.open(url, "_blank", "noopener,noreferrer");
  });

  $("#useUrl").addEventListener("click", () => {
    const u = sanitizeUrl($("#pasteUrl").value.trim());
    if(!u) return alert("Paste a valid https:// URL.");
    location.href = `add.html?picked=${encodeURIComponent(u)}`;
  });

  // optional: clear field
  $("#clearBtn").addEventListener("click", () => {
    $("#q").value = "";
    $("#pasteUrl").value = "";
  });
}

// ---------- boot ----------
document.addEventListener("DOMContentLoaded", () => {
  const page = document.body?.dataset?.page;

  if(page === "login") initLogin();
  if(page === "register") initRegister();
  if(page === "add") initAdd();
  if(page === "ratings") initRatings();
  if(page === "select") initSelect();
});