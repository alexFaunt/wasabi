// Setup basic express server
var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var port = process.env.PORT || 3000;

server.listen(port, function () {
    console.log('Server listening at port %d', port);
});

// Routing
app.use(express.static(__dirname));

var GAME_COUNT = 0;

var MAX_INFO_TOKENS = 8;

var MAX_FUSE_TOKENS = 3;

var CARDS_PER_SUIT = [3, 2, 2, 2, 1];

// Enums
var GAME_STATES = {
    PENDING: 'PENDING',
    PLAYING: 'PLAYING',
    WON: 'WON',
    LOST: 'LOST',
    CANCELLED: 'CANCELLED'
};

var COLOURS = [
    {
        string: 'red',
        className: 'red'
    },
    {
        string: 'blue',
        className: 'blue'
    },
    {
        string: 'green',
        className: 'green'
    },
    {
        string: 'yellow',
        className: 'yellow'
    },
    {
        string: 'black',
        className: 'black'
    }
];

var TURN_TYPES = {
    'PLAY': 'PLAY',
    'DISCARD': 'DISCARD',
    'INFO': 'INFO'
}

//Classes
var Message = function (dateTime, player, message) {
    this.dateTime = dateTime;
    this.player = player;
    this.message = message;
};

var Card = function (colour, number) {
    this.colour = colour;
    this.number = number;
};

var Deck = function () {
    this.cards = [];

    // generate deck here LOL IS THIS IS n^3 ?! Whatevs.

    // each colour
    for (var k = 0; k < COLOURS.length; k += 1) {

        // each number
        for (var i = 1; i <= CARDS_PER_SUIT.length; i += 1) {

            // duplicate cards
            for (var j = 0; j < CARDS_PER_SUIT[i-1]; j += 1) {

                this.cards.push({colour: COLOURS[k], number: i});
            }
        }
    }

};
Deck.prototype.drawCard = function () {
    return this.cards.splice(Math.floor(Math.random() * this.cards.length), 1)[0];
};
Deck.prototype.drawCards = function (amount) {
    var cards = [];
    for (var i = 0; i < amount; i +=1) {
        cards.push(this.drawCard());
    }
    return cards;
};

var Player = function (id, name, picture) {
    this.id = id;
    this.name = name;
    this.picture = picture;
    this.games = [];
    this.online = true;
};

var Info = function () {
    this.colour = null;
    this.number = null;
    this.notColour = [];
    this.notNumber = [];
};

var CardInfo = function (card) {
    this.card = card;
    this.info = null;
};

var Hand = function () {
    this.cards = [];
};

var Game = function () {
    this.id = GAME_COUNT++;
    this.deck = new Deck();
    this.played = {};
    this.discarded = {};
    this.hands = {};
    this.players = [];
    this.infoTokens = MAX_INFO_TOKENS;
    this.fuseTokens = MAX_FUSE_TOKENS;
    this.messages = [];
    this.state = GAME_STATES.PENDING;
    this.maxCards = null;
    this.focus = null; // This is the index of the players array whos turn it is.

    for (var i = 0; i < COLOURS.length ; i+=1) {
        this.played[COLOURS[i].string] = [];
        this.discarded[COLOURS[i].string] = [];
    }
};

Game.prototype.addPlayer = function (playerId) {
    if (this.state === GAME_STATES.PENDING) {
        this.players.push(playerId);
        this.hands[playerId] = new Hand();
        console.log('ADDING GAME '+this.id+'TO PLAYER' + playerId);
        PLAYERS[playerId].games.push(this.id);
        return true;
    }
    return false;
};

Game.prototype.startGame = function () {
    this.maxCards = this.players.length > 3 ? 4 : 5;  ////// Could use a good way of doing this instead of hard code.
    for (var hand in this.hands) {
        if (this.hands.hasOwnProperty(hand)) {
            this.hands[hand].cards = this.deck.drawCards(this.maxCards);
        }
    }
    this.focus = Math.floor(Math.random() * this.players.length);
    this.state = GAME_STATES.PLAYING;
};


// usernames which are currently connected to the chat
var GAMES = {};

var PLAYERS = {};

io.on('connection', function (socket) {

    // when the client emits 'add user', this listens and executes
    socket.on('player-login', function (playerProfile) {
        onPlayerLogin(socket, playerProfile);
    });

    // when the user disconnects.. perform this
    socket.on('player-logout', function (playerId) {
        onPlayerLogout(socket, playerId);
    });

    socket.on('create-game', function (playerId) {
        createGame(socket, playerId);
    });

    socket.on('start-game', function (gameId) {
        startGame(socket, gameId);
    });

    socket.on('join-game', function (data) {
        joinGame(socket, data);
    });

    socket.on('take-turn', function (data) {
        takeTurn(socket, data);
    });

    socket.on('play-card', function (data) {
        playCard(socket, data);
    });

    socket.on('discard-card', function (data) {
        discardCard(socket, data);
    });
});


var findActiveGame = function (player) {
    for (var i = 0; i < player.games.length; i+=1) {
        var game = GAMES[player.games[i]];
        if (game && game.state === GAME_STATES.PLAYING) {

            return game;
        }
    }

    return null;
};


var getTeam = function(gameId) {
    var team = {};
    for (var i = 0; i < GAMES[gameId].players.length; i += 1) {
        var player = PLAYERS[GAMES[gameId].players[i]];
        team[player.id] = player;
    }
    return team;
};

var onPlayerLogin = function (socket, playerProfile) {

    console.log('Player Login: ' + playerProfile.id);

    var player = PLAYERS[playerProfile.id];

    // first time player login - set em up
    if (!player) {
        player = PLAYERS[playerProfile.id] = new Player(playerProfile.id, playerProfile.name, playerProfile.picture);
    }

    // player has logged in before - see if they've got a game and auto connect
    var activeGame = findActiveGame(player);

    if (activeGame) {
        socket.emit('play-game', {
            game: activeGame,
            team: getTeam(activeGame.id)
        });
    }
    else {

        //player has no active games - dont auto play, just send them a list

        var gameLists = {
            yourGames: [],
            joinableGames: []
        };

        for (var game in GAMES) {
            if (GAMES.hasOwnProperty(game)) {
                if (GAMES[game].players.indexOf(player.id) > -1) {
                    gameLists.yourGames.push(GAMES[game]);
                }
                else if (GAMES[game].state === GAME_STATES.PENDING) {
                    gameLists.joinableGames.push(GAMES[game]);
                }
            }
        }

        socket.emit('display-games', gameLists)

    }

    // echo globally (all clients) that a person has connected --- This needs to only be to relevant people lol.. =/
    socket.broadcast.emit('teammate-login', player.id);
    return;

};

var onPlayerLogout = function (playerId) {
    PLAYERS[playerId].online = false;
    // PLAYERS[playerId].socket = null;
    // find if he was in a game, and make em offline ? shiiit messy

    // echo globally (all clients) that a person has connected
    socket.broadcast.emit('teammate-logout', playerId);
};

var createGame = function (socket, playerId) {
    var game = new Game();
    game.addPlayer(playerId);
    GAMES[game.id] = game;
    socket.emit('play-game', {
        game: game,
        team: getTeam(game.id)
    });
};

var startGame = function (socket, gameId) {
    GAMES[gameId].startGame();

    socket.emit('game-update', {
        game: GAMES[gameId],
        team: getTeam(gameId)
    });

    socket.broadcast.emit('game-update', {
        game: GAMES[gameId],
        team: getTeam(gameId)
    });


};

var joinGame = function (socket, data) {

    console.log('player id ' + data.playerId + ' joingin game id ' + data.gameId);
    if (GAMES[data.gameId].players.indexOf(data.playerId) === -1) {
        GAMES[data.gameId].addPlayer(data.playerId);
    }

    var team = getTeam(data.gameId);

    socket.broadcast.emit('game-update', {
        game: GAMES[data.gameId],
        team: team
    });

    socket.emit('play-game', {
        game: GAMES[data.gameId],
        team: team
    });

};

var takeTurn = function (socket, data) {

};

var playCard = function (socket, data) {
    console.log('Play card ! - player: ' + data.playerId + ' game: ' + data.gameId + ' cardIndex: ' + data.cardIndex) ;
    var card = GAMES[data.gameId].hands[data.playerId].cards.splice(data.cardIndex, 1)[0];
    console.log('you tried to play: '+card.number+card.colour.string);
    // BOOM. played a card
    if (GAMES[data.gameId].played[card.colour.string].length + 1 === card.number) {
        console.log('Correct.');
        GAMES[data.gameId].played[card.colour.string].push(card.number);
    }
    // LOL LOSE A TOKEN, GOT ANY LEFT?
    else if (!(--GAMES[data.gameId].fuseTokens)) {
        console.log('game over');
        // GAME OVER.

    }
    else {
        console.log('just lose a token which you already did, this else block is purely for logging.');
    }

};

var discardCard = function (socket, data) {
    console.log('Discard card ! - player: ' + data.playerId + ' game: ' + data.gameId + ' cardIndex: ' + data.cardIndex) ;

};







