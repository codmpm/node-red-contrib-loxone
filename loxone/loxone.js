module.exports = function (RED) {

    "use strict";
    var ws = require("ws");
    var crypto = require("crypto");

    const keepAliveInterval = 120000;

    //http://stackoverflow.com/questions/3745666/how-to-convert-from-hex-to-ascii-in-javascript
    function hex2a(hexx) {
        var hex = hexx.toString();//force conversion
        var str = '';
        for (var i = 0; i < hex.length; i += 2)
            str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
        return str;
    }

    function LoxoneMiniserver(config) {

        RED.nodes.createNode(this, config);

        var node = this;

        node.host = config.host;
        node.port = config.port;

        node.connected = false;
        node.authenticated = false;
        node.reconnectTimeout = undefined;
        node.keepAliveTimeout = undefined;

        var username = this.credentials.username;
        var password = this.credentials.password;
        var authKey = null;

        var uri = 'ws://' + node.host + ':' + node.port + '/ws/rfc6455';
        var reqInit = 'jdev/sys/getkey';

        connectMiniserver();

        function connectMiniserver() {
            node.tout = null;

            var socket = new ws(uri, 'remotecontrol');
            socket.setMaxListeners(0);
            node.server = socket; // keep for closing

            handleMiniserverConnection(socket);
        }

        function handleMiniserverConnection(socket) {

            socket.on('open', function () {
                node.log('Connected to ' + uri);

                node.connected = true;
                socket.send(reqInit);
                console.log('opened');
            });

            socket.on('message', function (msg) {
                console.log('received message:');
                console.log(msg);
                //console.log(typeof msg);

                //TODO: check binary message header. For now only handle the string/json responses

                if (typeof msg == 'string') {
                    var response = JSON.parse(msg);

                    switch (response.LL.Code) {

                        case '200':

                            if(response.LL.control.indexOf('authenticate') > -1){
                                //we've got 200 on our authentication request
                                node.authenticated = true;
                                node.log('Authenticated with miniserver!');

                                clearInterval(node.keepAliveTimeout);
                                node.keepAliveTimeout = setInterval(handleKeepAlive, keepAliveInterval);

                            } else if (response.LL.control == reqInit) {
                                authKey = hex2a(response.LL.value);
                                var cred = username + ':' + password;
                                var hash = crypto.createHmac('sha1', authKey).update(cred).digest('hex');
                                socket.send('authenticate/' + hash);
                            }
                            break;

                        case '401':

                            if(response.LL.control.indexOf('authenticate') > -1) {
                                //we've got a 401 on our authentication request
                                node.authenticated = false;
                                node.warn('Connection to miniserver could not be authorized.');
                            }

                            break;


                        default:
                            node.warn('Unknown status on miniserver request: ' + response.LL.Code);

                    }


                }


            });

            socket.on('close', function () {

                node.connected = false;
                node.authenticated = false;
                clearInterval(node.keepAliveTimeout);

                node.warn('Miniserver Websocket closed.');

                //node.reconnectTimeout = setTimeout(connectMiniserver, 5000);
            });

        }


        function handleKeepAlive(){
            if(node.connected){
                node.server.send('keepalive');
                node.log("Sent keepalive...");
            }
        }

    }

    RED.nodes.registerType("loxone-miniserver", LoxoneMiniserver, {
        credentials: {
            username: {type: "text"},
            password: {type: "password"}
        }
    });


    function LoxoneInNode(config) {

        RED.nodes.createNode(this, config);
        var node = this;

        this.on('input', function (msg) {


            node.send(msg);


        });
    }

    RED.nodes.registerType("loxone-in", LoxoneInNode);
    //RED.nodes.registerType("loxone-out", LoxoneOutNode);
}