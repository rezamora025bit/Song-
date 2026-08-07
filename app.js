/* ---------------- Data ---------------- */
const artistGenre = {
  "Isla Rae":"Pop", "Nordlys":"Electronic", "The Filament":"Hip-Hop",
  "Coral Drift":"R&B", "Mono Static":"Ambient"
};
const genreColors = {
  "Pop":"g4", "Electronic":"g3", "Hip-Hop":"g1", "R&B":"g5", "Ambient":"g2"
};
const tracks = [
  {id:1, title:"Static & Rain", artist:"Isla Rae", album:"Afterhours", dur:227, cover:"g1", tags:["rainy","melancholic","late-night"]},
  {id:2, title:"Coastal Standby", artist:"Nordlys", album:"Coastal Standby EP", dur:198, cover:"g3", tags:["chill","dreamy","coastal"]},
  {id:3, title:"Filament", artist:"The Filament", album:"Filament", dur:251, cover:"g4", tags:["moody","electronic","driving"]},
  {id:4, title:"Low Tide Radio", artist:"Coral Drift", album:"Low Tide Radio", dur:214, cover:"g5", tags:["calm","ambient","morning"]},
  {id:5, title:"3AM Signal", artist:"Mono Static", album:"Insomnia Mix", dur:239, cover:"g2", tags:["insomnia","tense","minimal"]},
  {id:6, title:"Halflight", artist:"Isla Rae", album:"Afterhours", dur:205, cover:"g6", tags:["dreamy","soft","late-night"]},
  {id:7, title:"Empty Platform", artist:"Nordlys", album:"Coastal Standby EP", dur:187, cover:"g1", tags:["lonely","ambient","waiting"]},
  {id:8, title:"Vacancy", artist:"The Filament", album:"Filament", dur:263, cover:"g3", tags:["dark","electronic","focus"]},
  {id:9, title:"Undertow", artist:"Coral Drift", album:"Low Tide Radio", dur:221, cover:"g4", tags:["deep","slow","heartbreak"]},
  {id:10, title:"Dial Tone", artist:"Mono Static", album:"Insomnia Mix", dur:196, cover:"g5", tags:["insomnia","minimal","tense"]},
  {id:11, title:"Nightbus", artist:"Isla Rae", album:"Afterhours", dur:242, cover:"g2", tags:["driving","late-night","energetic"]},
  {id:12, title:"Glass Weather", artist:"Nordlys", album:"Coastal Standby EP", dur:210, cover:"g6", tags:["rainy","calm","focus"]},
].map(t => ({...t, genre: artistGenre[t.artist] || "Other"}));
const playlists = [
  {id:"p1", name:"3AM Drive", desc:"For empty roads and full tanks.", cover:"g1", trackIds:[1,5,9,11]},
  {id:"p2", name:"Insomnia Mix", desc:"When sleep isn't happening.", cover:"g2", trackIds:[5,10,3,7]},
  {id:"p3", name:"Static & Rain", desc:"Wet windows, low volume.", cover:"g3", trackIds:[1,2,12,8]},
  {id:"p4", name:"Analog Mornings", desc:"The hour before the sun.", cover:"g5", trackIds:[6,4,9,12]},
  {id:"p5", name:"Empty Platform", desc:"Waiting-room ambience.", cover:"g4", trackIds:[7,3,8,10]},
  {id:"p6", name:"Undertow", desc:"Deep, slow, underwater.", cover:"g6", trackIds:[9,4,2,6]},
];
const newReleaseIds = [8, 9, 12];
const weeklyChartIds = [5, 1, 11, 3, 9, 2];
const spotlightArtist = "Isla Rae";

/* ---------------- State ---------------- */
let userPlaylists = [];
let likedTrackIds = new Set();
let customAudio = {};
let currentTrack = null, queue = [], queueIndex = -1, isPlaying = false, elapsed = 0, tickTimer = null;
let shuffleOn = false, repeatOn = false, volume = 0.7;
let totalPlays = 0;
let userName = "Night Owl";
let audioCtx = null, oscNode = null, gainNode = null;
let pendingAddTrackId = null;
let currentPlaylistViewId = null;
const realAudio = document.getElementById("realAudio");
const gCovers = ["g1","g2","g3","g4","g5","g6"];

/* ---------------- Helpers ---------------- */
function fmtTime(s){ const m = Math.floor(s/60), sec = Math.floor(s%60); return m + ":" + String(sec).padStart(2,"0"); }
function trackById(id){ return tracks.find(t => t.id === id); }
function slugify(s){ return s.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"") || "playlist"; }
function showToast(msg){
  const t = document.getElementById("toast");
  t.textContent = msg; t.classList.add("show");
  clearTimeout(t._timer);
  t._timer = setTimeout(()=>t.classList.remove("show"), 2200);
}
function getPlaylistById(id){
  if(id === "liked"){
    return {id:"liked", name:"Liked Songs", desc:likedTrackIds.size + " liked track" + (likedTrackIds.size===1?"":"s"), cover:"g-liked", trackIds:Array.from(likedTrackIds), isLiked:true};
  }
  const up = userPlaylists.find(p => p.id === id);
  if(up) return up;
  return playlists.find(p => p.id === id);
}
function isCuratedId(id){ return playlists.some(p=>p.id===id); }

/* ---------------- Card / row builders ---------------- */
function cardHTML(kind, obj){
  if(kind === "playlist"){
    return `<div class="card" data-type="playlist" data-id="${obj.id}">
      <div class="cover ${obj.cover}"><div class="play-fab"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div></div>
      <div class="card-title">${obj.name}</div><div class="card-sub">${obj.desc}</div></div>`;
  }
  return `<div class="card" data-type="track" data-id="${obj.id}">
    <div class="cover ${obj.cover}"><div class="play-fab"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div></div>
    <div class="card-title">${obj.title}</div><div class="card-sub">${obj.artist}</div></div>`;
}
function trackRowHTML(t, num, queueIds, opts){
  opts = opts || {};
  const playing = currentTrack && currentTrack.id === t.id && isPlaying;
  const liked = likedTrackIds.has(t.id);
  const removeBtn = opts.removable ? `<button class="row-icon-btn remove-btn" data-action="remove" data-id="${t.id}" title="Remove from playlist"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button>` : "";
  return `<tr class="track-row ${playing ? 'playing':''}" data-id="${t.id}">
    <td class="track-num">${playing ? `<div class="waveform"><span></span><span></span><span></span><span></span></div>` : num}</td>
    <td><div class="track-title-cell"><div class="mini-cover ${t.cover}"></div>
        <div><div class="track-name">${t.title}</div><button class="track-artist-link" data-action="artist" data-artist="${t.artist}">${t.artist}</button></div>
    </div></td>
    <td class="track-artist" style="color:var(--muted); font-size:12px;">${t.album}</td>
    <td>
      <div class="row-actions">
        <button class="row-icon-btn ${liked?'liked':''}" data-action="like" data-id="${t.id}" title="Like">
          <svg viewBox="0 0 24 24" fill="${liked?'currentColor':'none'}" stroke="currentColor" stroke-width="1.8"><path d="M12 21s-7-4.35-10-9.3C.5 8 2 4 6 4c2 0 3.5 1 4 2.5C10.5 5 12 4 14 4c4 0 5.5 4 4 7.7C21 16.65 14 21 12 21z"/></svg>
        </button>
        <button class="row-icon-btn" data-action="addto" data-id="${t.id}" title="Add to playlist">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 5v14M5 12h14"/></svg>
        </button>
        <button class="row-icon-btn" data-action="share-ig" data-id="${t.id}" title="Share to Instagram">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1"/></svg>
        </button>
        ${removeBtn}
      </div>
    </td>
    <td class="track-dur">${fmtTime(t.dur)}</td>
  </tr>`;
}
function attachTrackRowHandlers(container, queueIds){
  container.querySelectorAll(".track-row").forEach(row => {
    row.addEventListener("click", (e) => {
      if(e.target.closest("[data-action]")) return;
      const id = Number(row.dataset.id);
      const idx = queueIds.indexOf(id);
      playQueue(queueIds, idx >= 0 ? idx : 0);
    });
  });
  container.querySelectorAll('[data-action="like"]').forEach(btn => {
    btn.addEventListener("click", (e) => { e.stopPropagation(); toggleLike(Number(btn.dataset.id)); });
  });
  container.querySelectorAll('[data-action="addto"]').forEach(btn => {
    btn.addEventListener("click", (e) => { e.stopPropagation(); openAddToPlaylistModal(Number(btn.dataset.id)); });
  });
  container.querySelectorAll('[data-action="share-ig"]').forEach(btn => {
    btn.addEventListener("click", (e) => { e.stopPropagation(); shareToInstagram(trackById(Number(btn.dataset.id))); });
  });
  container.querySelectorAll('[data-action="artist"]').forEach(btn => {
    btn.addEventListener("click", (e) => { e.stopPropagation(); goTo({view:"artist", name: btn.dataset.artist}); });
  });
  container.querySelectorAll('[data-action="remove"]').forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      removeFromPlaylist(currentPlaylistViewId, Number(btn.dataset.id));
    });
  });
}

/* ---------------- Like ---------------- */
function toggleLike(trackId){
  if(likedTrackIds.has(trackId)){ likedTrackIds.delete(trackId); showToast("Removed from Liked Songs"); }
  else { likedTrackIds.add(trackId); showToast("Added to Liked Songs ❤"); }
  renderSidebar(); renderLibrary(); refreshCurrentView(); updateUserStats();
}

/* ---------------- User playlists ---------------- */
function createPlaylist(name){
  const pl = {id:"up-"+Date.now(), name: name || "New Playlist", desc:"", cover: gCovers[userPlaylists.length % gCovers.length], trackIds:[]};
  userPlaylists.push(pl);
  renderSidebar(); renderLibrary(); updateUserStats();
  showToast(`Created "${pl.name}"`);
  return pl;
}
function removeFromPlaylist(plId, trackId){
  const pl = userPlaylists.find(p=>p.id===plId);
  if(!pl) return;
  pl.trackIds = pl.trackIds.filter(id => id !== trackId);
  renderPlaylistDetail(plId);
  renderLibrary();
  showToast("Removed from playlist");
}

/* ---------------- Render: Home / Sidebar / Library ---------------- */
function renderHome(){
  document.getElementById("homeNewReleases").innerHTML = newReleaseIds.map(trackById).filter(Boolean).map(t => cardHTML("track", t)).join("");
  renderWeeklyChart();
  renderSpotlight();
  const genreList = [...new Set(tracks.map(t => t.genre))];
  document.getElementById("homeGenres").innerHTML = genreList.map(genreTileHTML).join("");
  document.getElementById("homePlaylists").innerHTML = playlists.slice(0,6).map(p => cardHTML("playlist", p)).join("");
  document.getElementById("homeTracks").innerHTML = tracks.map(t => cardHTML("track", t)).join("");
}
function renderWeeklyChart(){
  const rows = weeklyChartIds.map(trackById).filter(Boolean);
  const tbody = document.getElementById("weeklyChartBody");
  tbody.innerHTML = rows.map((t,i) => trackRowHTML(t, i+1, weeklyChartIds, {})).join("");
  attachTrackRowHandlers(tbody, weeklyChartIds);
}
function renderSpotlight(){
  const artistTracks = tracks.filter(t => t.artist === spotlightArtist);
  const ids = artistTracks.map(t => t.id);
  document.getElementById("spotlightAvatar").className = "avatar-lg " + (artistTracks[0] ? artistTracks[0].cover : "g6");
  document.getElementById("spotlightName").textContent = spotlightArtist;
  document.getElementById("spotlightSub").textContent = artistTracks.length + " tracks · Curated pick this week";
  document.getElementById("spotlightTracks").innerHTML = artistTracks.map(t => cardHTML("track", t)).join("");
  document.getElementById("spotlightPlay").onclick = () => { if(ids.length) playQueue(ids, 0); };
  document.getElementById("spotlightViewArtist").onclick = () => goTo({view:"artist", name: spotlightArtist});
}
function renderSidebar(){
  document.getElementById("sidebarPlaylists").innerHTML = playlists.map(p => `<button class="playlist-item" data-view="playlist" data-id="${p.id}">${p.name}</button>`).join("");
  document.getElementById("sidebarUserPlaylists").innerHTML = userPlaylists.length
    ? userPlaylists.map(p => `<button class="playlist-item" data-view="playlist" data-id="${p.id}">${p.name}</button>`).join("")
    : `<div style="font-size:12px; color:var(--muted); padding:4px 10px;">No playlists yet</div>`;
}
function renderLibrary(){
  const liked = getPlaylistById("liked");
  let html = cardHTML("playlist", liked);
  html += userPlaylists.map(p => cardHTML("playlist", p)).join("");
  html += `<div class="card new-card" id="newPlaylistCard"><div class="plus-circle"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 5v14M5 12h14"/></svg></div><div class="card-title">New Playlist</div></div>`;
  html += `<div style="grid-column:1/-1; margin:18px 0 4px; font-size:12px; color:var(--muted); text-transform:uppercase; letter-spacing:1px;">Curated for you</div>`;
  html += playlists.map(p => cardHTML("playlist", p)).join("");
  document.getElementById("libraryPlaylists").innerHTML = html;
}

/* ---------------- Render: Playlist / Artist detail ---------------- */
function renderPlaylistDetail(id){
  const pl = getPlaylistById(id);
  if(!pl) return;
  currentPlaylistViewId = id;
  document.getElementById("plCover").className = "cover " + pl.cover;
  document.getElementById("plKicker").textContent = pl.isLiked ? "PINNED PLAYLIST" : (isCuratedId(id) ? "CURATED PLAYLIST" : "PLAYLIST");
  document.getElementById("plTitle").textContent = pl.name;
  document.getElementById("plDesc").textContent = pl.desc;
  const removable = !pl.isLiked && !isCuratedId(id);
  const rows = pl.trackIds.map(trackById).filter(Boolean);
  document.getElementById("plTrackBody").innerHTML = rows.length
    ? rows.map((t,i) => trackRowHTML(t, i+1, pl.trackIds, {removable})).join("")
    : `<tr><td colspan="5" style="padding:24px 12px; color:var(--muted); text-align:center;">No tracks here yet.</td></tr>`;
  document.getElementById("plPlayAll").onclick = () => { if(pl.trackIds.length) playQueue(pl.trackIds, 0); };
  document.getElementById("plShare").onclick = () => sharePlaylist(id);
  document.getElementById("plDownload").onclick = () => downloadPlaylist(id);
  attachTrackRowHandlers(document.getElementById("plTrackBody"), pl.trackIds);
}
function renderArtist(name){
  const artistTracks = tracks.filter(t => t.artist === name);
  document.getElementById("artistAvatar").className = "avatar-lg " + (artistTracks[0] ? artistTracks[0].cover : "g6");
  document.getElementById("artistName").textContent = name;
  document.getElementById("artistSub").textContent = artistTracks.length + " track" + (artistTracks.length===1?"":"s") + " on AETHER";
  const ids = artistTracks.map(t=>t.id);
  document.getElementById("artistTrackBody").innerHTML = artistTracks.map((t,i) => trackRowHTML(t, i+1, ids, {})).join("");
  document.getElementById("artistPlayAll").onclick = () => { if(ids.length) playQueue(ids, 0); };
  attachTrackRowHandlers(document.getElementById("artistTrackBody"), ids);
}

/* ---------------- Genres ---------------- */
function genreTileHTML(genre){
  const count = tracks.filter(t => t.genre === genre).length;
  return `<div class="card genre-tile ${genreColors[genre] || 'g6'}" data-genre="${genre}">${genre}<span class="tile-count">${count} track${count===1?"":"s"}</span></div>`;
}
function renderGenres(){
  const genreList = [...new Set(tracks.map(t => t.genre))];
  document.getElementById("genresGrid").innerHTML = genreList.map(genreTileHTML).join("");
}
function renderGenreDetail(genre){
  const rows = tracks.filter(t => t.genre === genre);
  const ids = rows.map(t => t.id);
  document.getElementById("genreCover").className = "cover " + (genreColors[genre] || "g6");
  document.getElementById("genreName").textContent = genre;
  document.getElementById("genreSub").textContent = rows.length + " track" + (rows.length===1?"":"s") + " on AETHER";
  document.getElementById("genreTrackBody").innerHTML = rows.map((t,i) => trackRowHTML(t, i+1, ids, {})).join("");
  document.getElementById("genrePlayAll").onclick = () => { if(ids.length) playQueue(ids, 0); };
  attachTrackRowHandlers(document.getElementById("genreTrackBody"), ids);
}
document.addEventListener("click", (e) => {
  const tile = e.target.closest(".genre-tile");
  if(tile) goTo({view:"genre", name: tile.dataset.genre});
});

/* ---------------- Search ---------------- */
function renderSearch(query){
  const box = document.getElementById("searchResults");
  if(!query){
    box.innerHTML = `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.5"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg><div>Start typing to search tracks, artists or playlists.</div></div>`;
    return;
  }
  const q = query.toLowerCase();
  const matchedTracks = tracks.filter(t => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q));
  const allPl = [...playlists, ...userPlaylists];
  const matchedPlaylists = allPl.filter(p => p.name.toLowerCase().includes(q));
  if(matchedTracks.length === 0 && matchedPlaylists.length === 0){
    box.innerHTML = `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.5"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg><div>No results for "${query}"</div></div>`;
    return;
  }
  let html = "";
  if(matchedPlaylists.length) html += `<div class="section"><div class="section-head"><h2>Playlists</h2></div><div class="card-grid">${matchedPlaylists.map(p => cardHTML("playlist", p)).join("")}</div></div>`;
  if(matchedTracks.length){
    const ids = matchedTracks.map(t => t.id);
    html += `<div class="section"><div class="section-head"><h2>Tracks</h2></div><table class="track-table"><thead><tr><th>#</th><th>Title</th><th>Album</th><th></th><th style="text-align:right;">Duration</th></tr></thead><tbody id="searchTrackBody">${matchedTracks.map((t,i)=>trackRowHTML(t,i+1,ids,{})).join("")}</tbody></table></div>`;
  }
  box.innerHTML = html;
  if(matchedTracks.length) attachTrackRowHandlers(document.getElementById("searchTrackBody"), matchedTracks.map(t=>t.id));
}
function refreshCurrentView(){
  const active = document.querySelector(".view.active").id;
  if(active === "view-playlist" && currentPlaylistViewId) renderPlaylistDetail(currentPlaylistViewId);
  if(active === "view-search") renderSearch(document.getElementById("topSearchInput").value.trim());
  if(active === "view-home") renderHome();
}

/* ---------------- Navigation (with back-button history) ---------------- */
let navStack = [];
let currentState = {view:"home"};

function showView(name){
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.getElementById("view-" + name).classList.add("active");
  document.querySelectorAll(".nav-item").forEach(n => n.classList.toggle("active", n.dataset.view === name));
  document.querySelectorAll(".mtab[data-view]").forEach(n => n.classList.toggle("active", n.dataset.view === name));
}
function renderState(state){
  if(state.view === "playlist"){ renderPlaylistDetail(state.id); showView("playlist"); }
  else if(state.view === "artist"){ renderArtist(state.name); showView("artist"); }
  else if(state.view === "genres"){ renderGenres(); showView("genres"); }
  else if(state.view === "genre"){ renderGenreDetail(state.name); showView("genre"); }
  else if(state.view === "search"){ showView("search"); document.getElementById("topSearchInput").value = state.query || ""; renderSearch(state.query || ""); }
  else { showView(state.view); }
}
function goTo(state){
  navStack.push(currentState);
  currentState = state;
  renderState(state);
  updateBackButton();
}
function goBack(){
  if(navStack.length === 0) return;
  currentState = navStack.pop();
  renderState(currentState);
  updateBackButton();
}
function updateBackButton(){
  document.getElementById("btnBack").style.display = navStack.length ? "flex" : "none";
}
document.getElementById("btnBack").addEventListener("click", goBack);

document.querySelectorAll(".nav-item").forEach(btn => btn.addEventListener("click", () => goTo({view: btn.dataset.view})));
document.querySelectorAll(".mtab[data-view]").forEach(btn => btn.addEventListener("click", () => goTo({view: btn.dataset.view})));
document.getElementById("mtabAI").addEventListener("click", () => document.getElementById("aiPanel").classList.add("open"));
document.getElementById("mtabProfile").addEventListener("click", () => { updateUserStats(); document.getElementById("userPanel").classList.add("open"); });
document.getElementById("topSearchInput").addEventListener("input", (e) => {
  const q = e.target.value.trim();
  if(currentState.view !== "search") goTo({view:"search", query:q});
  else { currentState.query = q; renderSearch(q); }
});

document.addEventListener("click", (e) => {
  const newCard = e.target.closest("#newPlaylistCard");
  if(newCard){ openCreatePlaylistModal(); return; }
  const card = e.target.closest(".card");
  if(card){
    if(card.dataset.type === "playlist"){ goTo({view:"playlist", id: card.dataset.id}); }
    else { const id = Number(card.dataset.id); playQueue(tracks.map(t=>t.id), tracks.findIndex(t=>t.id===id)); }
    return;
  }
  const navPl = e.target.closest("[data-view='playlist'][data-id]");
  if(navPl){ goTo({view:"playlist", id: navPl.dataset.id}); }
});


/* ---------------- Modal system ---------------- */
const modalOverlay = document.getElementById("modalOverlay");
const modalTitle = document.getElementById("modalTitle");
const modalInput = document.getElementById("modalInput");
const modalBody = document.getElementById("modalBody");
const modalConfirm = document.getElementById("modalConfirm");
const modalCancel = document.getElementById("modalCancel");
function closeModal(){ modalOverlay.classList.remove("open"); modalConfirm.onclick = null; }
modalCancel.addEventListener("click", closeModal);
modalOverlay.addEventListener("click", (e) => { if(e.target === modalOverlay) closeModal(); });

function openCreatePlaylistModal(){
  modalTitle.textContent = "Name your playlist";
  modalInput.style.display = "block"; modalInput.value = ""; modalInput.placeholder = "e.g. Rainy Nights";
  modalBody.innerHTML = "";
  modalConfirm.textContent = "Create";
  modalConfirm.onclick = () => {
    const name = modalInput.value.trim();
    createPlaylist(name || "New Playlist");
    closeModal();
  };
  modalOverlay.classList.add("open");
  modalInput.focus();
}

function openAddToPlaylistModal(trackId){
  pendingAddTrackId = trackId;
  modalTitle.textContent = "Add to playlist";
  modalInput.style.display = "none";
  modalConfirm.textContent = "Done";
  modalConfirm.onclick = closeModal;
  renderAddToPlaylistBody();
  modalOverlay.classList.add("open");
}
function renderAddToPlaylistBody(){
  const t = trackById(pendingAddTrackId);
  let html = `<label class="modal-checkbox-row"><input type="checkbox" id="chk-liked" ${likedTrackIds.has(pendingAddTrackId)?"checked":""}><span class="mini-cover g-liked"></span><span>Liked Songs</span></label>`;
  html += userPlaylists.map(p => `<label class="modal-checkbox-row"><input type="checkbox" class="chk-pl" data-plid="${p.id}" ${p.trackIds.includes(pendingAddTrackId)?"checked":""}><span class="mini-cover ${p.cover}"></span><span>${p.name}</span></label>`).join("");
  html += `<div class="modal-newpl-row"><input type="text" id="quickPlName" placeholder="New playlist name"><button id="quickPlCreate">Add</button></div>`;
  modalBody.innerHTML = html;
  document.getElementById("chk-liked").addEventListener("change", (e) => {
    if(e.target.checked) likedTrackIds.add(pendingAddTrackId); else likedTrackIds.delete(pendingAddTrackId);
    renderSidebar(); renderLibrary(); refreshCurrentView();
  });
  modalBody.querySelectorAll(".chk-pl").forEach(chk => {
    chk.addEventListener("change", (e) => {
      const pl = userPlaylists.find(p => p.id === e.target.dataset.plid);
      if(!pl) return;
      if(e.target.checked){ if(!pl.trackIds.includes(pendingAddTrackId)) pl.trackIds.push(pendingAddTrackId); }
      else { pl.trackIds = pl.trackIds.filter(id => id !== pendingAddTrackId); }
      renderSidebar(); refreshCurrentView();
    });
  });
  document.getElementById("quickPlCreate").addEventListener("click", () => {
    const nameInput = document.getElementById("quickPlName");
    const pl = createPlaylist(nameInput.value.trim() || "New Playlist");
    pl.trackIds.push(pendingAddTrackId);
    renderAddToPlaylistBody();
    showToast(`Added to "${pl.name}"`);
  });
}

function sharePlaylist(id){
  const pl = getPlaylistById(id);
  const text = buildShareText(pl);
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(() => showToast("Copied playlist to clipboard!"))
      .catch(() => showShareFallback(text));
  } else { showShareFallback(text); }
}
function showShareFallback(text){
  modalTitle.textContent = "Share this playlist";
  modalInput.style.display = "none";
  modalBody.innerHTML = `<textarea readonly>${text}</textarea><div style="font-size:12px; color:var(--muted);">Copy failed automatically — select the text above and copy it manually.</div>`;
  modalConfirm.textContent = "Close";
  modalConfirm.onclick = closeModal;
  modalOverlay.classList.add("open");
}
function buildShareText(pl){
  const rows = pl.trackIds.map(trackById).filter(Boolean);
  let text = `${pl.name} — AETHER playlist\n${pl.desc || ""}\n\n`;
  rows.forEach((t,i) => { text += `${i+1}. ${t.title} — ${t.artist} (${fmtTime(t.dur)})\n`; });
  return text;
}
function downloadPlaylist(id){
  const pl = getPlaylistById(id);
  const text = buildShareText(pl);
  const blob = new Blob([text], {type:"text/plain"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = slugify(pl.name) + ".txt";
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast("Downloaded " + a.download);
}

/* ---------------- Instagram share (story card) ---------------- */
function roundRectPath(ctx, x, y, w, h, r){
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.arcTo(x+w, y, x+w, y+h, r);
  ctx.arcTo(x+w, y+h, x, y+h, r);
  ctx.arcTo(x, y+h, x, y, r);
  ctx.arcTo(x, y, x+w, y, r);
  ctx.closePath();
}
function buildStoryCanvas(track){
  const W = 1080, H = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  const colors = auroraColors[track.cover] || auroraColors.default;

  // Background base
  ctx.fillStyle = "#0A0B10";
  ctx.fillRect(0, 0, W, H);

  // Ambient glow blobs
  let g1 = ctx.createRadialGradient(W*0.25, H*0.2, 0, W*0.25, H*0.2, W*0.9);
  g1.addColorStop(0, colors[0] + "aa"); g1.addColorStop(1, "transparent");
  ctx.fillStyle = g1; ctx.fillRect(0, 0, W, H);
  let g2 = ctx.createRadialGradient(W*0.8, H*0.85, 0, W*0.8, H*0.85, W*0.9);
  g2.addColorStop(0, colors[1] + "aa"); g2.addColorStop(1, "transparent");
  ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H);

  // Album art square
  const artSize = 760, artX = (W-artSize)/2, artY = 430;
  const artGrad = ctx.createLinearGradient(artX, artY, artX+artSize, artY+artSize);
  artGrad.addColorStop(0, colors[0]); artGrad.addColorStop(1, colors[1]);
  ctx.save();
  roundRectPath(ctx, artX, artY, artSize, artSize, 32);
  ctx.clip();
  ctx.fillStyle = artGrad;
  ctx.fillRect(artX, artY, artSize, artSize);
  ctx.restore();
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = 60; ctx.shadowOffsetY = 25;
  roundRectPath(ctx, artX, artY, artSize, artSize, 32);
  ctx.strokeStyle = "rgba(255,255,255,0.08)"; ctx.lineWidth = 2; ctx.stroke();
  ctx.restore();

  // Track title
  ctx.textAlign = "center";
  ctx.fillStyle = "#F2F1EC";
  ctx.font = "700 60px 'Space Grotesk', sans-serif";
  wrapText(ctx, track.title, W/2, artY+artSize+110, 900, 68);

  // Artist
  ctx.fillStyle = "#8B8D9B";
  ctx.font = "500 36px 'Inter', sans-serif";
  ctx.fillText(track.artist, W/2, artY+artSize+185);

  // Waveform decoration
  ctx.fillStyle = colors[0];
  const wfY = artY+artSize+240, barW = 6, gap = 8, count = 40;
  const startX = W/2 - ((barW+gap)*count)/2;
  for(let i=0;i<count;i++){
    const h = 14 + Math.abs(Math.sin(i*0.7))*46;
    ctx.fillRect(startX + i*(barW+gap), wfY - h/2, barW, h);
  }

  // Brand footer
  ctx.fillStyle = "#FFB454";
  ctx.font = "700 42px 'Space Grotesk', sans-serif";
  ctx.fillText("AETHER", W/2, H-140);
  ctx.fillStyle = "#8B8D9B";
  ctx.font = "600 26px 'Inter', sans-serif";
  ctx.fillText("BEYOND SOUND", W/2, H-95);

  return canvas;
}
function wrapText(ctx, text, x, y, maxWidth, lineHeight){
  const words = text.split(" ");
  let line = "", lines = [];
  words.forEach(w => {
    const test = line ? line + " " + w : w;
    if(ctx.measureText(test).width > maxWidth && line){ lines.push(line); line = w; }
    else line = test;
  });
  lines.push(line);
  const totalH = lines.length * lineHeight;
  let startY = y - totalH/2 + lineHeight/2;
  lines.forEach((l,i) => ctx.fillText(l, x, startY + i*lineHeight));
}
async function shareToInstagram(track){
  if(!track){ showToast("Pick a track first."); return; }
  showToast("Building your story card...");
  const canvas = buildStoryCanvas(track);
  canvas.toBlob(async (blob) => {
    if(!blob){ showToast("Couldn't generate the image."); return; }
    const fileName = slugify(track.title) + "-aether-story.png";
    const file = new File([blob], fileName, {type:"image/png"});
    if(navigator.canShare && navigator.canShare({files:[file]})){
      try{
        await navigator.share({files:[file], title: track.title + " — AETHER", text: `${track.title} by ${track.artist} on AETHER`});
        return;
      }catch(err){ /* user cancelled or unsupported — fall through to download */ }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = fileName;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("Story image saved — open Instagram and add it to your Story");
  }, "image/png");
}
document.getElementById("btnShareIG").addEventListener("click", () => shareToInstagram(currentTrack));

/* ---------------- Theme toggle ---------------- */
function setTheme(light){
  document.body.classList.toggle("theme-light", light);
  document.getElementById("iconMoon").style.display = light ? "none" : "block";
  document.getElementById("iconSun").style.display = light ? "block" : "none";
  document.getElementById("switchTheme").classList.toggle("on", !light);
}
document.getElementById("btnThemeToggle").addEventListener("click", () => {
  const light = !document.body.classList.contains("theme-light");
  setTheme(light);
});

/* ---------------- Aurora ambient background ---------------- */
const auroraColors = {
  g1:["#7C5CFF","#2B2470"], g2:["#FFB454","#7A4A1E"], g3:["#3EC6C0","#123A3D"],
  g4:["#FF6584","#4A1030"], g5:["#8CE38A","#1C3B22"], g6:["#7C5CFF","#FFB454"],
  default:["#7C5CFF","#12141C"]
};
let auroraToggle = false;
function updateAurora(track){
  const colors = (track && auroraColors[track.cover]) || auroraColors.default;
  const nextSet = document.getElementById(auroraToggle ? "auroraSetA" : "auroraSetB");
  const currSet = document.getElementById(auroraToggle ? "auroraSetB" : "auroraSetA");
  const blobs = nextSet.querySelectorAll(".blob");
  blobs[0].style.background = `radial-gradient(circle, ${colors[0]}, transparent 70%)`;
  blobs[1].style.background = `radial-gradient(circle, ${colors[1]}, transparent 70%)`;
  requestAnimationFrame(() => { nextSet.classList.add("active"); currSet.classList.remove("active"); });
  auroraToggle = !auroraToggle;
}
updateAurora(null);

/* ---------------- User panel ---------------- */
const userPanel = document.getElementById("userPanel");
document.getElementById("btnUserToggle").addEventListener("click", () => { updateUserStats(); userPanel.classList.add("open"); });
document.getElementById("btnUserClose").addEventListener("click", () => userPanel.classList.remove("open"));
const userNameInput = document.getElementById("userNameInput");
userNameInput.addEventListener("input", () => {
  userName = userNameInput.value.trim() || "Night Owl";
  document.getElementById("btnUserToggle").textContent = initialsFor(userName);
  document.getElementById("userAvatarXL").textContent = initialsFor(userName);
});
function initialsFor(name){
  return name.split(" ").filter(Boolean).slice(0,2).map(w => w[0].toUpperCase()).join("") || "NW";
}
function updateUserStats(){
  document.getElementById("statLiked").textContent = likedTrackIds.size;
  document.getElementById("statPlaylists").textContent = userPlaylists.length;
  document.getElementById("statPlays").textContent = totalPlays;
}
document.getElementById("switchTheme").addEventListener("click", (e) => {
  const willBeOn = !e.currentTarget.classList.contains("on");
  setTheme(!willBeOn);
});
document.getElementById("switchAutoplay").addEventListener("click", (e) => {
  e.currentTarget.classList.toggle("on");
});
document.getElementById("btnSignOut").addEventListener("click", () => {
  showToast("This is a demo — there's no real account system yet.");
});

/* ---------------- Queue panel ---------------- */
const queuePanel = document.getElementById("queuePanel");
document.getElementById("btnQueueToggle").addEventListener("click", () => { renderQueuePanel(); queuePanel.classList.toggle("open"); });
document.getElementById("btnQueueClose").addEventListener("click", () => queuePanel.classList.remove("open"));
function renderQueuePanel(){
  const list = document.getElementById("queueList");
  if(queue.length === 0){ list.innerHTML = `<div style="padding:20px; color:var(--muted); font-size:13px; text-align:center;">Queue is empty.</div>`; return; }
  list.innerHTML = queue.map((id, i) => {
    const t = trackById(id);
    if(!t) return "";
    return `<div class="queue-item ${i===queueIndex?'current':''}" data-idx="${i}">
      <div class="mini-cover ${t.cover}"></div>
      <div class="qi-meta"><div class="qi-title">${t.title}</div><div class="qi-artist">${t.artist}</div></div>
      <div class="qi-actions">
        <button data-act="up" title="Move up"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19V5M5 12l7-7 7 7"/></svg></button>
        <button data-act="down" title="Move down"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12l7 7 7-7"/></svg></button>
        <button data-act="remove" title="Remove"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      </div>
    </div>`;
  }).join("");
  list.querySelectorAll(".queue-item").forEach(item => {
    const idx = Number(item.dataset.idx);
    item.addEventListener("click", (e) => {
      if(e.target.closest("[data-act]")) return;
      queueIndex = idx; loadTrack(trackById(queue[queueIndex])); play(); renderQueuePanel();
    });
    item.querySelector('[data-act="up"]').addEventListener("click", (e) => { e.stopPropagation(); moveQueueItem(idx, -1); });
    item.querySelector('[data-act="down"]').addEventListener("click", (e) => { e.stopPropagation(); moveQueueItem(idx, 1); });
    item.querySelector('[data-act="remove"]').addEventListener("click", (e) => { e.stopPropagation(); removeQueueItem(idx); });
  });
}
function moveQueueItem(idx, dir){
  const newIdx = idx + dir;
  if(newIdx < 0 || newIdx >= queue.length) return;
  [queue[idx], queue[newIdx]] = [queue[newIdx], queue[idx]];
  if(queueIndex === idx) queueIndex = newIdx; else if(queueIndex === newIdx) queueIndex = idx;
  renderQueuePanel();
}
function removeQueueItem(idx){
  queue.splice(idx, 1);
  if(idx < queueIndex) queueIndex--;
  else if(idx === queueIndex){ queueIndex = Math.min(queueIndex, queue.length - 1); if(queue.length){ loadTrack(trackById(queue[queueIndex])); } }
  renderQueuePanel();
}

/* ---------------- Playback engine ---------------- */
function ensureAudio(){ if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
function stopTone(){ if(oscNode){ try{ oscNode.stop(); }catch(e){} oscNode.disconnect(); oscNode = null; } }
function startTone(track){
  ensureAudio(); stopTone();
  gainNode = audioCtx.createGain(); gainNode.gain.value = 0; gainNode.connect(audioCtx.destination);
  oscNode = audioCtx.createOscillator(); oscNode.type = "sine";
  oscNode.frequency.value = 90 + (track.id * 11) % 60;
  oscNode.connect(gainNode); oscNode.start();
  gainNode.gain.linearRampToValueAtTime(0.035 * volume, audioCtx.currentTime + 0.4);
}
function hasRealAudio(trackId){ return !!customAudio[trackId]; }

function playQueue(ids, index){
  queue = ids.slice(); queueIndex = index;
  loadTrack(trackById(queue[queueIndex])); play(); renderQueuePanel();
}
function loadTrack(track){
  currentTrack = track; elapsed = 0; totalPlays++;
  document.getElementById("npTitle").textContent = track.title;
  document.getElementById("npTitle").classList.remove("empty");
  document.getElementById("npArtist").textContent = track.artist;
  document.getElementById("npArtist").classList.remove("empty");
  document.getElementById("npCover").className = "np-cover " + track.cover;
  document.getElementById("timeTotal").textContent = fmtTime(track.dur);
  document.getElementById("npSource").style.display = hasRealAudio(track.id) ? "block" : "none";
  document.getElementById("uploadDot").style.display = hasRealAudio(track.id) ? "block" : "none";
  updateProgressUI(); refreshVisibleRows(); updateAurora(track); updateUserStats();
}
function play(){
  if(!currentTrack) return;
  isPlaying = true;
  document.getElementById("iconPlay").style.display = "none";
  document.getElementById("iconPause").style.display = "block";
  if(hasRealAudio(currentTrack.id)){
    stopTone();
    if(realAudio.src !== customAudio[currentTrack.id]) realAudio.src = customAudio[currentTrack.id];
    realAudio.currentTime = elapsed; realAudio.volume = volume;
    realAudio.play().catch(()=>{});
  } else {
    startTone(currentTrack);
  }
  clearInterval(tickTimer); tickTimer = setInterval(tick, 1000);
  refreshVisibleRows();
}
function pause(){
  isPlaying = false;
  document.getElementById("iconPlay").style.display = "block";
  document.getElementById("iconPause").style.display = "none";
  if(gainNode) gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.15);
  if(!realAudio.paused) realAudio.pause();
  clearInterval(tickTimer);
  refreshVisibleRows();
}
function tick(){
  if(hasRealAudio(currentTrack.id)){
    elapsed = Math.floor(realAudio.currentTime);
    if(realAudio.ended || elapsed >= currentTrack.dur){ if(repeatOn){ elapsed=0; realAudio.currentTime=0; realAudio.play().catch(()=>{}); } else { nextTrack(); return; } }
  } else {
    elapsed++;
    if(elapsed >= currentTrack.dur){ if(repeatOn){ elapsed = 0; } else { nextTrack(); return; } }
  }
  updateProgressUI();
}
function updateProgressUI(){
  const pct = currentTrack ? (elapsed / currentTrack.dur) * 100 : 0;
  document.getElementById("progressFill").style.width = pct + "%";
  document.getElementById("timeElapsed").textContent = fmtTime(elapsed);
}
function nextTrack(){
  if(queue.length === 0) return;
  queueIndex = shuffleOn ? Math.floor(Math.random() * queue.length) : (queueIndex + 1) % queue.length;
  loadTrack(trackById(queue[queueIndex])); play(); renderQueuePanel();
}
function prevTrack(){
  if(queue.length === 0) return;
  if(elapsed > 3){ elapsed = 0; if(hasRealAudio(currentTrack.id)) realAudio.currentTime = 0; updateProgressUI(); return; }
  queueIndex = (queueIndex - 1 + queue.length) % queue.length;
  loadTrack(trackById(queue[queueIndex])); play(); renderQueuePanel();
}
function refreshVisibleRows(){
  document.querySelectorAll(".track-row").forEach(row => {
    const id = Number(row.dataset.id);
    const playing = currentTrack && currentTrack.id === id && isPlaying;
    row.classList.toggle("playing", playing);
    const numCell = row.querySelector(".track-num");
    if(numCell){
      if(playing) numCell.innerHTML = `<div class="waveform"><span></span><span></span><span></span><span></span></div>`;
      else { const rowsInBody = Array.from(row.parentElement.children); numCell.textContent = rowsInBody.indexOf(row) + 1; }
    }
  });
}

/* Transport controls */
document.getElementById("btnPlayPause").addEventListener("click", () => { if(!currentTrack){ playQueue(tracks.map(t=>t.id), 0); return; } isPlaying ? pause() : play(); });
document.getElementById("btnNext").addEventListener("click", nextTrack);
document.getElementById("btnPrev").addEventListener("click", prevTrack);
document.getElementById("btnShuffle").addEventListener("click", (e) => { shuffleOn = !shuffleOn; e.currentTarget.classList.toggle("toggle-active", shuffleOn); });
document.getElementById("btnRepeat").addEventListener("click", (e) => { repeatOn = !repeatOn; e.currentTarget.classList.toggle("toggle-active", repeatOn); });
document.getElementById("progressTrack").addEventListener("click", (e) => {
  if(!currentTrack) return;
  const rect = e.currentTarget.getBoundingClientRect();
  const pct = (e.clientX - rect.left) / rect.width;
  elapsed = Math.floor(currentTrack.dur * pct);
  if(hasRealAudio(currentTrack.id)) realAudio.currentTime = elapsed;
  updateProgressUI();
});
document.getElementById("volumeTrack").addEventListener("click", (e) => {
  const rect = e.currentTarget.getBoundingClientRect();
  volume = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  document.getElementById("volumeFill").style.width = (volume*100) + "%";
  realAudio.volume = volume;
  if(gainNode && isPlaying) gainNode.gain.linearRampToValueAtTime(0.05*volume + 0.005, audioCtx.currentTime + 0.05);
});

/* Upload real audio */
document.getElementById("btnUpload").addEventListener("click", () => {
  if(!currentTrack){ showToast("Pick a track first, then attach audio."); return; }
  document.getElementById("audioFileInput").click();
});
document.getElementById("audioFileInput").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if(!file || !currentTrack) return;
  const url = URL.createObjectURL(file);
  customAudio[currentTrack.id] = url;
  document.getElementById("npSource").style.display = "block";
  document.getElementById("uploadDot").style.display = "block";
  showToast(`Real audio attached to "${currentTrack.title}"`);
  if(isPlaying) play();
  e.target.value = "";
});
realAudio.addEventListener("ended", () => { if(currentTrack && hasRealAudio(currentTrack.id) && !repeatOn) nextTrack(); });

/* ---------------- AI DJ ---------------- */
const aiPanel = document.getElementById("aiPanel");
const aiMessages = document.getElementById("aiMessages");
const aiInput = document.getElementById("aiInput");
let aiBusy = false;

document.getElementById("btnAIToggle").addEventListener("click", () => aiPanel.classList.toggle("open"));
document.getElementById("btnAIClose").addEventListener("click", () => aiPanel.classList.remove("open"));
document.querySelectorAll(".ai-chip").forEach(chip => {
  chip.addEventListener("click", () => sendAIMessage("Give me a playlist for: " + chip.dataset.mood));
});
document.getElementById("aiSend").addEventListener("click", () => {
  const val = aiInput.value.trim();
  if(val) { sendAIMessage(val); aiInput.value = ""; }
});
aiInput.addEventListener("keydown", (e) => {
  if(e.key === "Enter"){ const val = aiInput.value.trim(); if(val){ sendAIMessage(val); aiInput.value = ""; } }
});

function catalogForAI(){
  return tracks.map(t => ({id:t.id, title:t.title, artist:t.artist, album:t.album, tags:t.tags}));
}
function addAIBubble(role, html){
  const div = document.createElement("div");
  div.className = "ai-msg " + role;
  div.innerHTML = html;
  aiMessages.appendChild(div);
  aiMessages.scrollTop = aiMessages.scrollHeight;
  return div;
}
function addUserBubble(text){
  const div = document.createElement("div");
  div.className = "ai-msg user";
  div.textContent = text;
  aiMessages.appendChild(div);
  aiMessages.scrollTop = aiMessages.scrollHeight;
}
function suggestListHTML(trackIds){
  const rows = trackIds.map(trackById).filter(Boolean);
  if(!rows.length) return "";
  return `<div class="ai-suggest-list">${rows.map(t => `<div class="ai-suggest-item" data-id="${t.id}">
    <div class="mini-cover ${t.cover}"></div>
    <div class="si-meta"><div class="si-title">${t.title}</div><div class="si-artist">${t.artist}</div></div>
  </div>`).join("")}</div>`;
}
function wireSuggestClicks(container, trackIds){
  container.querySelectorAll(".ai-suggest-item").forEach(item => {
    item.addEventListener("click", () => {
      const id = Number(item.dataset.id);
      const idx = trackIds.indexOf(id);
      playQueue(trackIds, idx >= 0 ? idx : 0);
    });
  });
}

async function callClaude(systemPrompt, userText){
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      system: systemPrompt,
      messages: [{ role: "user", content: userText }]
    })
  });
  const data = await response.json();
  const textBlock = (data.content || []).find(b => b.type === "text");
  if(!textBlock) throw new Error("No text in response");
  let clean = textBlock.text.trim().replace(/^```json/i, "").replace(/^```/, "").replace(/```$/, "").trim();
  return JSON.parse(clean);
}

async function sendAIMessage(userText){
  if(aiBusy) return;
  aiBusy = true;
  addUserBubble(userText);
  const typing = addAIBubble("assistant", `<div class="ai-typing"><span></span><span></span><span></span></div>`);
  const systemPrompt = `You are the AI DJ for a fictional night-listening music app called AETHER. You can ONLY recommend tracks from this exact catalog (never invent new ones): ${JSON.stringify(catalogForAI())}. Respond in the same language the user writes in. Respond with ONLY strict JSON, no markdown fences, no extra text, in this exact shape: {"reply": "short conversational reply, max 2 sentences", "trackIds": [array of 3 to 6 track id numbers from the catalog that best fit], "playlistName": "a short creative playlist name if this feels like a playlist request, otherwise empty string"}`;
  try{
    const result = await callClaude(systemPrompt, userText);
    typing.remove();
    let html = result.reply || "";
    const trackIds = Array.isArray(result.trackIds) ? result.trackIds.filter(id => trackById(id)) : [];
    html += suggestListHTML(trackIds);
    if(result.playlistName && trackIds.length){
      html += `<button class="ai-save-btn" data-name="${result.playlistName}" data-ids="${trackIds.join(',')}"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>Save as "${result.playlistName}"</button>`;
    }
    const bubble = addAIBubble("assistant", html);
    if(trackIds.length) wireSuggestClicks(bubble, trackIds);
    const saveBtn = bubble.querySelector(".ai-save-btn");
    if(saveBtn){
      saveBtn.addEventListener("click", () => {
        const ids = saveBtn.dataset.ids.split(",").map(Number);
        const pl = createPlaylist(saveBtn.dataset.name);
        pl.trackIds = ids;
        renderSidebar(); renderLibrary();
        showToast(`Saved as "${pl.name}"`);
        saveBtn.textContent = "Saved ✓";
        saveBtn.disabled = true;
      });
    }
  }catch(err){
    typing.remove();
    addAIBubble("assistant", `I couldn't reach the AI DJ right now. This feature needs to run inside Claude's preview — if you've downloaded and hosted this file elsewhere, you'll need to connect your own AI backend with an API key.`);
  }
  aiBusy = false;
}

document.getElementById("btnSeeAllGenres").addEventListener("click", () => goTo({view:"genres"}));
document.getElementById("btnAIRecommend").addEventListener("click", async () => {
  const box = document.getElementById("aiRecommendBox");
  box.innerHTML = `<div class="ai-typing" style="padding-left:0;"><span></span><span></span><span></span></div>`;
  const likedTitles = Array.from(likedTrackIds).map(trackById).filter(Boolean).map(t => t.title + " by " + t.artist);
  const userText = likedTitles.length
    ? `Recommend tracks for someone who liked: ${likedTitles.join(", ")}.`
    : `This user hasn't liked anything yet — recommend a good, varied starter set from the catalog.`;
  const systemPrompt = `You are a music recommender for a fictional app called AETHER. You can ONLY recommend tracks from this exact catalog (never invent new ones): ${JSON.stringify(catalogForAI())}. Respond with ONLY strict JSON, no markdown fences, no extra text: {"reply": "one short sentence explaining the picks", "trackIds": [4 to 6 track id numbers], "playlistName": ""}`;
  try{
    const result = await callClaude(systemPrompt, userText);
    const trackIds = Array.isArray(result.trackIds) ? result.trackIds.filter(id => trackById(id)) : [];
    const rows = trackIds.map(trackById).filter(Boolean);
    box.innerHTML = `<div style="font-size:12.5px; color:var(--muted); margin-bottom:10px;">${result.reply || ""}</div>
      <div class="card-grid">${rows.map(t => cardHTML("track", t)).join("")}</div>`;
  }catch(err){
    box.innerHTML = `<div style="font-size:12.5px; color:var(--muted);">Couldn't reach the AI DJ right now — this works when previewed inside Claude. For a hosted site you'll need your own AI backend.</div>`;
  }
});

/* ---------------- Init ---------------- */
document.getElementById("btnUserToggle").textContent = initialsFor(userName);
document.getElementById("userAvatarXL").textContent = initialsFor(userName);
renderSidebar(); renderHome(); renderLibrary(); renderSearch("");

/* Boot splash */
window.addEventListener("load", () => {
  setTimeout(() => { document.getElementById("bootSplash").classList.add("hide"); }, 550);
});
setTimeout(() => { document.getElementById("bootSplash").classList.add("hide"); }, 2200);
