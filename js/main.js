document.addEventListener('DOMContentLoaded', () => {
    // --- GESTIONE EVENTI (LISTENER) ---

    // Pulsanti Menu e Gioco
    document.getElementById('start-btn').addEventListener('click', startGame);
    document.getElementById('play-again-btn').addEventListener('click', resetGame);
    document.getElementById('analyze-btn').addEventListener('click', goToAnalysis);

    // Pulsanti Navigazione Storia (Mouse)
    document.getElementById('btn-prev').addEventListener('click', showPrevMove);
    document.getElementById('btn-next').addEventListener('click', showNextMove);

    // Navigazione Storia (Tastiera)
    document.addEventListener('keydown', (e) => {
        if (gameWrapper.classList.contains('hidden')) return;

        if (e.key === 'ArrowLeft') {
            showPrevMove();
        } else if (e.key === 'ArrowRight') {
            showNextMove();
        }
    });

    // Pulsanti Impostazioni (Ingranaggio)
    const settingsIcon = document.getElementById('settings-icon');
    const settingsMenu = document.getElementById('settings-menu');
    const closeSettings = document.getElementById('close-settings');
    const toggleHints = document.getElementById('toggle-hints');

    settingsIcon.addEventListener('click', () => {
        settingsMenu.classList.toggle('hidden');
    });
    closeSettings.addEventListener('click', () => {
        settingsMenu.classList.add('hidden');
    });

    toggleHints.addEventListener('change', (e) => {
        gameOptions.showHints = e.target.checked;
        if (selectedCell) drawBoard();
    });
});

// --- VARIABILI DI STATO ---
const boardElement = document.getElementById('board');
const currentPlayerSpan = document.getElementById('current-player');
const gameWrapper = document.getElementById('game-wrapper');
const mainMenu = document.getElementById('main-menu');
const gameOverModal = document.getElementById('game-over-modal');
const winnerTitle = document.getElementById('winner-title');
const winnerMessage = document.getElementById('winner-message');
const moveListBody = document.getElementById('move-list-body');
const titleContainer = document.getElementById('title-container'); // Riferimento al titolo

let selectedCell = null; 
let currentTurn = 'black'; 
let isGameOver = false;
let boardState = [];

// STORIA E LOG
let gameHistory = []; 
let moveLog = [];     
let currentHistoryIndex = 0; 

// Opzioni
let gameOptions = {
    showHints: true
};

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

// --- FUNZIONI DI AVVIO E RESET ---

function startGame() {
    // Gestione UI
    mainMenu.classList.add('hidden');
    gameWrapper.classList.remove('hidden');
    gameOverModal.classList.add('hidden');
    
    // SPOSTA IL TITOLO: Aggiunge la classe che lo rende piccolo e in alto a sinistra
    titleContainer.classList.add('in-game');

    // Reset Variabili di Gioco
    boardState = JSON.parse(JSON.stringify(initialLayout));
    currentTurn = 'black';
    isGameOver = false;
    selectedCell = null;
    
    // Reset Storia
    gameHistory = [JSON.parse(JSON.stringify(boardState))];
    moveLog = [];
    currentHistoryIndex = 0;
    
    updateMoveTable();
    updateTurnUI();
    drawBoard();
}

function resetGame() {
    startGame();
}

function goToAnalysis() {
    const gameData = {
        history: gameHistory,
        moves: moveLog,
        winner: winnerTitle.innerText
    };
    localStorage.setItem('tablutAnalysisData', JSON.stringify(gameData));
    window.location.href = 'analysis/analysis.html';
}

// --- RENDERING (DISEGNO SCACCHIERA) ---

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
                const letter = document.createElement('span');
                letter.classList.add('coord', 'coord-letter');
                letter.innerText = String.fromCharCode(97 + c);
                cell.appendChild(letter);
            }
            if (c === 0) {
                const num = document.createElement('span');
                num.classList.add('coord', 'coord-num');
                num.innerText = 9 - r;
                cell.appendChild(num);
            }

            // Colori speciali
            if (r === 4 && c === 4) cell.classList.add('throne');
            if ((r===0||r===8) && (c===0||c===8)) cell.classList.add('escape');

            // Evidenzia Selezione
            if (isLatest && selectedCell && selectedCell.r === r && selectedCell.c === c) {
                cell.classList.add('selected');
            }

            // Pallini Suggerimento
            if (isLatest && possibleMoves.some(m => m.r === r && m.c === c)) {
                const dot = document.createElement('div');
                dot.classList.add('hint-dot');
                cell.appendChild(dot);
            }

            // Disegna Pezzi
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

// --- NAVIGAZIONE STORIA ---

function showPrevMove() {
    if (currentHistoryIndex > 0) {
        currentHistoryIndex--;
        drawBoard();
    }
}

function showNextMove() {
    if (currentHistoryIndex < gameHistory.length - 1) {
        currentHistoryIndex++;
        drawBoard();
    }
}

function updateNavButtons() {
    document.getElementById('btn-prev').disabled = (currentHistoryIndex === 0);
    document.getElementById('btn-next').disabled = (currentHistoryIndex === gameHistory.length - 1);
}

// --- NOTAZIONE E TABELLA ---

function getNotation(r, c) {
    const file = String.fromCharCode(97 + c);
    const rank = 9 - r;
    return `${file}${rank}`;
}

function updateMoveTable() {
    moveListBody.innerHTML = '';
    
    for (let i = 0; i < moveLog.length; i += 2) {
        const row = document.createElement('tr');
        
        const numCell = document.createElement('td');
        numCell.innerText = (i / 2) + 1 + ".";
        row.appendChild(numCell);

        const blackCell = document.createElement('td');
        blackCell.innerText = moveLog[i].text;
        row.appendChild(blackCell);

        const whiteCell = document.createElement('td');
        if (i + 1 < moveLog.length) {
            whiteCell.innerText = moveLog[i+1].text;
        }
        row.appendChild(whiteCell);

        moveListBody.appendChild(row);
    }

    const container = document.getElementById('move-history-container');
    container.scrollTop = container.scrollHeight;
}

// --- LOGICA DI GIOCO ---

function updateTurnUI() {
    if (currentTurn === 'black') {
        currentPlayerSpan.innerText = "Neri";
        currentPlayerSpan.style.color = "black";
    } else {
        currentPlayerSpan.innerText = "Bianchi";
        currentPlayerSpan.style.color = "#d4a017";
    }
}

function getPossibleMoves(r, c) {
    let moves = [];
    for (let i = 0; i < 9; i++) {
        for (let j = 0; j < 9; j++) {
            if (boardState[i][j] === 0 && isValidMove(r, c, i, j)) {
                moves.push({r: i, c: j});
            }
        }
    }
    return moves;
}

function onCellClick(r, c) {
    if (isGameOver) return;
    const clickedVal = boardState[r][c];
    
    if (isMyPiece(clickedVal)) {
        selectedCell = { r, c };
        drawBoard(); 
        return;
    }

    if (selectedCell && clickedVal === 0) {
        if (isValidMove(selectedCell.r, selectedCell.c, r, c)) {
            movePiece(selectedCell.r, selectedCell.c, r, c);
        }
    }
}

function isMyPiece(val) {
    if (currentTurn === 'white') return (val === 1 || val === 2);
    if (currentTurn === 'black') return (val === 3);
    return false;
}

function isValidMove(r1, c1, r2, c2) {
    const movingPiece = boardState[r1][c1];

    if (movingPiece === 2) {
        const diffR = Math.abs(r1 - r2);
        const diffC = Math.abs(c1 - c2);
        if (diffR + diffC !== 1) return false;
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

    const isRestricted = (r2 === 4 && c2 === 4) || ((r2===0||r2===8) && (c2===0||c2===8));
    if (isRestricted) return false;

    return true;
}

function movePiece(r1, c1, r2, c2) {
    const piece = boardState[r1][c1];
    boardState[r2][c2] = piece;
    boardState[r1][c1] = 0;

    const startNotation = getNotation(r1, c1);
    const endNotation = getNotation(r2, c2);
    const moveText = `${startNotation}-${endNotation}`; 
    
    moveLog.push({
        color: currentTurn,
        text: moveText
    });
    
    const newState = JSON.parse(JSON.stringify(boardState));
    gameHistory.push(newState);
    currentHistoryIndex++;

    updateMoveTable();
    checkCaptures(r2, c2);
    
    if (checkWin()) return;

    currentTurn = (currentTurn === 'white') ? 'black' : 'white';
    selectedCell = null;
    updateTurnUI();
    drawBoard();
}

// --- CATTURE E VITTORIA ---

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
            if (neighbor === 2) {
                checkKingCapture(adjR, adjC);
                return;
            }
            let anvil = false;
            if (far !== 0) {
                const farIsFriend = iAmWhite ? (far === 1 || far === 2) : (far === 3);
                if (farIsFriend) anvil = true;
            } else if (isHostileStructure(farR, farC)) {
                anvil = true;
            }

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
        const dirs = [[-1,0], [1,0], [0,-1], [0,1]];
        let enemies = 0;
        dirs.forEach(d => {
            if (boardState[4+d[0]][4+d[1]] === 3) enemies++;
        });
        if (enemies === 4) {
            boardState[4][4] = 0;
            showVictory("Vittoria Neri!", "I Neri hanno catturato il Re sul Trono!");
        }
    } else {
        const isBlack = (r, c) => (isInBounds(r,c) && boardState[r][c] === 3) || isHostileStructure(r,c);
        
        const vert = isBlack(kR-1, kC) && isBlack(kR+1, kC);
        const horiz = isBlack(kR, kC-1) && isBlack(kR, kC+1);
                      
        if (vert || horiz) {
            boardState[kR][kC] = 0;
            showVictory("Vittoria Neri!", "Il Re è caduto nell'imboscata!");
        }
    }
}

function isHostileStructure(r, c) {
    if ((r===0||r===8) && (c===0||c===8)) return true;
    if (r===4 && c===4) return true;
    return false;
}

function checkWin() {
    let king = null;
    for(let r=0; r<9; r++) {
        for(let c=0; c<9; c++) {
            if(boardState[r][c] === 2) king = {r,c};
        }
    }
    
    if (!king) return true; 

    if ((king.r===0||king.r===8) && (king.c===0||king.c===8)) {
        showVictory("Vittoria Bianchi!", "Il Re ha raggiunto la salvezza!");
        return true;
    }
    return false;
}

function showVictory(title, msg) {
    isGameOver = true;
    winnerTitle.innerText = title;
    winnerMessage.innerText = msg;
    gameOverModal.classList.remove('hidden');
}

function isInBounds(r, c) { return r>=0 && r<9 && c>=0 && c<9; }
