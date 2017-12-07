module.exports = function (RED) {

    "use strict";
    const node_lox_ws_api = require("node-lox-ws-api");
    const http = require('http');
    const encMethods = {
        0: 'Token-Enc',
        1: 'AES-256-CBC',
        2: 'Hash'
    };

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

        if (configNode.active !== true) {
            result.msg = 'connection disabled'
        }

        if (configNode && configNode.active && configNode.connected) {

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

            if (configNode.active !== true) {
                result.msg = 'connection disabled'
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
        node.active = true; //config.active;
        node._inputNodes = [];
        node._outputNodes = [];
        node._streamInNodes = [];
        node._streamAllNodes = [];
        node._webserviceNodes = [];
        node._webserviceNodeQueue = []; //only webservice nodes which are waiting for a return will be here

        //do nothing if miniserver connection is not active
        /*
        if (config.active !== true) {
            node.log('connection to ' + config.host + ':' + config.port + ' disabled');

            node.setConnectionStatusMsg("grey", "connection disabled", "dot");
            return;
        }*/

        var text_logger_limit = 100;

        node.encMethod = 'Token-Enc';
        if (encMethods.hasOwnProperty(config.enctype)) {
            node.encMethod = encMethods[config.enctype];
        }

        var client = new node_lox_ws_api(
            config.host + ':' + config.port,
            node.credentials.username,
            node.credentials.password,
            true,
            node.encMethod
        );

        client.connect();

        client.on('connect', function () {
            node.log('Miniserver connected (' + config.host + ':' + config.port + ') using ' + node.encMethod);
            node.connected = true;
        });

        client.on('authorized', function () {
            //node.log('authorized');
            node.authenticated = true;
            node.connection = client;

            node.setConnectionStatusMsg("green", "connected", "dot");
            sendOnlineNodeMsg(true, config.id);
        });

        client.on('connect_failed', function () {
            node.error('Miniserver connect failed');
            node.setConnectionStatusMsg("red", "connection failed", "ring");
        });

        client.on('connection_error', function (error) {
            node.error('Miniserver connection error: ' + error);
            node.setConnectionStatusMsg("red", "connection error", "ring");
        });

        client.on('close', function () {
            node.log("connection closed");
            node.connected = false;
            node.authenticated = false;
            node.connection = null;


            //node.log('active on client close' + node.active);

            /*if (node.active !== true) {
                client.abort();
                node.setConnectionStatusMsg("grey", "connection disabled", "ring");
            } else {
                node.setConnectionStatusMsg("yellow", "connection closed", "ring");
            }*/

            node.setConnectionStatusMsg("yellow", "connection closed", "ring");
            sendOnlineNodeMsg(false, config.id);

        });


        client.on('send', function (message) {
            //node.log("sent message: " + message);
        });

        client.on('message_text', function (message) {

            switch (message.type) {
                case 'json':
                    data.json = _limitString(JSON.stringify(message.json), text_logger_limit);
                    node.log("received text message: " + data.json);

                    break;
                case 'control':

                    for (var i in node._webserviceNodeQueue) {

                        var wsNode = node._webserviceNodeQueue[i];

                        if (wsNode.uri === 'j' + message.control) {

                            var msg = {
                                'payload': message.value,
                                'topic': message.control,
                                'code': parseInt(message.code)
                            };

                            //and parse all values to msg.data
                            if (message.hasOwnProperty('data') && message.data.hasOwnProperty('LL')) {
                                var additionalData = JSON.parse(JSON.stringify(message.data.LL));

                                delete additionalData.Code;
                                delete additionalData.control;

                                if (Object.keys(additionalData).length) {
                                    msg.data = additionalData;
                                }

                            }

                            //add miniserver info
                            msg.msInfo = node.structureData.msInfo;
                            msg.lastModified = node.structureData.lastModified;

                            //send the data out of the requesting node
                            wsNode.send(msg);

                            //unregister node from queue
                            node.removeWebserviceNodeFromQueue(wsNode);
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
            //node.log('keepalive (' + time + 'ms)');

            RED.nodes.eachNode(function (nodeData) {

                if (nodeData.type === 'loxone-keepalive' &&
                    nodeData.hasOwnProperty('miniserver') &&
                    nodeData.miniserver === node.id) {

                    var keepaliveNode = RED.nodes.getNode(nodeData.id);
                    if (keepaliveNode) {
                        keepaliveNode.send({
                            topic: 'keepalive',
                            payload: time,
                            msInfo: node.structureData.msInfo,
                            lastModified: node.structureData.lastModified
                        });
                    }
                }
            });

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
            //on (full-)deploys close event shutdown the client
            if (node.connected) {
                client.once('close', function () {

                    //console.log('We are here!');
                    done();
                });
                client.abort();
            } else {
                done();
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

    LoxoneMiniserver.prototype.registerWebserviceNode = function (handler) {
        this._webserviceNodes.push(handler);
    };

    LoxoneMiniserver.prototype.registerStreamInNode = function (handler) {
        this._streamInNodes.push(handler);
    };

    LoxoneMiniserver.prototype.registerStreamAllNode = function (handler) {
        this._streamAllNodes.push(handler);
    };


    LoxoneMiniserver.prototype.addWebserviceNodeToQueue = function (handler) {
        this._webserviceNodeQueue.push(handler);
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

    LoxoneMiniserver.prototype.deregisterStreamInNode = function (handler) {
        this._streamInNodes.forEach(function (node, i, streamInNodes) {
            if (node === handler) {
                streamInNodes.splice(i, 1);
            }
        });
    };

    LoxoneMiniserver.prototype.deregisterStreamAllNode = function (handler) {
        this._streamAllNodes.forEach(function (node, i, streamAllNodes) {
            if (node === handler) {
                streamAllNodes.splice(i, 1);
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


    LoxoneMiniserver.prototype.removeWebserviceNodeFromQueue = function (handler) {
        this._webserviceNodeQueue.forEach(function (node, i, outputNodes) {
            if (node === handler) {
                outputNodes.splice(i, 1);
            }
        });
    };

    LoxoneMiniserver.prototype.setConnectionStatusMsg = function (color, text, shape) {
        shape = shape || 'dot';
        var newState = function (item) {
            item.status({
                fill: color,
                shape: shape,
                text: text
            });
        };

        this._inputNodes.forEach(newState);
        this._outputNodes.forEach(newState);
        this._streamInNodes.forEach(newState);
        this._streamAllNodes.forEach(newState);
        this._webserviceNodes.forEach(newState);
    };

    LoxoneMiniserver.prototype.findControlByState = function (uuid) {

        //search in all controls for given state uuid to find the corresponding control
        for (var wantedControlUuid in this.structureData.controls) {
            if (
                this.structureData.controls.hasOwnProperty(wantedControlUuid) &&
                this.structureData.controls[wantedControlUuid].hasOwnProperty('states')
            ) {
                for (var curState in  this.structureData.controls[wantedControlUuid].states) {
                    if (
                        this.structureData.controls[wantedControlUuid].states.hasOwnProperty(curState) &&
                        this.structureData.controls[wantedControlUuid].states[curState] === uuid
                    ) {
                        return this.structureData.controls[wantedControlUuid];
                    }
                }
            }
        }

        return null;
    };

    LoxoneMiniserver.prototype.buildMsgObject = function (event, uuid, controlStructure) {

        //get state name
        var stateName;
        for (stateName in controlStructure.states) {
            if (
                controlStructure.states.hasOwnProperty(stateName) &&
                controlStructure.states[stateName] === uuid
            ) {
                break;
            }
        }

        //evaluate payload
        var payload;

        try {
            payload = JSON.parse(event);
        }
        catch (err) {
            payload = event;
        }

        return {
            payload: payload,
            topic: controlStructure.name || null,
            state: stateName,
            room: this.structureData.rooms[controlStructure.room].name || null,
            category: this.structureData.cats[controlStructure.cat].name || null,
            details: controlStructure.details || null,
            type: controlStructure.type || null,
            isFavorite: controlStructure.isFavorite || null,
            isSecured: controlStructure.isSecured || null,
            uuid: uuid || null,
            msInfo: this.structureData.msInfo,
            lastModified: this.structureData.lastModified
        };

    };

    LoxoneMiniserver.prototype.handleEvent = function (uuid, event) {

        var i, curNode, curRoom, curCategory;
        var controlStructure = this.findControlByState(uuid);

        //do we have a control for this uuid? could also be weather or global
        if (controlStructure) {

            //publish event to control-in nodes
            for (i = 0; i < this._inputNodes.length; i++) {
                if (this._inputNodes[i].state === uuid) {
                    this._inputNodes[i].send(this.buildMsgObject(event, uuid, controlStructure));
                }
            }

            //publish event to stream-all node
            for (i = 0; i < this._streamAllNodes.length; i++) {
                curNode = this._streamAllNodes[i];
                try {
                    curNode.send(this.buildMsgObject(event, uuid, controlStructure));
                } catch (error) {
                    //TODO: error handling
                }
            }

            //publish event to stream-in node
            for (i = 0; i < this._streamInNodes.length; i++) {

                curNode = this._streamInNodes[i];
                curRoom = (curNode.hasOwnProperty('room')) ? curNode.room : null;
                curCategory = (curNode.hasOwnProperty('category')) ? curNode.category : null;

                //neither category or room present/filled, continue
                if (!curRoom && !curCategory) {
                    continue;
                }

                if (
                    (!curRoom || curRoom === controlStructure.room) &&
                    (!curCategory || curCategory === controlStructure.cat)
                ) {
                    curNode.send(this.buildMsgObject(event, uuid, controlStructure));
                }
            }
        }

    };

    function prepareStructure(data) {
        var structure = {
            rooms: data.rooms || {},
            cats: data.cats || {},
            controls: {},
            msInfo: data.msInfo || {},
            lastModified: data.lastModified
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

    function sendOnlineNodeMsg(online, configId) {

        online = online || false;

        RED.nodes.eachNode(function (theNode) {

            if (theNode.type === 'loxone-online' &&
                theNode.hasOwnProperty('miniserver') &&
                theNode.miniserver === configId) {

                var node = RED.nodes.getNode(theNode.id);

                if (node) {
                    /*
                    node.status({
                        fill: (node.miniserver.active !== true) ? 'grey' : 'yellow',
                        shape: 'dot',
                        text: (node.miniserver.active !== true) ? 'connection disabled' : 'offline'
                    });
                    */

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
                if (node.miniserver.connected && node.miniserver.connection) {
                    node.miniserver.connection.send_control_command(node.control, msg.payload);
                }
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


        if (node.miniserver) {

            node.miniserver.registerWebserviceNode(node);

            this.on('close', function (done) {
                if (node.miniserver) {
                    node.miniserver.deregisterWebserviceNode(node);
                }
                done();
            });

            this.on('input', function (msg) {

                node.status({});
                var wantedURI = msg.uri || config.uri;

                if (!wantedURI.length) {
                    node.status({
                        fill: 'red',
                        shape: 'ring',
                        text: 'empty uri'
                    });
                    return null;
                }

                if (!wantedURI.match(/^jdev/)) {
                    node.status({
                        fill: 'red',
                        shape: 'ring',
                        text: 'invalid uri'
                    });
                    return null;
                }

                node.uri = wantedURI + ((config.appendpayload === true) ? msg.payload : '');

                //node.log('sending ' + node.uri);

                //add node to the queue for waiting messages and send the URI
                if (node.miniserver.connected && node.miniserver.connection) {
                    node.miniserver.addWebserviceNodeToQueue(node);
                    node.miniserver.connection.send_command(node.uri);
                }

            });

        }


    }

    RED.nodes.registerType('loxone-webservice', LoxoneWebServiceNode);


    function LoxoneOnlineNode(config) {
        RED.nodes.createNode(this, config);
    }

    RED.nodes.registerType('loxone-online', LoxoneOnlineNode);

    function LoxoneKeepaliveNode(config) {
        RED.nodes.createNode(this, config);
    }

    RED.nodes.registerType('loxone-keepalive', LoxoneKeepaliveNode);


    RED.nodes.registerType('loxone-stream-in', LoxoneStreamInNode);

    function LoxoneStreamInNode(config) {

        RED.nodes.createNode(this, config);
        var node = this;

        node.category = config.category;
        node.room = config.room;

        node.miniserver = RED.nodes.getNode(config.miniserver);

        if (node.miniserver) {

            node.miniserver.registerStreamInNode(node);

            this.on('close', function (done) {

                if (node.miniserver) {
                    node.miniserver.deregisterStreamInNode(node);
                }

                done();
            });
        }

    }


    RED.nodes.registerType('loxone-stream-all', LoxoneStreamAllNode);

    function LoxoneStreamAllNode(config) {

        RED.nodes.createNode(this, config);
        var node = this;

        node.category = config.category;
        node.room = config.room;

        node.miniserver = RED.nodes.getNode(config.miniserver);

        if (node.miniserver) {

            node.miniserver.registerStreamAllNode(node);

            this.on('close', function (done) {

                if (node.miniserver) {
                    node.miniserver.deregisterStreamAllNode(node);
                }

                done();
            });
        }

    }
};
