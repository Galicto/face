/**
 * AI Face Recognition Dashboard – Real-time Logic
 * Connects via WebSocket for live detection updates.
 */

// ── DOM References ───────────────────────────────────────────────────────────
const dom = {
    totalFaces: document.getElementById('total-faces'),
    fpsChip: document.getElementById('fps-chip'),
    ringProgress: document.getElementById('ring-progress'),
    ringLabel: document.getElementById('ring-label'),
    focusBarFill: document.getElementById('focus-bar-fill'),
    logList: document.getElementById('log-list'),
    statusBadge: document.getElementById('status-badge'),
    personCards: document.getElementById('person-cards'),
    // bottom row
    uniquePeople: document.getElementById('unique-people'),
    peakFaces: document.getElementById('peak-faces'),
    sessionTime: document.getElementById('session-time'),
    totalDetections: document.getElementById('total-detections'),
};

// ── State ────────────────────────────────────────────────────────────────────
const state = {
    sessionStart: Date.now(),
    peakFaces: 0,
    totalDetections: 0,
    seenPeople: new Set(),
    lastDetections: {},
};

const RING_CIRCUM = 2 * Math.PI * 65;
const MAX_RING_VALUE = 10; // ring shows up to 10 faces

const PERSON_COLORS = [
    { border: 'var(--accent-cyan)', bg: 'rgba(6,182,212,0.12)', text: 'var(--accent-cyan)' },
    { border: 'var(--accent-green)', bg: 'rgba(16,185,129,0.12)', text: 'var(--accent-green)' },
    { border: 'var(--accent-purple)', bg: 'rgba(139,92,246,0.12)', text: 'var(--accent-purple)' },
    { border: 'var(--accent-amber)', bg: 'rgba(245,158,11,0.12)', text: 'var(--accent-amber)' },
    { border: 'var(--accent-red)', bg: 'rgba(239,68,68,0.12)', text: 'var(--accent-red)' },
    { border: 'var(--accent-blue)', bg: 'rgba(59,130,246,0.12)', text: 'var(--accent-blue)' },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatDuration(ms) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function timeNow() {
    return new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// ── Update UI ────────────────────────────────────────────────────────────────
function update(data) {
    const { detections, total_faces, fps, class_names } = data;

    // Total faces
    dom.totalFaces.textContent = total_faces;

    // FPS chip
    dom.fpsChip.textContent = `${fps} FPS`;

    // Ring (based on total faces, max 10)
    const ringPct = Math.min(total_faces / MAX_RING_VALUE, 1) * 100;
    const offset = RING_CIRCUM - (RING_CIRCUM * ringPct / 100);
    dom.ringProgress.style.strokeDashoffset = offset;
    dom.ringLabel.textContent = total_faces;

    // Focus bar shows detection density
    dom.focusBarFill.style.width = `${ringPct}%`;

    // Track stats
    state.totalDetections += total_faces;
    state.peakFaces = Math.max(state.peakFaces, total_faces);
    Object.keys(detections).forEach(name => state.seenPeople.add(name));

    // Bottom row
    dom.uniquePeople.textContent = state.seenPeople.size;
    dom.peakFaces.textContent = state.peakFaces;
    dom.sessionTime.textContent = formatDuration(Date.now() - state.sessionStart);
    dom.totalDetections.textContent = state.totalDetections > 9999
        ? `${(state.totalDetections / 1000).toFixed(1)}K`
        : state.totalDetections;

    // ── Per-person cards ─────────────────────────────────────────────────────
    updatePersonCards(detections, class_names || []);

    // ── Activity log: log new arrivals / departures ──────────────────────────
    for (const name of Object.keys(detections)) {
        if (!state.lastDetections[name] || state.lastDetections[name] === 0) {
            addLog(`${capitalize(name)} detected`, 'green');
        }
    }
    for (const name of Object.keys(state.lastDetections)) {
        if (state.lastDetections[name] > 0 && (!detections[name] || detections[name] === 0)) {
            addLog(`${capitalize(name)} left frame`, 'red');
        }
    }

    state.lastDetections = { ...detections };
}

function updatePersonCards(detections, classNames) {
    // Build HTML for each known class
    const allNames = [...new Set([...classNames, ...Object.keys(detections)])];
    let html = '';
    allNames.forEach((name, i) => {
        const count = detections[name] || 0;
        const color = PERSON_COLORS[i % PERSON_COLORS.length];
        const isActive = count > 0;
        html += `
      <div class="metric" style="
        border-left: 4px solid ${isActive ? color.border : 'rgba(255,255,255,0.06)'};
        opacity: ${isActive ? 1 : 0.5};
        transition: all 0.3s ease;
      ">
        <div class="metric-label">${capitalize(name)}</div>
        <div class="metric-value" style="color: ${isActive ? color.text : 'var(--text-muted)'}; font-size: 1.6rem;">
          ${isActive ? '✓ Present' : '— Absent'}
        </div>
        <div class="metric-sub">${count} detection${count !== 1 ? 's' : ''} in frame</div>
      </div>
    `;
    });
    dom.personCards.innerHTML = html;
}

function addLog(msg, color) {
    const li = document.createElement('li');
    li.className = 'log-item';
    li.innerHTML = `
    <span class="log-dot log-dot--${color}"></span>
    <span>${msg}</span>
    <span class="log-time">${timeNow()}</span>
  `;
    dom.logList.prepend(li);
    while (dom.logList.children.length > 30) {
        dom.logList.removeChild(dom.logList.lastChild);
    }
}

// ── WebSocket Connection ─────────────────────────────────────────────────────
function connectWS() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/ws/metrics`);

    ws.onopen = () => {
        dom.statusBadge.innerHTML = `<span class="status-dot"></span> Live`;
        addLog('Connected to server', 'green');
    };

    ws.onmessage = (e) => {
        try {
            const data = JSON.parse(e.data);
            update(data);
        } catch (_) { }
    };

    ws.onclose = () => {
        dom.statusBadge.innerHTML = `<span class="status-dot" style="background:var(--accent-red);"></span> Reconnecting…`;
        setTimeout(connectWS, 2000);
    };

    ws.onerror = () => ws.close();
}

// ── Fallback: polling ────────────────────────────────────────────────────────
async function pollMetrics() {
    try {
        const res = await fetch('/metrics');
        const data = await res.json();
        update(data);
    } catch (_) { }
}

// ── Boot ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    dom.ringProgress.style.strokeDasharray = RING_CIRCUM;
    dom.ringProgress.style.strokeDashoffset = RING_CIRCUM;

    addLog('Dashboard initialised', 'green');

    if ('WebSocket' in window) {
        connectWS();
    } else {
        setInterval(pollMetrics, 500);
    }
});
