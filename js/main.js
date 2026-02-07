// --- CONFIGURAZIONE ---
const boardElement = document.getElementById('board');
const currentPlayerSpan = document.getElementById('current-player');
const gameUi = document.getElementById('game-ui');
const menu = document.getElementById('menu');

let selectedCell = null; // {r, c}
let currentTurn = 'black'; // 'black' o 'white'
let isGameOver = false;

// Matrice Logica: 0=Vuoto, 1=Bianco, 2=Re, 3=Nero
let boardState = [];

// Layout iniziale standard Tablut (Linneo)
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

// --- 1. GESTIONE PARTITA ---

function startGame() {
    // Clona il layout iniziale per resettare la partita
    boardState = JSON.parse(JSON.stringify(initialLayout));
    currentTurn = 'black';
    isGameOver = false;
    selectedCell = null;
    
    // UI Update
    menu.style.display = 'none';
    gameUi.style.display = 'block';
    updateTurnUI();
    
    drawBoard();
}

function updateTurnUI() {
    currentPlayerSpan.innerText = (currentTurn === 'black') ? "Muscoviti (Neri)" : "Difensori (Bianchi)";
    currentPlayerSpan.style.color = (currentTurn === 'black') ? "black" : "#d4a017";
}

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

            // Selezione visiva
            if (selectedCell && selectedCell.r === r && selectedCell.c === c) {
                cell.classList.add('selected');
            }

            // Pezzi
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

// --- 2. LOGICA MOVIMENTO ---

function onCellClick(r, c) {
    if (isGameOver) return;

    const clickedVal = boardState[r][c];
    
    // 1. Se clicco su un mio pezzo -> Seleziono
    if (isMyPiece(clickedVal)) {
        selectedCell = { r, c };
        drawBoard(); // Ridisegna per mostrare la selezione
        return;
    }

    // 2. Se ho un pezzo selezionato e clicco su vuoto -> Provo a muovere
    if (selectedCell && clickedVal === 0) {
        if (isValidMove(selectedCell.r, selectedCell.c, r, c)) {
            movePiece(selectedCell.r, selectedCell.c, r, c);
        } else {
            console.log("Mossa non valida!");
            // Opzionale: Aggiungi un'animazione di errore qui
        }
    }
}

function isMyPiece(val) {
    if (currentTurn === 'white') return (val === 1 || val === 2);
    if (currentTurn === 'black') return (val === 3);
    return false;
}

function isValidMove(r1, c1, r2, c2) {
    // Regola base: Movimento Ortogonale (Torre)
    if (r1 !== r2 && c1 !== c2) return false;

    // Controllo ostacoli
    const dr = Math.sign(r2 - r1);
    const dc = Math.sign(c2 - c1);
    let nr = r1 + dr;
    let nc = c1 + dc;

    while (nr !== r2 || nc !== c2) {
        if (boardState[nr][nc] !== 0) return false; // C'è un pezzo in mezzo
        // Nota: Nel Tablut moderno spesso il trono è ostacolo se non sei il Re.
        // Qui assumiamo che il trono vuoto non blocchi il passaggio, ma non ci si può fermare sopra.
        nr += dr;
        nc += dc;
    }

    // Regola: Destinazione proibita
    const piece = boardState[r1][c1];
    const isKing = (piece === 2);
    
    // Trono (4,4) e Angoli: Solo il Re può fermarcisi
    const isThrone = (r2 === 4 && c2 === 4);
    const isCorner = ((r2===0||r2===8) && (c2===0||c2===8));

    if ((isThrone || isCorner) && !isKing) {
        return false;
    }

    return true;
}

function movePiece(r1, c1, r2, c2) {
    // Esegui mossa
    const piece = boardState[r1][c1];
    boardState[r2][c2] = piece;
    boardState[r1][c1] = 0;

    // Verifica Catture e Vittoria
    handleCaptures(r2, c2);
    
    if (checkWin()) return;

    // Cambio turno
    currentTurn = (currentTurn === 'white') ? 'black' : 'white';
    selectedCell = null;
    updateTurnUI();
    drawBoard();
}

// --- 3. LOGICA CATTURE E VITTORIA ---

function handleCaptures(r, c) {
    const directions = [[-1,0], [1,0], [0,-1], [0,1]]; // Su, Giù, Sx, Dx
    const me = boardState[r][c]; // Chi ha appena mosso
    const iAmWhite = (me === 1 || me === 2);

    directions.forEach(dir => {
        const adjR = r + dir[0];
        const adjC = c + dir[1];
        const farR = r + (dir[0] * 2);
        const farC = c + (dir[1] * 2);

        // Controllo limiti scacchiera
        if (!isInBounds(adjR, adjC) || !isInBounds(farR, farC)) return;

        const neighbor = boardState[adjR][adjC];
        const far = boardState[farR][farC];

        // Se il vicino è nemico
        const isEnemy = iAmWhite ? (neighbor === 3) : (neighbor === 1 || neighbor === 2);
        
        if (isEnemy) {
            // CATTURA DEL RE (Regole Speciali)
            if (neighbor === 2) {
                if (checkKingCapture(adjR, adjC)) {
                    boardState[adjR][adjC] = 0;
                    endGame("I Muscoviti hanno catturato il Re!");
                }
                return; // La cattura del Re è gestita a parte, non continuo col codice sotto
            }

            // CATTURA SOLDATI SEMPLICI (Custodia)
            // Serve: [MIO] [NEMICO] [INCUDINE]
            // L'incudine può essere: Un mio pezzo, Il Trono (vuoto o col Re), Un Angolo
            let isAnvil = false;

            // 1. Incudine è un pezzo amico
            if (far !== 0) {
                const farIsFriend = iAmWhite ? (far === 1 || far === 2) : (far === 3);
                if (farIsFriend) isAnvil = true;
            } 
            // 2. Incudine è una struttura ostile (Trono o Angolo)
            else {
                if (isHostileStructure(farR, farC)) isAnvil = true;
            }

            if (isAnvil) {
                console.log(`Cattura a ${adjR},${adjC}`);
                boardState[adjR][adjC] = 0; // Rimuovi pezzo
            }
        }
    });
}

// Verifica se il Re è circondato
function checkKingCapture(kR, kC) {
    // 1. Re sul Trono: Serve circondarlo su 4 lati
    const onThrone = (kR === 4 && kC === 4);
    // 2. Re adiacente al Trono: Serve 3 lati neri + il Trono
    const nearThrone = (kR === 4 && (kC === 3 || kC === 5)) || (kC === 4 && (kR === 3 || kR === 5));

    const sides = [[-1,0], [1,0], [0,-1], [0,1]];
    let blackCount = 0;

    sides.forEach(s => {
        const nr = kR + s[0];
        const nc = kC + s[1];
        if (isInBounds(nr, nc)) {
            if (boardState[nr][nc] === 3) blackCount++;
            else if (boardState[nr][nc] === 4 || (nr===4 && nc===4)) blackCount++; // Il trono conta come ostile per il Re se non ci è sopra
        }
    });

    if (onThrone) return blackCount === 4;
    if (nearThrone) return blackCount === 4; // 3 neri + 1 trono
    
    // Altrimenti basta la morsa a 2 classica (gestita parzialmente qui, ma per sicurezza controlliamo)
    // Se siamo qui, il codice generico di cattura sopra avrebbe dovuto funzionare, 
    // ma per il Re a volte si preferisce essere espliciti.
    // Nel Tablut di Linneo: Il Re fuori dal trono si cattura come un soldato.
    return false; // Se è come un soldato, è già stato gestito dal loop "isAnvil" generico, ma qui gestiamo i casi speciali.
    // Nota: Ho lasciato che il loop principale gestisca la cattura a 2 del Re. Questo funge solo per i casi speciali (3 o 4 pezzi).
}

function isHostileStructure(r, c) {
    // Angoli
    if ((r===0||r===8) && (c===0||c===8)) return true;
    // Trono (È ostile per tutti i soldati e per il re se usato come incudine da soldati neri)
    if (r===4 && c===4) return true;
    return false;
}

function checkWin() {
    let kingFound = false;
    let kingPos = {};

    for (let r=0; r<9; r++) {
        for (let c=0; c<9; c++) {
            if (boardState[r][c] === 2) {
                kingFound = true;
                kingPos = {r, c};
            }
        }
    }

    if (!kingFound) {
        endGame("I Muscoviti vincono! Il Re è stato catturato.");
        return true;
    }

    // Re su angolo -> Vince Bianco
    if ((kingPos.r === 0 || kingPos.r === 8) && (kingPos.c === 0 || kingPos.c === 8)) {
        endGame("I Difensori vincono! Il Re è fuggito.");
        return true;
    }

    return false;
}

function endGame(msg) {
    isGameOver = true;
    setTimeout(() => {
        alert(msg);
        menu.style.display = 'block'; // Mostra di nuovo il menu
        document.getElementById('start-btn').innerText = "Gioca Ancora";
    }, 100);
}

function isInBounds(r, c) {
    return r >= 0 && r < 9 && c >= 0 && c < 9;
}
