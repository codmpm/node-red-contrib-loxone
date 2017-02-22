module.exports = function (RED) {

    "use strict";
    const node_lox_ws_api = require("node-lox-ws-api");

    RED.httpAdmin.get('/struct', function (req, res) {
        if (!req.query.id) {
            return res.json("");
        }

        var configNode = RED.nodes.getNode(req.query.id);
        var result = {
            state: 'error',
            msg: 'miniserver not connected',
            structure: {}
        };

        if (configNode.miniserverConnected) {

            /*
             console.log('connected, show debug');

             console.log('---------------------------');
             console.log(configNode.rooms);
             console.log(configNode.categories);

             console.log('---------------------------');
             //console.log(node.structureData.controls);
             console.log(configNode.controls);
             */

            result = {
                state: 'ok',
                msg: 'got miniserver structure',
                structure: {
                    rooms: configNode.rooms,
                    categories: configNode.categories,
                    controls: configNode.controls
                }
            };

        }

        res.json(result)

    });

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
        node.miniserverConnected = false;
        node.miniserverAuthenticated = false;
        node.miniserverConnection = null;
        node.structureData = null;
        node.rooms = {};
        node.categories = {};
        node.controls = {};


        var text_logger_limit = 100;
        //TODO: put auth mode in config
        //var ws_auth = config.encrypted ? 'AES-256-CBC' : 'Hash';
        var ws_auth = 'Hash';


        node.log('connecting miniserver...');

        //TODO: add port to connection
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
            node.miniserverConnected = true;
        });

        client.on('authorized', function () {
            node.log("authorized");
            node.miniserverAuthenticated = true;
            node.miniserverConnection = client;
        });

        client.on('connect_failed', function () {
            node.error("connect failed");
        });

        client.on('connection_error', function (error) {
            node.error("connection error: " + error);
        });

        client.on('close', function () {
            node.log("connection closed");
            node.miniserverConnected = false;
            node.miniserverAuthenticated = false;
            node.miniserverConnection = null;
        });

        client.on('send', function (message) {
            node.log("sent message: " + message);
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
            node.log('received message header (' + header.next_state() + '):');
            //console.log(header);
        });

        client.on('message_event_table_values', function (messages) {
            node.log('received value messages:' + messages.length);
        });

        client.on('message_event_table_text', function (messages) {
            node.log('received text messages:' + messages.length);
        });

        client.on('get_structure_file', function (data) {
            node.log("got structure file " + data.lastModified);
            node.structureData = data;
            parseStructure(data);

        });

        client.on('update_event_value', _update_event);
        client.on('update_event_text', _update_event);
        client.on('update_event_daytimer', _update_event);
        client.on('update_event_weather', _update_event);


        function parseStructure(data) {

            var uuid;

            for (uuid in data.rooms) {
                if (data.rooms.hasOwnProperty(uuid)) {
                    node.rooms[uuid] = data.rooms[uuid].name;
                }
            }

            for (uuid in data.cats) {
                if (data.cats.hasOwnProperty(uuid)) {
                    node.categories[uuid] = data.cats[uuid].name;
                }
            }

            for (uuid in data.controls) {
                if (data.controls.hasOwnProperty(uuid)) {
                    node.controls[uuid] = {
                        name: data.controls[uuid].name,
                        room: data.controls[uuid].room,
                        cat: data.controls[uuid].cat,
                        states: data.controls[uuid].states
                    }
                }
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