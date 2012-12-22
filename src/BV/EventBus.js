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
                longQueue[event][i](obj);
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




