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

        if (configNode.connected) {

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
                /*
                 structure: {
                 rooms: configNode.rooms,
                 categories: configNode.categories,
                 controls: configNode.controls
                 }*/
                structure: configNode.structureData
            };

        }

        res.json(result)

    });

    function LoxoneMiniserver(config) {


        function _update_event(uuid, evt) {
            //node.log("received update event: " + JSON.stringify(evt) + ':' + uid);
            node.handleEvent(uuid, evt);
        }

        function _limit_string(text, limit) {
            if (text.length <= limit) {
                return text;
            }
            return text.substr(0, limit) + '...(' + text.length + ')';
        }

        RED.nodes.createNode(this, config);

        var node = this;
        node.connected = false;
        node.authenticated = false;
        node.connection = null;
        node.structureData = null;
        node._inputNodes = [];
        node._outputNodes = [];

        var text_logger_limit = 100;
        //TODO: put auth mode in config
        //var ws_auth = config.encrypted ? 'AES-256-CBC' : 'Hash';
        var ws_auth = 'Hash';


        node.log('connecting miniserver at ' + config.host + ':' + config.port);

        var client = new node_lox_ws_api(
            config.host + ':' + config.port,
            node.credentials.username,
            node.credentials.password,
            true,
            ws_auth
        );

        client.connect();

        client.on('connect', function () {
            node.log('connected to ' + config.host);
            node.connected = true;
        });

        client.on('authorized', function () {
            node.log('authorized');
            node.authenticated = true;
            node.connection = client;

            node.set_connection_state("green", "connected", "dot");
        });

        client.on('connect_failed', function () {
            node.error('connect failed');
            node.set_connection_state("red", "connection failed", "ring");
        });

        client.on('connection_error', function (error) {
            node.error('connection error: ' + error);
        });

        client.on('close', function () {
            node.log("connection closed");
            node.connected = false;
            node.authenticated = false;
            node.connection = null;

            node.set_connection_state("yellow", "connection closed", "ring");
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
            //node.log('received message header (' + header.next_state() + '):');
            //console.log(header);
        });

        client.on('message_event_table_values', function (messages) {
            //node.log('received value messages:' + messages.length);
        });

        client.on('message_event_table_text', function (messages) {
            //node.log('received text messages:' + messages.length);
        });

        client.on('get_structure_file', function (data) {
            node.log("got structure file " + data.lastModified);
            node.structureData = data;
            //parseStructure(data);
        });

        client.on('update_event_value', _update_event);
        client.on('update_event_text', _update_event);
        client.on('update_event_daytimer', _update_event);
        client.on('update_event_weather', _update_event);

        this.on('close', function(done) {
            if (node.connected){
                client.once('close', function() {
                    done();
                });
                client.close();
            }
        });

    }

    RED.nodes.registerType("loxone-miniserver", LoxoneMiniserver, {
        credentials: {
            username: {type: "text"},
            password: {type: "password"}
        }
    });


    LoxoneMiniserver.prototype.registerInputNode = function (handler) {
        this._inputNodes.push(handler);
    };

    LoxoneMiniserver.prototype.registerOutputNode = function (handler) {
        this._outputNodes.push(handler);
    };


    LoxoneMiniserver.prototype.deregisterInputNode = function (handler) {
        this._inputNodes.forEach(function (node, i, inputNodes) {
            if (node === handler) {
                inputNodes.splice(i, 1);
            }
        });
    };

    LoxoneMiniserver.prototype.deregisterOutputNode = function (handler) {
        this._outputNodes.forEach(function (node, i, outputNodes) {
            if (node === handler) {
                outputNodes.splice(i, 1);
            }
        });
    };

    LoxoneMiniserver.prototype.set_connection_state = function(color, text, shape = 'dot'){
        var set_connection_state = function(item) {
            item.status({
                fill: color,
                shape: shape,
                text: text
            });
        };

        this._inputNodes.forEach(set_connection_state);
        this._outputNodes.forEach(set_connection_state);
    };

    LoxoneMiniserver.prototype.handleEvent = function (uuid, event) {

        for (var i = 0; i < this._inputNodes.length; i++) {
            if (this._inputNodes[i].state == uuid) {

                var ourControl = this._inputNodes[i].control;
                var controlName, stateName, roomName, categoryName, controlDetails, controlType;

                if (typeof this.structureData.controls[ourControl] != 'undefined') {

                    //get information on control from structure
                    var controlStructure = this.structureData.controls[ourControl];

                    controlName = controlStructure.name;
                    controlDetails = controlStructure.details;
                    controlType = controlStructure.type;
                    roomName = this.structureData.rooms[controlStructure.room].name;
                    categoryName = this.structureData.cats[controlStructure.cat].name;

                    //get state name
                    for (stateName in controlStructure.states) {
                        if (controlStructure.states[stateName] == this._inputNodes[i].state) {
                            break;
                        }
                    }

                    this.log('got "' + stateName + '" for "' + controlName + '"');

                } else {
                    this.log('got message for ' + this._inputNodes[i].state);
                }


                var payload;
                try {
                    payload = JSON.parse(event);
                }
                catch (err) {
                    payload = event;
                }

                var msg = {
                    payload: payload,
                    topic: controlName,
                    state: stateName,
                    room: roomName,
                    category: categoryName,
                    details: controlDetails,
                    type: controlType
                };

                this._inputNodes[i].send(msg);

            }
        }

    };


    function LoxoneInNode(config) {

        RED.nodes.createNode(this, config);
        var node = this;

        node.status({});
        node.state = config.state;
        node.control = config.control;
        node.subControl = config.subControl;

        node.miniserver = RED.nodes.getNode(config.miniserver);

        if (node.miniserver) {
            node.miniserver.registerInputNode(node);

            this.on('close', function(done) {
                if (node.miniserver) {
                    node.miniserver.deregisterInputNode(node);
                }
                done();
            });
        }

    }

    RED.nodes.registerType("loxone-in", LoxoneInNode);

    function LoxoneOutNode(config) {

        RED.nodes.createNode(this, config);
        var node = this;

        node.status({});
        node.control = config.control;
        node.subControl = config.subControl;

        node.miniserver = RED.nodes.getNode(config.miniserver);

        if (node.miniserver) {

            node.miniserver.registerOutputNode(node);

            this.on('input', function (msg) {
                node.miniserver.connection.send_cmd(node.control, msg.payload);
            });

            this.on('close', function(done) {
                if (node.miniserver) {
                    node.miniserver.deregisterOutputNode(node);
                }
                done();
            });
        }

    }

    RED.nodes.registerType("loxone-out", LoxoneOutNode);
};
