document.addEventListener('DOMContentLoaded', () => {
    // --- GESTIONE EVENTI ---
    document.getElementById('start-btn').addEventListener('click', startGame);
    document.getElementById('play-again-btn').addEventListener('click', resetGame);
    document.getElementById('analyze-btn').addEventListener('click', goToAnalysis);

    document.getElementById('btn-prev').addEventListener('click', () => navigateHistory(-1));
    document.getElementById('btn-next').addEventListener('click', () => navigateHistory(1));

    document.addEventListener('keydown', (e) => {
        if (gameWrapper.classList.contains('hidden')) return;
        if (e.key === 'ArrowLeft') navigateHistory(-1);
        else if (e.key === 'ArrowRight') navigateHistory(1);
    });

    // Impostazioni
    const settingsIcon = document.getElementById('settings-icon');
    const settingsMenu = document.getElementById('settings-menu');
    const closeSettings = document.getElementById('close-settings');
    const toggleHints = document.getElementById('toggle-hints');

    settingsIcon.addEventListener('click', () => settingsMenu.classList.toggle('hidden'));
    closeSettings.addEventListener('click', () => settingsMenu.classList.add('hidden'));
    toggleHints.addEventListener('change', (e) => {
        gameOptions.showHints = e.target.checked;
        if (selectedCell) drawBoard();
    });
});

// --- VARIABILI GLOBALI ---
const boardElement = document.getElementById('board');
const currentPlayerSpan = document.getElementById('current-player');
const gameWrapper = document.getElementById('game-wrapper');
const mainMenu = document.getElementById('main-menu');
const gameOverModal = document.getElementById('game-over-modal');
const winnerTitle = document.getElementById('winner-title');
const winnerMessage = document.getElementById('winner-message');
const moveListBody = document.getElementById('move-list-body');
// Nota: titleContainer non è strettamente necessario qui perché usiamo document.body, ma lo lasciamo per coerenza

let selectedCell = null; 
let currentTurn = 'black'; 
let isGameOver = false;
let boardState = [];

// STORIA, LOG E ANIMAZIONE
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
    
    // NUOVO: Attiva la modalità "In Gioco" sul body per spostare il logo
    document.body.classList.add('game-active');

    boardState = JSON.parse(JSON.stringify(initialLayout));
    currentTurn = 'black';
    isGameOver = false;
    selectedCell = null;
    
    gameHistory = [JSON.parse(JSON.stringify(boardState))];
    moveLog = [];
    currentHistoryIndex = 0;
    
    updateMoveTable();
    updateTurnUI();
    drawBoard();
}

function resetGame() { startGame(); }

function goToAnalysis() {
    const gameData = {
        history: gameHistory,
        moves: moveLog,
        winner: winnerTitle.innerText
    };
    localStorage.setItem('tablutAnalysisData', JSON.stringify(gameData));
    window.location.href = 'analysis/analysis.html';
}

// --- ENGINE ANIMAZIONE ---

function animatePieceMovement(fromR, fromC, toR, toC, pieceVal, callback) {
    const startCell = document.querySelector(`.cell[data-row='${fromR}'][data-col='${fromC}']`);
    const endCell = document.querySelector(`.cell[data-row='${toR}'][data-col='${toC}']`);

    if (!startCell || !endCell) { callback(); return; }

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
        ghost.style.left = (endRect.left + (endRect.width * 0.125)) + 'px';
        ghost.style.top = (endRect.top + (endRect.height * 0.125)) + 'px';

        ghost.addEventListener('transitionend', () => {
            ghost.remove();
            callback();
        }, { once: true });
    });
}

// --- NAVIGAZIONE STORIA ---

function navigateHistory(direction) {
    const now = Date.now();
    const isFast = (now - lastNavTime < 200); 
    lastNavTime = now;

    if (isAnimating) return; 

    if (direction === -1) {
        if (currentHistoryIndex > 0) {
            if (isFast) {
                currentHistoryIndex--;
                drawBoard();
                updateNavButtons();
            } else {
                const moveData = moveLog[currentHistoryIndex - 1]; 
                isAnimating = true;
                
                const pieceVal = gameHistory[currentHistoryIndex][moveData.to.r][moveData.to.c];

                animatePieceMovement(
                    moveData.to.r, moveData.to.c, 
                    moveData.from.r, moveData.from.c, 
                    pieceVal, 
                    () => {
                        currentHistoryIndex--;
                        drawBoard();
                        updateNavButtons();
                        isAnimating = false;
                    }
                );
            }
        }
    } 
    else if (direction === 1) {
        if (currentHistoryIndex < gameHistory.length - 1) {
            if (isFast) {
                currentHistoryIndex++;
                drawBoard();
                updateNavButtons();
            } else {
                const moveData = moveLog[currentHistoryIndex];
                isAnimating = true;

                const pieceVal = gameHistory[currentHistoryIndex][moveData.from.r][moveData.from.c];

                animatePieceMovement(
                    moveData.from.r, moveData.from.c, 
                    moveData.to.r, moveData.to.c, 
                    pieceVal, 
                    () => {
                        currentHistoryIndex++;
                        drawBoard();
                        updateNavButtons();
                        isAnimating = false;
                    }
                );
            }
        }
    }
}

function updateNavButtons() {
    document.getElementById('btn-prev').disabled = (currentHistoryIndex === 0);
    document.getElementById('btn-next').disabled = (currentHistoryIndex === gameHistory.length - 1);
}

// --- DISEGNO SCACCHIERA ---

function drawBoard() {
    boardElement.innerHTML = '';
    const stateToDraw = gameHistory[currentHistoryIndex];
    const isLatest = (currentHistoryIndex === gameHistory.length - 1);

    let possibleMoves = [];
    if (isLatest && !isGameOver && gameOptions.showHints && selectedCell) {
        possibleMoves = getPossibleMoves(selectedCell.r, selectedCell.c);
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

            // Colori speciali
            if (r === 4 && c === 4) cell.classList.add('throne');
            if ((r===0||r===8) && (c===0||c===8)) cell.classList.add('escape');

            // Selezione
            if (isLatest && selectedCell && selectedCell.r === r && selectedCell.c === c) {
                cell.classList.add('selected');
            }

            // Suggerimenti
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

// --- MOSSE E REGOLE ---

function onCellClick(r, c) {
    if (isGameOver || isAnimating) return; 
    const clickedVal = boardState[r][c];
    
    if (isMyPiece(clickedVal)) {
        selectedCell = { r, c };
        drawBoard(); 
        return;
    }

    if (selectedCell && clickedVal === 0) {
        if (isValidMove(selectedCell.r, selectedCell.c, r, c)) {
            const fromR = selectedCell.r;
            const fromC = selectedCell.c;
            const pieceVal = boardState[fromR][fromC];

            isAnimating = true;
            animatePieceMovement(fromR, fromC, r, c, pieceVal, () => {
                isAnimating = false;
                movePiece(fromR, fromC, r, c);
            });
            
            selectedCell = null;
            drawBoard(); 
        }
    }
}

function movePiece(r1, c1, r2, c2) {
    const piece = boardState[r1][c1];
    boardState[r2][c2] = piece;
    boardState[r1][c1] = 0;

    const startNotation = getNotation(r1, c1);
    const endNotation = getNotation(r2, c2);
    
    moveLog.push({
        color: currentTurn,
        text: `${startNotation}-${endNotation}`,
        from: {r: r1, c: c1}, 
        to: {r: r2, c: c2}
    });
    
    const newState = JSON.parse(JSON.stringify(boardState));
    gameHistory.push(newState);
    currentHistoryIndex++;

    checkCaptures(r2, c2);
    
    if (checkWin()) return;

    currentTurn = (currentTurn === 'white') ? 'black' : 'white';
    updateMoveTable();
    updateTurnUI();
    drawBoard();
}

function getNotation(r, c) {
    return `${String.fromCharCode(97 + c)}${9 - r}`;
}

function updateMoveTable() {
    moveListBody.innerHTML = '';
    for (let i = 0; i < moveLog.length; i += 2) {
        const row = document.createElement('tr');
        const num = document.createElement('td');
        num.innerText = (i / 2) + 1 + ".";
        row.appendChild(num);
        
        const black = document.createElement('td');
        black.innerText = moveLog[i].text;
        row.appendChild(black);

        const white = document.createElement('td');
        if (i + 1 < moveLog.length) white.innerText = moveLog[i+1].text;
        row.appendChild(white);
        
        moveListBody.appendChild(row);
    }
    const container = document.getElementById('move-history-container');
    container.scrollTop = container.scrollHeight;
}

// --- LOGICA REGOLE ---
function isMyPiece(val) {
    if (currentTurn === 'white') return (val === 1 || val === 2);
    if (currentTurn === 'black') return (val === 3);
    return false;
}

function isValidMove(r1, c1, r2, c2) {
    const movingPiece = boardState[r1][c1];
    if (movingPiece === 2) {
        if (Math.abs(r1 - r2) + Math.abs(c1 - c2) !== 1) return false;
        return true;
    }
    if (r1 !== r2 && c1 !== c2) return false;
    const dr = Math.sign(r2 - r1);
    const dc = Math.sign(c2 - c1);
    let nr = r1 + dr;
    let nc = c1 + dc;
    while (nr !== r2 || nc !== c2) {
        if (boardState[nr][nc] !== 0) return false; 
        if (nr === 4 && nc === 4) return false;    
        nr += dr;
        nc += dc;
    }
    if ((r2 === 4 && c2 === 4) || ((r2===0||r2===8) && (c2===0||c2===8))) return false;
    return true;
}

function checkCaptures(r, c) {
    const dirs = [[-1,0], [1,0], [0,-1], [0,1]];
    const me = boardState[r][c];
    const iAmWhite = (me === 1 || me === 2);
    let captured = false;

    dirs.forEach(d => {
        const adjR = r + d[0];
        const adjC = c + d[1];
        const farR = r + (d[0] * 2);
        const farC = c + (d[1] * 2);

        if (!isInBounds(adjR, adjC) || !isInBounds(farR, farC)) return;
        const neighbor = boardState[adjR][adjC];
        const far = boardState[farR][farC];
        const isEnemy = iAmWhite ? (neighbor === 3) : (neighbor === 1 || neighbor === 2);

        if (isEnemy) {
            if (neighbor === 2) { checkKingCapture(adjR, adjC); return; }
            let anvil = false;
            if (far !== 0) {
                const farIsFriend = iAmWhite ? (far === 1 || far === 2) : (far === 3);
                if (farIsFriend) anvil = true;
            } else if (isHostileStructure(farR, farC)) anvil = true;

            if (anvil) {
                boardState[adjR][adjC] = 0;
                captured = true;
            }
        }
    });
    if (captured) {
        gameHistory[currentHistoryIndex] = JSON.parse(JSON.stringify(boardState));
    }
}

function checkKingCapture(kR, kC) {
    if (kR === 4 && kC === 4) {
        let enemies = 0;
        [[-1,0], [1,0], [0,-1], [0,1]].forEach(d => {
            if (boardState[4+d[0]][4+d[1]] === 3) enemies++;
        });
        if (enemies === 4) {
            boardState[4][4] = 0;
            showVictory("Vittoria Neri!", "I Neri hanno catturato il Re sul Trono!");
        }
    } else {
        const isBlack = (r, c) => (isInBounds(r,c) && boardState[r][c] === 3) || isHostileStructure(r,c);
        if ((isBlack(kR-1, kC) && isBlack(kR+1, kC)) || (isBlack(kR, kC-1) && isBlack(kR, kC+1))) {
            boardState[kR][kC] = 0;
            showVictory("Vittoria Neri!", "Il Re è caduto nell'imboscata!");
        }
    }
}

function updateTurnUI() {
    if (currentTurn === 'black') {
        currentPlayerSpan.innerText = "Neri";
        currentPlayerSpan.style.color = "black";
    } else {
        currentPlayerSpan.innerText = "Bianchi";
        currentPlayerSpan.style.color = "#d4a017";
    }
}

function showVictory(title, msg) {
    isGameOver = true;
    winnerTitle.innerText = title;
    winnerMessage.innerText = msg;
    gameOverModal.classList.remove('hidden');
}

function isHostileStructure(r, c) {
    return ((r===0||r===8) && (c===0||c===8)) || (r===4 && c===4);
}
function isInBounds(r, c) { return r>=0 && r<9 && c>=0 && c<9; }
