module.exports = function (RED) {

    "use strict";
    var ws = require("ws");

    function LoxoneMiniserver(config) {
        RED.nodes.createNode(this, config);
        var node = this;

        node.host = config.host;
        node.post = config.port;

        node.username = this.credentials.user;
        node.password = this.credentials.password;

        connectMiniserver();

        function connectMiniserver() {
            node.tout = null;
            var socket = new ws('ws://' + node.host + ':' + node.port + '/ws/rfc6455');
            socket.setMaxListeners(0);
            node.server = socket; // keep for closing

            handleMiniserverConnection(socket);
        }

        function handleMiniserverConnection(socket) {

            socket.on('open', function(){
                console.log('opened');
            });

            socket.on('close', function(){
                console.log('closed');
            })

        }


    }

    function LoxoneInNode(config) {

        RED.nodes.createNode(this, config);
        var node = this;

        this.on('input', function (msg) {


            node.send(msg);


        });
    }


    RED.nodes.registerType("loxone-miniserver", LoxoneMiniserver);
    RED.nodes.registerType("loxone-in", LoxoneInNode);
    //RED.nodes.registerType("loxone-out", LoxoneOutNode);
}