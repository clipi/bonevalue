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



