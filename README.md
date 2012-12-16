#Introduction

Welcome to project BoneValue! The goal is to provide a platform for devloping web-based Peer-to-Peer applications. By utilising WebRTC it is now possible to establish direct p2p connections between two browser tabs without sending any data via a relay. This project consists of two parts - a clientside javascript library and a NodeJS discovery server. This project handles user authentication, peer discovery, peer management and network resource management. 

**The WebRTC DataChannel API is not yet implemented in any browser - hopefully it will appear Q1 2013. For now, use a polyfill!**

	BYOI - Bring Your Own Infrastructure

Project structure:

- **p2p-platform** contains everything you need *(apart from a polyfill)* to start building your own p2p webapp  
- **src** contains the raw source code and some unit tests  

# Example p2p WebApp

##Server

    npm install bcrypt express mongojs websocket
    node server.js
    
##Client

Open up several instances of the following page, open + read the javascript console and everything should make sense.

	<!doctype html>
	<html>
		<head>
		    <script type="text/javascript" src="scripts/BV.js"></script>
		    <script type="text/javascript">
		        // Define an Echo module with a slight twist
		        $BV.module("My.Echo.Module", function(e) {
		            // e = { request: { ... }, callback: function(response) { ... } }
		            var chineseWhispers = "Not "+e.request.text;
		            console.log("Routing data: "+chineseWhispers);
		            e.callback({text: chineseWhispers});
		        });

		        // Whenever a peer connects, send them an Echo request
		        $BV.on("peerconnect", function(peer) {
		            // peer = { name: "admin", id: "17234564" }
		            $BV.get(peer.id).message("My.Echo.Module", { text: "Friday" }, function(response) {
		                // response = { ... }
		                console.log("Received: "+response.text);
		            });
		        });

		        // Kick off the process
		        $BV.connect("p2p.example.com", "admin", "test");
		    </script>
		</head>
		<body>
		    &nbsp;
		</body>
	</html>

# Client Side

The whole point of this project is to avoid routing data through servers - aside from tweaking User related functions, everything else should be client side. After including the BoneValue clientside script, $BV will be created for you in global scope.

## Startup

Users must authenticate with the central server as they connect. After connecting the client is given a PeerId, it is notified of all other User aliases in it's account and is told of each online peer belonging to those aliases.

	:::javascript 
	$BV.connect(hostname, username, password); 
	// ... 
	$BV.disconnect(); 

## Capturing Key Events

These are the currently supported events:

	:::javascript
	$BV.on("connect", function() {
		// we've successfully authenticated and connected to the discovery server
	});
	$BV.on("disconnect", function() {
		// we've disconnected from the discovery server, or the server is down
	});
	$BV.on("peerconnect", function(peer) {
	    // A new peer has become available
		// peer = { name: ___, id: ___ }
	});
	$BV.on("peerdisconnect", function(peerId) {
	    // A peer has just gone offline
	});
	$BV.on("newuser", function(alias) {
	    // A new User has just been added
	});

## Communicating with Peers

The p2p communication is implemented RPC style. Functionality should be pushed into modules, identifiable by name, which take a request object and return a response object.

The global $BV object has a function .get("") which takes a query string and returns an object granting access to p2p communication. The query can be "*" for every peer, or a username "Oli" for every peer beloning to the account "Oli", or a specific peerId "6826386814235" for just one specific peer. The .get() function will ALWAYS return an object containing a function .message() which will target all peers you queried for.

	:::javascript
	$BV.get("*").message("My.Echo.Module", { text: "Friday" }, function(response) {
	    // will send the message to all peers
	});
	$BV.get("Us").message("My.Echo.Module", { text: "Friday" }, function(response) {
	    // will send the message to all of the current users peers
	});
	$BV.get("admin").message("My.Echo.Module", { text: "Friday" }, function(response) {
	    // will send the message to all of the user "admin"s peers
	});
	$BV.get("8722369652").message("My.Echo.Module", { text: "Friday" }, function(response) {
	    // will send the message directly to the peer whose peerId is 8722369652
	});
	
	alert("Your current PeerId is: "+$BV.getId()); 

- The first parameter is the name of the module you want to target.  
- The second parameter is an object containing any data you wish to send to the other peer.  
- The third parameter is a callback function which will be invoked when the other peer responds to the request.  

## Creating a Module

Creating a module is simple:

	:::javascript
	$BV.module("Some.Module.Identifier", function(e) {
	    // e = { request: { ... }, callback: function(response) { ... } }
	    e.callback({ ... });
	});

- The first parameter is a unique name you want to use to refer to the module.  
- The second parameter is a function which will be invoked whenever a request is made to this module.  
- The function's parameter contains two properties, "data" (the data object send as the request) and "callback" (the route back to the sender).  

## Peer Management

The default behaviour is as follows:
  
- Each User maintains a list of other trusted Users  
- Users can only interact with peers belonging to trusted Users  
- Each user account may log in multiple times  
- Each instance will have it's own PeerId  
- Users may add other users to their list of trusted Users by exchanging Tokens.  

To create a new user login on the discovery server:

	:::javascript
	$BV.invite("email");

Tokens work as follows:
  
- A User must first request a token.  
- When requesting a token, they must state an alias they wish to tie to the token.  
- The User then sends the token to the intended recipient.  
- The recipient then claims the token, giving an alias they wish to use for the original User.  

For example:

	:::javascript 
	$BV.requestToken("alias", function(data) { 
		// data.token
	}); 
	
	$BV.claimToken("alias", "--token--"); 
 
# Server

The primary purpose of the server is to maintain a link to each peer and pass connection requests between them. The nodejs server provided works fine, however it is unlikely to function exactly as everyone wants - there are far too many implementation options to please everyone. 

The areas of new user registration, user authentication, controlling who can communicate with who and deciding how you want to store user data are all wide open for debate. As such I feel the best thing to do is provide an example implementation, point out the really important bits and leave custom implementations up to peoples preferences.

The core functionality - passing connection requests between peers:

	...
	var WebSocketServer = require('websocket').server;
	var mainSocket = new WebSocketServer({
		httpServer: server
	});
	var peers = {};
	...
	mainSocket.on('request', function (request) {
	    ...
		var socket = request.accept(null, request.origin);
		var peerId = Math.floor(Math.random()*9999999999999);
		peers[peerId] = socket;
		...
		socket.on('message', function(message) {
			var json = JSON.parse(message.utf8Data);
			var data = json.data;
			switch(json.type) {
				case 'peerRequest':
					var client = peers[data.to];
					if (client) client.send(JSON.stringify({type: 'peerRequest', data: data}));
					...
				case 'peerResponse':
					var client = peers[data.to]; 
					if (client) client.send(JSON.stringify({type: 'peerResponse', data: data}));
					...
				...
			}
			...
		}
		...
	}
	...

Whenever a new peer connects they should immediately be assigned a PeerId:

	socket.send(JSON.stringify({type: 'setPeerId', data: { peerId: 769375769885 }}));

Next, the peer should receive a list of each user they should be able to communicate with and each peer belonging to those users:

	socket.send(JSON.stringify({type: 'userList', data: ['Bob', 'Dave', 'Fred']}));
	socket.send(JSON.stringify({type: 'peerList', data: [{name: 'Bob', id: 79376736756}, {name: 'Dave', id: 73686589331}]}));

Next, all other peers who should be capable of communicating with them should recieve a "peerConnect" message. Each peer should have already been told about the alias of the User the new peer belongs to:

	someSocket.send(JSON.stringify({type: 'userAdd', data: "Bob"}));
	someSocket.send(JSON.stringify({type: 'peerConnect', data: {name: 'Bob', id: 29567262476}}));
	someSocket.send(JSON.stringify({type: 'peerConnect', data: {name: 'Bob', id: 79376736756}}));
	
When a peer disconnects, each peer they can communicate with should receive a 'peerDisconnect' message:

	someSocket.send(JSON.stringify({type: 'peerDisconnect', data: 769375769885}));


