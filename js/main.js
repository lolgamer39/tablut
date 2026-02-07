// --- CONFIGURAZIONE E STATO DEL GIOCO ---
const boardElement = document.getElementById('board');
const statusElement = document.getElementById('status'); // Assicurati di avere <div id="status"> nell'HTML

let selectedCell = null;
let currentTurn = 'black'; // Inizia sempre chi attacca (i Neri)
let isGameOver = false;

// 0=Vuoto, 1=Bianco, 2=Re, 3=Nero
// Rappresentazione logica della scacchiera
let boardState = [
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

// --- 1. INIZIALIZZAZIONE ---

function initGame() {
    drawBoard();
    updateStatus();
}

function drawBoard() {
    boardElement.innerHTML = ''; // Pulisce la scacchiera grafica
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            const cell = document.createElement('div');
            cell.classList.add('cell');
            cell.dataset.row = r;
            cell.dataset.col = c;

            // Colora caselle speciali (Trono e Angoli)
            if (r === 4 && c === 4) cell.classList.add('throne');
            if ((r === 0 || r === 8) && (c === 0 || c === 8)) cell.classList.add('escape');

            // Disegna il pezzo se presente
            const pieceType = boardState[r][c];
            if (pieceType !== 0) {
                const piece = document.createElement('div');
                piece.classList.add('piece');
                if (pieceType === 1) piece.classList.add('white-piece');
                if (pieceType === 2) { piece.classList.add('white-piece'); piece.classList.add('king'); }
                if (pieceType === 3) piece.classList.add('black-piece');
                cell.appendChild(piece);
            }

            // Event Listener per il click
            cell.addEventListener('click', () => handleCellClick(r, c));
            boardElement.appendChild(cell);
        }
    }
}

// --- 2. GESTIONE DELL'INTERAZIONE ---

function handleCellClick(row, col) {
    if (isGameOver) return;

    const clickedValue = boardState[row][col];
    const cellElement = getCellElement(row, col);

    // SELEZIONE: Se clicco su un mio pezzo
    if (isMyPiece(clickedValue)) {
        // Rimuovi selezione precedente
        if (selectedCell) {
            getCellElement(selectedCell.r, selectedCell.c).classList.remove('selected');
        }
        
        selectedCell = { r: row, c: col };
        cellElement.classList.add('selected');
        console.log(`Selezionato: ${row}, ${col}`);
    } 
    // MOVIMENTO: Se ho già selezionato e clicco su una casella vuota
    else if (selectedCell && clickedValue === 0) {
        if (isValidMove(selectedCell.r, selectedCell.c, row, col)) {
            executeMove(selectedCell.r, selectedCell.c, row, col);
        } else {
            console.log("Mossa non valida");
            // Feedback visivo opzionale (es. shake)
        }
    }
}

// Controlla se il pezzo cliccato appartiene al giocatore di turno
function isMyPiece(value) {
    if (currentTurn === 'white') return (value === 1 || value === 2);
    if (currentTurn === 'black') return (value === 3);
    return false;
}

// --- 3. LOGICA DI MOVIMENTO ---

function isValidMove(r1, c1, r2, c2) {
    // 1. Deve essere in linea retta
    if (r1 !== r2 && c1 !== c2) return false;

    // 2. Controllo ostacoli nel percorso
    const deltaR = Math.sign(r2 - r1);
    const deltaC = Math.sign(c2 - c1);
    
    let checkR = r1 + deltaR;
    let checkC = c1 + deltaC;

    while (checkR !== r2 || checkC !== c2) {
        if (boardState[checkR][checkC] !== 0) return false; // Percorso bloccato da un pezzo
        checkR += deltaR;
        checkC += deltaC;
    }

    // 3. Regole speciali delle caselle
    const movingPiece = boardState[r1][c1];
    
    // Solo il Re (2) può andare sul trono (4,4) o sugli angoli
    const isThrone = (r2 === 4 && c2 === 4);
    const isCorner = ((r2===0||r2===8) && (c2===0||c2===8));

    if ((isThrone || isCorner) && movingPiece !== 2) {
        return false; // I soldati non possono andare sul trono o negli angoli
    }

    // Regola avanzata: Il trono vuoto non si può attraversare (semplificazione classica)
    if (boardState[4][4] === 0 && movingPiece !== 2) {
         // Se il percorso passa per il centro (4,4)
         if (r1===r2 && r1===4 && Math.min(c1,c2) < 4 && Math.max(c1,c2) > 4) return false;
         if (c1===c2 && c1===4 && Math.min(r1,r2) < 4 && Math.max(r1,r2) > 4) return false;
    }

    return true;
}

// --- 4. ESECUZIONE E CATTURE ---

function executeMove(r1, c1, r2, c2) {
    // Aggiorna lo stato logico
    const piece = boardState[r1][c1];
    boardState[r2][c2] = piece;
    boardState[r1][c1] = 0;

    // Ridisegna (o sposta nel DOM per efficienza, qui ridisegniamo per semplicità)
    drawBoard();
    
    // Controlla catture
    checkCaptures(r2, c2);

    // Controlla vittoria
    if (checkWin()) return;

    // Cambio Turno
    currentTurn = (currentTurn === 'white') ? 'black' : 'white';
    selectedCell = null;
    updateStatus();
}

function checkCaptures(r, c) {
    const directions = [
        {dr: -1, dc: 0}, // Su
        {dr: 1, dc: 0},  // Giù
        {dr: 0, dc: -1}, // Sinistra
        {dr: 0, dc: 1}   // Destra
    ];

    const myPiece = boardState[r][c]; // Chi ha mosso (1/2 o 3)
    const isWhiteTurn = (currentTurn === 'white');

    directions.forEach(dir => {
        const adjR = r + dir.dr;     // Casella adiacente
        const adjC = c + dir.dc;
        const farR = r + (dir.dr * 2); // Casella oltre l'adiacente
        const farC = c + (dir.dc * 2);

        // Controllo se le coordinate sono dentro la scacchiera
        if (adjR >= 0 && adjR < 9 && farR >= 0 && farR < 9) {
            const adjacentPiece = boardState[adjR][adjC];
            const farPiece = boardState[farR][farC];

            // Identifichiamo il nemico
            const isEnemy = isWhiteTurn ? (adjacentPiece === 3) : (adjacentPiece === 1 || adjacentPiece === 2);

            if (isEnemy) {
                // Condizione di cattura: PezzoNemico è tra MioPezzo e (MioPezzo O Angolo O Trono)
                // Nota: Il Trono e gli Angoli sono ostili per tutti (tranne il Re sul trono)
                
                let anvilIsFriendly = false; // L'"incudine" è l'altro pezzo che fa la morsa

                if (farPiece !== 0) {
                    // Se c'è un pezzo, deve essere mio amico
                    if (isWhiteTurn) anvilIsFriendly = (farPiece === 1 || farPiece === 2);
                    else anvilIsFriendly = (farPiece === 3);
                } else {
                    // Se la casella è vuota, controlla se è un angolo o il trono (sono ostili)
                    const isFarThrone = (farR === 4 && farC === 4);
                    const isFarCorner = ((farR===0||farR===8) && (farC===0||farC===8));
                    if (isFarThrone || isFarCorner) anvilIsFriendly = true;
                }

                // ESEGUI CATTURA
                // Eccezione: Il Re non si cattura così facilmente se è sul trono (ma qui lo trattiamo normalmente se fuori dal trono)
                if (anvilIsFriendly) {
                    // Se il pezzo catturato è il RE
                    if (adjacentPiece === 2) {
                        // Il Re sul trono richiede 4 lati occupati, fuori dal trono ne bastano 2 (regola standard)
                        // Per semplicità di questo codice base, applichiamo la regola standard:
                        if (adjR === 4 && adjC === 4) return; // Non catturi il Re SUL trono con 2 pezzi
                        console.log("RE CATTURATO!");
                        boardState[adjR][adjC] = 0;
                        endGame("I Muscoviti (Neri) vincono! Il Re è caduto.");
                    } else {
                        console.log("Cattura avvenuta a ", adjR, adjC);
                        boardState[adjR][adjC] = 0; // Rimuovi pezzo
                        drawBoard();
                    }
                }
            }
        }
    });
}

// --- 5. CONDIZIONI DI VITTORIA ---

function checkWin() {
    // 1. Vittoria BIANCHI: Re su un angolo
    // Cerchiamo dov'è il Re
    let kingPos = null;
    for(let r=0; r<9; r++) {
        for(let c=0; c<9; c++) {
            if (boardState[r][c] === 2) kingPos = {r, c};
        }
    }

    if (!kingPos) {
        // Il Re non c'è più (è stato mangiato nella funzione checkCaptures)
        endGame("I Muscoviti (Neri) vincono!");
        return true;
    }

    if ((kingPos.r === 0 || kingPos.r === 8) && (kingPos.c === 0 || kingPos.c === 8)) {
        endGame("I Difensori (Bianchi) vincono! Il Re è salvo.");
        return true;
    }

    return false;
}

function endGame(message) {
    isGameOver = true;
    statusElement.innerText = message;
    statusElement.style.color = "red";
    statusElement.style.fontWeight = "bold";
    alert(message);
}

function updateStatus() {
    statusElement.innerText = `Turno: ${currentTurn === 'white' ? 'Difensori (Bianchi)' : 'Muscoviti (Neri)'}`;
}

function getCellElement(r, c) {
    return document.querySelector(`.cell[data-row='${r}'][data-col='${c}']`);
}

// AVVIA
initGame();
