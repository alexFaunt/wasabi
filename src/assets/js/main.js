// HACKY CODE DON'T JUDGE LEST YE BE JUDGED.

var APP_IDS = {
    facebook: 1470701249879173
};

var MODULES_PATH = 'components/';
var MODULES = {
    GAME_SELECTOR: MODULES_PATH + 'game-selector/game-selector.html',
    GAME: MODULES_PATH + 'wasabi-game/wasabi-game.html'
};

var PLAYER;
var CURRENT_CONTENT;
var PLAYING_GAME = false;
var CONTENT = document.getElementById('content');
var WAITING_FOR_GAME = null;

var socket = io();

var onFacebookLogin = function (authLogin) {
    hello(authLogin.network).api('/me').then(onFacebookProfile);
};

var onFacebookProfile = function (profile) {

    PLAYER = profile;

    socket.emit('player-login', profile);
};

var onTeammateLogin = function (teamMateInfo) {
};

var onTeammateLogout = function (teamMateInfo) {
};


var startPendingGame = function (e) {
    socket.emit('start-game', e.detail);
};

var sanitiseGame = function (game) {
    game.deckLeft = game.deck.cards.length;
    delete game.deck; /// HAHA, need to delete this too, these need to go server side, but it's all synced it's annoying. JUST DON'T CHEAT K?
    for (var i = 0;i < game.hands[PLAYER.id].cards.length; i+=1) {
        delete game.hands[PLAYER.id].cards[i].colour; //
        delete game.hands[PLAYER.id].cards[i].number; //
    }
    return game;
};

var playGame = function (data) {

    Polymer.import([MODULES.GAME], function () {
        var gameElement = document.createElement('wasabi-game');
        gameElement.player = PLAYER.id;
        gameElement.team = data.team;
        if (data.game.state === 'PLAYING') {
            data.game = sanitiseGame(data.game);
        }
        gameElement.game = data.game;
        gameElement.addEventListener('start-game', startPendingGame);
        gameElement.addEventListener('play-card', playCard);
        gameElement.addEventListener('discard-card', discardCard);
        gameElement.addEventListener('give-info', giveInformation);
        gameElement.addEventListener('back-to-select', backToMenu);
        setContent(gameElement);
        PLAYING_GAME = true;
    });
};

var startNewGame = function () {
    socket.emit('create-game', PLAYER.id);
};

var playSelectedGame = function (e) {
    WAITING_FOR_GAME = e.detail;
    socket.emit('join-game', {
        playerId: PLAYER.id,
        gameId: e.detail
    });
};

var setContent = function (ele) {
    CONTENT.innerHTML = '';
    CURRENT_CONTENT = ele;
    CONTENT.appendChild(ele);
};

var backToMenu = function () {
    PLAYING_GAME = false;
    socket.emit('update-games');
};

var displayGameSelect = function (games) {

    var gameLists = {
        yourGames: [],
        joinableGames: []
    };

    for (var idx in games) {
        if (games.hasOwnProperty(idx)) {
            if (games[idx].players.indexOf(PLAYER.id) > -1) {
                gameLists.yourGames.push(games[idx]);
            }
            else if (games[idx].state === 'PENDING') {
                gameLists.joinableGames.push(games[idx]);
            }
        }
    }

    Polymer.import([MODULES.GAME_SELECTOR], function () {
        var gameSelector = document.createElement('game-selector');
        gameSelector.yourGames = gameLists.yourGames;
        gameSelector.joinableGames = gameLists.joinableGames;
        gameSelector.addEventListener('new-game', startNewGame);
        gameSelector.addEventListener('select-game', playSelectedGame);
        PLAYING_GAME = false;
        setContent(gameSelector);
    });

};

var gameUpdate = function (data) {
    if (PLAYING_GAME && CURRENT_CONTENT.game.id === data.game.id) {
        data.game = sanitiseGame(data.game);
        CURRENT_CONTENT.game = data.game;
        // if we get sent a team update it
        if (data.team) {
            CURRENT_CONTENT.team = data.team;
        }
    }
    else if (!PLAYING_GAME && WAITING_FOR_GAME == data.game.id) {
        playGame(data);
        WAITING_FOR_GAME = null;
    }
};

var playCard = function (data) {
    socket.emit('play-card', data.detail);
};

var discardCard = function (data) {
    socket.emit('discard-card', data.detail);
};

var giveInformation = function (data) {
    socket.emit('give-info', data.detail);
};

var gameListUpdate = function (data) {
    if (!PLAYING_GAME) {
        displayGameSelect(data);
    }
};

// GO
hello.init(APP_IDS);

hello.on('auth.login', onFacebookLogin);

socket.on('teammate-login', onTeammateLogin);

socket.on('teammate-logout', onTeammateLogout);

socket.on('play-game', playGame);

socket.on('display-games', displayGameSelect);

socket.on('game-list-update', gameListUpdate);

socket.on('game-update', gameUpdate);

document.getElementById('facebook').addEventListener('click', function(){
    hello('facebook').login();
});




