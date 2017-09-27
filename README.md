# node-red-contrib-loxone

**Attention: node-red-contrib-loxone is currently not working with Loxone 9 - we are working on a solution**

This node connects the Loxone Miniserver to node-red. It uses [node-lox-ws-api](https://github.com/alladdin/node-lox-ws-api) 
by Ladislav Dokulil based on Loxone's documenation for the [Websocket API](https://www.loxone.com/dede/wp-content/uploads/sites/2/2016/08/loxone-communicating-with-the-miniserver.pdf).

It enables you to connect the Loxone Miniserver directly to node-red and work with the data
on occuring events. As this uses the official Websocket, you will only see controls that are 
visualized in Loxone-Config. 

**You will get the data from Loxone's websocket _as is_. There is and will be no abstraction layer!**

So please know how to handle the data according to the [structure file](https://www.loxone.com/dede/wp-content/uploads/sites/2/2016/08/loxone-structure-file.pdf?x48792) 
or the [webservice documenation](https://www.loxone.com/enen/kb/web-services/).

The connection to the miniserver is encrypted (hashed) via node-lox-ws-api (only for control-in and control-out), AES-256-CBC for command encryption 
is possible but should not be needed in the local network. The AES Encryption only applies to the nodes, the credentials for the connection 
are hashed anyway and will not be transmitted in plaintext. 
Keepalive is handled via `node-lox-ws-api`.

> Help, pull requests and feedback in general are very welcome!

As I don't have an own Loxone installation, I can't do a "real world" test. Gladly a friend of mine lent me his spare miniserver for initial testing.

Tested with loxone-config V8.3.3.21, node-red 0.16.2, nodeJS 6.10.3 LTS

### Nodes
* **Miniserver**: Configure a miniserver connection used by every other node
* **Control-In**: Select a control and a state to hook an event which then gets passed to node-red on occurence.
* **Control-Out**: Select a control and feed it commands according to the [structure file](https://www.loxone.com/dede/wp-content/uploads/sites/2/2016/08/loxone-structure-file.pdf?x48792)
* **Webservice**: Send direct webservice calls through the existing websocket, see the [webservice documenation](https://www.loxone.com/enen/kb/web-services/). 
Please use URI's in form of `jdev/sps/io/foo` (no leading `/`), simply replace `dev/` from the documentation with `jdev/`. The returned
value will be in `msg.payload`.
* **Online**: Emit's `true`/`false` for the state of the connection to the selected miniserver. Be careful as every failed 
connection attempt sends a `false` over and over again till a connection could be established.
* **Keepalive**: outputs the current time (in ms) from the keepalive request done by the underlying library (node-lox-ws-api) 
every 2 minutes. See page 17 of the Loxone webservice documentation. The response time can be used to measssure connection 
quality.

The information used comes from the structure file, which can be retrieved from your miniserver via `http://<miniserver>/data/LoxAPP3.json`.

The `msg.payload` of the control-out-node holds the value retrieved from it's state. The `msg`-object also has some more information of
the selected control. For example:

    {
        payload: 20.8125,
        topic: "test ds18b20",
        state: "value",
        room: "Serverraum",
        category: "Temperatur",
        details: {
            format: "%.1f°"
        },
        type: "InfoOnlyAnalog"
    }

In general you will find the arrived data in `msg.payload`, but have a look at the complete `msg`-object of each node.
    
### Examples

![image of node-red editor](https://github.com/codmpm/node-red-contrib-loxone/blob/master/node-red-contrib-loxone-editor.png?raw=true)
![image node-red dashboard](https://github.com/codmpm/node-red-contrib-loxone/blob/master/node-red-contrib-loxone-dashboard.png?raw=true)

Here's a small video of the controls above with the Loxone Webinterface on the left, Loxone-Config with LiveView enabled in the 
middle and node-red with node-red-dashboard on the right: https://cloud.codm.de/nextcloud/index.php/s/hNO2hIgnGIDWGqM

--- 

![image of node-red flow for fritzbox](https://github.com/codmpm/node-red-contrib-loxone/blob/master/node-red-contrib-loxone-demo-fritz.png?raw=true)
  
Another example: Reading the current used bandwith of a FritzBox-Router and display 
this data in the visualisation of the Miniserver:  https://cloud.codm.de/nextcloud/index.php/s/5XoNoMLilinpU4v
    
The flow itself could be found here: http://flows.nodered.org/flow/0b3c81b3361027ce4064d4e934f23685    

---

![image of node-red flow for webservice](https://github.com/codmpm/node-red-contrib-loxone/blob/master/node-red-contrib-loxone-webservice.png?raw=true)
The webservice node, added in version `0.1.0`, allows you to directly call webservice URI's through the already 
established websocket connection.

Beginning with version `0.4.0` you can choose to automaticly append the incoming `msg.payload` to the set URI. 
This is handy to add dynamic content to the webservice call, for example `DownOn` or `DownOff`.

As the `UpDownDigital` (etc.) virtual input has no state where the control-in node can listen to, I've switched it as 
an example via the webservice-node. See a short video here: https://cloud.codm.de/nextcloud/index.php/s/IttSURIGl8OkUBf


### Caveats
Only `controls` are parsed, no `mediaServer`, `weatherServer`, etc. Is this enough? 

Events can only be generated by control-in and the controls have to be visible to show up in the node. 
Well, this is not a caveat as it lays in the design of Loxone's websocket. 
We can only come around this if Loxone add's a "websocket" checkmark to the controls in Loxone-Config.
Also controls will not be shown if you put them in room "unused" _and_ category "unused", albeit they
are marked "visible".

I've discovered that a switch element emits its current state (`active`) two times with the same value.
The first one when the trigger-button is pressed and second one when the button is released - so 
take care of this as it might give you unexpected results. This could be catched with a delay node.
Also keep in mind, that this element sends `1/0` but expects to be fed with `On/Off/Pulse`.

### nodeJS
I advice you to use the latest [LTS version](https://github.com/nodejs/LTS) of nodeJS - currently `6.10.3`.

If you realy can not update to a supported version of nodeJS, the last version of node-red-contrib-loxone running with 
nodeJS `< 4.5` is `0.4.0` which can be installed with:

    cd ~/.node-red
    npm install node-red-contrib-loxone@0.4.0

### ToDo 
* Convenience / Testing!
* better logging, more failsaveness, more user info
* See `TODO` comments in the code
* ...

### Installation
Install the usual way. Either

    cd ~/.node-red/
    npm install node-red-contrib-loxone
    
or via node-red's `Manage palette`.

### Contributing

1. Fork it!
2. Create your feature branch: `git checkout -b my-new-feature`
3. Commit your changes: `git commit -am 'Add some feature'`
4. Push to the branch: `git push origin my-new-feature`
5. Submit a pull request :D

### Credits
Patrik Mayer with great help from [Ladislav Dokulil](https://github.com/alladdin), 2017 

I'm not affiliated with [Loxone](https://www.loxone.com/) in any way.

Many thanks to [Nick O'Leary](https://github.com/knolleary), [Dave Conway-Jones](https://github.com/dceejay/)
 and everyone else from the node-red Slack-Channel. 

Also the people from the ever helpful [LoxForum](https://www.loxforum.com/) have to be mentioned.

### License
MIT

