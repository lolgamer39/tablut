document.addEventListener('DOMContentLoaded', () => {
    // Gestione Eventi Semplificata
    bindEvent('start-btn', 'click', startGame);
    bindEvent('play-again-btn', 'click', resetGame);
    bindEvent('analyze-btn', 'click', goToAnalysis);
    bindEvent('btn-prev', 'click', () => navigateHistory(-1));
    bindEvent('btn-next', 'click', () => navigateHistory(1));

    // Tastiera
    document.addEventListener('keydown', (e) => {
        if (document.getElementById('game-wrapper').classList.contains('hidden')) return;
        if (e.key === 'ArrowLeft') navigateHistory(-1);
        if (e.key === 'ArrowRight') navigateHistory(1);
    });

    // Impostazioni
    const setIcon = document.getElementById('settings-icon');
    const setMenu = document.getElementById('settings-menu');
    if(setIcon && setMenu) {
        setIcon.addEventListener('click', () => setMenu.classList.toggle('hidden'));
        bindEvent('close-settings', 'click', () => setMenu.classList.add('hidden'));
    }
    
    const hints = document.getElementById('toggle-hints');
    if(hints) hints.addEventListener('change', (e) => {
        gameOptions.showHints = e.target.checked;
        if (selectedCell) drawBoard();
    });

    bindEvent('bg-select', 'change', (e) => applyTheme('bg', e.target.value));
    bindEvent('board-select', 'change', (e) => applyTheme('board', e.target.value));
});

function bindEvent(id, event, func) {
    const el = document.getElementById(id);
    if(el) el.addEventListener(event, func);
}

// --- TEMI ---
const pageThemes = { 'classic': '#faebd7', 'pearl': '#f5f5f5', 'mint': '#e0f2f1', 'ocean': '#e3f2fd', 'rose': '#fce4ec' };
const boardThemes = { 'wood': { cell: '#f0e2d0', border: '#5a3a22' }, 'stone': { cell: '#cfd8dc', border: '#455a64' }, 'sand': { cell: '#fff3e0', border: '#e65100' }, 'ivory': { cell: '#ffffff', border: '#333333' }, 'forest': { cell: '#dcedc8', border: '#33691e' } };

function applyTheme(type, value) {
    const root = document.documentElement;
    if (type === 'bg' && pageThemes[value]) root.style.setProperty('--page-bg', pageThemes[value]);
    else if (type === 'board' && boardThemes[value]) {
        root.style.setProperty('--board-cell', boardThemes[value].cell);
        root.style.setProperty('--board-border', boardThemes[value].border);
    }
}

// --- VARIABILI ---
let selectedCell = null; 
let currentTurn = 'black'; 
let isGameOver = false;
let boardState = [];
let gameHistory = []; 
let moveLog = []; 
let currentHistoryIndex = 0; 
let isAnimating = false; 
let gameOptions = { showHints: true };

const initialLayout = [
    [0, 0, 0, 3, 3, 3, 0, 0, 0],
    [0, 0, 0, 0, 3, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 0, 0, 0, 0],
    [3, 0, 0, 0, 1, 0, 0, 0, 3],
    [3, 3, 1, 1, 2, 1, 1, 3, 3],
    [3, 0, 0, 0, 1, 0, 0, 0, 3],
    [0, 0, 0, 0, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 3, 0, 0, 0, 0],
    [0, 0, 0, 3, 3, 3, 0, 0, 0]
];

// --- LOGICA PRINCIPALE ---

function startGame() {
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('game-wrapper').classList.remove('hidden');
    document.getElementById('game-over-modal').classList.add('hidden');
    document.body.classList.add('game-active');

    // Reset Totale
    boardState = JSON.parse(JSON.stringify(initialLayout));
    currentTurn = 'black';
    isGameOver = false;
    selectedCell = null;
    isAnimating = false;
    
    gameHistory = [JSON.parse(JSON.stringify(boardState))];
    moveLog = [];
    currentHistoryIndex = 0;
    
    updateMoveTable();
    updateTurnUI();
    drawBoard();
}

function resetGame() { startGame(); }

function goToAnalysis() {
    localStorage.setItem('tablutAnalysisData', JSON.stringify({ history: gameHistory, moves: moveLog, winner: document.getElementById('winner-title').innerText }));
    window.location.href = 'analysis/analysis.html';
}

function drawBoard() {
    const boardEl = document.getElementById('board');
    if (!boardEl) return;
    boardEl.innerHTML = '';
    
    // Recupero Sicuro Stato
    let state = initialLayout;
    if (gameHistory.length > 0 && gameHistory[currentHistoryIndex]) {
        state = gameHistory[currentHistoryIndex];
    } else {
        gameHistory = [JSON.parse(JSON.stringify(initialLayout))];
        currentHistoryIndex = 0;
    }

    const isLatest = (currentHistoryIndex === gameHistory.length - 1);
    let moves = [];
    
    if (isLatest && !isGameOver && gameOptions.showHints && selectedCell) {
        moves = getPossibleMoves(selectedCell.r, selectedCell.c, state);
    }

    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.row = r;
            cell.dataset.col = c;

            // Coordinate
            if (r === 8) cell.innerHTML += `<span class="coord coord-letter">${String.fromCharCode(97 + c)}</span>`;
            if (c === 0) cell.innerHTML += `<span class="coord coord-num">${9 - r}</span>`;

            // Classi speciali
            if (r === 4 && c === 4) cell.classList.add('throne');
            if ((r===0||r===8) && (c===0||c===8)) cell.classList.add('escape');

            // Selezione
            if (isLatest && selectedCell && selectedCell.r === r && selectedCell.c === c) {
                cell.classList.add('selected');
            }

            // Hint
            if (isLatest && moves.some(m => m.r === r && m.c === c)) {
                const dot = document.createElement('div');
                dot.className = 'hint-dot';
                cell.appendChild(dot);
            }

            // Pezzo
            const val = state[r][c];
            if (val !== 0) {
                const piece = document.createElement('div');
                piece.className = 'piece';
                if (val === 1) piece.classList.add('white-piece');
                if (val === 2) { piece.classList.add('white-piece'); piece.classList.add('king'); }
                if (val === 3) piece.classList.add('black-piece');
                cell.appendChild(piece);
            }

            if (isLatest) {
                cell.addEventListener('click', () => handleInput(r, c));
            } else {
                cell.style.cursor = 'default';
            }
            
            boardEl.appendChild(cell);
        }
    }
    updateNavUI();
}

function handleInput(r, c) {
    if (isGameOver || isAnimating) return; 
    
    const currentState = gameHistory[currentHistoryIndex];
    const clickedVal = currentState[r][c];
    
    // Selezione
    if (isMyPiece(clickedVal)) {
        selectedCell = { r, c };
        drawBoard(); 
        return;
    }

    // Movimento
    if (selectedCell && clickedVal === 0) {
        if (isValidMove(selectedCell.r, selectedCell.c, r, c, currentState)) {
            performMoveWithAnimation(selectedCell.r, selectedCell.c, r, c, currentState);
        }
    }
}

function performMoveWithAnimation(r1, c1, r2, c2, currentState) {
    const pieceVal = currentState[r1][c1];
    isAnimating = true;

    // 1. Prepara elementi DOM
    const startCell = document.querySelector(`.cell[data-row='${r1}'][data-col='${c1}']`);
    const endCell = document.querySelector(`.cell[data-row='${r2}'][data-col='${c2}']`);
    
    let ghost = null;

    if (startCell && endCell) {
        const pieceEl = startCell.querySelector('.piece');
        if (pieceEl) pieceEl.classList.add('invisible');

        const rect1 = startCell.getBoundingClientRect();
        const rect2 = endCell.getBoundingClientRect();

        ghost = document.createElement('div');
        ghost.className = 'piece animating-piece';
        if (pieceVal === 1) ghost.classList.add('white-piece');
        if (pieceVal === 2) { ghost.classList.add('white-piece', 'king'); }
        if (pieceVal === 3) ghost.classList.add('black-piece');

        ghost.style.width = rect1.width * 0.8 + 'px';
        ghost.style.height = rect1.height * 0.8 + 'px';
        ghost.style.left = (rect1.left + rect1.width * 0.1) + 'px';
        ghost.style.top = (rect1.top + rect1.height * 0.1) + 'px';
        
        document.body.appendChild(ghost);

        // Forza reflow
        void ghost.offsetWidth;

        ghost.style.left = (rect2.left + rect2.width * 0.1) + 'px';
        ghost.style.top = (rect2.top + rect2.height * 0.1) + 'px';
    }

    // 2. Timer infallibile: Dopo 250ms esegue la logica, INDIPENDENTEMENTE dalla grafica
    setTimeout(() => {
        if (ghost) ghost.remove();
        executeMoveLogic(r1, c1, r2, c2);
        isAnimating = false;
        selectedCell = null;
    }, 250);
}

function executeMoveLogic(r1, c1, r2, c2) {
    // Nuova copia stato
    const newState = JSON.parse(JSON.stringify(gameHistory[currentHistoryIndex]));
    const piece = newState[r1][c1];
    newState[r2][c2] = piece;
    newState[r1][c1] = 0;
    
    boardState = newState;
    
    const txt = `${getNotation(r1, c1)}-${getNotation(r2, c2)}`;
    moveLog.push({ color: currentTurn, text: txt, from: {r: r1, c: c1}, to: {r: r2, c: c2} });
    
    gameHistory.push(newState);
    currentHistoryIndex++;

    checkCaptures(r2, c2, newState);
    
    if (!checkWin(newState)) {
        currentTurn = (currentTurn === 'white') ? 'black' : 'white';
    }
    
    updateMoveTable();
    updateTurnUI();
    drawBoard();
}

function navigateHistory(dir) {
    if (isAnimating) return;
    if (dir === -1 && currentHistoryIndex > 0) currentHistoryIndex--;
    else if (dir === 1 && currentHistoryIndex < gameHistory.length - 1) currentHistoryIndex++;
    else return;

    drawBoard();
}

// --- UTILITY E REGOLE (Standard) ---
function updateNavUI() {
    const p = document.getElementById('btn-prev');
    const n = document.getElementById('btn-next');
    if(p) p.disabled = (currentHistoryIndex === 0);
    if(n) n.disabled = (currentHistoryIndex === gameHistory.length - 1);
}

function getNotation(r, c) { return `${String.fromCharCode(97 + c)}${9 - r}`; }

function updateMoveTable() {
    const list = document.getElementById('move-list-body');
    if(!list) return;
    list.innerHTML = '';
    for (let i = 0; i < moveLog.length; i += 2) {
        const row = document.createElement('tr');
        const n = document.createElement('td'); n.innerText = (i/2)+1 + ".";
        const b = document.createElement('td'); b.innerText = moveLog[i].text;
        const w = document.createElement('td'); 
        if(moveLog[i+1]) w.innerText = moveLog[i+1].text;
        row.append(n, b, w);
        list.appendChild(row);
    }
    const c = document.getElementById('move-history-container');
    if(c) c.scrollTop = c.scrollHeight;
}

function isMyPiece(val) {
    if (currentTurn === 'white') return (val === 1 || val === 2);
    if (currentTurn === 'black') return (val === 3);
    return false;
}

function isValidMove(r1, c1, r2, c2, state) {
    if (r1===r2 && c1===c2) return false;
    const p = state[r1][c1];
    if (p === 2) { if (Math.abs(r1-r2) + Math.abs(c1-c2) !== 1) return false; return true; }
    
    const dr = Math.sign(r2-r1), dc = Math.sign(c2-c1);
    if (dr !== 0 && dc !== 0) return false; // Solo ortogonale

    let nr = r1 + dr, nc = c1 + dc;
    while (nr !== r2 || nc !== c2) {
        if (state[nr][nc] !== 0) return false;
        if (nr === 4 && nc === 4) return false;
        nr += dr; nc += dc;
    }
    // Accesso vietato a campi speciali (tranne Re)
    if ((r2===0||r2===8) && (c2===0||c2===8)) return false;
    if (r2===4 && c2===4) return false;
    
    return true;
}

function getPossibleMoves(r, c, state) {
    let m = [];
    for (let i=0; i<9; i++) for (let j=0; j<9; j++) 
        if (state[i][j]===0 && isValidMove(r, c, i, j, state)) m.push({r:i, c:j});
    return m;
}

function checkCaptures(r, c, state) {
    const me = state[r][c];
    const isWhite = (me === 1 || me === 2);
    let captured = false;
    [[-1,0], [1,0], [0,-1], [0,1]].forEach(d => {
        const nr = r + d[0], nc = c + d[1];
        const fr = r + d[0]*2, fc = c + d[1]*2;
        if (isInBounds(nr, nc) && isInBounds(fr, fc)) {
            const nVal = state[nr][nc], fVal = state[fr][fc];
            const isEnemy = isWhite ? (nVal === 3) : (nVal === 1 || nVal === 2);
            if (isEnemy) {
                if (nVal === 2) { checkKingCapture(nr, nc, state); return; }
                let anvil = false;
                if (fVal !== 0) {
                    const fFriend = isWhite ? (fVal===1 || fVal===2) : (fVal===3);
                    if (fFriend) anvil = true;
                } else if (isHostile(fr, fc)) anvil = true;
                
                if (anvil) { state[nr][nc] = 0; captured = true; }
            }
        }
    });
    if(captured) gameHistory[currentHistoryIndex] = JSON.parse(JSON.stringify(state));
}

function checkKingCapture(r, c, state) {
    // Semplificata per brevità: Re catturato se circondato su 4 lati
    // In variante linneo spesso basta 2 lati fuori dal trono, ma qui usiamo regola base
    let count = 0;
    [[-1,0],[1,0],[0,-1],[0,1]].forEach(d => {
        const nr=r+d[0], nc=c+d[1];
        if(isInBounds(nr,nc)) {
            if(state[nr][nc]===3 || isHostile(nr,nc)) count++;
        }
    });
    // Se trono: 4 lati. Se fuori: 4 lati (o 2 a seconda della variante, qui lasciamo difficile)
    // Per fixare veloce: Se Re è su trono serve 4. Se fuori serve 2 (verticale o orizzontale).
    const onThrone = (r===4 && c===4);
    if (onThrone && count===4) win('Neri');
    else if (!onThrone) {
        // Controllo a morsa
        const v = (chk(r-1,c,state) && chk(r+1,c,state));
        const h = (chk(r,c-1,state) && chk(r,c+1,state));
        if(v || h) win('Neri');
    }
}
function chk(r, c, s) { return isInBounds(r,c) && (s[r][c]===3 || isHostile(r,c)); }

function checkWin(state) {
    let k = null;
    for(let i=0;i<9;i++) for(let j=0;j<9;j++) if(state[i][j]===2) k={r:i,c:j};
    if(!k) { win('Neri'); return true; }
    if((k.r===0||k.r===8) && (k.c===0||k.c===8)) { win('Bianchi'); return true; }
    return false;
}

function win(who) {
    isGameOver = true;
    document.getElementById('winner-title').innerText = `Vittoria ${who}!`;
    document.getElementById('game-over-modal').classList.remove('hidden');
}

function updateTurnUI() {
    const el = document.getElementById('current-player');
    if (currentTurn === 'black') { el.innerText = "Neri"; el.style.color = "black"; } 
    else { el.innerText = "Bianchi"; el.style.color = "#d4a017"; }
}

function isHostile(r, c) { return ((r===0||r===8) && (c===0||c===8)) || (r===4 && c===4); }
function isInBounds(r, c) { return r>=0 && r<9 && c>=0 && c<9; }
