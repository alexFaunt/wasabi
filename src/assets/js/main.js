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

var socket = io();

var onFacebookLogin = function (authLogin) {
    hello(authLogin.network).api('/me').then(onFacebookProfile);
};

var onFacebookProfile = function (profile) {
    console.log(profile.name, profile.id);

    PLAYER = profile;

    socket.emit('player-login', profile);
};

var onTeammateLogin = function (teamMateInfo) {
    console.log('LOLIN', teamMateInfo);
};

var onTeammateLogout = function (teamMateInfo) {
    console.log('LOLOUT', teamMateInfo);
};


var startPendingGame = function (e) {
    socket.emit('start-game', e.detail);
};

var sanitiseGame = function (game) {
    game.deckLeft = game.deck.cards.length;
    delete game.deck; /// HAHA, need to delete this too, these need to go server side, but it's all synced it's annoying. JUST DON'T CHEAT K?
    delete game.hands[PLAYER.id]; // remove the current players hand - pretty crappy way to stop cheating but it'll do for now
    return game;
}

var playGame = function (data) {
    console.log('Found a game that you should be playing, get on with it', data);

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
        setContent(gameElement);
        PLAYING_GAME = true;
    });
};

var startNewGame = function () {
    socket.emit('create-game', PLAYER.id);
};

var playSelectedGame = function (e) {
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

var displayGameSelect = function (gamesToDisplay) {
    console.log('Display a list of games to pick from');

    Polymer.import([MODULES.GAME_SELECTOR], function () {
        var gameSelector = document.createElement('game-selector');
        gameSelector.yourGames = gamesToDisplay.yourGames;
        gameSelector.joinableGames = gamesToDisplay.joinableGames;
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
        CURRENT_CONTENT.team = data.team;
    }
    else if (!PLAYING_GAME) {
        playGame(data);
    }
};

var playCard = function (data) {
    socket.emit('play-card', data.detail);
};

var discardCard = function (data) {
    socket.emit('discard-card', data.detail);
};

// GO

hello.init(APP_IDS);

hello.on('auth.login', onFacebookLogin);

socket.on('teammate-login', onTeammateLogin);

socket.on('teammate-logout', onTeammateLogout);

socket.on('play-game', playGame);

socket.on('display-games', displayGameSelect);

socket.on('game-update', gameUpdate);

document.getElementById('facebook').addEventListener('click', function(){
    hello('facebook').login();
});




