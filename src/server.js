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

var MAX_LIFE_POINTS = 3;

var CARDS_PER_SUIT = [3, 2, 2, 2, 1];

var WHITELISTING = false;

// me + test accounts
var WHITELIST = ['10152475539689601', '267049153493228', '1380998382190394'];

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
        idx: 0,
        string: 'red',
        className: 'red'
    },
    {
        idx: 1,
        string: 'blue',
        className: 'blue'
    },
    {
        idx: 2,
        string: 'green',
        className: 'green'
    },
    {
        idx: 3,
        string: 'yellow',
        className: 'yellow'
    },
    {
        idx: 4,
        string: 'purple',
        className: 'purple'
    }
];

var TURN_TYPES = {
    'PLAY': 'PLAY',
    'DISCARD': 'DISCARD',
    'INFO': 'INFO'
}

//Classes
var Message = function (message) {
    this.dateTime = new Date();
    this.message = message;
};

var Info = function () {
    this.colour = null;
    this.number = null;
    this.notColour = [];
    this.notNumber = [];
};

var Card = function (colour, number) {
    this.colour = colour;
    this.number = number;
    this.info = new Info();
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

                this.cards.push(new Card(COLOURS[k], i));
            }
        }
    }

};
Deck.prototype.drawCard = function () {
    if (this.cards.length) {
        return this.cards.splice(Math.floor(Math.random() * this.cards.length), 1)[0];
    }
    return null;
};
Deck.prototype.drawCards = function (amount) {
    var cards = [];
    for (var i = 0; i < amount; i +=1) {
        cards.push(this.drawCard());
    }
    return cards;
};

var Player = function (id, name, picture, games) {
    this.id = id;
    this.name = name;
    this.picture = picture;
    this.games = games ? games : [];
};

var Hand = function () {
    this.cards = [];
};

var Game = function (existing) {
    if (existing) {
        this.id = existing.id;
        this.deck = existing.deck;
        this.played = existing.played;
        this.discarded = existing.discarded;
        this.hands = existing.hands;
        this.players = existing.players;
        this.infoTokens = existing.infoTokens;
        this.lifePoints = existing.lifePoints;
        this.messages = existing.messages;
        this.state = existing.state;
        this.maxCards = existing.maxCards;
        this.focus = existing.focus;
        this.creator = existing.creator;
        this.creatorName = existing.creatorName;
        this.gameEndCard = existing.gameEndCard;
        this.playersFinished = existing.playersFinished;
        this.played = existing.played;
    }
    else {
        this.id = GAME_COUNT++;
        this.deck = new Deck();
        this.played = [];
        this.discarded = [];
        this.hands = {};
        this.players = [];
        this.infoTokens = MAX_INFO_TOKENS;
        this.lifePoints = MAX_LIFE_POINTS;
        this.messages = [];
        this.state = GAME_STATES.PENDING;
        this.maxCards = null;
        this.focus = null; // This is the index of the players array whos turn it is.
        this.creator = null;
        this.creatorName = null;
        this.gameEndCard = null;
        this.playersFinished = [];// The player who drew the last card gets 1 more go.

        for (var i = 0; i < COLOURS.length ; i+=1) {
            this.played[COLOURS[i].idx] = [];
        }
    }
};

Game.prototype.addPlayer = function (playerId) {
    if (this.state === GAME_STATES.PENDING) {
        if (this.players.length === 0) {
            this.creator = playerId;
            this.creatorName = PLAYERS[playerId].name;
        }
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

Game.prototype.hasWon = function () {
    for (var i = 0; i < this.played.length; i += 1) {
        if(this.played[i].length < CARDS_PER_SUIT.length) {
            return false;
        }
    }
    return true;
};

Game.prototype.playCard = function (playerId, cardIndex) {

    var card = this.hands[playerId].cards.splice(cardIndex, 1)[0];

    console.log('you tried to play: '+card.number+card.colour.string);

    var success = ' failed to play a '

    // BOOM. played a card
    if (this.played[card.colour.idx].length + 1 === card.number) {
        console.log('Correct.');
        success = ' succesfully played a ';
        this.played[card.colour.idx].push(card);

        // did we win yet?
        if (this.hasWon()) {
            console.log('WINNER WINNER CHECHEN DINNAH.');
            this.state = GAME_STATES.WON;
        }
        // no better carry on shit lords.
        else {
            this.nextTurn();

            this.giveCard(playerId);
        }
    }
    // LOL LOSE A TOKEN, GOT ANY LEFT?
    else if (!(--this.lifePoints)) {
        console.log('game over');
        // GAME OVER.
        this.state = GAME_STATES.LOST;
    }
    else {
        this.discardCard(playerId, null, card);
    }

    this.messages.unshift(new Message(PLAYERS[playerId].name + success + card.colour.string + ' ' + card.number));

};


// two ways to invoke, either with player Id + card index, or card
Game.prototype.discardCard = function (playerId, cardIndex, card) {
    var discardedCard;

    if (cardIndex !== null) {
        discardedCard = this.hands[playerId].cards.splice(cardIndex, 1)[0];
    }
    else {
        discardedCard = card;
    }
    this.messages.unshift(new Message(PLAYERS[playerId].name + ' discarded a ' + discardedCard.colour.string + ' ' + discardedCard.number));

    this.discarded.push(discardedCard);

    var amount = 0;
    for (var i = 0; i < this.discarded.length; i += 1) {
        amount = this.discarded[i].number === discardedCard.number && this.discarded[i].colour.idx === discardedCard.colour.idx ? amount + 1 : amount;
    }
    // bad discard - loswer.
    if (amount === CARDS_PER_SUIT[discardedCard.number - 1]) {
        console.log('Discarded too many cards - ' + discardedCard.number + ' ' + discardedCard.colour.string + ' x ' + amount);
        this.gameEndCard = discardedCard;
        this.state = GAME_STATES.LOST;
    }
    // good discard
    else {
        // if it was invoked using a card index then it's a legit discard then we get a token
        if (cardIndex !== null) {
            // get a tokens
            this.infoTokens = this.infoTokens < MAX_INFO_TOKENS ? this.infoTokens + 1 : MAX_INFO_TOKENS;
        }

        // and a new cards
        this.giveCard(playerId);

        this.nextTurn();
    }

};

Game.prototype.giveCard = function (playerId) {
    var card = this.deck.drawCard();
    if (card !== null) {
        this.hands[playerId].cards.push(card);
    }

};

Game.prototype.nextTurn = function () {

    if (!this.deck.cards.length) {
        console.log('Nomore cards');

        this.playersFinished.push(this.players[this.focus]);

        // Greater than, because we push the first person in, who is the one who got the last card,
        // They get another go.
        if (this.playersFinished.length > this.players.length ) {
            console.log('Youve all had a go now fuck off');
            this.state = GAME_STATES.LOST;
            return;
        }
    }

    this.focus = this.focus === this.players.length - 1 ? 0 : this.focus + 1;

    console.log('Next turn player - index:' + this.focus);

};

Game.prototype.giveInfo = function (playerId, type, value) {
    // Should be impossible... but better check.
    if (this.infoTokens === 0) {
        return;
    }
    console.log('giving info to ' + PLAYERS[playerId].name + ' tpye: ' + type + ' value: ' + value);

    this.infoTokens -= 1;

    var amount = 0;

    for (var i = 0; i < this.hands[playerId].cards.length; i+=1) {
        if ((type === 'number' && this.hands[playerId].cards[i][type]) === value ||
            (type === 'colour' && this.hands[playerId].cards[i][type].string === value)) {
            this.hands[playerId].cards[i].info[type] = value;
            amount += 1;
        }
        else {

            this.hands[playerId].cards[i].info['not' + type.substring(0,1).toUpperCase() + type.substring(1)].push(value);

            // If the length of not info is the same length as type of thing -1 , then we know what it is, cba to do that though.
        }
    }

    this.messages.unshift(new Message(PLAYERS[this.players[this.focus]].name + ' told ' + PLAYERS[playerId].name + ' that they have ' + amount + ' ' + value + (amount > 1 ? '\'s' : '')));
    this.nextTurn();
};

// usernames which are currently connected to the chat
var GAMES = null;

var PLAYERS = null;


var setGames = function (rows) {
    GAMES = {};
    for (var i = 0; i < rows.length; i += 1) {
        var game = JSON.parse(rows[i].data);
        GAMES[game.id] = new Game(game);
    }
};

var setPlayers = function (rows) {
    PLAYERS = {};
    for (var i = 0; i < rows.length; i += 1) {
        var player = JSON.parse(rows[i].data);
        PLAYERS[player.id] = new Player(player.id, player.name, player.picture, player.games);
    }
};

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

var getOthersGames = function () {
    var gameLists = [];

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
};

var onPlayerLogin = function (socket, playerProfile) {

    console.log('Player Login: ' + playerProfile.id + ' ' + playerProfile.first_name);

    if (WHITELISTING && (WHITELIST.indexOf(playerProfile.id) === -1)) {
        return;
    }

    var player = PLAYERS[playerProfile.id];

    // first time player login - set em up
    if (!player) {
        player = PLAYERS[playerProfile.id] = new Player(playerProfile.id, playerProfile.first_name, playerProfile.picture);
    }

    socket.emit('display-games', GAMES);

    // echo globally (all clients) that a person has connected --- This needs to only be to relevant people lol.. =/
    // socket.broadcast.emit('teammate-login', player.id);
    return;

};

var onPlayerLogout = function (playerId) {
    // PLAYERS[playerId].online = false;
    // PLAYERS[playerId].socket = null;
    // find if he was in a game, and make em offline ? shiiit messy

    // echo globally (all clients) that a person has connected
    socket.broadcast.emit('teammate-logout', playerId);

    saveData();
};

var createGame = function (socket, playerId) {
    var game = new Game();
    game.addPlayer(playerId);
    GAMES[game.id] = game;
    socket.emit('play-game', {
        game: game,
        team: getTeam(game.id)
    });

    socket.broadcast.emit('game-list-update', GAMES);

    saveData();
};

var updateGames = function (socket) {
    socket.emit('game-list-update', GAMES);
};

var emitUpdate = function (socket, gameId) {
    socket.emit('game-update', {
        game: GAMES[gameId],
        team: getTeam(gameId)
    });

    socket.broadcast.emit('game-update', {
        game: GAMES[gameId],
        team: getTeam(gameId)
    });

    saveData();
}

var startGame = function (socket, gameId) {
    GAMES[gameId].startGame();

    emitUpdate(socket, gameId);
};

var joinGame = function (socket, data) {

    console.log('player id ' + data.playerId + ' joingin game id ' + data.gameId);
    if (GAMES[data.gameId].players.indexOf(data.playerId) === -1) {
        GAMES[data.gameId].addPlayer(data.playerId);
    }

    emitUpdate(socket, data.gameId);

    socket.broadcast.emit('game-list-update', GAMES);

};

var playCard = function (socket, data) {
    console.log('Play card ! - player: ' + data.playerId + ' game: ' + data.gameId + ' cardIndex: ' + data.cardIndex);

    GAMES[data.gameId].playCard(data.playerId, data.cardIndex);

    emitUpdate(socket, data.gameId);
};

var discardCard = function (socket, data) {
    console.log('Discard card ! - player: ' + data.playerId + ' game: ' + data.gameId + ' cardIndex: ' + data.cardIndex);

    GAMES[data.gameId].discardCard(data.playerId, data.cardIndex);

    emitUpdate(socket, data.gameId);
};

var giveInfo = function (socket, data) {
    GAMES[data.gameId].giveInfo(data.playerId, data.type, data.value);

    emitUpdate(socket, data.gameId);
};


var pg = require('pg');
var conString = process.env.DATABASE_URL;
// var conString = "pg://alex:wasabi@localhost:5432/db";
var client = new pg.Client(conString);
client.connect();

// client.query('DROP TABLE games');
// client.query('CREATE TABLE games(data varchar(1000000))');
// client.query("INSERT INTO games(data) values($1)", [JSON.stringify(new Game())]);
// client.query("INSERT INTO games(data) values($1)", [JSON.stringify(new Game())]);
// client.query("INSERT INTO games(data) values($1)", [JSON.stringify(new Game())]);

// client.query('DROP TABLE players');
// client.query('CREATE TABLE players(data varchar(1000))');
// client.query("INSERT INTO players(data) values($1)", [JSON.stringify(new Player('1','2','3'))]);
// client.query("INSERT INTO players(data) values($1)", [JSON.stringify(new Player('1','2','3'))]);
// client.query("INSERT INTO players(data) values($1)", [JSON.stringify(new Player('1','2','3'))]);
console.log(JSON.stringify(new Player('1','2','3')).length);

var query = client.query("SELECT * FROM games");
query.on("row", function (row, result) {
    result.addRow(row);
});
query.on("end", function (result) {
    // console.log(JSON.stringify(result.rows, null, "    "));
    setGames(result.rows);
    startServer();
});

var query2 = client.query("SELECT * FROM players");
query2.on("row", function (row, result) {
    result.addRow(row);
});
query2.on("end", function (result) {
    // console.log(JSON.stringify(result.rows, null, "    "));
    setPlayers(result.rows);
    startServer();
});


var startServer = function () {

    if (PLAYERS === null || GAMES === null) {
        return;
    }
    console.log(PLAYERS);
    console.log(GAMES);

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

        socket.on('play-card', function (data) {
            playCard(socket, data);
        });

        socket.on('discard-card', function (data) {
            discardCard(socket, data);
        });

        socket.on('give-info', function (data) {
            giveInfo(socket, data);
        });

        socket.on('update-games', function () {
            updateGames(socket);
        });
    });
};

var saveData = function () {
    // This can't be good.
    client.query('DROP TABLE games');
    client.query('CREATE TABLE games(data varchar(1000000))');

    for (var game in GAMES) {
        if (GAMES.hasOwnProperty(game)) {
            client.query("INSERT INTO games(data) values($1)", [JSON.stringify(game)]);
        }
    }
    // This can't be good.
    client.query('DROP TABLE players');
    client.query('CREATE TABLE players(data varchar(10000))');

    for (var player in PLAYERS) {
        if (PLAYERS.hasOwnProperty(player)) {
            client.query("INSERT INTO players(data) values($1)", [JSON.stringify(player)]);
        }
    }

};

process.on('SIGTERM', function () {
    server.close();

    client.end();

    process.exit(0);
});








