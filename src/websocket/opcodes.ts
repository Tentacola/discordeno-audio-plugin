export enum VoiceOpcodes {
    Identify = 0,
    /** Select the voice protocol. */
    SelectProtocol = 1,
    /** Complete the websocket handshake. */
    Ready = 2,
    /** Keep the websocket connection alive. */
    Heartbeat = 3,
    /** Describe the session. */
    SessionDescription = 4,
    /** Indicate which users are speaking. */
    Speaking = 5,
    /** Sent to acknowledge a received client heartbeat. */
    HeartbeatACK = 6,
    /** Resume a connection. */
    Resume = 7,
    /** Time to wait between sending heartbeats in milliseconds. */
    Hello = 8,
    /** Acknowledge a successful session resume. */
    Resumed = 9,
    /** A client has connected to the voice channel */
    ClientConnect = 11,
    /** A client has disconnected from the voice channel */
    ClientDisconnect = 13,
    DAVE_PREPARE_TRANSITION = 21,
    DAVE_EXECUTE_TRANSITION = 22,
    DAVE_TRANSITION_READY = 23,
    DAVE_PREPARE_EPOCH = 24,
    MLS_EXTERNAL_SENDER = 25,
    MLS_KEY_PACKAGE = 26,
    MLS_PROPOSALS = 27,
    MLS_COMMIT_WELCOME = 28,
    MLS_ANNOUNCE_COMMIT_TRANSITION = 29,
    MLS_WELCOME = 30,
    MLS_INVALID_COMMIT_WELCOME = 31,
}

export enum VoiceCloseEventCodes {
    /** You sent an invalid [opcode](https://discord.com/developers/docs/topics/opcodes-and-status-codes#voice-voice-opcodes). */
    UnknownOpcode = 4001,
    /** You sent a invalid payload in your [identifying](https://discord.com/developers/docs/topics/gateway#identify) to the Gateway. */
    FailedToDecodePayload = 4002,
    /** You sent a payload before [identifying](https://discord.com/developers/docs/topics/gateway#identify) with the Gateway. */
    NotAuthenticated = 4003,
    /** The token you sent in your [identify](https://discord.com/developers/docs/topics/gateway#identify) payload is incorrect. */
    AuthenticationFailed = 4004,
    /** You sent more than one [identify](https://discord.com/developers/docs/topics/gateway#identify) payload. Stahp. */
    AlreadyAuthenticated = 4005,
    /** Your session is no longer valid. */
    SessionNoLongerValid = 4006,
    /** Your session has timed out. */
    SessionTimedOut = 4009,
    /** We can't find the server you're trying to connect to. */
    ServerNotFound = 4011,
    /** We didn't recognize the [protocol](https://discord.com/developers/docs/topics/voice-connections#establishing-a-voice-udp-connection-example-select-protocol-payload) you sent. */
    UnknownProtocol = 4012,
    /** Channel was deleted, you were kicked, voice server changed, or the main gateway session was dropped. Should not reconnect. */
    Disconnect = 4014,
    /** The server crashed. Our bad! Try [resuming](https://discord.com/developers/docs/topics/voice-connections#resuming-voice-connection). */
    VoiceServerCrashed = 4015,
    /** We didn't recognize your [encryption](https://discord.com/developers/docs/topics/voice-connections#encrypting-and-sending-voice). */
    UnknownEncryptionMode = 4016,
}

export enum ReceiveVoiceOpcodes {
    /** Complete the websocket handshake. */
    Ready = VoiceOpcodes.Ready,
    /** Describe the session. */
    SessionDescription = VoiceOpcodes.SessionDescription,
    /** Indicate which users are speaking. */
    Speaking = VoiceOpcodes.Speaking,
    /** Sent to acknowledge a received client heartbeat. */
    HeartbeatACK = VoiceOpcodes.HeartbeatACK,
    /** Time to wait between sending heartbeats in milliseconds. */
    Hello = VoiceOpcodes.Hello,
    /** Acknowledge a successful session resume. */
    Resumed = VoiceOpcodes.Resumed,
    /** A client has connected to the voice channel */
    ClientConnect = VoiceOpcodes.ClientConnect,
    /** A client has disconnected from the voice channel */
    ClientDisconnect = VoiceOpcodes.ClientDisconnect,
    /** MLS_EXTERNAL_SENDER */
    MLS_EXTERNAL_SENDER = VoiceOpcodes.MLS_EXTERNAL_SENDER,
    /** MLS_PROPOSALS */
    MLS_PROPOSALS = VoiceOpcodes.MLS_PROPOSALS,
    /** MLS_ANNOUNCE_COMMIT_TRANSITION */
    MLS_ANNOUNCE_COMMIT_TRANSITION =
        VoiceOpcodes.MLS_ANNOUNCE_COMMIT_TRANSITION,
    /** MLS_WELCOME */
    MLS_WELCOME = VoiceOpcodes.MLS_WELCOME,
    /** DAVE_PREPARE_TRANSITION */
    DAVE_PREPARE_TRANSITION = VoiceOpcodes.DAVE_PREPARE_TRANSITION,
    /** DAVE_EXECUTE_TRANSITION */
    DAVE_EXECUTE_TRANSITION = VoiceOpcodes.DAVE_EXECUTE_TRANSITION,
    /** DAVE_PREPARE_EPOCH */
    DAVE_PREPARE_EPOCH = VoiceOpcodes.DAVE_PREPARE_EPOCH,
}

export enum SendVoiceOpcodes {
    /** 	Begin a voice websocket connection. */
    Identify = VoiceOpcodes.Identify,
    /** 	Select the voice protocol. */
    SelectProtocol = VoiceOpcodes.SelectProtocol,
    /** Keep the websocket connection alive. */
    Heartbeat = VoiceOpcodes.Heartbeat,
    /** Sent to acknowledge a received client heartbeat. */
    HeartbeatACK = VoiceOpcodes.HeartbeatACK,
    /** Indicate which users are speaking. */
    Speaking = VoiceOpcodes.Speaking,
    /** Resume a connection. */
    Resume = VoiceOpcodes.Resume,
    /** MLS_KEY_PACKAGE. */
    MLS_KEY_PACKAGE = VoiceOpcodes.MLS_KEY_PACKAGE,
    /** MLS_COMMIT_WELCOME. */
    MLS_COMMIT_WELCOME = VoiceOpcodes.MLS_COMMIT_WELCOME,
    /** DAVE_TRANSITION_READY. */
    DAVE_TRANSITION_READY = VoiceOpcodes.DAVE_TRANSITION_READY,
    /** MLS_INVALID_COMMIT_WELCOME. */
    MLS_INVALID_COMMIT_WELCOME = VoiceOpcodes.MLS_INVALID_COMMIT_WELCOME,
}
