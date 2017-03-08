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

            var i;
            for (i = 0; i < node._inputNodes.length; i++) {
                node._inputNodes[i].status({
                    fill: "green",
                    shape: "dot",
                    text: "connected"
                });
            }

            for (i = 0; i < node._outputNodes.length; i++) {
                node._outputNodes[i].status({
                    fill: "green",
                    shape: "dot",
                    text: "connected"
                });
            }

        });

        client.on('connect_failed', function () {
            node.error('connect failed');

            var i;
            for (i = 0; i < node._inputNodes.length; i++) {
                node._inputNodes[i].status({
                    fill: "red",
                    shape: "circle",
                    text: "connection failed"
                });
            }

            for (i = 0; i < node._outputNodes.length; i++) {
                node._outputNodes[i].status({
                    fill: "red",
                    shape: "circle",
                    text: "connection failed"
                });
            }

        });

        client.on('connection_error', function (error) {
            node.error('connection error: ' + error);
        });

        client.on('close', function () {
            node.log("connection closed");
            node.connected = false;
            node.authenticated = false;
            node.connection = null;

            var i = 0;
            for (i = 0; i < node._inputNodes.length; i++) {
                node._inputNodes[i].status({
                    fill: "orange",
                    shape: "circle",
                    text: "connection closed"
                });
            }

            for (i = 0; i < node._outputNodes.length; i++) {
                node._outputNodes[i].status({
                    fill: "orange",
                    shape: "circle",
                    text: "connection closed"
                });
            }

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

    }

    RED.nodes.registerType("loxone-miniserver", LoxoneMiniserver, {
        credentials: {
            username: {type: "text"},
            password: {type: "password"}
        }
    });


    LoxoneMiniserver.prototype.registerInputNode = function (handler) {
        //console.log('registered input node for ' + handler.uuid);
        this._inputNodes.push(handler);
    };

    /*
     LoxoneMiniserver.prototype.registerOutputNode = function (handler) {
     //console.log('registered output node for ' + handler.uuid);
     this._outputNodes.push(handler);
     };
     */


    LoxoneMiniserver.prototype.removeInputNode = function (handler) {
        this._inputNodes.forEach(function (node, i, inputNodes) {
            if (node === handler) {
                inputNodes.splice(i, 1);
            }
        });
    };

    /*
     LoxoneMiniserver.prototype.removeOutputNode = function (handler) {
     this._outputNodes.forEach(function (node, i, inputNodes) {
     if (node === handler) {
     inputNodes.splice(i, 1);
     }
     });
     };
     */

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
            //register node to the desired connection
            node.miniserver.registerInputNode(node);

            //this.miniserver.connection
            //TODO: think about unregistering the node from the connection
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

            //this.registerOutputNode(node);

            this.on('input', function (msg) {
                node.miniserver.connection.send_cmd(node.control, msg.payload);
            });
        }

    }

    RED.nodes.registerType("loxone-out", LoxoneOutNode);
};