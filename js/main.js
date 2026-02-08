document.addEventListener('DOMContentLoaded', () => {
    // Gestione Eventi
    bindEvent('play-again-btn', 'click', resetGame);
    bindEvent('restart-game-btn', 'click', () => {
        if(confirm("Sei sicuro di voler ricominciare?")) resetGame();
    });
    bindEvent('btn-prev', 'click', () => navigateHistory(-1));
    bindEvent('btn-next', 'click', () => navigateHistory(1));

    // Tastiera
    document.addEventListener('keydown', (e) => {
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

    // AVVIO PARTITA: Controlla se c'è un salvataggio o inizia da zero
    loadGame();
});

function bindEvent(id, event, func) {
    const el = document.getElementById(id);
    if(el) el.addEventListener(event, func);
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

// --- LOGICA SALVATAGGIO (PERSISTENZA) ---
function saveGame() {
    const gameState = {
        boardState,
        currentTurn,
        isGameOver,
        gameHistory,
        moveLog,
        currentHistoryIndex
    };
    localStorage.setItem('tablut_save', JSON.stringify(gameState));
}

function loadGame() {
    const saved = localStorage.getItem('tablut_save');
    if (saved) {
        try {
            const data = JSON.parse(saved);
            boardState = data.boardState;
            currentTurn = data.currentTurn;
            isGameOver = data.isGameOver;
            gameHistory = data.gameHistory;
            moveLog = data.moveLog;
            currentHistoryIndex = data.currentHistoryIndex;
            
            // Se la partita caricata è finita, mostra il modal
            if (isGameOver) {
                document.getElementById('game-over-modal').classList.remove('hidden');
                // Determina chi ha vinto guardando l'ultimo log o lo stato
                document.getElementById('winner-title').innerText = "Partita Terminata";
            }
        } catch (e) {
            console.error("Errore salvataggio", e);
            initNewGame();
        }
    } else {
        initNewGame();
    }
    updateMoveTable();
    updateTurnUI();
    drawBoard();
}

function initNewGame() {
    boardState = JSON.parse(JSON.stringify(initialLayout));
    currentTurn = 'black';
    isGameOver = false;
    selectedCell = null;
    isAnimating = false;
    gameHistory = [JSON.parse(JSON.stringify(boardState))];
    moveLog = [];
    currentHistoryIndex = 0;
    saveGame();
}

function resetGame() {
    localStorage.removeItem('tablut_save');
    document.getElementById('game-over-modal').classList.add('hidden');
    initNewGame();
    updateMoveTable();
    updateTurnUI();
    drawBoard();
}

// --- LOGICA DI GIOCO ---

function drawBoard() {
    const boardEl = document.getElementById('board');
    if (!boardEl) return;
    boardEl.innerHTML = '';
    
    let state = initialLayout;
    if (gameHistory.length > 0 && gameHistory[currentHistoryIndex]) {
        state = gameHistory[currentHistoryIndex];
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

            if (r === 8) cell.innerHTML += `<span class="coord coord-letter">${String.fromCharCode(97 + c)}</span>`;
            if (c === 0) cell.innerHTML += `<span class="coord coord-num">${9 - r}</span>`;

            if (r === 4 && c === 4) cell.classList.add('throne');
            if ((r===0||r===8) && (c===0||c===8)) cell.classList.add('escape');

            if (isLatest && selectedCell && selectedCell.r === r && selectedCell.c === c) {
                cell.classList.add('selected');
            }

            if (isLatest && moves.some(m => m.r === r && m.c === c)) {
                const dot = document.createElement('div');
                dot.className = 'hint-dot';
                cell.appendChild(dot);
            }

            const val = state[r][c];
            if (val !== 0) {
                const piece = document.createElement('div');
                piece.className = 'piece';
                if (val === 1) piece.classList.add('white-piece');
                if (val === 2) { piece.classList.add('white-piece', 'king'); }
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
    
    // Selezione (se clicco un mio pezzo)
    if (isMyPiece(clickedVal)) {
        selectedCell = { r, c };
        drawBoard(); 
        return;
    }

    // Movimento (se ho selezionato e clicco una cella vuota)
    if (selectedCell && clickedVal === 0) {
        if (isValidMove(selectedCell.r, selectedCell.c, r, c, currentState)) {
            performMoveWithAnimation(selectedCell.r, selectedCell.c, r, c, currentState);
        }
    }
}

function performMoveWithAnimation(r1, c1, r2, c2, currentState) {
    selectedCell = null; 
    const pieceVal = currentState[r1][c1];
    isAnimating = true;

    // Rimozione immediata hints visivi
    const hints = document.querySelectorAll('.hint-dot');
    hints.forEach(h => h.remove());

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
        void ghost.offsetWidth; // Reflow
        ghost.style.left = (rect2.left + rect2.width * 0.1) + 'px';
        ghost.style.top = (rect2.top + rect2.height * 0.1) + 'px';
    }

    setTimeout(() => {
        if (ghost) ghost.remove();
        executeMoveLogic(r1, c1, r2, c2);
        isAnimating = false;
    }, 250);
}

function executeMoveLogic(r1, c1, r2, c2) {
    const newState = JSON.parse(JSON.stringify(gameHistory[currentHistoryIndex]));
    const piece = newState[r1][c1];
    newState[r2][c2] = piece;
    newState[r1][c1] = 0;
    
    boardState = newState;
    
    const txt = `${getNotation(r1, c1)}-${getNotation(r2, c2)}`;
    moveLog.push({ color: currentTurn, text: txt });
    
    gameHistory.push(newState);
    currentHistoryIndex++;

    checkCaptures(r2, c2, newState);
    
    // Cambio turno se non è finita
    if (!checkWin(newState)) {
        currentTurn = (currentTurn === 'white') ? 'black' : 'white';
    }
    
    saveGame(); // Salvataggio automatico
    updateMoveTable();
    updateTurnUI();
    drawBoard();
}

// --- UTILITY E NUOVE REGOLE ---

function isMyPiece(val) {
    if (currentTurn === 'white') return (val === 1 || val === 2);
    if (currentTurn === 'black') return (val === 3);
    return false;
}

function isValidMove(r1, c1, r2, c2, state) {
    if (r1===r2 && c1===c2) return false;
    
    // Regola Trono: Nessuno può tornare sul trono (4,4) una volta lasciato
    // (A meno che non sia l'inizio e il Re sia ancora lì, ma qui stiamo muovendo VERSO il trono)
    if (r2 === 4 && c2 === 4) return false;

    const dr = Math.sign(r2-r1), dc = Math.sign(c2-c1);
    if (dr !== 0 && dc !== 0) return false; // Solo ortogonale

    // Controllo Percorso
    let nr = r1 + dr, nc = c1 + dc;
    while (nr !== r2 || nc !== c2) {
        // NUOVA REGOLA: Attraversamento Trono
        // Se la casella intermedia è il Trono (4,4), è permesso saltarla (se vuota/non bloccante)
        // Ma nel Tablut il trono è "vuoto" (0) se il Re non c'è.
        // La regola dice "possono attraversare la casella".
        // Quindi se nr,nc == 4,4, ignoriamo il controllo "state[nr][nc] !== 0"
        // perché il trono vale 0 ma è logicamente speciale.
        
        const isThrone = (nr === 4 && nc === 4);
        
        // Se c'è un pezzo e NON è il trono (che si può saltare), blocca.
        // Nota: se nel trono c'è il RE, state[4][4] è 2, quindi blocca comunque.
        if (state[nr][nc] !== 0 && !isThrone) return false;
        
        // Se è il trono, ma c'è un pezzo sopra (es. Re), blocca.
        if (isThrone && state[nr][nc] !== 0) return false;

        nr += dr; nc += dc;
    }
    
    // Destinazione deve essere libera (già controllato in handleInput ma ridondante ok)
    if (state[r2][c2] !== 0) return false;
    
    // Campi speciali (angoli) solo per il Re
    const isKing = (state[r1][c1] === 2);
    if (!isKing && (r2===0||r2===8) && (c2===0||c2===8)) return false;
    
    return true;
}

function getPossibleMoves(r, c, state) {
    let m = [];
    // Scansione 4 direzioni
    const dirs = [[-1,0], [1,0], [0,-1], [0,1]];
    dirs.forEach(d => {
        for(let k=1; k<9; k++) {
            let nr = r + d[0]*k;
            let nc = c + d[1]*k;
            if (isInBounds(nr, nc)) {
                if (isValidMove(r, c, nr, nc, state)) {
                    m.push({r: nr, c: nc});
                } else {
                    // Se trovo un blocco nel path (pezzo non saltabile), interrompo la direzione
                    // Ma attenzione: isValidMove fa check precisi. 
                    // Per efficienza qui potremmo semplificare, ma isValidMove è l'autorità.
                    // Se isValidMove ritorna false PERCHÉ c'è un pezzo in mezzo, stop.
                    // Se ritorna false PERCHÉ destinazione è trono, continua a cercare oltre? NO.
                    // Nel Tablut non si scavalcano pezzi. Si scavalca SOLO il trono VUOTO.
                    
                    // Verifichiamo se il blocco è "fisico"
                    // Se la casella intermedia è occupata (e non è trono vuoto), stop.
                    if (state[nr][nc] !== 0) break; // Pezzo blocca
                    if (nr===4 && nc===4) {
                        // Trono: posso passarci (non break), ma non fermarmici (isValidMove darà false)
                        // Quindi continuo il loop k
                    }
                }
            } else break;
        }
    });
    return m;
}

function checkCaptures(r, c, state) {
    const me = state[r][c];
    const isWhite = (me === 1 || me === 2);
    let captured = false;
    
    [[-1,0], [1,0], [0,-1], [0,1]].forEach(d => {
        const nr = r + d[0], nc = c + d[1];
        const fr = r + d[0]*2, fc = c + d[1]*2;
        
        if (isInBounds(nr, nc)) {
            const nVal = state[nr][nc];
            // Nemico?
            const isEnemy = isWhite ? (nVal === 3) : (nVal === 1 || nVal === 2);
            
            if (isEnemy) {
                // Se è il RE, logica speciale
                if (nVal === 2) { 
                    checkKingCapture(nr, nc, state); 
                    return; 
                }
                
                // Pedina normale
                // Serve un incudine (pezzo amico o struttura ostile)
                if (isInBounds(fr, fc)) {
                    const fVal = state[fr][fc];
                    let anvil = false;
                    
                    // Amico dall'altra parte?
                    if (fVal !== 0) {
                        const fFriend = isWhite ? (fVal===1 || fVal===2) : (fVal===3);
                        if (fFriend) anvil = true;
                    } 
                    // Struttura ostile (Trono vuoto o Angoli)
                    else if (isHostileStructure(fr, fc)) {
                        anvil = true;
                    }
                    
                    if (anvil) {
                        state[nr][nc] = 0; // CATTURA
                        captured = true;
                    }
                }
            }
        }
    });
    
    if(captured) {
        // Aggiorniamo la history corrente con le catture
        gameHistory[currentHistoryIndex] = JSON.parse(JSON.stringify(state));
    }
}

// --- NUOVA LOGICA CATTURA RE ---
function checkKingCapture(r, c, state) {
    // 1. Contiamo gli attaccanti (pezzi neri o strutture ostili)
    let attackers = 0;
    
    // Coordinate adiacenti
    const adj = [[r-1,c], [r+1,c], [r,c-1], [r,c+1]];
    
    adj.forEach(pos => {
        const [ar, ac] = pos;
        if (!isInBounds(ar, ac)) {
            // Fuori bordo (Bordo scacchiera)
            // Il bordo conta come ostile per cattura Re?
            // "se il re si trova sul bordo... basta circondarlo da 3 pedine"
            // Significa che il "fuori bordo" agisce da 4° blocco.
            attackers++;
        } else {
            const val = state[ar][ac];
            if (val === 3) {
                attackers++; // Pezzo Nero
            } else if (ar === 4 && ac === 4) {
                // Trono
                // "se il re si trova... in una casella di quelle adiacenti al trono... basta circondarlo da 3 pedine"
                // Significa che il Trono agisce da blocco.
                attackers++;
            }
        }
    });

    // Se attaccanti >= 4, il Re è preso.
    // Nota: Se il Re è sul bordo, avrà 1 "fuori bordo" + 3 neri = 4. Corretto.
    // Se il Re è vicino al trono, avrà 1 "trono" + 3 neri = 4. Corretto.
    // In campo aperto servono 4 neri. Corretto.
    
    if (attackers >= 4) {
        win('Neri');
    }
}

function checkWin(state) {
    let k = null;
    for(let i=0;i<9;i++) for(let j=0;j<9;j++) if(state[i][j]===2) k={r:i,c:j};
    
    // Re non trovato (catturato da logica checkKingCapture) -> Neri vincono
    // Ma checkKingCapture chiama win() direttamente.
    // Qui controlliamo se Re ha raggiunto la salvezza.
    
    if (k) {
        if((k.r===0||k.r===8) && (k.c===0||k.c===8)) { 
            win('Bianchi'); 
            return true; 
        }
    }
    return isGameOver;
}

function win(who) {
    isGameOver = true;
    document.getElementById('winner-title').innerText = `Vittoria ${who}!`;
    document.getElementById('game-over-modal').classList.remove('hidden');
    saveGame(); // Salva lo stato di game over
}

// Strutture ostili per le pedine normali (Trono, Angoli)
function isHostileStructure(r, c) { 
    return ((r===0||r===8) && (c===0||c===8)) || (r===4 && c===4); 
}

function isInBounds(r, c) { return r>=0 && r<9 && c>=0 && c<9; }

function updateTurnUI() {
    const el = document.getElementById('current-player');
    if (currentTurn === 'black') { el.innerText = "Neri"; el.style.color = "black"; } 
    else { el.innerText = "Bianchi"; el.style.color = "#d4a017"; }
}

function getNotation(r, c) { return `${String.fromCharCode(97 + c)}${9 - r}`; }

function updateNavUI() {
    const p = document.getElementById('btn-prev');
    const n = document.getElementById('btn-next');
    if(p) p.disabled = (currentHistoryIndex === 0);
    if(n) n.disabled = (currentHistoryIndex === gameHistory.length - 1);
}

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

function navigateHistory(dir) {
    if (isAnimating) return;
    if (dir === -1 && currentHistoryIndex > 0) currentHistoryIndex--;
    else if (dir === 1 && currentHistoryIndex < gameHistory.length - 1) currentHistoryIndex++;
    else return;
    drawBoard();
}
