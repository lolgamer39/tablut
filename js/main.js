document.addEventListener('DOMContentLoaded', () => {
    // --- EVENTI ---
    const startBtn = document.getElementById('start-btn');
    if(startBtn) startBtn.addEventListener('click', startGame);
    
    const resetBtn = document.getElementById('play-again-btn');
    if(resetBtn) resetBtn.addEventListener('click', resetGame);
    
    const analyzeBtn = document.getElementById('analyze-btn');
    if(analyzeBtn) analyzeBtn.addEventListener('click', goToAnalysis);

    const btnPrev = document.getElementById('btn-prev');
    if(btnPrev) btnPrev.addEventListener('click', () => navigateHistory(-1));
    
    const btnNext = document.getElementById('btn-next');
    if(btnNext) btnNext.addEventListener('click', () => navigateHistory(1));

    document.addEventListener('keydown', (e) => {
        if (gameWrapper && gameWrapper.classList.contains('hidden')) return;
        if (e.key === 'ArrowLeft') navigateHistory(-1);
        else if (e.key === 'ArrowRight') navigateHistory(1);
    });

    // Impostazioni
    const settingsIcon = document.getElementById('settings-icon');
    const settingsMenu = document.getElementById('settings-menu');
    const closeSettings = document.getElementById('close-settings');
    const toggleHints = document.getElementById('toggle-hints');
    const bgSelect = document.getElementById('bg-select');
    const boardSelect = document.getElementById('board-select');

    if(settingsIcon) settingsIcon.addEventListener('click', () => settingsMenu.classList.toggle('hidden'));
    if(closeSettings) closeSettings.addEventListener('click', () => settingsMenu.classList.add('hidden'));
    
    if(toggleHints) {
        toggleHints.addEventListener('change', (e) => {
            gameOptions.showHints = e.target.checked;
            if (selectedCell) drawBoard();
        });
    }

    if(bgSelect) bgSelect.addEventListener('change', (e) => applyTheme('bg', e.target.value));
    if(boardSelect) boardSelect.addEventListener('change', (e) => applyTheme('board', e.target.value));
});

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

// --- VARIABILI GLOBALI ---
const boardElement = document.getElementById('board');
const currentPlayerSpan = document.getElementById('current-player');
const gameWrapper = document.getElementById('game-wrapper');
const mainMenu = document.getElementById('main-menu');
const gameOverModal = document.getElementById('game-over-modal');
const winnerTitle = document.getElementById('winner-title');
const winnerMessage = document.getElementById('winner-message');
const moveListBody = document.getElementById('move-list-body');

let selectedCell = null; 
let currentTurn = 'black'; 
let isGameOver = false;
let boardState = [];
let gameHistory = []; 
let moveLog = []; 
let currentHistoryIndex = 0; 
let lastNavTime = 0; 
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

// --- LOGICA GIOCO ---

function startGame() {
    mainMenu.classList.add('hidden');
    gameWrapper.classList.remove('hidden');
    gameOverModal.classList.add('hidden');
    document.body.classList.add('game-active');

    // Reset Totale e Sicuro
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
    const gameData = { history: gameHistory, moves: moveLog, winner: winnerTitle.innerText };
    localStorage.setItem('tablutAnalysisData', JSON.stringify(gameData));
    window.location.href = 'analysis/analysis.html';
}

function drawBoard() {
    if (!boardElement) return;
    boardElement.innerHTML = '';
    
    // Recupero Sicuro dello Stato
    let stateToDraw = initialLayout;
    
    // Controlla se la storia è valida, altrimenti ripara
    if (gameHistory && gameHistory.length > 0) {
        if (currentHistoryIndex < 0) currentHistoryIndex = 0;
        if (currentHistoryIndex >= gameHistory.length) currentHistoryIndex = gameHistory.length - 1;
        stateToDraw = gameHistory[currentHistoryIndex];
    } else {
        // Ripristino di emergenza
        gameHistory = [JSON.parse(JSON.stringify(initialLayout))];
        currentHistoryIndex = 0;
        stateToDraw = initialLayout;
    }

    const isLatest = (currentHistoryIndex === gameHistory.length - 1);
    let possibleMoves = [];
    
    // Calcolo mosse solo se non è game over e siamo nel presente
    if (isLatest && !isGameOver && gameOptions.showHints && selectedCell) {
        possibleMoves = getPossibleMoves(selectedCell.r, selectedCell.c, stateToDraw);
    }

    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            const cell = document.createElement('div');
            cell.classList.add('cell');
            cell.dataset.row = r;
            cell.dataset.col = c;

            // Coordinate
            if (r === 8) {
                const l = document.createElement('span');
                l.classList.add('coord', 'coord-letter');
                l.innerText = String.fromCharCode(97 + c);
                cell.appendChild(l);
            }
            if (c === 0) {
                const n = document.createElement('span');
                n.classList.add('coord', 'coord-num');
                n.innerText = 9 - r;
                cell.appendChild(n);
            }

            // Caselle speciali
            if (r === 4 && c === 4) cell.classList.add('throne');
            if ((r===0||r===8) && (c===0||c===8)) cell.classList.add('escape');

            // Selezione
            if (isLatest && selectedCell && selectedCell.r === r && selectedCell.c === c) {
                cell.classList.add('selected');
            }

            // Pallini
            if (isLatest && possibleMoves.some(m => m.r === r && m.c === c)) {
                const dot = document.createElement('div');
                dot.classList.add('hint-dot');
                cell.appendChild(dot);
            }

            // Pezzi
            const val = stateToDraw[r][c];
            if (val !== 0) {
                const piece = document.createElement('div');
                piece.classList.add('piece');
                if (val === 1) piece.classList.add('white-piece');
                if (val === 2) { piece.classList.add('white-piece'); piece.classList.add('king'); }
                if (val === 3) piece.classList.add('black-piece');
                cell.appendChild(piece);
            }

            // Click
            if (isLatest) {
                cell.addEventListener('click', () => onCellClick(r, c));
            } else {
                cell.style.cursor = 'default';
            }
            
            boardElement.appendChild(cell);
        }
    }
    updateNavButtons();
}

function onCellClick(r, c) {
    if (isGameOver || isAnimating) return; 
    
    // Usa sempre lo stato sicuro dalla storia
    const currentState = gameHistory[currentHistoryIndex];
    if (!currentState) return;

    const clickedVal = currentState[r][c];
    
    if (isMyPiece(clickedVal)) {
        selectedCell = { r, c };
        drawBoard(); 
        return;
    }

    if (selectedCell && clickedVal === 0) {
        if (isValidMove(selectedCell.r, selectedCell.c, r, c, currentState)) {
            const fromR = selectedCell.r;
            const fromC = selectedCell.c;
            const pieceVal = currentState[fromR][fromC];

            isAnimating = true;
            animatePieceMovement(fromR, fromC, r, c, pieceVal, () => {
                isAnimating = false;
                executeMoveLogic(fromR, fromC, r, c);
            });
            
            selectedCell = null;
        }
    }
}

function animatePieceMovement(fromR, fromC, toR, toC, pieceVal, callback) {
    const startCell = document.querySelector(`.cell[data-row='${fromR}'][data-col='${fromC}']`);
    const endCell = document.querySelector(`.cell[data-row='${toR}'][data-col='${toC}']`);

    if (!startCell || !endCell) { callback(); return; }

    const originalPiece = startCell.querySelector('.piece');
    if (originalPiece) originalPiece.classList.add('invisible');

    const startRect = startCell.getBoundingClientRect();
    const endRect = endCell.getBoundingClientRect();

    const ghost = document.createElement('div');
    ghost.classList.add('piece', 'animating-piece');
    
    if (pieceVal === 1) ghost.classList.add('white-piece');
    else if (pieceVal === 2) { ghost.classList.add('white-piece', 'king'); }
    else if (pieceVal === 3) ghost.classList.add('black-piece');

    ghost.style.width = startRect.width * 0.75 + 'px'; 
    ghost.style.height = startRect.height * 0.75 + 'px';
    ghost.style.left = (startRect.left + (startRect.width * 0.125)) + 'px'; 
    ghost.style.top = (startRect.top + (startRect.height * 0.125)) + 'px';

    document.body.appendChild(ghost);

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            ghost.style.left = (endRect.left + (endRect.width * 0.125)) + 'px';
            ghost.style.top = (endRect.top + (endRect.height * 0.125)) + 'px';
        });
    });

    const finish = () => {
        ghost.remove();
        callback();
    };
    ghost.addEventListener('transitionend', finish, { once: true });
    setTimeout(finish, 400); // Fallback di sicurezza
}

function executeMoveLogic(r1, c1, r2, c2) {
    // Clonazione profonda sicura
    const newState = JSON.parse(JSON.stringify(gameHistory[currentHistoryIndex]));
    const piece = newState[r1][c1];
    newState[r2][c2] = piece;
    newState[r1][c1] = 0;
    
    boardState = newState;
    const moveText = `${getNotation(r1, c1)}-${getNotation(r2, c2)}`;
    moveLog.push({ color: currentTurn, text: moveText, from: {r: r1, c: c1}, to: {r: r2, c: c2} });
    
    gameHistory.push(newState);
    currentHistoryIndex++;
    checkCaptures(r2, c2, newState);
    
    if (checkWin(newState)) return;
    
    currentTurn = (currentTurn === 'white') ? 'black' : 'white';
    updateMoveTable();
    updateTurnUI();
    drawBoard();
}

// --- UTILS & REGOLE ---
function navigateHistory(direction) {
    if (isAnimating) return;
    const now = Date.now();
    const isFast = (now - lastNavTime < 250);
    lastNavTime = now;

    if (direction === -1 && currentHistoryIndex > 0) {
        if (isFast) {
            currentHistoryIndex--;
            drawBoard();
            updateNavButtons();
        } else {
            const lastMove = moveLog[currentHistoryIndex - 1]; 
            const pieceVal = gameHistory[currentHistoryIndex][lastMove.to.r][lastMove.to.c];
            isAnimating = true;
            animatePieceMovement(lastMove.to.r, lastMove.to.c, lastMove.from.r, lastMove.from.c, pieceVal, () => {
                isAnimating = false;
                currentHistoryIndex--;
                drawBoard();
                updateNavButtons();
            });
        }
    } else if (direction === 1 && currentHistoryIndex < gameHistory.length - 1) {
        if (isFast) {
            currentHistoryIndex++;
            drawBoard();
            updateNavButtons();
        } else {
            const nextMove = moveLog[currentHistoryIndex];
            const pieceVal = gameHistory[currentHistoryIndex][nextMove.from.r][nextMove.from.c];
            isAnimating = true;
            animatePieceMovement(nextMove.from.r, nextMove.from.c, nextMove.to.r, nextMove.to.c, pieceVal, () => {
                isAnimating = false;
                currentHistoryIndex++;
                drawBoard();
                updateNavButtons();
            });
        }
    }
}

function updateNavButtons() {
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');
    if(btnPrev) btnPrev.disabled = (currentHistoryIndex === 0);
    if(btnNext) btnNext.disabled = (currentHistoryIndex === gameHistory.length - 1);
}

function getNotation(r, c) { return `${String.fromCharCode(97 + c)}${9 - r}`; }
function updateMoveTable() {
    if(!moveListBody) return;
    moveListBody.innerHTML = '';
    for (let i = 0; i < moveLog.length; i += 2) {
        const row = document.createElement('tr');
        const num = document.createElement('td'); num.innerText = (i / 2) + 1 + ".";
        row.appendChild(num);
        const black = document.createElement('td'); black.innerText = moveLog[i].text;
        row.appendChild(black);
        const white = document.createElement('td');
        if (i + 1 < moveLog.length) white.innerText = moveLog[i+1].text;
        row.appendChild(white);
        moveListBody.appendChild(row);
    }
    const container = document.getElementById('move-history-container');
    if(container) container.scrollTop = container.scrollHeight;
}

function isMyPiece(val) {
    if (currentTurn === 'white') return (val === 1 || val === 2);
    if (currentTurn === 'black') return (val === 3);
    return false;
}

function isValidMove(r1, c1, r2, c2, state) {
    const s = state || boardState;
    if (r1 < 0 || r1 > 8 || c1 < 0 || c1 > 8) return false;
    const movingPiece = s[r1][c1];
    if (movingPiece === 2) { if (Math.abs(r1 - r2) + Math.abs(c1 - c2) !== 1) return false; return true; }
    if (r1 !== r2 && c1 !== c2) return false;
    const dr = Math.sign(r2 - r1);
    const dc = Math.sign(c2 - c1);
    let nr = r1 + dr; let nc = c1 + dc;
    while (nr !== r2 || nc !== c2) {
        if (nr < 0 || nr > 8 || nc < 0 || nc > 8) return false;
        if (s[nr][nc] !== 0) return false; 
        if (nr === 4 && nc === 4) return false;    
        nr += dr; nc += dc;
    }
    if ((r2 === 4 && c2 === 4) || ((r2===0||r2===8) && (c2===0||c2===8))) return false;
    return true;
}

function checkCaptures(r, c, state) {
    const dirs = [[-1,0], [1,0], [0,-1], [0,1]];
    const me = state[r][c];
    const iAmWhite = (me === 1 || me === 2);
    let captured = false;
    dirs.forEach(d => {
        const adjR = r + d[0]; const adjC = c + d[1];
        const farR = r + (d[0] * 2); const farC = c + (d[1] * 2);
        if (!isInBounds(adjR, adjC) || !isInBounds(farR, farC)) return;
        const neighbor = state[adjR][adjC];
        const far = state[farR][farC];
        const isEnemy = iAmWhite ? (neighbor === 3) : (neighbor === 1 || neighbor === 2);
        if (isEnemy) {
            if (neighbor === 2) { checkKingCapture(adjR, adjC, state); return; }
            let anvil = false;
            if (far !== 0) {
                const farIsFriend = iAmWhite ? (far === 1 || far === 2) : (far === 3);
                if (farIsFriend) anvil = true;
            } else if (isHostileStructure(farR, farC)) anvil = true;
            if (anvil) { state[adjR][adjC] = 0; captured = true; }
        }
    });
    if (captured) gameHistory[currentHistoryIndex] = JSON.parse(JSON.stringify(state));
}

function checkKingCapture(kR, kC, state) {
    if (kR === 4 && kC === 4) {
        let enemies = 0;
        [[-1,0], [1,0], [0,-1], [0,1]].forEach(d => { if (state[4+d[0]][4+d[1]] === 3) enemies++; });
        if (enemies === 4) { state[4][4] = 0; showVictory("Vittoria Neri!", "I Neri hanno catturato il Re sul Trono!"); }
    } else {
        const isBlack = (r, c) => (isInBounds(r,c) && state[r][c] === 3) || isHostileStructure(r,c);
        if ((isBlack(kR-1, kC) && isBlack(kR+1, kC)) || (isBlack(kR, kC-1) && isBlack(kR, kC+1))) {
            state[kR][kC] = 0; showVictory("Vittoria Neri!", "Il Re è caduto nell'imboscata!");
        }
    }
}

function checkWin(state) {
    const s = state || gameHistory[currentHistoryIndex];
    let king = null;
    for(let r=0; r<9; r++) { for(let c=0; c<9; c++) { if(s[r][c] === 2) king = {r,c}; } }
    if (!king) return true; 
    if ((king.r===0||king.r===8) && (king.c===0||king.c===8)) { showVictory("Vittoria Bianchi!", "Il Re ha raggiunto la salvezza!"); return true; }
    return false;
}

function updateTurnUI() {
    if (currentTurn === 'black') { currentPlayerSpan.innerText = "Neri"; currentPlayerSpan.style.color = "black"; } 
    else { currentPlayerSpan.innerText = "Bianchi"; currentPlayerSpan.style.color = "#d4a017"; }
}

function showVictory(title, msg) {
    isGameOver = true; winnerTitle.innerText = title; winnerMessage.innerText = msg; gameOverModal.classList.remove('hidden');
}

function isHostileStructure(r, c) { return ((r===0||r===8) && (c===0||c===8)) || (r===4 && c===4); }
function isInBounds(r, c) { return r>=0 && r<9 && c>=0 && c<9; }
