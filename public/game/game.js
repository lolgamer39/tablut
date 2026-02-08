// Aggiungi queste variabili globali all'inizio
let mode = 'local'; // 'local' o 'online'
let socket;
let myOnlineColor = null;
let gameId = null;
let timeLimit = 0; // in secondi
let timers = { white: 0, black: 0 };
let timerInterval = null;
let boardHashHistory = {}; // Per la regola della ripetizione

document.addEventListener('DOMContentLoaded', () => {
    // Leggi parametri URL
    const params = new URLSearchParams(window.location.search);
    mode = params.get('mode') || 'local';
    
    if (mode === 'online') {
        const name = params.get('name');
        const time = params.get('time');
        initOnlineGame(name, time);
    } else {
        // Nascondi UI online
        document.getElementById('online-ui').classList.add('hidden');
        startGame(); // Avvio classico locale
    }
    
    // ... bind eventi esistenti ...
});

// --- NUOVA FUNZIONE: Hash della board per ripetizione ---
function getBoardHash(state, turn) {
    // Crea una stringa univoca che rappresenta lo stato
    return JSON.stringify(state) + "_" + turn;
}

function checkThreeFoldRepetition(state, turn) {
    const hash = getBoardHash(state, turn);
    if (!boardHashHistory[hash]) boardHashHistory[hash] = 0;
    boardHashHistory[hash]++;
    
    if (boardHashHistory[hash] >= 3) {
        return true;
    }
    return false;
}

// --- MODIFICHE AL FLUSSO DI GIOCO ---

// Modifica startGame per resettare la storia hash
function startGame() {
    // ... codice esistente ...
    boardHashHistory = {}; // Reset hash
    // ...
}

// Modifica executeMoveLogic per includere il controllo Patta
function executeMoveLogic(r1, c1, r2, c2) {
    // ... logica movimento esistente ...
    // Dopo aver mosso e cambiato turno:
    
    // 1. Controllo Vittoria Normale (esistente)
    // 2. Controllo Patta (Nuovo)
    if (!isGameOver && checkThreeFoldRepetition(boardState, currentTurn)) {
        drawGame("Patta per ripetizione di mosse (3 volte)");
        if (mode === 'online') socket.emit('game_over', { gameId, result: 'draw' });
        return;
    }
    
    if (mode === 'online') {
        // Se è online, invio la mossa al server
        // Nota: invio SOLO se è stata una mossa MIA
        if (currentTurn !== myOnlineColor) { // Ho appena mosso io, ora tocca all'altro
             socket.emit('make_move', {
                 gameId: gameId,
                 moveData: { r1, c1, r2, c2 }
             });
        }
        updateTimersUI();
    }
}

function drawGame(reason) {
    isGameOver = true;
    clearInterval(timerInterval);
    document.getElementById('winner-title').innerText = "Pareggio";
    document.getElementById('winner-message').innerText = reason;
    document.getElementById('game-over-modal').classList.remove('hidden');
}

// --- LOGICA ONLINE ---

function initOnlineGame(name, time) {
    document.getElementById('online-ui').classList.remove('hidden');
    document.getElementById('my-name').innerText = name;
    
    if (time !== 'no-time') {
        timeLimit = parseInt(time) * 60;
        timers.white = timeLimit;
        timers.black = timeLimit;
        updateTimersUI();
    }

    socket = io();

    // Connessione e Ricerca
    socket.emit('find_game', { username: name, timeControl: time });

    socket.on('game_start', (data) => {
        gameId = data.gameId;
        document.getElementById('opp-name').innerText = (data.white === name) ? data.black : data.white;
        
        // Colore viene assegnato in un evento separato 'assign_color' o qui
        startGame();
        
        // Avvia gestione ping
        startConnectionCheck();
    });

    socket.on('assign_color', (color) => {
        myOnlineColor = color;
        // Ruota la board visivamente se sono bianco? (Opzionale)
        document.getElementById('current-player').innerText = "Neri"; // Inizia sempre nero
        
        if (timeLimit > 0) startTimerClock();
    });

    socket.on('opponent_move', (move) => {
        // Esegui la mossa dell'avversario sulla mia board
        const state = gameHistory[currentHistoryIndex];
        performMoveWithAnimation(move.r1, move.c1, move.r2, move.c2, state);
    });

    socket.on('time_expired', (data) => {
        if (data.loser === myOnlineColor) win(myOnlineColor === 'white' ? 'Neri' : 'Bianchi'); // Ho perso io
        else win(myOnlineColor); // Ha perso lui
    });

    socket.on('opponent_disconnected', () => {
        win(myOnlineColor);
        alert("L'avversario si è disconnesso. Hai vinto!");
    });
    
    socket.on('game_aborted', (data) => {
        alert("Partita annullata: " + data.reason);
        window.location.href = '../index.html';
    });
    
    // Gestione Ping/Pong (Barre segnale)
    socket.on('pong', (serverTime) => {
        const latency = Date.now() - lastPingTime;
        updateSignalBars(latency);
    });
}

// Gestione Input (Blocca se non è il mio turno online)
const originalHandleInput = handleInput; // Salviamo la vecchia funzione se serve
handleInput = function(r, c) {
    if (mode === 'online' && currentTurn !== myOnlineColor) return; // Non tocca a me
    originalHandleInput(r, c);
}

// --- TIMER CLIENT-SIDE ---
function startTimerClock() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        if (isGameOver) return;
        
        if (currentTurn === 'white') timers.white--;
        else timers.black--;

        updateTimersUI();

        if (timers.white <= 0 || timers.black <= 0) {
            clearInterval(timerInterval);
            // Il server manderà l'evento ufficiale, ma visivamente fermiamo qui
        }
    }, 1000);
}

function updateTimersUI() {
    document.getElementById('my-timer').innerText = formatTime(myOnlineColor === 'white' ? timers.white : timers.black);
    document.getElementById('opp-timer').innerText = formatTime(myOnlineColor === 'white' ? timers.black : timers.white);
}

function formatTime(seconds) {
    if (seconds < 0) return "00:00";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0'+s : s}`;
}

// --- CONNESSIONE (Barre) ---
let lastPingTime = 0;
let poorConnectionCount = 0;

function startConnectionCheck() {
    setInterval(() => {
        lastPingTime = Date.now();
        socket.emit('ping');
    }, 2000); // Ping ogni 2 secondi
}

function updateSignalBars(latency) {
    const bars = document.getElementById('my-signal');
    bars.className = 'signal-bars'; // reset
    
    let quality = 4;
    if (latency > 100) quality = 3;
    if (latency > 300) quality = 2;
    if (latency > 500) quality = 1;

    bars.classList.add(`signal-${quality}`);

    // Logica Annullamento per connessione scadente (1 tacca fissa)
    if (quality === 1) {
        poorConnectionCount++;
        if (poorConnectionCount > 15) { // 30 secondi di lag estremo
            alert("Connessione troppo instabile. Partita annullata.");
            window.location.href = '../index.html';
        }
    } else {
        poorConnectionCount = 0;
    }
}
