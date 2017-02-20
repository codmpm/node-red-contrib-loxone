module.exports = function (RED) {

    "use strict";
    //var ws = require("ws");
    const node_lox_ws_api = require("node-lox-ws-api");

    function LoxoneMiniserver(config) {

        function _update_event(uuid, evt) {
            var data = {
                uuid: uuid,
                'event': _limit_string(JSON.stringify(evt), text_logger_limit),
            };
            node.log("received update event: " + data.event + ':' + data.uuid);
        }

        function _limit_string(text, limit) {
            if (text.length <= limit) {
                return text;
            }
            return text.substr(0, limit) + '...(' + text.length + ')';
        }


        RED.nodes.createNode(this, config);

        var node = this;
        //node.port = config.port;


        var text_logger_limit = 100;
        //var ws_auth = config.encrypted ? 'AES-256-CBC' : 'Hash';
        var ws_auth = 'Hash';

        node.log('connecting miniserver...');

        var client = new node_lox_ws_api(
            config.host,
            node.credentials.username,
            node.credentials.password,
            true,
            ws_auth
        );

        client.connect();

        client.on('connect', function () {
            node.log("connected");
        });

        client.on('authorized', function () {
            node.log("authorized");
        });

        client.on('connect_failed', function () {
            node.error("connect failed");
        });

        client.on('connection_error', function (error) {
            node.error("connection error: " + error);
        });

        client.on('close', function () {
            node.log("connection closed");
        });

        client.on('send', function (message) {
            node.log("send message: " + message);
        });

        client.on('message_text', function (message) {
            var data = {
                type: message.type
            };
            switch (message.type) {
                case 'json':
                    data.json = _limit_string(JSON.stringify(message.json), text_logger_limit);
                    node.log("received text message: " + data.json);

                    break;
                case 'control':
                    data.control = message.control;
                    data.value = message.value;
                    data.code = message.code;
                    break;
                default:
                    data.text = _limit_string(message.data, text_logger_limit);
                    node.log("received text message: " + data.text);
            }

        });


        client.on('keepalive', function (time) {
            node.log('keepalive (' + time + 'ms)');
        });

        client.on('message_header', function (header) {
            node.log('received message header (' + header.next_state() + '):', header);
        });

        client.on('message_event_table_values', function (messages) {
            node.log('received value messages:' + messages.length);
        });

        client.on('message_event_table_text', function (messages) {
            node.log('received text messages:' + messages.length);
        });

        client.on('get_structure_file', function (data) {
            node.log("get structure file " + data.lastModified);

            //console.log('------------ structure');
            //console.log(data);
            //console.log('----------------------');
        });

        client.on('update_event_value', _update_event);
        client.on('update_event_text', _update_event);
        client.on('update_event_daytimer', _update_event);
        client.on('update_event_weather', _update_event);


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