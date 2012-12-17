function setCookie(c_name,value) {
    var exdate=new Date();
    exdate.setDate(exdate.getDate() + 6);
    document.cookie=c_name+"=-1; path=/; expires=Monday, 19-Aug-1996 05:00:00 GMT";
    document.cookie=c_name + "=" + escape(value) + "; path=/; expires="+exdate.toUTCString();
}

//
// Build enough objects for the bare service to operate
//
function buildEnvironment() {
    setCookie("uun", "admin");
    setCookie("ppz", "test");
    tmp = {};
    tmp.EventBus = new BV.Objects.EventBus(true);
    tmp.Net = new BV.Objects.Net(tmp.EventBus);
    tmp.PeerManager = new BV.Objects.PeerManager(tmp.EventBus);
    tmp.Users = new BV.Objects.Users(tmp.EventBus, tmp.PeerManager);
    tmp.Net.setHost("localhost:8000");
    BV.Module["BV.Module.Echo"] = "BV.Module.Echo";
    return tmp;
}

function delay(f) {
    setTimeout(function() { f(); }, 1000);
}


BV.Settings.Debug = true;

//
//
//
asyncTest( "Discovery Service Connection Test", 2, function() {
    var peerA = buildEnvironment();
    
    peerA.EventBus.wait(BV.Event.Net.Disconnected, function() {
        ok(true, "BV.Event.Net.Disconnected");
        delay(function() { start(); });
    });
    peerA.EventBus.wait(BV.Event.Net.Connected, function() {
        ok(true, "BV.Event.Net.Connected");
        peerA.Net.disconnect();
    });
    
    peerA.Net.connect();
});

//
//
//
asyncTest( "Peer Discovery Test - 2 peers", 7, function() {
    var peerA = buildEnvironment();
    var peerB = buildEnvironment();
    
    peerA.EventBus.wait(BV.Event.Net.Connected, function() {
        ok(true, "PeerA BV.Event.Net.Connected");
        peerB.Net.connect();
    });
    peerB.EventBus.wait(BV.Event.Net.Connected, function() {
        ok(true, "PeerB BV.Event.Net.Connected");
        setTimeout(function() {
            equal(Object.keys(peerA.Users.get()['Us']).length, 3, "PeerA has 2 peerIds");
            equal(Object.keys(peerB.Users.get()['Us']).length, 3, "PeerB has 2 peerIds");
            peerB.Net.disconnect();
        }, 1000);
    });
    peerB.EventBus.wait(BV.Event.Net.Disconnected, function() {
        ok(true, "BV.Event.Net.Disconnected");
        setTimeout(function() {
            equal(Object.keys(peerA.Users.get()['Us']).length, 2, "PeerA does not have 1 peerId?");
            peerA.Net.disconnect();
        }, 1000);
    });
    peerA.EventBus.wait(BV.Event.Net.Disconnected, function() {
        ok(true, "BV.Event.Net.Disconnected");
        start(); 
    });
    
    peerA.Net.connect(); 
});

//
//
//
asyncTest( "Peer Communication Test - 2 Peers - PeerA>PeerB", 9, function() {
    var peerA = buildEnvironment();
    var peerB = buildEnvironment();
    
    peerA.EventBus.wait(BV.Event.Net.Connected, function() {
        ok(true, "PeerA BV.Event.Net.Connected");
        peerB.Net.connect();
    });
    peerB.EventBus.wait(BV.Event.Net.Connected, function() {
        ok(true, "PeerB BV.Event.Net.Connected");
        setTimeout(function() {
            equal(Object.keys(peerA.Users.get()['Us']).length, 3, "PeerA has 2 peerIds");
            equal(Object.keys(peerB.Users.get()['Us']).length, 3, "PeerB has 2 peerIds");
            peerB.EventBus.wait("BV.Module.Echo", function(e) {
                equal("1w2e3r4t", e.request, "peerA -> peerB echo test");
                e.callback(e.request);
            });
            peerA.Users.get().message("BV.Module.Echo", "1w2e3r4t", false, function(data) {
                equal("1w2e3r4t", data, "peerA -> peerB -> peerA echo test");
                peerA.Net.disconnect();
            });
            
        }, 1000);
    });
    peerA.EventBus.wait(BV.Event.Net.Disconnected, function() {
        ok(true, "PeerA BV.Event.Net.Disconnected");
        setTimeout(function() {
            equal(Object.keys(peerB.Users.get()['Us']).length, 2, "PeerB has 1 peerIds");
            peerB.Net.disconnect();
        }, 1000);
    });
    peerB.EventBus.wait(BV.Event.Net.Disconnected, function() {
        ok(true, "PeerB BV.Event.Net.Disconnected");
        start();
    });
    
    peerA.Net.connect();
});

//
//
//
asyncTest( "Peer Communication Test - 2 Peers - PeerB>PeerA", 9, function() {
    var peerA = buildEnvironment();
    var peerB = buildEnvironment();
    
    peerA.EventBus.wait(BV.Event.Net.Connected, function() {
        ok(true, "PeerA BV.Event.Net.Connected");
        peerB.Net.connect();
    });
    peerB.EventBus.wait(BV.Event.Net.Connected, function() {
        ok(true, "PeerB BV.Event.Net.Connected");
        setTimeout(function() {
            equal(Object.keys(peerA.Users.get()['Us']).length, 3, "PeerA has 2 peerIds");
            equal(Object.keys(peerB.Users.get()['Us']).length, 3, "PeerB has 2 peerIds");
            peerA.EventBus.wait("BV.Module.Echo", function(e) {
                equal("dvfbhtrefgh86", e.request, "peerB -> peerA echo test");
                e.callback(e.request);
            });
            peerB.Users.get().message("BV.Module.Echo", "dvfbhtrefgh86", false, function(data) {
                equal("dvfbhtrefgh86", data, "peerB -> peerA -> peerB echo test");
                peerA.Net.disconnect();
            });
        }, 1000);
    });
    peerA.EventBus.wait(BV.Event.Net.Disconnected, function() {
        ok(true, "PeerA BV.Event.Net.Disconnected");
        setTimeout(function() {
            equal(Object.keys(peerB.Users.get()['Us']).length, 2, "PeerB has 1 peerIds");
            peerB.Net.disconnect();
        }, 1000);
    });
    peerB.EventBus.wait(BV.Event.Net.Disconnected, function() {
        ok(true, "PeerB BV.Event.Net.Disconnected");
        start();
    });
    
    peerA.Net.connect();
});

//
//
//
asyncTest( "Peer Discovery Test - 4 peers", 18, function() {
    var peerA = buildEnvironment();
    var peerB = buildEnvironment();
    var peerC = buildEnvironment();
    var peerD = buildEnvironment();
    
    peerA.EventBus.wait(BV.Event.Net.Connected, function() {
        ok(true, "PeerA BV.Event.Net.Connected");
        peerB.Net.connect();
    });
    peerB.EventBus.wait(BV.Event.Net.Connected, function() {
        ok(true, "PeerB BV.Event.Net.Connected");
        peerC.Net.connect();
    });
    peerC.EventBus.wait(BV.Event.Net.Connected, function() {
        ok(true, "PeerC BV.Event.Net.Connected");
        peerD.Net.connect();
    });
    peerD.EventBus.wait(BV.Event.Net.Connected, function() {
        ok(true, "PeerD BV.Event.Net.Connected");
        setTimeout(function() {
            equal(Object.keys(peerA.Users.get()['Us']).length, 5, "PeerA has 4 peerIds");
            equal(Object.keys(peerB.Users.get()['Us']).length, 5, "PeerB has 4 peerIds");
            equal(Object.keys(peerC.Users.get()['Us']).length, 5, "PeerC has 4 peerIds");
            equal(Object.keys(peerD.Users.get()['Us']).length, 5, "PeerD has 4 peerIds");
            peerA.Net.disconnect();
        }, 2000);
    });    
    peerA.EventBus.wait(BV.Event.Net.Disconnected, function() {
        ok(true, "PeerA BV.Event.Net.Disconnected");
        setTimeout(function() {
            equal(Object.keys(peerB.Users.get()['Us']).length, 4, "PeerB has 3 peerIds");
            equal(Object.keys(peerC.Users.get()['Us']).length, 4, "PeerC has 3 peerIds");
            equal(Object.keys(peerD.Users.get()['Us']).length, 4, "PeerD has 3 peerIds");
            peerB.Net.disconnect();
        }, 2000);
    }); 
    peerB.EventBus.wait(BV.Event.Net.Disconnected, function() {
        ok(true, "PeerB BV.Event.Net.Disconnected");
        setTimeout(function() {
            equal(Object.keys(peerC.Users.get()['Us']).length, 3, "PeerC has 2 peerIds");
            equal(Object.keys(peerD.Users.get()['Us']).length, 3, "PeerD has 2 peerIds");
            peerC.Net.disconnect();
        }, 2000);
    }); 
    peerC.EventBus.wait(BV.Event.Net.Disconnected, function() {
        ok(true, "PeerC BV.Event.Net.Disconnected");
        setTimeout(function() {
            equal(Object.keys(peerD.Users.get()['Us']).length, 2, "PeerD has 1 peerIds");
            peerD.Net.disconnect();
        }, 2000);
    }); 
    peerD.EventBus.wait(BV.Event.Net.Disconnected, function() {
        ok(true, "PeerA BV.Event.Net.Disconnected");
        start();
    }); 

    peerA.Net.connect();
});

//
//
//
asyncTest( "Peer Communication Test - 4 peers - All Broadcast", 31, function() {
    var peerA = buildEnvironment();
    var peerB = buildEnvironment();
    var peerC = buildEnvironment();
    var peerD = buildEnvironment();
    
    peerA.EventBus.wait(BV.Event.Net.Connected, function() {
        ok(true, "PeerA BV.Event.Net.Connected");
        peerB.Net.connect();
    });
    peerB.EventBus.wait(BV.Event.Net.Connected, function() {
        ok(true, "PeerB BV.Event.Net.Connected");
        peerC.Net.connect();
    });
    peerC.EventBus.wait(BV.Event.Net.Connected, function() {
        ok(true, "PeerC BV.Event.Net.Connected");
        peerD.Net.connect();
    });
    peerD.EventBus.wait(BV.Event.Net.Connected, function() {
        ok(true, "PeerD BV.Event.Net.Connected");
        setTimeout(function() {
            equal(Object.keys(peerA.Users.get()['Us']).length, 5, "PeerA has 4 peerIds");
            equal(Object.keys(peerB.Users.get()['Us']).length, 5, "PeerB has 4 peerIds");
            equal(Object.keys(peerC.Users.get()['Us']).length, 5, "PeerC has 4 peerIds");
            equal(Object.keys(peerD.Users.get()['Us']).length, 5, "PeerD has 4 peerIds");
            
            var count=12;
            var countDown = function() {
                count--;
                if (count==0) {
                    ok(true, "All messages accounted for");
                    peerA.Net.disconnect();
                }
            }
            
            peerA.EventBus.wait("BV.Module.Echo", function(e) { e.callback(e.request); });
            peerB.EventBus.wait("BV.Module.Echo", function(e) { e.callback(e.request); });
            peerC.EventBus.wait("BV.Module.Echo", function(e) { e.callback(e.request); });
            peerD.EventBus.wait("BV.Module.Echo", function(e) { e.callback(e.request); });
            
            peerA.Users.get().message("BV.Module.Echo", "w2jgfu73hjrgu3", false, function(data) {
                equal("w2jgfu73hjrgu3", data, "peerA -> * echo test");
                countDown();
            });
            peerB.Users.get().message("BV.Module.Echo", "oitjguornfguie4", false, function(data) {
                equal("oitjguornfguie4", data, "peerB -> * echo test");
                countDown();
            });
            peerC.Users.get().message("BV.Module.Echo", "fghjklkjhgfd", false, function(data) {
                equal("fghjklkjhgfd", data, "peerC -> * echo test");
                countDown();
            });
            peerD.Users.get().message("BV.Module.Echo", "9ijhnbvfde367ijhgf", false, function(data) {
                equal("9ijhnbvfde367ijhgf", data, "peerD -> * echo test");
                countDown();
            });
        }, 2000);
    });    
    peerA.EventBus.wait(BV.Event.Net.Disconnected, function() {
        ok(true, "PeerA BV.Event.Net.Disconnected");
        setTimeout(function() {
            equal(Object.keys(peerB.Users.get()['Us']).length, 4, "PeerB has 3 peerIds");
            equal(Object.keys(peerC.Users.get()['Us']).length, 4, "PeerC has 3 peerIds");
            equal(Object.keys(peerD.Users.get()['Us']).length, 4, "PeerD has 3 peerIds");
            peerB.Net.disconnect();
        }, 2000);
    }); 
    peerB.EventBus.wait(BV.Event.Net.Disconnected, function() {
        ok(true, "PeerB BV.Event.Net.Disconnected");
        setTimeout(function() {
            equal(Object.keys(peerC.Users.get()['Us']).length, 3, "PeerC has 2 peerIds");
            equal(Object.keys(peerD.Users.get()['Us']).length, 3, "PeerD has 2 peerIds");
            peerC.Net.disconnect();
        }, 2000);
    }); 
    peerC.EventBus.wait(BV.Event.Net.Disconnected, function() {
        ok(true, "PeerC BV.Event.Net.Disconnected");
        setTimeout(function() {
            equal(Object.keys(peerD.Users.get()['Us']).length, 2, "PeerD has 1 peerIds");
            peerD.Net.disconnect();
        }, 2000);
    }); 
    peerD.EventBus.wait(BV.Event.Net.Disconnected, function() {
        ok(true, "PeerA BV.Event.Net.Disconnected");
        start();
    }); 

    peerA.Net.connect();
});

//
//
//
asyncTest( "Peer Discovery Test - 2+2 peers", 36, function() {
    var peerA = buildEnvironment();
    var peerB = buildEnvironment();
    var peerC = buildEnvironment();
    var peerD = buildEnvironment();
    
    peerA.EventBus.wait(BV.Event.Net.Connected, function() {
        ok(true, "PeerA BV.Event.Net.Connected");
        peerB.Net.connect();
    });
    peerB.EventBus.wait(BV.Event.Net.Connected, function() {
        ok(true, "PeerB BV.Event.Net.Connected");
        setTimeout(function() {
            equal(Object.keys(peerA.Users.get()['Us']).length, 3, "PeerA has 2 peerIds");
            equal(Object.keys(peerB.Users.get()['Us']).length, 3, "PeerB has 2 peerIds");
            peerA.EventBus.dispatch(BV.Event.Net.InviteUser, { email: "test" });
            setTimeout(function() {
                setCookie("uun", "test");
                peerC.Net.connect();
            }, 1000);
        }, 1000);
    });
    peerC.EventBus.wait(BV.Event.Net.Connected, function() {
        ok(true, "PeerC BV.Event.Net.Connected");
        peerD.Net.connect();
    });
    peerD.EventBus.wait(BV.Event.Net.Connected, function() {
        ok(true, "PeerD BV.Event.Net.Connected");
        setTimeout(function() {
            equal(Object.keys(peerA.Users.get()['Us']).length, 3, "PeerA has 2 peerIds");
            equal(Object.keys(peerB.Users.get()['Us']).length, 3, "PeerB has 2 peerIds");
            equal(Object.keys(peerC.Users.get()['Us']).length, 3, "PeerC has 2 peerIds");
            equal(Object.keys(peerD.Users.get()['Us']).length, 3, "PeerD has 2 peerIds");
            equal(Object.keys(peerA.Users.get()).length, 2, "PeerA has 1 User");
            equal(Object.keys(peerB.Users.get()).length, 2, "PeerB has 1 User");
            equal(Object.keys(peerC.Users.get()).length, 2, "PeerC has 1 User");
            equal(Object.keys(peerD.Users.get()).length, 2, "PeerD has 1 User");
            
            peerA.EventBus.wait(BV.Event.Net.TokenResponse, function(data) {
                ok(true, "PeerA BV.Event.Net.TokenResponse");
                peerC.EventBus.dispatch(BV.Event.Net.ClaimToken, {token:data.token, name: "admin"} );
                setTimeout(function() {
                    equal(Object.keys(peerA.Users.get()).length, 3, "PeerA has 2 Users");
                    equal(Object.keys(peerB.Users.get()).length, 3, "PeerB has 2 Users");
                    equal(Object.keys(peerC.Users.get()).length, 3, "PeerC has 2 Users");
                    equal(Object.keys(peerD.Users.get()).length, 3, "PeerD has 2 Users");
                    
                    var count=12;
                    var countDown = function() {
                        count--;
                        if (count==0) {
                            ok(true, "All messages accounted for");
                            peerA.Net.disconnect();
                        }
                    }
                    
                    peerA.EventBus.wait("BV.Module.Echo", function(e) { e.callback(e.request); });
                    peerB.EventBus.wait("BV.Module.Echo", function(e) { e.callback(e.request); });
                    peerC.EventBus.wait("BV.Module.Echo", function(e) { e.callback(e.request); });
                    peerD.EventBus.wait("BV.Module.Echo", function(e) { e.callback(e.request); });
                    
                    peerA.Users.get().message("BV.Module.Echo", "w2jgfu73hjrgu3", false, function(data) {
                        equal("w2jgfu73hjrgu3", data, "peerA -> * echo test");
                        countDown();
                    });
                    peerB.Users.get().message("BV.Module.Echo", "oitjguornfguie4", false, function(data) {
                        equal("oitjguornfguie4", data, "peerB -> * echo test");
                        countDown();
                    });
                    peerC.Users.get().message("BV.Module.Echo", "fghjklkjhgfd", false, function(data) {
                        equal("fghjklkjhgfd", data, "peerC -> * echo test");
                        countDown();
                    });
                    peerD.Users.get().message("BV.Module.Echo", "9ijhnbvfde367ijhgf", false, function(data) {
                        equal("9ijhnbvfde367ijhgf", data, "peerD -> * echo test");
                        countDown();
                    });
                    
                }, 2000);
            });
            peerA.EventBus.dispatch(BV.Event.Net.RequestToken, { name: "test" });
        }, 1000);
    });    
    peerA.EventBus.wait(BV.Event.Net.Disconnected, function() {
        ok(true, "PeerA BV.Event.Net.Disconnected");
        setTimeout(function() {
            peerD.Net.disconnect();
        }, 1000);
    }); 
    peerD.EventBus.wait(BV.Event.Net.Disconnected, function() {
        ok(true, "PeerD BV.Event.Net.Disconnected");
        setTimeout(function() {
            peerC.Net.disconnect();
        }, 1000);
    }); 
    peerC.EventBus.wait(BV.Event.Net.Disconnected, function() {
        ok(true, "PeerC BV.Event.Net.Disconnected");
        setTimeout(function() {
            peerB.Net.disconnect();
        }, 1000);
    }); 
    peerB.EventBus.wait(BV.Event.Net.Disconnected, function() {
        ok(true, "PeerB BV.Event.Net.Disconnected");
        start();
    }); 

    peerA.Net.connect();
});






