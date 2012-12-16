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
    function removedDataChannel() { 
        connectionCounter--; 
        if (connectionCounter==0) {
            clearDeleteFunction();
            startDeleteFunction();
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
    function sendMessage(module, data, callback) {
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
            dataChannel.close();
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



