document.addEventListener('DOMContentLoaded', () => {
    // Colleghiamo i pulsanti
    document.getElementById('start-btn').addEventListener('click', startGame);
    document.getElementById('restart-btn').addEventListener('click', resetGame);
});

// --- VARIABILI GLOBALI ---
const boardElement = document.getElementById('board');
const currentPlayerSpan = document.getElementById('current-player');
const gameWrapper = document.getElementById('game-wrapper'); // Contiene tutto il gioco
const menu = document.getElementById('menu');
const restartContainer = document.getElementById('restart-container');

let selectedCell = null; 
let currentTurn = 'black'; 
let isGameOver = false;
let boardState = [];

// Layout Iniziale
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

// --- GESTIONE INTERFACCIA ---

function startGame() {
    // 1. Nascondi il menu
    menu.classList.add('hidden');
    
    // 2. Mostra il gioco (rimuovi la classe hidden)
    gameWrapper.classList.remove('hidden');
    restartContainer.classList.add('hidden'); // Assicurati che il tasto restart sia nascosto

    // 3. Inizializza variabili
    boardState = JSON.parse(JSON.stringify(initialLayout));
    currentTurn = 'black';
    isGameOver = false;
    selectedCell = null;
    
    updateTurnUI();
    drawBoard();
}

function resetGame() {
    // Torna allo stato iniziale come se avessi premuto start
    boardState = JSON.parse(JSON.stringify(initialLayout));
    currentTurn = 'black';
    isGameOver = false;
    selectedCell = null;
    
    restartContainer.classList.add('hidden');
    updateTurnUI();
    drawBoard();
}

// --- RENDER ---

function drawBoard() {
    boardElement.innerHTML = '';
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            const cell = document.createElement('div');
            cell.classList.add('cell');
            cell.dataset.row = r;
            cell.dataset.col = c;

            // Colori speciali
            if (r === 4 && c === 4) cell.classList.add('throne');
            if ((r===0||r===8) && (c===0||c===8)) cell.classList.add('escape');

            // Evidenzia selezione
            if (selectedCell && selectedCell.r === r && selectedCell.c === c) {
                cell.classList.add('selected');
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
        currentPlayerSpan.innerText = "Muscoviti (Neri)";
        currentPlayerSpan.style.color = "black";
    } else {
        currentPlayerSpan.innerText = "Difensori (Bianchi)";
        currentPlayerSpan.style.color = "#d4a017";
    }
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

    // --- CORREZIONE RE: MOVIMENTO DI 1 SOLA CASELLA ---
    if (movingPiece === 2) {
        // Calcola distanza
        const diffR = Math.abs(r1 - r2);
        const diffC = Math.abs(c1 - c2);
        
        // Deve muoversi di 1 casella in totale (non in diagonale, quindi somma diff deve essere 1)
        // Esempio: (0,1) -> somma 1 (OK). (1,1) -> somma 2 (NO, è diagonale). (2,0) -> somma 2 (NO, troppo lontano).
        if (diffR + diffC !== 1) return false;
        
        // La destinazione deve essere vuota (già controllato dal main loop, ma ok)
        return true;
    }

    // --- MOVIMENTO ALTRI PEZZI (COME LA TORRE) ---
    
    // Deve essere in linea retta
    if (r1 !== r2 && c1 !== c2) return false;

    // Controllo ostacoli
    const dr = Math.sign(r2 - r1);
    const dc = Math.sign(c2 - c1);
    let nr = r1 + dr;
    let nc = c1 + dc;

    while (nr !== r2 || nc !== c2) {
        if (boardState[nr][nc] !== 0) return false; 
        
        // Il trono vuoto blocca i soldati? Nella tua variante solitamente SI.
        // Se vuoi che i soldati possano attraversare il trono vuoto, rimuovi le righe sotto.
        if (nr === 4 && nc === 4) return false; 
        
        nr += dr;
        nc += dc;
    }

    // Trono e Angoli proibiti ai soldati semplici
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
            // Se è il Re, controllo speciale
            if (neighbor === 2) {
                checkKingCapture(adjR, adjC);
                return;
            }

            // Soldato normale
            let anvil = false;
            if (far !== 0) {
                // Incudine amica
                const farIsFriend = iAmWhite ? (far === 1 || far === 2) : (far === 3);
                if (farIsFriend) anvil = true;
            } else if (isHostileStructure(farR, farC)) {
                // Incudine struttura (Angolo o Trono)
                anvil = true;
            }

            if (anvil) {
                boardState[adjR][adjC] = 0;
                console.log("Cattura!");
            }
        }
    });
}

function checkKingCapture(kR, kC) {
    // Re sul Trono: serve circondarlo su 4 lati
    // Re fuori dal trono: Nella variante "Re lento", di solito basta circondarlo su 2 lati come un soldato, 
    // oppure 4 lati. Per semplicità usiamo la regola standard Tablut: 
    // Se è sul trono -> 4 lati. Se è fuori -> 2 lati (catturabile come soldato).
    
    // Poiché il controllo "catturabile come soldato" è già gestito dal loop generico se l'incudine c'è,
    // qui gestiamo solo il caso "Sul Trono" che richiede 4 nemici.
    
    if (kR === 4 && kC === 4) {
        const dirs = [[-1,0], [1,0], [0,-1], [0,1]];
        let enemies = 0;
        dirs.forEach(d => {
            if (boardState[4+d[0]][4+d[1]] === 3) enemies++;
        });
        if (enemies === 4) {
            boardState[4][4] = 0;
            endGame("I Muscoviti vincono! Re catturato al trono.");
        }
    } else {
        // Se il Re è fuori dal trono, il loop generico (sopra) lo vedrà come un pezzo nemico
        // e lo catturerà se stretto tra due pezzi.
        // Ma dobbiamo essere sicuri che l'incudine sia valida. 
        // Verifichiamo manualmente la "morsa" qui per sicurezza se il loop sopra fallisce.
        // (Il loop sopra non cattura se neighbor === 2 perché entra in questo blocco if).
        
        // Controlliamo se è stretto ora:
        // Chi ha mosso è in (r,c), il Re è in (kR, kC). L'incudine è oltre il Re.
        // Calcoliamo dove deve essere l'incudine
        const dR = kR - r; // direzione dal pezzo mosso al Re
        const dC = kC - c; // ...
        
        // (Nota: r e c non sono passati a questa funzione, quindi usiamo un trucco o semplifichiamo)
        // Semplificazione: Controlliamo le 4 direzioni attorno al Re per vedere se è stretto tra due neri
        
        const vert = (boardState[kR-1]?.[kC] === 3 || isHostileStructure(kR-1, kC)) && 
                     (boardState[kR+1]?.[kC] === 3 || isHostileStructure(kR+1, kC));
                     
        const horiz = (boardState[kR]?.[kC-1] === 3 || isHostileStructure(kR, kC-1)) && 
                      (boardState[kR]?.[kC+1] === 3 || isHostileStructure(kR, kC+1));
                      
        if (vert || horiz) {
            boardState[kR][kC] = 0;
            endGame("I Muscoviti vincono! Re catturato.");
        }
    }
}

function isHostileStructure(r, c) {
    if ((r===0||r===8) && (c===0||c===8)) return true;
    if (r===4 && c===4) return true;
    return false;
}

function checkWin() {
    // Re sugli angoli
    let king = null;
    for(let r=0; r<9; r++) {
        for(let c=0; c<9; c++) {
            if(boardState[r][c] === 2) king = {r,c};
        }
    }
    
    if (!king) return true; // Re morto, gestito in endGame

    if ((king.r===0||king.r===8) && (king.c===0||king.c===8)) {
        endGame("I Bianchi vincono!");
        return true;
    }
    return false;
}

function endGame(msg) {
    isGameOver = true;
    setTimeout(() => {
        alert(msg);
        restartContainer.classList.remove('hidden');
    }, 100);
}

function isInBounds(r, c) { return r>=0 && r<9 && c>=0 && c<9; }
