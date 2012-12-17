var BV = window.BV || {};

//Main Events
BV.Event = {};
BV.Event.Net = {};
BV.Event.Net.Ready = "BV.Event.Net.Ready";
BV.Event.Net.Connected = "BV.Event.Net.Connected";
BV.Event.Net.Disconnected = "BV.Event.Net.Disconnected";
BV.Event.Net.ConnectionError = "BV.Event.Net.ConnectionError";
BV.Event.Net.PeerDump = "BV.Event.Net.PeerDump";
BV.Event.Net.TokenResponse = "BV.Event.Net.TokenResponse";
BV.Event.Net.PeerRequest = "BV.Event.Net.PeerRequest";
BV.Event.Net.SendPeerRequest = "BV.Event.Net.SendPeerRequest";
BV.Event.Net.PeerResponse = "BV.Event.Net.PeerResponse";
BV.Event.Net.SendPeerResponse = "BV.Event.Net.SendPeerResponse";
BV.Event.Net.UserAdd = "BV.Event.Net.UserAdd";
BV.Event.Net.PeerAdd = "BV.Event.Net.PeerAdd";
BV.Event.Net.PeerRemove = "BV.Event.Net.PeerRemove";
BV.Event.Net.RequestToken = "BV.Event.Net.RequestToken";
BV.Event.Net.ClaimToken = "BV.Event.Net.ClaimToken";
BV.Event.Net.InviteUser = "BV.Event.Net.InviteUser";

// Data Modules
BV.Module = {};

// Networking Parameters
BV.Settings = {};
BV.Settings.Debug = false;
BV.Settings.MaxInPeer = 5;
BV.Settings.MaxOutPeer = 5;
BV.Settings.ConnectionTimeout = 5000;
BV.Settings.DeadTimeout = 5000;
BV.Settings.Tolerance = 5000;



var BV = window.BV || {};
BV.Objects = BV.Objects || {};

//
// The EventBus allows objects to communicate without needing
// to know anything about each other.
//
BV.Objects.EventBus = function() {
    var tempQueue = {};
    var longQueue = {};
    var id = "??"+Math.floor(Math.random()*100);
    
    //
    // Dispatch a new event to the entire app
    //
    function dispatch(event, obj) {
        if (BV.Settings.Debug) console.log(id+": "+event+"; Data-> "+JSON.stringify(obj));
        if (tempQueue.hasOwnProperty(event)) {
            for (var i=0; i<tempQueue[event].length; i++) {
                setTimeout(tempQueue[event][i](obj), 1);
            }
            delete tempQueue[event];
        }
        if (longQueue.hasOwnProperty(event)) {
            for (var i=0; i<longQueue[event].length; i++) {
                setTimeout(longQueue[event][i](obj), 1);
            }
        }
    };

    //
    // Wait for every instance of an event
    //
    function wait(event, callback) {
        if (!longQueue.hasOwnProperty(event)) {
            longQueue[event] = [];
        }
        longQueue[event].push(callback);
    };
    
    //
    // Wait for one instance of an event
    //
    function waitOnce(event, callback) {
        if (!tempQueue.hasOwnProperty(event)) {
            tempQueue[event] = [];
        }
        tempQueue[event].push(callback);
    };
    
    //
    // Get and Set the id - it's used for debug messages
    //
    function setId(newId) {
        id = newId;
    };
    function getId() {
        return id;
    };
    
    //
    // Return object
    //
    return {
        wait: wait,
        waitOnce: waitOnce,
        dispatch: dispatch,
        getId: getId, 
        setId: setId
    };
};  




var BV = window.BV || {};
BV.Objects = BV.Objects || {};

BV.Objects.PeerManager = function(EventBus) {
    // A list of all known PeerIds, provided by the server.
    var allPeers = {};
    // A pool of currently active peers
    var outPeers = []; var inPeers = [];
    // A queue of all Peer requests waiting for a resource
    var outQueue = [];
    
    //
    // The PeerDump event - debug all currently active Peers
    //
    EventBus.wait(BV.Event.Net.PeerDump, function() { 
        for (var i=0; i<inPeers.length; i++) inPeers[i].dump(); 
        for (var i=0; i<outPeers.length; i++) outPeers[i].dump(); 
    });
    
    //
    // Wait for the PeerAdd event, add the new peerId to our list
    //
    EventBus.wait(BV.Event.Net.PeerAdd, function(peer) {
        var peerId = peer.id; 
        if ((!allPeers[peerId]) && (peerId != EventBus.getId())) {
            allPeers[peerId] = peer.name;
        }
    });
    
    //
    // The server should tell us when a Peer has gone offline
    //
    EventBus.wait(BV.Event.Net.PeerRemove, function(peerId) { 
        delete allPeers[peerId];
        deletePeerById(peerId);
    });
    
    //
    // The server tells us another Peer is requesting a connection
    //
    EventBus.wait(BV.Event.Net.PeerRequest, function(data) { 
        //
        // If we have a spare slot, allocate a Peer object and respond
        //
        if (inPeers.length < BV.Settings.MaxInPeer) {
            for (var i=0; i<inPeers.length; i++) {
                if (inPeers[i].getId()==data.from) {
                    if (BV.Settings.Debug) console.log(data.from+": Request from existing inPeer?!");
                    return;
                }
            }
            var newPeer = new BV.Objects.Peer(EventBus, self);
            newPeer.setId(data.from);
            inPeers.push(newPeer);
            if (BV.Settings.Debug) console.log(data.from+": Created inPeer (count="+inPeers.length+")");
            newPeer.setOffer(data.spd);
            newPeer.createAnswer(function (sdp) {
                EventBus.dispatch(BV.Event.Net.SendPeerResponse, { to: data.from, from: EventBus.getId(), peer: data.peer, spd: sdp });
            });
            newPeer.setConnectionTimeout(setTimeout(function() {
                //
                // If timeout wasn't cancelled, assume connction failed and delete
                //
                if (BV.Settings.Debug) console.log(EventBus.getId()+": Connection Timeout (they asked us, no heartbeat yet...)");
                deletePeerByObject(newPeer);
            }, BV.Settings.ConnectionTimeout+(Math.random()*BV.Settings.Tolerance)));
            //
            // Set a function to delete this peer after a period of inactivity
            //
            newPeer.setDeleteFunction(function() {
                deletePeerByObject(newPeer);
            });
        }
        //
        // If there's no space, ignore the request - the other Peer will timeout and reschedule
        //
        return;
    });
    
    //
    // The server comes back to us with another Peer's response to our connection
    //
    EventBus.wait(BV.Event.Net.PeerResponse, function(data) { 
        for (var i=0; i<outPeers.length; i++) {
            if (outPeers[i].getId() == data.from) {
                outPeers[i].setAnswer(data.spd);
                break;
            }
        }
    });
    
    //
    // Other bits of code call this function and expect back a Peer object ready to go.
    //
    function getPeer(peerId, callback) {
        //
        // Is the PeerID valid?
        //
        if (!allPeers[peerId]) {
            if (BV.Settings.Debug) console.log(peerId+": Not a valid PeerID");
            return;
        }
        //
        // See if we are already connected or if they are in the
        // process of connecting to us
        //
        for (var i=0; i<outPeers.length; i++) {
            if (outPeers[i].getId() == peerId) {
                if (outPeers[i].isReady()) {
                    if (BV.Settings.Debug) console.log(peerId+": Found peer object");
                    callback(outPeers[i]);
                } else {
                    //
                    // If we have a Peer object but it is still being established
                    // then queue up the callback
                    //
                    outPeers[i].addConnectedCallback(function() { callback(outPeers[i]); });
                }
                return;
            }
        }
        //
        // If we don't know anything about them, establish a connection
        //
        if (BV.Settings.Debug) console.log(peerId+": Requesting a new outPeer"); 
        getNewOutPeer(peerId, function(newPeer) {
            newPeer.addConnectedCallback(function() { callback(newPeer); });
            newPeer.createOffer(function(sdp) {
                EventBus.dispatch(BV.Event.Net.SendPeerRequest, { to: peerId, from: EventBus.getId(), peer: peerId, spd: sdp });
                newPeer.setConnectionTimeout(setTimeout(function() {
                    //
                    // If timeout wasn't cancelled, assume connction failed and re-schedule
                    //
                    if (BV.Settings.Debug) console.log(peerId+": Connection Timeout (We asked them, failed to establish heartbeat)");
                    deletePeerByObject(newPeer);
                    setTimeout(function() {
                        getPeer(peerId, callback);
                    }, 1000+(Math.floor(Math.random()*3000)));
                }, BV.Settings.ConnectionTimeout+(Math.random()*BV.Settings.Tolerance)));
                //
                // Set a function to delete this peer after a period of inactivity
                //
                newPeer.setDeleteFunction(function() {
                    deletePeerByObject(newPeer);
                });
            });
        }, false);
    };
    
    //
    // Queue up to request a new outbound Peer object - there's a hard
    // upper limit of 10 RTCPeerConnection objects imposed by Chrome!
    //
    function getNewOutPeer(peerId, callback) {
        //
        // This function is the goal - create a Peer and callback
        //
        var addPeer = function() {
            var newPeer = new BV.Objects.Peer(EventBus, self);
            newPeer.setId(peerId);
            outPeers.push(newPeer);
            if (BV.Settings.Debug) console.log(peerId+": Created outPeer (count="+outPeers.length+")");
            callback(newPeer);
        };
        
        //
        // Join the queue to wait for a spare resource
        //
        outQueue.push(addPeer);
        while ((outPeers.length < BV.Settings.MaxOutPeer) && (outQueue.length>0)) {
            ((outQueue.splice(0, 1))[0])();
        }
    };
    
    //
    // Convenience function to recycle a Peer resource
    //
    function deletePeerByObject(p) {
        if (outPeers.indexOf(p) !== -1) {
            if (BV.Settings.Debug) console.log(p.getId()+": Deleting outPeer (count="+outPeers.length+")");
            p.close(function() {
                delete p;
            });
            outPeers.splice(outPeers.indexOf(p), 1);
            
            while ((outPeers.length < BV.Settings.MaxOutPeer) && (outQueue.length>0)) {
                ((outQueue.splice(0, 1))[0])();
            }
        }
        if (inPeers.indexOf(p) !== -1) {
            if (BV.Settings.Debug) console.log(p.getId()+": Deleting inPeer (count="+inPeers.length+")");
            p.close(function() {
                delete p;
            });
            inPeers.splice(inPeers.indexOf(p), 1);
        }
    };
    
    //
    // Convenience function to recycle a Peer resource
    //
    function deletePeerById(peerId) {
        for (var i=0; i<inPeers.length; i++) {
            if (inPeers[i].getId() == peerId) deletePeerByObject(inPeers[i]);
        }
        for (var i=0; i<outPeers.length; i++) {
            if (outPeers[i].getId() == peerId) deletePeerByObject(outPeers[i]);
        }
    };
    
    //
    // The end goal: Send a message to the desired module of another peer
    //
    function sendToPeer(peerId, module, keepAlive, data, callback) {
        getPeer(peerId, function(somePeer) {
            somePeer.sendMessage(module, data, keepAlive, callback);
        });
    };
    
    //
    // Send a message to all Peers belonging to an alias
    //
    function sendToAlias(alias, module, keepAlive, data, callback) {
        for (var peerId in allPeers) {
            if (allPeers[peerId] == alias) {
                sendToPeer(peerId, module, keepAlive, data, callback);
            }
        }
    };
    
    //
    // Broadcast a message to the desired module of every online peer
    //
    function broadcast(module, data, callback) { 
        for(var peerId in allPeers) {
            sendToPeer(peerId, module, false, data, callback);
        }
    };
    
    //
    // Return object
    //
    var self = {
        deletePeerById: deletePeerById,
        sendToPeer: sendToPeer,
        sendToAlias: sendToAlias,    
        broadcast: broadcast
    };
    return self;
};



var BV = window.BV || {};
BV.Objects = BV.Objects || {};

window.RTCPeerConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection || window.mozRTCPeerConnection;

//
// 
//
BV.Objects.Peer = function(EventBus, PeerManager) {
    // The peer connection
    if (BV.Settings.Debug) console.log("++RTC");
    var pc = new RTCPeerConnection({"iceServers": [{"url": "stun:stun.l.google.com:19302"}]});
    // The heartbeat to detect when other Peer goes offline
    var heartbeat;
    // The other peers UID
    var id;
    // The callback for when a connection has been established
    var connectedCallbacks = [];
    // The callback for when a connection timesout
    var timeoutFunction = function() { console.log(id+": NO TIMEOUT CALLBACK!"); };
    // The callback for when a connection timesout
    var deleteFunction = function() { console.log(id+": NO DELETE CALLBACK!"); };
    var deleteFunctionTimeout;
    // Status variables used to determine if Peer can be deleted
    var ready = false; var connectionCounter = 0; var used = false;
    
    //
    // Convenience functions
    //
    pc.onerror = function(event) { console.error("!!!!ERROR!!!"); };
    pc.onclose = function(event) { console.error("!!!CLOSE!!"); };
    function canDelete() { return used && (connectionCounter==0); };
    function isReady() { return ready; };
    function setReady(b) { ready = b; };
    function setId(newId) { id = newId; };
    function getId() { return id; };
    function setHeartbeat(h) { heartbeat = h; };
    function getHeartbeat() { return heartbeat; };
    function setConnectionTimeout(t) { timeoutFunction = t; };
    function clearConnectionTimeout() { clearTimeout(timeoutFunction); };
    function setDeleteFunction(t) { deleteFunction = t; };
    function addConnectedCallback(callback) { connectedCallbacks.push(callback); };
    function dump() { console.log("-- "+id+": Ready:"+ready+", Used:"+used+" Count:"+connectionCounter); };
    function errorHandler(e) { console.error(id+": Error! " + e); };
    
    function startDeleteFunction() { 
        deleteFunctionTimeout = setTimeout(function() { deleteFunction(); }, BV.Settings.DeadTimeout+(Math.random()*BV.Settings.Tolerance));
    };
    function clearDeleteFunction() { clearTimeout(deleteFunctionTimeout); };
    
    function addedDataChannel() { 
        connectionCounter++; 
        used=true; 
        clearDeleteFunction();
    };
    function removedDataChannel(keepAlive) { 
        connectionCounter--; 
        if (connectionCounter==0) {
            if (!keepAlive) {
                console.error("Killed");
                deleteFunction();
            } else {
                clearDeleteFunction();
                startDeleteFunction();
            }
        }
    };
    
    //
    // Peer 1 Creates an initial offer
    //
    function createOffer(callback) {
        pc.createOffer(function(offer) {
            pc.setLocalDescription(new RTCSessionDescription({sdp: offer.sdp, type: 'offer'}));
            if (BV.Settings.Debug) console.log(id+": set local description (offer)");
            callback(offer.sdp);
        }, errorHandler);
    };
    
    //
    // Peer 1 Sets a timeout function which will assume the connection was unsuccessful
    //
    function setConnectionTimeout(t) { 
        timeoutFunction = t; 
    };
    
    //
    // Peer 2 Receives and sets the initial offer
    //
    function setOffer(offer) {
        pc.setRemoteDescription(new RTCSessionDescription({sdp: offer,type: 'offer'}));
        if (BV.Settings.Debug) console.log(id+": set remote description (offer) to "+pc.remoteDescription);
    };
    
    //
    // Peer 2 Creates an answer to the initial offer
    //
    function createAnswer(callback) {
        pc.createAnswer(function(answer) {
            pc.setLocalDescription(new RTCSessionDescription({sdp: answer.sdp, type: 'answer'}));
            if (BV.Settings.Debug) console.log(id+": set local description (answer)");
            callback(answer.sdp);
        }, function (error) { 
            console.error(id+": "+error+" Remote description is "+pc.remoteDescription);
        });
    };
    
    //
    // ( Peer 2 Sets a timeout function which will assume the connection was unsuccessful )
    //
    
    //
    // Peer 1 Receives and sets the answer
    //
    function setAnswer(answer) {
        pc.setRemoteDescription(new RTCSessionDescription({sdp: answer, type: 'answer'}));
        if (BV.Settings.Debug) console.log(id+": set remote description (answer) to "+pc.remoteDescription);
        setTimeout(function() { establishHeartbeat(); }, 100);
    };
    
    //
    // Peer 1 Sets up the heartbeat channel and waits for response to go READY
    //
    function establishHeartbeat() {
        var heartbeat = pc.createDataChannel('heartbeat');
        heartbeat.onmessage = function(message) { 
            var data = JSON.parse(message.data); 
            //
            // The connection was successful, cancel the connection timeout
            //
            clearConnectionTimeout();
            if (BV.Settings.Debug) console.log(id+": heartbeat established");
            setReady(true);
            while(connectedCallbacks.length>0) {
                (connectedCallbacks.pop())();
            }
        };
        //
        // When the heartbeat stops, dump this Peer object.
        //
        heartbeat.onclose = function() {
            if (BV.Settings.Debug) console.log(id+": heartbeat lost!");
            PeerManager.deletePeerById(id);
        };
        heartbeat.onopen = function() { };
        heartbeat.onerror = function(e) { 
            if (BV.Settings.Debug) console.error(id+": heartbeat error!");
            PeerManager.deletePeerById(id);
        };
        setHeartbeat(heartbeat);
    };

    //
    // Peer 2 detects the heartbeat channel, writes down it and goes READY
    //
    pc.ondatachannel = function(event) {
        var dataChannel = event.channel;
        if (dataChannel.label == "heartbeat") {
            //
            // The connection was successful, cancel the connection timeout
            //
            clearConnectionTimeout();
            heartbeat = dataChannel;
            heartbeat.send(JSON.stringify({ ready: true }), errorHandler);
            if (BV.Settings.Debug) console.log(id+": Remote heartbeat established");
            setReady(true);
            //
            // When the heartbeat stops, dump this Peer object.
            //
            heartbeat.onclose = function() {
                if (BV.Settings.Debug) console.log(id+": Remote heartbeat lost!");
                PeerManager.deletePeerById(id);
            };
            heartbeat.onerror = function(e) { 
                if (BV.Settings.Debug) console.error(id+": heartbeat error!");
                PeerManager.deletePeerById(id);
            };
            setHeartbeat(heartbeat);
        } else {
            //
            // Normal data channel, hook up to requested module
            //
            addedDataChannel();
            if (BV.Settings.Debug) console.log(id+": Remote datachannel opened");
            dataChannel.onmessage = function(message) {
                var data = JSON.parse(message.data);
                var handled = false;
                for (var i in BV.Module) {
                    if (BV.Module[i] == data.module) {
                        var cb = function(d) {
                            dataChannel.send(JSON.stringify(d), errorHandler);
                            dataChannel.close();
                            if (BV.Settings.Debug) console.log(id+": Responded to remote request");
                        }
                        EventBus.dispatch(BV.Module[i], { request: data.data, callback: cb, peer:getId() });
                        handled = true;
                        break;
                    }
                }
                if (!handled) {
                    dataChannel.send(JSON.stringify({ err: "Uhh... what?!" }), errorHandler);
                    dataChannel.close();
                }
            };
            dataChannel.onclose = function() {
                removedDataChannel();
                delete dataChannel;
                if (BV.Settings.Debug) console.log(id+": Remote datachannel closed");
            };
        }
    };
    
    //
    // Either Peer tries to send a message to the other
    //
    function sendMessage(module, data, keepAlive, callback) {
        var dataChannel = pc.createDataChannel(Math.floor(Math.random()*999999999));
        //
        // Set a timeout incase the other Peer has disconnected on us
        //
        var timeout = setTimeout(function() {
            //TODO restart the Peer without destroying it
            //
            //
            console.error(id+": Send Message Timeout!");
        }, 250);
        
        //
        // Wait for the channel to open
        //
        dataChannel.onopen = function() {
            clearTimeout(timeout);
            addedDataChannel();
            if (BV.Settings.Debug) console.log(id+": local datachannel opened, sending data");
            var obj = { module: module, data: data };
            dataChannel.send(JSON.stringify(obj), errorHandler);
        };
        
        //
        // If we get a response, pass it to the callback
        //
        dataChannel.onmessage = function(message) {
            var data = JSON.parse(message.data);
            callback(data);
            if (BV.Settings.Debug) console.log(id+": Received"+data);
            dataChannel.close(keepAlive);
        };
        
        //
        // Clean up after ourselves
        //
        dataChannel.onclose = function() {
            delete dataChannel;
            removedDataChannel();
            if (BV.Settings.Debug) console.log(id+": local datachannel closed");
        };
        
        dataChannel.onerror = function(e) { 
            console.error("ERROR "+e.message); 
        };
        if (BV.Settings.Debug) console.log(id+": Trying to open local datachannel");
    };
    
    //
    // Called by either Peer to terminate the possible connection,
    //
    function close(callback) { 
        try {
            heartbeat.close();
        } catch(e) {
            
        }; 
        try {
            if (BV.Settings.Debug) console.log("--RTC");
            pc.close(); 
        } catch(e) {
            
        }; 
        // Give events time to propagate
        setTimeout(function() {
            delete heartbeat;
            delete pc;
            callback();
        }, 100); 
    };

    //
    // Return object
    //
    return {
        createOffer: createOffer,
        createAnswer: createAnswer,
        setOffer: setOffer,
        setAnswer: setAnswer,
        sendMessage: sendMessage,
        getId: getId,
        setId: setId,
        close: close,
        addConnectedCallback: addConnectedCallback,
        isReady: isReady,
        setReady: setReady,
        canDelete: canDelete,
        setConnectionTimeout: setConnectionTimeout,
        clearConnectionTimeout: clearConnectionTimeout,
        dump: dump,
        setDeleteFunction: setDeleteFunction
    };
};



var BV = window.BV || {};
BV.Objects = BV.Objects || {};

//
// Convenience function to make it easy to track and message other instances
//
BV.Objects.Users = function(EventBus, PeerManager) {
    var userList = {
        message: function(module, data, keepAlive, callback) {
            PeerManager.broadcast(module, data, callback);
        }
    };
    
    //
    // Wait for the UserAdd event
    //
    EventBus.wait(BV.Event.Net.UserAdd, function(alias) {
        if (!userList.hasOwnProperty(alias)) {
            userList[alias] = {
                message: function(module, outData, keepAlive, callback) {
                    PeerManager.sendToAlias(alias, module, outData, callback);
                }
            };
        }
    });
    
    //
    // Wait for the PeerAdd event
    //
    EventBus.wait(BV.Event.Net.PeerAdd, function(data) {
        userList[data.name][data.id] = {
            message: function(module, outData, keepAlive, callback) {
                PeerManager.sendToPeer(data.id, module, outData, callback);
            }
        };
    });
    
    //
    // Wait for the PeerRemove event
    //
    EventBus.wait(BV.Event.Net.PeerRemove, function(peerId) {
        for (var user in userList) {
            if ((user != "message") && userList[user].hasOwnProperty(peerId)) {
                delete userList[user][peerId];
            }
        };
    });
    
    function get() {
        return userList;
    };
    
    return {
        get: get
    };
};



var BV = window.BV || {};
BV.Objects = BV.Objects || {};

//
// This is responsible for all communication with the server. It converts websocket
// requests/responses into Javascript events which fire through the EventBus.
//
BV.Objects.Net = function(EventBus) {
    var socket;
    var host = "";
    
    function connect() {
        socket = new WebSocket('ws://'+host);
        socket.onopen = function() {
            EventBus.dispatch(BV.Event.Net.Connected, {});
        };
        socket.onmessage = function (message) {
            var json = JSON.parse(message.data);
            switch (json.type) {
                case 'error':
                    EventBus.dispatch(BV.Event.Net.ConnectionError, {});
                    break;
                case 'peerConnect':
                    EventBus.dispatch(BV.Event.Net.PeerAdd, json.data);
                    break;
                case 'peerDisconnect':
                    EventBus.dispatch(BV.Event.Net.PeerRemove, json.data);
                    break;
                case 'peerRequest':
                    EventBus.dispatch(BV.Event.Net.PeerRequest, json.data);
                    break;
                case 'peerResponse':
                    EventBus.dispatch(BV.Event.Net.PeerResponse, json.data);
                    break;
                case 'userAdd':
                    EventBus.dispatch(BV.Event.Net.UserAdd, json.data);
                    break;
                case 'userList':
                    for (var i=0; i<json.data.length; i++) {
				        EventBus.dispatch(BV.Event.Net.UserAdd, json.data[i]);
				    }
                    break;
                case 'setPeerId':
                    window.document.title = json.data.peerId;
				    EventBus.setId(json.data.peerId);
				    EventBus.dispatch(BV.Event.Net.PeerAdd, {name: "Us", id: json.data.peerId});
                    break;
                case 'peerList':
                    for (var i=0; i<json.data.length; i++) {
				        EventBus.dispatch(BV.Event.Net.PeerAdd, json.data[i]);
				    }
                    break;
                case 'tokenResponse':
                    EventBus.dispatch(BV.Event.Net.TokenResponse, json.data);
                    break;
            };
        };
        socket.onclose = function() {
            EventBus.dispatch(BV.Event.Net.Disconnected, {});
        };
    };
    
    function disconnect() {
        socket.close();
    };

    EventBus.wait(BV.Event.Net.SendPeerRequest, function(data) {
        socket.send(JSON.stringify({type: "peerRequest", data: data}));
    });
    
    EventBus.wait(BV.Event.Net.SendPeerResponse, function(data) {
        socket.send(JSON.stringify({type: "peerResponse", data: data}));
    });
    
    EventBus.wait(BV.Event.Net.RequestToken, function(data) { 
        socket.send(JSON.stringify({type: "requestToken", data: data}));
    });
    
    EventBus.wait(BV.Event.Net.ClaimToken, function(data) { 
        socket.send(JSON.stringify({type: "claimToken", data: data}));
    });
    
    EventBus.wait(BV.Event.Net.InviteUser, function(data) { 
        socket.send(JSON.stringify({type: "inviteUser", data: data}));
    });
    
    function setHost(newHost) {
        host = newHost;
    };
    
    return {
        connect: connect,
        disconnect: disconnect,
        setHost: setHost
    };
};




//
// Create a global object wrapping all our hardwork up in a few convenience functions
//
$BV = (function() {
    var EventBus = new BV.Objects.EventBus(true);
    var Net = new BV.Objects.Net(EventBus);
    var PeerManager = new BV.Objects.PeerManager(EventBus);
    var Users = new BV.Objects.Users(EventBus, PeerManager);
    
    function setCookie(c_name,value) {
        var exdate=new Date();
        exdate.setDate(exdate.getDate() + 6);
        document.cookie=c_name+"=-1; path=/; expires=Monday, 19-Aug-1996 05:00:00 GMT";
        document.cookie=c_name + "=" + escape(value) + "; path=/; expires="+exdate.toUTCString();
    };

    //
    // A jQuery-esque selector for p2p communication
    //
    function get(filter) {
        var userList = Users.get();
        if (filter == "*") return userList;
        if (userList.hasOwnProperty(filter)) return userList[filter];
        for (var user in userList) {
            if ((user != "message") && userList[user].hasOwnProperty(filter)) 
                return userList[user][filter];
        }
        return {
            message: function() { }
        };
    };
    
    //
    // Connect to a discovery server
    //
    function connect(host, username, password) {
        setCookie("uun", username);
        setCookie("ppz", password);
        Net.setHost(host);
        Net.connect();
    };
    
    //
    // Disconnect from the discovery server
    //
    function disconnect() {
        Net.disconnect();
    };
    
    //
    // Register a new module
    //
    function module(name, callback) {
        BV.Module[name] = name;
        EventBus.wait(name, function(e) {
            callback(e);
        });
    };
    
    //
    // Register functions to various events
    //
    function on(event, callback) {
        if (event == "connect") {
            EventBus.wait(BV.Event.Net.Connected, function() { callback(); });
        } else if (event == "disconnect") {
            EventBus.wait(BV.Event.Net.Disconnected, function() { callback(); });
        } else if (event == "peerconnect") {
            EventBus.wait(BV.Event.Net.PeerAdd, function(data) { callback(data); });
        } else if (event == "peerdisconnect") {
            EventBus.wait(BV.Event.Net.PeerRemove, function(data) { callback(data); });
        } else if (event == "newuser") {
            EventBus.wait(BV.Event.Net.UserAdd, function(data) { callback(data); });
        }
    };
    
    //
    // Get our current peerId
    //
    function getId() {
        return EventBus.getId();
    };
    
    //
    // Request a new user invite
    //
    function inviteUser(email) {
        EventBus.dispatch(BV.Event.Net.InviteUser, { email: email });
    };
    
    //
    // Request a token to add a user
    //
    function requestToken(alias, callback) {
        EventBus.waitOnce(BV.Event.Net.TokenResponse, function(token) {
            callback(token);
        });
        EventBus.dispatch(BV.Event.Net.RequestToken, { name: alias });
    };
    
    //
    // Claim a token confirming the addition of a user
    //
    function claimToken(alias, token) {
        EventBus.dispatch(BV.Event.Net.ClaimToken, { name: alias, token: token });
    };
    
    //
    // Return object
    //
    var self = {
        connect: connect,
        disconnect: disconnect,
        get: get,
        module: module,
        on: on,
        getId: getId,
        inviteUser: inviteUser,
        requestToken: requestToken,
        claimToken: claimToken
    };
    return self;
})();

