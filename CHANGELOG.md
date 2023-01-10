### 0.10.13
*  Fixed Error when multiple messages over one node, thanks [Jakob-Gliwa](https://github.com/Jakob-Gliwa)

### 0.10.12
* node-lox-ws-api 0.4.5-bugfix4 which should resolve #58 thanks to @arsiesis

### 0.10.11
* node-lox-ws-api 0.4.5-bugfix3 so you don't have to build binary dependencies of [WebSocket-Node](https://github.com/theturtle32/WebSocket-Node/blob/master/CHANGELOG.md)


### 0.10.10
* Sort the rooms and cats data, fixes #56

### 0.10.9
* `online` is emited _after_ the structure file has been parsed, not after authorisation anymore

### 0.10.8
* fixed missing event parameter for stream-in

### 0.10.7
* fixed non working keepalive node, introduced in `0.10.6`
* fixed translations in miniserver-config

### 0.10.6
* fixed #44
* new `node-lox-ws-api` for better reconnction handling
* fixed missing structure file for miniserver config
* better error messages if miniserver not reachable, also on online nodes
* configurable miniserver keepalive in config node

### 0.10.5 
* fixed #42
* added info that git is needed

### 0.10.4
* fixed development dependency `package.json`

### 0.10.3
* fixed #35
* using own forked node-lox-ws-api
* better connection information adressing #28 and hopefully #33
* `miniserver.connected` now after authentification not after initial connection



### 0.10.2
* updated `node-lox-ws-api` to `0.4.4` for nodejs 10.x compatibility. Thanks @alladdin 

### 0.10.1
* fixed category is displayed in room introduced in `0.10.0`, thanks to @Jofagi 

### 0.10.0
* fixed crash on empty room or empty category (unused)
* adapted colors and logo to match new loxone style

### 0.9.1
* parsing of substates (intelligent room controller > temperatures) fixed

### 0.9.0
* added `msInfo` and `lastModified` to `msg`-object

### 0.8.0
* added stream-all node, thanks to @JoDehli
* added uuid, isFavorite, isSecured to all messages, except webservice calls as this info is not there
* added `msg.data` on webservice calls to get all return values (e.g. if you query "all")

### 0.7.0
* added stream-in node
* removed keepalive log message
* refactored event handling and building of msg-object

### 0.6.2
* fixed missing msg-object data in control-in node introduced in `0.6.1`

### 0.6.1
* updated `node-lox-ws-api` to `0.4.3` to fix reconnect bug 
* removed wrong `client.abort()` on `client.close`
* removed "activate connection" checkbox for now
* refactoring

### 0.6.0
* complete Token-Based-Auth support through updated node-lox-ws-api 0.4.2*
* new option to select encryption type for the miniserver connection, defaults to Token-Enc
* fixed bug where the structure did not load due to wrong active connection interpretation

### 0.5.0
* updated `node-lox-ws-api` to `0.3.4` for an intermediate solution working with Loxone 9
* added checkbox to activate a miniserver connection

### 0.4.2
* `node-lox-ws-api` updated to `0.3.2`

### 0.4.1
* `node-lox-ws-api` updated to `0.3.1`
* disconnect on AES fixed
* AES now also for webservice calls
* dropped support for nodeJS `< 4.5`

### 0.4.0
* webservice-node: added checkbox for appending `msg.payload` to the URI of the webservice node

### 0.3.1
* review readme
* fixed image display from readme on flows.nodered.org

### 0.3.0
* added keepalive node
* correct handling of online-node with more than one miniserver connection

### 0.2.2 
* fixed error if empty room name or empty category name

### 0.2.1
* fixed error on deploying after editing the config node

### 0.2.0
* added online node
* only controls shown regarding room/category on node editing 
* updated `node-lox-ws-api` to 0.2.8groovy
* updated `ws` to 2.2.3

### 0.1.0
* breaks compatibility to 0.0.x
* added webservice-node
* updated `node-lox-ws-api`

### 0.0.x
* control-in
* control-out
* initial release
* testing
