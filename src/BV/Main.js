
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

