module.exports = function (RED) {

    "use strict";
    const node_lox_ws_api = require("node-lox-ws-api");
    const http = require('http');


    RED.httpAdmin.get('/loxone-miniserver/struct', function (req, res) {
        if (!req.query.id) {
            return res.json("");
        }

        var configNode = RED.nodes.getNode(req.query.id);
        var result = {
            state: 'error',
            msg: 'miniserver not connected',
            structure: {}
        };

        if (configNode && configNode.connected) {

            result = {
                state: 'ok',
                msg: 'got miniserver structure',
                structure: configNode.structureData
            };

        }

        res.json(result)
    });

    RED.httpAdmin.get('/loxone-miniserver/struct-changed', function (req, res) {

        var result = {
            state: 'error',
            msg: 'miniserver not connected',
            structure: {}
        };

        var username = req.query.username;
        var password = req.query.password;

        var configNode = RED.nodes.getNode(req.query.id);
        if (configNode) {
            if (!username) {
                username = configNode.credentials.username;
            }
            if (!password) {
                password = configNode.credentials.password;
            }
        }

        http.get({
                host: req.query.host,
                port: req.query.port,
                path: '/data/LoxAPP3.json',
                auth: username + ':' + password,
            }, function (http_res) {
                if (http_res.statusCode !== 200) {
                    http_res.resume();
                    res.json(result);
                    return;
                }

                var data = '';
                http_res.on('data', function (chunk) {
                    data += chunk;
                });
                http_res.on('end', function () {
                    result = {
                        state: 'ok',
                        msg: 'got miniserver structure',
                        structure: prepareStructure(JSON.parse(data)),
                    };
                    res.json(result);
                });
            }
        ).on('error', function (e) {
            res.json(result);
        });
    });

    function LoxoneMiniserver(config) {


        function _updateEvent(uuid, evt) {
            //node.log("received update event: " + JSON.stringify(evt) + ':' + uuid);
            node.handleEvent(uuid, evt);
        }

        function _limitString(text, limit) {
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
        node._webserviceNodes = []; //only webservice nodes which have a message sent will be here

        var text_logger_limit = 100;
        var ws_auth = config.encrypted ? 'AES-256-CBC' : 'Hash';

        //node.log('connecting miniserver at ' + config.host + ':' + config.port);

        var client = new node_lox_ws_api(
            config.host + ':' + config.port,
            node.credentials.username,
            node.credentials.password,
            true,
            ws_auth
        );

        client.connect();

        client.on('connect', function () {
            node.log('Miniserver connected (' + config.host + ':' + config.port) + ')';
            node.connected = true;
        });

        client.on('authorized', function () {
            //node.log('authorized');
            node.authenticated = true;
            node.connection = client;

            node.setConnectionState("green", "connected", "dot");
            sendOnlineMsg(true);
        });

        client.on('connect_failed', function () {
            node.error('Miniserver connect failed');
            node.setConnectionState("red", "connection failed", "ring");
        });

        client.on('connection_error', function (error) {
            node.error('Miniserver connection error: ' + error);
            node.setConnectionState("red", "connection error", "ring");
        });

        client.on('close', function () {
            node.log("connection closed");
            node.connected = false;
            node.authenticated = false;
            node.connection = null;

            node.setConnectionState("yellow", "connection closed", "ring");
            sendOnlineMsg(false);
        });

        client.on('send', function (message) {
            //node.log("sent message: " + message);
        });

        client.on('message_text', function (message) {

            var data = {
                type: message.type
            };

            switch (message.type) {
                case 'json':
                    data.json = _limitString(JSON.stringify(message.json), text_logger_limit);
                    node.log("received text message: " + data.json);

                    break;
                case 'control':

                    for (var i in node._webserviceNodes) {

                        var wsNode = node._webserviceNodes[i];

                        if (wsNode.uri == 'j' + message.control) {

                            var msg = {
                                'payload': message.value,
                                'topic': message.control,
                                'code': parseInt(message.code)
                            };

                            //send the data out of the requesting node
                            wsNode.send(msg);

                            //unregister node from queue
                            node.deregisterWebserviceNode(wsNode);
                            break;
                        }
                    }

                    break;
                default:
                    data.text = _limitString(message.data, text_logger_limit);
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
            node.structureData = prepareStructure(data);
        });

        client.on('update_event_value', _updateEvent);
        client.on('update_event_text', _updateEvent);
        client.on('update_event_daytimer', _updateEvent);
        client.on('update_event_weather', _updateEvent);

        this.on('close', function (done) {
            if (node.connected) {
                client.once('close', function () {
                    done();
                });

                client.abort();
            } else {
                done();
            }
            sendOnlineMsg(false);
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

    LoxoneMiniserver.prototype.registerWebserviceNode = function (handler) {
        this._webserviceNodes.push(handler);
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

    LoxoneMiniserver.prototype.deregisterWebserviceNode = function (handler) {
        this._webserviceNodes.forEach(function (node, i, outputNodes) {
            if (node === handler) {
                outputNodes.splice(i, 1);
            }
        });
    };

    LoxoneMiniserver.prototype.setConnectionState = function (color, text, shape = 'dot') {
        var newState = function (item) {
            item.status({
                fill: color,
                shape: shape,
                text: text
            });
        };

        this._inputNodes.forEach(newState);
        this._outputNodes.forEach(newState);
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

                    //this.log('got "' + stateName + '" for "' + controlName + '"');

                } else {
                    //this.log('got message for ' + this._inputNodes[i].state);
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

    function prepareStructure(data) {
        var structure = {
            rooms: data.rooms,
            cats: data.cats,
            controls: {}
        };

        for (var uuid in data.controls) {
            if (!data.controls.hasOwnProperty(uuid)) {
                continue;
            }

            structure.controls[uuid] = data.controls[uuid];

            if (data.controls[uuid].hasOwnProperty('subControls')) {
                for (var sub_uuid in data.controls[uuid].subControls) {
                    if (!data.controls[uuid].subControls.hasOwnProperty(sub_uuid)) {
                        continue;
                    }

                    structure.controls[sub_uuid] = data.controls[uuid].subControls[sub_uuid];
                    structure.controls[sub_uuid].parent = uuid;
                    structure.controls[sub_uuid].room = data.controls[uuid].room;
                    structure.controls[sub_uuid].cat = data.controls[uuid].cat;
                }
            }
        }

        return structure;
    };

    function sendOnlineMsg(online) {

        online = online || false;

        RED.nodes.eachNode(function (theNode) {

            if (theNode.type == 'loxone-online') {

                var node = RED.nodes.getNode(theNode.id);

                if (node) {
                    node.status({
                        fill: (online) ? 'green' : 'yellow',
                        shape: 'dot',
                        text: (online) ? 'online' : 'offline'
                    });

                    node.send({
                        payload: online
                    });
                }

            }

        });

    }

    function LoxoneControlInNode(config) {

        RED.nodes.createNode(this, config);
        var node = this;

        node.state = config.state;
        node.control = config.control;

        node.miniserver = RED.nodes.getNode(config.miniserver);

        if (node.miniserver) {
            node.miniserver.registerInputNode(node);

            this.on('close', function (done) {
                if (node.miniserver) {
                    node.miniserver.deregisterInputNode(node);
                }
                done();
            });
        }

    }

    RED.nodes.registerType("loxone-control-in", LoxoneControlInNode);

    function LoxoneControlOutNode(config) {

        RED.nodes.createNode(this, config);
        var node = this;

        node.control = config.control;
        node.miniserver = RED.nodes.getNode(config.miniserver);

        if (node.miniserver) {

            node.miniserver.registerOutputNode(node);

            this.on('input', function (msg) {
                node.miniserver.connection.send_cmd(node.control, msg.payload);
            });

            this.on('close', function (done) {
                if (node.miniserver) {
                    node.miniserver.deregisterOutputNode(node);
                }
                done();
            });
        }

    }

    RED.nodes.registerType("loxone-control-out", LoxoneControlOutNode);


    function LoxoneWebServiceNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        node.miniserver = RED.nodes.getNode(config.miniserver);

        this.on('input', function (msg) {

            node.status({});
            var wantedURI = msg.uri || config.uri;

            if (!wantedURI.length) {
                node.status({
                    fill: 'yellow',
                    shape: 'ring',
                    text: 'empty uri'
                });
                return null;
            }

            if (!wantedURI.match(/^jdev/)) {
                node.status({
                    fill: 'yellow',
                    shape: 'ring',
                    text: 'invalid uri'
                });
                return null;
            }

            node.uri = wantedURI;
            //node.log('sending ' + wantedURI);

            //add node to the queue for waiting messages and send the URI
            node.miniserver.registerWebserviceNode(node);
            node.miniserver.connection.connection.send(wantedURI);

        });


    }

    RED.nodes.registerType('loxone-webservice', LoxoneWebServiceNode);


    function LoxoneOnlineNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        node.miniserver = RED.nodes.getNode(config.miniserver);
    }

    RED.nodes.registerType('loxone-online', LoxoneOnlineNode);


}
;
