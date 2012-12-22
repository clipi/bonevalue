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
            newPeer.setOffer(data.spd, function() {
                newPeer.createAnswer(function (sdp) {
                    EventBus.dispatch(BV.Event.Net.SendPeerResponse, { to: data.from, from: EventBus.getId(), peer: data.peer, spd: sdp });
                });
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
                outPeers[i].setAnswer(data.spd, function() { });
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



