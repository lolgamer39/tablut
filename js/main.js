document.addEventListener('DOMContentLoaded', () => {
    // Pulsanti Gioco
    document.getElementById('start-btn').addEventListener('click', startGame);
    document.getElementById('play-again-btn').addEventListener('click', resetGame);

    // Pulsanti Impostazioni
    const settingsIcon = document.getElementById('settings-icon');
    const settingsMenu = document.getElementById('settings-menu');
    const closeSettings = document.getElementById('close-settings');
    const toggleHints = document.getElementById('toggle-hints');

    // Toggle Menu
    settingsIcon.addEventListener('click', () => {
        settingsMenu.classList.toggle('hidden');
    });
    closeSettings.addEventListener('click', () => {
        settingsMenu.classList.add('hidden');
    });

    // Toggle Hints
    toggleHints.addEventListener('change', (e) => {
        gameOptions.showHints = e.target.checked;
        if (selectedCell) drawBoard();
    });
});

// --- STATO DEL GIOCO ---
const boardElement = document.getElementById('board');
const currentPlayerSpan = document.getElementById('current-player');
const gameWrapper = document.getElementById('game-wrapper');
const mainMenu = document.getElementById('main-menu');
const gameOverModal = document.getElementById('game-over-modal');
const winnerTitle = document.getElementById('winner-title');
const winnerMessage = document.getElementById('winner-message');

let selectedCell = null; 
let currentTurn = 'black'; 
let isGameOver = false;
let boardState = [];

// Opzioni modificabili
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

// --- GESTIONE PARTITA ---

function startGame() {
    mainMenu.classList.add('hidden');
    gameWrapper.classList.remove('hidden');
    gameOverModal.classList.add('hidden');

    // Reset Variabili
    boardState = JSON.parse(JSON.stringify(initialLayout));
    currentTurn = 'black';
    isGameOver = false;
    selectedCell = null;
    
    updateTurnUI();
    drawBoard();
}

function resetGame() {
    startGame();
}

// --- RENDER ---

function drawBoard() {
    boardElement.innerHTML = '';
    
    // Calcolo suggerimenti se attivi
    let possibleMoves = [];
    if (gameOptions.showHints && selectedCell) {
        possibleMoves = getPossibleMoves(selectedCell.r, selectedCell.c);
    }

    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            const cell = document.createElement('div');
            cell.classList.add('cell');
            cell.dataset.row = r;
            cell.dataset.col = c;

            // Colori speciali
            if (r === 4 && c === 4) cell.classList.add('throne');
            if ((r===0||r===8) && (c===0||c===8)) cell.classList.add('escape');

            // 1. Evidenzia Selezione
            if (selectedCell && selectedCell.r === r && selectedCell.c === c) {
                cell.classList.add('selected');
            }

            // 2. Disegna Pallino Suggerimento
            if (possibleMoves.some(m => m.r === r && m.c === c)) {
                const dot = document.createElement('div');
                dot.classList.add('hint-dot');
                cell.appendChild(dot);
            }

            // Disegna Pezzi
            const val = boardState[r][c];
            if (val !== 0) {
                const piece = document.createElement('div');
                piece.classList.add('piece');
                if (val === 1) piece.classList.add('white-piece');
                if (val === 2) { piece.classList.add('white-piece'); piece.classList.add('king'); }
                if (val === 3) piece.classList.add('black-piece');
                cell.appendChild(piece);
            }

            cell.addEventListener('click', () => onCellClick(r, c));
            boardElement.appendChild(cell);
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

// --- LOGICA SUGGERIMENTI ---
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

// --- LOGICA MOVIMENTO ---

function onCellClick(r, c) {
    if (isGameOver) return;
    const clickedVal = boardState[r][c];
    
    // Seleziona pezzo amico
    if (isMyPiece(clickedVal)) {
        selectedCell = { r, c };
        drawBoard(); 
        return;
    }

    // Muovi in casella vuota
    if (selectedCell && clickedVal === 0) {
        if (isValidMove(selectedCell.r, selectedCell.c, r, c)) {
            movePiece(selectedCell.r, selectedCell.c, r, c);
        } else {
            console.log("Mossa non valida");
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

    // Re: muove di 1 casella
    if (movingPiece === 2) {
        const diffR = Math.abs(r1 - r2);
        const diffC = Math.abs(c1 - c2);
        if (diffR + diffC !== 1) return false;
        return true;
    }

    // Altri pezzi: Torre
    if (r1 !== r2 && c1 !== c2) return false;

    const dr = Math.sign(r2 - r1);
    const dc = Math.sign(c2 - c1);
    let nr = r1 + dr;
    let nc = c1 + dc;

    while (nr !== r2 || nc !== c2) {
        if (boardState[nr][nc] !== 0) return false; 
        // Trono vuoto blocca i soldati
        if (nr === 4 && nc === 4) return false; 
        nr += dr;
        nc += dc;
    }

    // Caselle proibite ai soldati
    const isRestricted = (r2 === 4 && c2 === 4) || ((r2===0||r2===8) && (c2===0||c2===8));
    if (isRestricted) return false;

    return true;
}

function movePiece(r1, c1, r2, c2) {
    const piece = boardState[r1][c1];
    boardState[r2][c2] = piece;
    boardState[r1][c1] = 0;

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
            // Caso Re
            if (neighbor === 2) {
                checkKingCapture(adjR, adjC);
                return;
            }
            // Caso Soldato
            let anvil = false;
            if (far !== 0) {
                const farIsFriend = iAmWhite ? (far === 1 || far === 2) : (far === 3);
                if (farIsFriend) anvil = true;
            } else if (isHostileStructure(farR, farC)) {
                anvil = true;
            }

            if (anvil) {
                boardState[adjR][adjC] = 0;
            }
        }
    });
}

function checkKingCapture(kR, kC) {
    // Re sul trono (4,4) -> 4 lati
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
        // Re fuori dal trono -> morsa a 2
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
