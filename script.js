/* script.js — fetches matches from CricketData.org and renders UI
   Your API key (as provided) is used here. For production, proxy this through a server. */

const API_KEY = '945777b0-2d44-49f3-b4a7-f10e901ed18d';
const CURRENT_MATCHES_URL = `https://api.cricapi.com/v1/currentMatches?apikey=${API_KEY}&offset=0`;

/* SPA-ish navigation via hash */
const sections = ['home','live','news','login','contact'];
function showSection(name){
  sections.forEach(s=>{
    const el = document.getElementById(s);
    if(!el) return;
    el.hidden = s !== name;
  });
  document.querySelectorAll('.nav-link').forEach(a=>a.classList.toggle('active', a.getAttribute('href') === '#'+name));
}
window.addEventListener('hashchange', ()=> showSection((location.hash||'#home').replace('#','')));
showSection((location.hash||'#home').replace('#',''));

/* Helper: escape text to prevent XSS */
function escapeHtml(t){
  if(t === undefined || t === null) return '';
  return String(t).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
}

/* Format innings (best-effort) */
function formatInnings(inn){
  if(!inn) return '';
  const runs = inn.r || inn.runs || '';
  const wickets = inn.w || inn.wickets || '';
  const overs = inn.o || inn.overs || '';
  if(!runs && !wickets && !overs) return '';
  return `${runs}/${wickets} (${overs})`;
}

/* Convert match object to a compact line for ticker / cards */
function matchToLine(m){
  const tA = (m.teams && m.teams[0]) || m.teamInfo?.[0]?.name || m.t1 || (m.name||'').split(' v ')[0] || 'Team A';
  const tB = (m.teams && m.teams[1]) || m.teamInfo?.[1]?.name || m.t2 || (m.name||'').split(' v ')[1] || 'Team B';
  let sA = '', sB = '';
  if(Array.isArray(m.score) && m.score.length){
    const lastTwo = m.score.slice(-2);
    sA = formatInnings(lastTwo[0]);
    sB = formatInnings(lastTwo[1]);
  } else if(m.score && typeof m.score === 'object'){
    sA = formatInnings(m.score.inning1 || m.score[0] || m.score.innings?.[0]);
    sB = formatInnings(m.score.inning2 || m.score[1] || m.score.innings?.[1]);
  }
  const status = m.status || (m.matchStarted? 'Live' : (m.matchEnded? 'Final' : 'Scheduled'));
  const left = `${tA}${sA ? ' ' + sA : ''}`.trim();
  const right = `${tB}${sB ? ' ' + sB : ''}`.trim();
  return `${left} vs ${right}${status ? ' — ' + status : ''}`;
}

/* Render ticker — duplicate content to allow seamless scroll */
function renderTicker(matches){
  const ticker = document.getElementById('liveTicker');
  if(!ticker) return;
  if(!matches || matches.length === 0){
    ticker.innerHTML = `<div class="tick"><span class="dot" style="background:var(--muted)"></span> No live matches right now.</div>`;
    return;
  }
  const items = matches.map(m=>{
    const live = String(m.live || '').toLowerCase() === 'true' || /live/i.test(m.status||'');
    const dotColor = live ? 'var(--success)' : 'var(--accent)';
    return `<div class="tick"><span class="dot" style="background:${dotColor}"></span> ${escapeHtml(matchToLine(m))}</div>`;
  }).join('<span style="width:28px"></span>');
  ticker.innerHTML = items + items; // duplicate for loop
}

/* Render score grid */
function renderScoreGrid(matches){
  const grid = document.getElementById('scoreGrid');
  if(!grid) return;
  grid.innerHTML = '';
  if(!matches || matches.length === 0){
    grid.innerHTML = `<div class="muted">No live matches currently.</div>`;
    return;
  }
  matches.forEach(m=>{
    const container = document.createElement('div');
    container.className = 'score';
    const title = m.name || `${(m.teams?.[0]||'Team A')} vs ${(m.teams?.[1]||'Team B')}`;
    const status = m.status || '';
    const scoreLine = matchToLine(m);
    container.innerHTML = `<strong>${escapeHtml(title)}</strong>
                           <div style="margin-top:8px">${escapeHtml(scoreLine)}</div>
                           <div class="muted" style="margin-top:8px">${escapeHtml(status)}</div>`;
    grid.appendChild(container);
  });
}

/* Render all matches (detailed list) */
function renderAllMatches(matches){
  const el = document.getElementById('allMatches');
  if(!el) return;
  el.innerHTML = '';
  if(!matches || matches.length === 0){ el.innerHTML = '<p class="muted">No current matches.</p>'; return; }
  const container = document.createElement('div');
  container.style.display = 'grid';
  container.style.gridTemplateColumns = 'repeat(auto-fill,minmax(320px,1fr))';
  container.style.gap = '12px';
  matches.forEach(m=>{
    const div = document.createElement('div');
    div.className = 'score';
    div.innerHTML = `<strong>${escapeHtml(m.name || 'Match')}</strong>
                     <div style="margin-top:8px">${escapeHtml(matchToLine(m))}</div>
                     <div class="muted" style="margin-top:8px">${escapeHtml(m.status || '')}</div>`;
    container.appendChild(div);
  });
  el.appendChild(container);
}

/* Quick stats */
function renderQuickStats(matches){
  const el = document.getElementById('quickStats');
  if(!el) return;
  const total = matches.length || 0;
  const live = matches.filter(m=>/live|innings|day/i.test(m.status||'')).length;
  const finished = matches.filter(m=>/won|final|draw|tie|no result|stumps/i.test((m.status||'').toLowerCase())).length;
  el.innerHTML = `
    <div style="display:flex;gap:12px;flex-wrap:wrap">
      <div><strong style="font-size:1.3rem">${total}</strong><div class="muted">Matches</div></div>
      <div><strong style="font-size:1.3rem">${live}</strong><div class="muted">Live</div></div>
      <div><strong style="font-size:1.3rem">${finished}</strong><div class="muted">Finished</div></div>
    </div>`;
}

/* Fetch API */
async function fetchCurrentMatches(){
  try{
    const res = await fetch(CURRENT_MATCHES_URL);
    if(!res.ok) throw new Error('Network response not OK: ' + res.status);
    const json = await res.json();
    return json.data || json.matches || [];
  }catch(err){
    console.error('Error fetching matches:', err);
    return [];
  }
}

/* Full refresh */
async function refreshAll(){
  const matches = await fetchCurrentMatches();
  renderTicker(matches);
  renderScoreGrid(matches);
  renderAllMatches(matches);
  renderQuickStats(matches);
}
refreshAll();
setInterval(refreshAll, 30000);

/* Forms: demo handlers */
document.getElementById('loginForm')?.addEventListener('submit', function(e){
  e.preventDefault();
  const email = this.email.value.trim();
  document.getElementById('loginMsg').textContent = `Demo login: ${email}`;
  this.reset();
});

document.getElementById('contactForm')?.addEventListener('submit', function(e){
  e.preventDefault();
  document.getElementById('contactMsg').textContent = 'Thanks — message received (demo).';
  this.reset();
});

/* Footer year */
document.getElementById('year').textContent = new Date().getFullYear();
