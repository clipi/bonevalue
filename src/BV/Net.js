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



