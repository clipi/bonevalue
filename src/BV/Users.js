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



