const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve i file statici dalla cartella 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Strutture Dati
let waitingQueue = {
    'no-time': [],
    '10': [],
    '30': []
};
let games = {}; // idPartita -> oggetto dati partita

io.on('connection', (socket) => {
    console.log('Utente connesso:', socket.id);
    
    // Gestione Ping per qualità connessione
    socket.on('ping', () => {
        socket.emit('pong', Date.now());
    });

    // Richiesta di unirsi a una partita
    socket.on('find_game', (data) => {
        const { username, timeControl } = data;
        const queue = waitingQueue[timeControl];

        if (queue.length > 0) {
            // Trovato avversario
            const opponent = queue.shift();
            const gameId = `game_${opponent.id}_${socket.id}`;
            
            // Assegnazione colori casuale
            const rand = Math.random();
            const p1Color = rand > 0.5 ? 'white' : 'black';
            const p2Color = rand > 0.5 ? 'black' : 'white';

            // Creazione stato partita lato server
            games[gameId] = {
                id: gameId,
                p1: { id: opponent.id, name: opponent.name, color: p1Color, time: parseInt(timeControl) * 60, socket: opponent.socket },
                p2: { id: socket.id, name: username, color: p2Color, time: parseInt(timeControl) * 60, socket: socket },
                timeControl: timeControl,
                turn: 'black', // Inizia sempre il nero nel Tablut? O bianco? Di solito Nero muove per primo o Bianco? (Nel Tablut classico è Bianco, nel tuo codice sembra Nero. Mantengo Nero).
                lastMoveTime: Date.now(),
                startTime: Date.now(),
                movesCount: 0,
                timerInterval: null
            };

            // Unisci i socket alla room
            opponent.socket.join(gameId);
            socket.join(gameId);

            // Avvia Timer Server se c'è tempo
            if (timeControl !== 'no-time') {
                startServerTimer(gameId);
            }

            // Notifica inizio
            io.to(gameId).emit('game_start', {
                gameId: gameId,
                white: p1Color === 'white' ? opponent.name : username,
                black: p1Color === 'black' ? opponent.name : username,
                myColor: null // Verrà sovrascritto inviando singolarmente
            });
            
            io.to(opponent.id).emit('assign_color', p1Color);
            io.to(socket.id).emit('assign_color', p2Color);

        } else {
            // Aggiungi alla coda
            queue.push({ id: socket.id, name: username, socket: socket });
        }
    });

    // Gestione Mossa
    socket.on('make_move', (data) => {
        const game = games[data.gameId];
        if (!game) return;

        // Controllo 30 secondi iniziali (Abort)
        if (game.movesCount === 0) {
            if (Date.now() - game.startTime > 30000) {
                io.to(game.id).emit('game_aborted', { reason: 'Nessuna mossa nei primi 30 secondi.' });
                clearInterval(game.timerInterval);
                delete games[game.id];
                return;
            }
        }

        // Reset timer inattività 5 minuti
        game.lastMoveTime = Date.now();
        game.movesCount++;
        
        // Cambio turno server
        game.turn = game.turn === 'white' ? 'black' : 'white';

        // Inoltra la mossa all'avversario
        socket.to(data.gameId).emit('opponent_move', data.moveData);
    });

    // Gestione Fine Partita (Vittoria/Sconfitta inviata dal client logic)
    socket.on('game_over', (data) => {
        const game = games[data.gameId];
        if (game) {
            clearInterval(game.timerInterval);
            delete games[data.gameId];
        }
    });

    // Disconnessione
    socket.on('disconnect', () => {
        // Rimuovi dalle code
        for (const t in waitingQueue) {
            waitingQueue[t] = waitingQueue[t].filter(p => p.id !== socket.id);
        }
        
        // Gestisci disconnessione in partita
        for (const gId in games) {
            const g = games[gId];
            if (g.p1.id === socket.id || g.p2.id === socket.id) {
                io.to(gId).emit('opponent_disconnected');
                clearInterval(g.timerInterval);
                delete games[gId];
            }
        }
    });
});

function startServerTimer(gameId) {
    const game = games[gameId];
    game.timerInterval = setInterval(() => {
        const now = Date.now();
        
        // Controllo Inattività 5 minuti
        if (now - game.lastMoveTime > 300000) { // 300.000 ms = 5 min
            io.to(gameId).emit('game_over_timeout', { winner: game.turn === 'white' ? 'black' : 'white', reason: 'inactivity' });
            clearInterval(game.timerInterval);
            delete games[gameId];
            return;
        }

        // Decremento Tempo
        if (game.turn === 'white') {
            const pWhite = game.p1.color === 'white' ? game.p1 : game.p2;
            pWhite.time--;
            if (pWhite.time <= 0) {
                io.to(gameId).emit('time_expired', { loser: 'white' });
                clearInterval(game.timerInterval);
                delete games[gameId];
            }
        } else {
            const pBlack = game.p1.color === 'black' ? game.p1 : game.p2;
            pBlack.time--;
            if (pBlack.time <= 0) {
                io.to(gameId).emit('time_expired', { loser: 'black' });
                clearInterval(game.timerInterval);
                delete games[gameId];
            }
        }
        
        // Sincronizza ogni secondo (opzionale, meglio farlo fare al client e sync ogni tanto)
        // Per semplicità qui mandiamo solo eventi critici, il client conta per conto suo.
    }, 1000);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server attivo sulla porta ${PORT}`));
