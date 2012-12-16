var express = require('express');
var app = express();
    app.use(express.static(__dirname+"/frontend"));
var server = require('http').createServer(app);
    server.listen(8000);
var WebSocketServer = require('websocket').server;
var mainSocket = new WebSocketServer({
    httpServer: server
});
var bcrypt = require('bcrypt');
var db = require("mongojs").connect("mongodb://localhost:27017/test", ["users", "tokens"]);
var peers = {};

//
// Authenticate connection requests. Callback with the user's
// userId to pass, callback with null to fail.
//
function authenticate(request, callback) {
    var username = request.cookies[0].value;
    var password = request.cookies[1].value;
    db.users.findOne({ email: username }, function(err, doc) {
        if (doc) {
            bcrypt.compare(password, doc.password, function(err, res) {
                if (res) {
                    callback(doc._id);
                } else {
                    console.log("Bad login");
                    callback(null);                    
                }
            });
        } else {
            console.log("Bad login");
            callback(null);
        }
    });
};

//
// Wait for peer connections
//
mainSocket.on('request', function (request) {
    authenticate(request, function(userId) {
        if (userId == null) {
		    request.reject();
		    return;
		}
		
		var socket = request.accept(null, request.origin);
		var peerId = Math.floor(Math.random()*9999999999999);
		console.log(peerId+": Connected");
		socket.send(JSON.stringify({type: 'userAdd', data: "Us"}));

		while (peers[peerId] != undefined) {
		    peerId = Math.floor(Math.random()*999999999999);
		}

		peers[peerId] = socket;
		socket.send(JSON.stringify({type: 'setPeerId', data: { peerId: peerId }}));
		
		db.users.update({_id: userId}, {$push:{peerIds: peerId}}, function(err) {
		    if (err) console.log("Adding peerId failed?! ["+err+"]");
		});
		
		//
		// Send the user list to the client
		// 
		db.users.find({_id: userId}, function(err, doc) {
		    var list = []; doc=doc[0];
		    for (var i=0; i<doc.aliases.length; i++) {
		        list.push(doc.aliases[i].name);
		    }
		    socket.send(JSON.stringify({type: 'userList', data: list}));
		});
		
		//
		// Broadcast to anyone who has this userId a 'peerConnect' message
		//
		db.users.find({ $or: [{userList: userId}, {_id: userId}] }, function(err, doc) {
		    for (var i=0; i<doc.length; i++) {
		        var tmpPeers = doc[i].peerIds;
		        //
		        // Find their alias for us
		        //
		        var alias = "Us";
		        for (var k=0; k<doc[i].aliases.length; k++) {
		            if (doc[i].aliases[k].userid.id==userId.id) {
		                alias = doc[i].aliases[k].name;
		                break;
		            }
		        }
		        for (var j=0; j<tmpPeers.length; j++) {
		            if ((tmpPeers[j] != peerId) && (peers[tmpPeers[j]])) {
		                peers[tmpPeers[j]].send(JSON.stringify({type: 'peerConnect', data: {name: alias, id: peerId}}));
		            }
		        }
		    }
		});
		
		//
		// Send a list all of the PeerId's associated to every Peer on this accounts PeerList
		//
		db.users.find({_id: userId}, function(err, doc) {
		    var user = doc[0];
		    db.users.find({ $or: [{userList: userId}, {_id: userId}] }, function(err, doc) {
		        var tmp = [];
		        for (var i=0; i<doc.length; i++) {
		            var tmpPeers = doc[i].peerIds;
		            //
		            // Find our alias for this user
		            //
		            var alias = "Us";
		            for (var k=0; k<user.aliases.length; k++) {
		                if (user.aliases[k].userid.id==doc[i]._id.id) {
		                    alias = user.aliases[k].name;
		                    break;
		                }
		            }
		            for (var j=0; j<tmpPeers.length; j++) {
		                if (tmpPeers[j] != peerId) {
		                    tmp.push({name: alias, id: tmpPeers[j]});
		                }
		            }
		        }
		        socket.send(JSON.stringify({type: 'peerList', data: tmp}));
		    });
		});
		
		//
		// Tell peerB that peerA wants to connect
		//
		socket.on('message', function(message) {
		    var json = JSON.parse(message.utf8Data);
		    var data = json.data;
		    switch(json.type) {
		        case 'peerRequest':
				    var client = peers[data.to];
			   		if (client) client.send(JSON.stringify({type: 'peerRequest', data: data}));
		            break;
		        case 'peerResponse':
		            var client = peers[data.to]; 
				    if (client) client.send(JSON.stringify({type: 'peerResponse', data: data}));
				    break;
				case 'inviteUser':
					db.users.find({ email: data.email }, function(err, users) {
						if (users.length==0) {
						    bcrypt.hash("test", 10, function(err, hash) {
						        db.users.save({ email: data.email, 
						                        password: hash, 
						                        userList: [],
						                        peerIds: [],
						                        aliases: [] }, function(err, saved) {
						            if(err) {
						                console.log("User not saved");
						            } else {
						                console.log("User saved");
						            }
						        });
						    });
						}
					});
					break;
				case 'requestToken':
					var token = "=="+new Buffer(""+Math.floor(Math.random()*9999999999999)).toString('base64');
					db.tokens.save({ userId: userId, 
						             token: token, 
						             name: data.name,
						             created: new Date() }, function(err, saved) {
						socket.send(JSON.stringify({type: 'tokenResponse', data: {token: token}}));
					});
					break;
				case 'claimToken':
					db.tokens.find({ token: data.token }, function(err, tokens) {
						var token = tokens[0];
						if (err || !token) {
						    console.log("Failed to find token: "+data.token);
						    return;
						}
						// is the token still valid?
						var now = Date.now();
						if ((now - (token.created).getTime()) < 600000) {
						    // add each user to eachothers userList
						    if (userId.id != token.userId.id) {
						        db.users.update({_id: token.userId}, {$push:{userList: userId}}, function(err) { });
						        db.users.update({_id: userId}, {$push:{userList: token.userId}}, function(err) { });
						        
				db.users.update({_id: token.userId}, {$push:{aliases: {userid: userId, name: token.name}}}, function(err) { });
				db.users.update({_id: userId}, {$push:{aliases: {userid: token.userId, name: data.name}}}, function(err) { });
						        
						        // tell each user about the others online peers
						        var peerAs = []; var peerBs = [];
						        db.users.find({_id: userId}, function(err, doc) {
						            for (var i=0; i<doc.length; i++) {
						                var tmpPeers = doc[i].peerIds;
						                for (var j=0; j<tmpPeers.length; j++) {
						                    peerAs.push(tmpPeers[j]);
						                    if (peers[tmpPeers[j]])
						                        peers[tmpPeers[j]].send(JSON.stringify({type: 'userAdd', data: data.name}));
						                }
						            }
						            db.users.find({_id: token.userId}, function(err, doc) {
						                for (var i=0; i<doc.length; i++) {
						                    var tmpPeers = doc[i].peerIds;
						                    for (var j=0; j<tmpPeers.length; j++) {
						                        peerBs.push(tmpPeers[j]);
						                        if (peers[tmpPeers[j]])
						                            peers[tmpPeers[j]].send(JSON.stringify({type: 'userAdd', data: token.name}));
						                    }
						                }
						                for (var i=0; i<peerAs.length; i++) {
						                    for (var j=0; j<peerBs.length; j++) {
						                        if (peerAs[i] != peerBs[j]) {
						                            if (peers[peerAs[i]])
						                                peers[peerAs[i]].send(JSON.stringify({type: 'peerConnect', data: {name: data.name, id: peerBs[j]}}));
						                            if (peers[peerBs[i]])
						                                peers[peerBs[i]].send(JSON.stringify({type: 'peerConnect', data: {name: token.name, id: peerAs[j]}}));
						                        }
						                    }
						                }
						            });
						        });
						    }
						}
						db.tokens.remove({ token: data.token }, function(err, token) { });
					});
					break;
			}
		});
		
		//
		// Remove the peerId from the database
		// Broadcast to every peer who has this accountId a 'peerDisconnect' message
		//
		socket.on('close', function(socket) {
		    db.users.update({_id: userId}, {$pull:{peerIds: peerId}}, function(err) {
		        if (err) console.log("Removing peerId failed?! ["+err+"]");
		    });
		    delete peers[peerId];
		    db.users.find({ $or: [{userList: userId}, {_id: userId}] }, function(err, doc) {
		        for (var i=0; i<doc.length; i++) {
		            var tmpPeers = doc[i].peerIds;
		            for (var j=0; j<tmpPeers.length; j++) {
		                if (tmpPeers[j] != peerId) {
		                    if (peers[tmpPeers[j]])
		                        peers[tmpPeers[j]].send(JSON.stringify({type: 'peerDisconnect', data: peerId}));
		                }
		            }
		        }
		    });
		});
	});
});

//
// Clear all user accounts and tokens
//
db.users.remove({}); db.tokens.remove({});

//
// On load, clear all peerId's
//
db.users.update({}, {$set:{peerIds: []}}, {multi:true}, function(err) {
    if (err) console.log("Clearing peerIds failed?! ["+err+"]");
});

//
// On load, test for the admin account - if its not there, create it
//
db.users.find({ email: "admin" }, function(err, doc) {
    if (err || doc.length==0) {
        bcrypt.hash("test", 10, function(err, hash) {
            db.users.save({ email: "admin", 
                            password: hash, 
                            userList: [],
                            peerIds: [],
                            aliases: [] }, function(err, saved) {
                if(err) {
                    console.log("Admin could not be saved");
                } 
            });
        });
    }
});








