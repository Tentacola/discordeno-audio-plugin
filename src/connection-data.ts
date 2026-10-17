import { EventSource } from "../utils/mod.ts";
import { wait } from "../utils/wait.ts";
import { LoadSource, UdpArgs } from "./mod.ts";
import { QueuePlayer } from "./player/mod.ts";
import { FRAME_DURATION } from "./sample-consts.ts";
import { sendAudioPacket } from "./udp/packet.ts";
import { DAVE_PROTOCOL_VERSION, DAVESession } from "../deps.ts";
import { SendVoiceOpcodes } from "./websocket/opcodes.ts";

export type BotData = {
    botId: bigint;
    guildData: Map<bigint, ConnectionData>;
    udpSource: EventSource<UdpArgs>;
    bufferSize: number;
    loadSource: LoadSource;
};

export type ConnectionData = {
    player: QueuePlayer;
    audio: ReturnType<typeof createAudioStreamer>;
    dave: {
        session?: DAVESession;
        pending: Map<number, number>;
    };
    clientsConnected: Set<string>;
    guildId: bigint;
    channelId: bigint;
    botId: bigint;
    udpSocket?: Deno.DatagramConn;
    udpRaw: EventSource<Uint8Array>;
    ssrcToUser: Map<number, bigint>;
    usersToSsrc: Map<bigint, number>;
    context: {
        ssrc: number;
        ready: boolean;
        speaking: boolean;
        sequence: number;
        wsSequence: number;
        timestamp: number;
        lastHeart?: number;
        reconnect: number;
        nonce: number;
    };
    connectInfo: {
        endpoint?: string;
        sessionId?: string;
        token?: string;
    };
    heartbeat?: NodeJS.Timeout;
    remote?: { port: number; hostname: string };
    ws?: WebSocket;
    secret?: Uint8Array;
    mode?: string;
    resume?: boolean;
};

const connectionData = new Map<bigint, BotData>();

/**
 * Returns a random number that is in the range of n bits.
 *
 * @param n - The number of bits
 */
function randomNBit(n: number) {
    return Math.floor(Math.random() * 2 ** n);
}

export function createBotData(
    botId: bigint,
    udpSource: EventSource<UdpArgs>,
    loadSource: LoadSource,
    bufferSize = 10,
) {
    const botData: BotData = {
        botId,
        guildData: new Map(),
        udpSource,
        bufferSize,
        loadSource,
    };
    connectionData.set(botId, botData);
    return botData;
}

export function getBotData(botId: bigint) {
    const botData = connectionData.get(botId);
    if (botData === undefined) {
        throw "Bot first needs to be connected!";
    }
    return botData;
}

export function getConnectionData(
    botId: bigint,
    guildId: bigint,
    channelId?: bigint,
) {
    const botData = getBotData(botId);
    let data = botData.guildData.get(guildId);
    if (data === undefined) {
        const udpRaw = new EventSource<Uint8Array>();
        data = {
            player: undefined as unknown as QueuePlayer,
            guildId,
            botId,
            udpRaw,
            context: {
                ssrc: 1,
                ready: false,
                speaking: false,
                wsSequence: -1,
                sequence: randomNBit(16),
                timestamp: randomNBit(32),
                reconnect: 0,
                nonce: 0,
            },
            connectInfo: {},
            audio: createAudioStreamer(),
            ssrcToUser: new Map<number, bigint>(),
            usersToSsrc: new Map<bigint, number>(),
            dave: {
                pending: new Map<number, number>(),
            },
            clientsConnected: new Set(),
            channelId: channelId!,
        };
        data.player = new QueuePlayer(data, botData.loadSource);
        botData.guildData.set(guildId, data);
        connectAudioIterable(data);
    }

    return data;
}

export function createDaveSession(
    botId: bigint,
    guildId: bigint,
    channelId: bigint,
) {
    const data = getConnectionData(botId, guildId);
    data.dave.session = new DAVESession(
        DAVE_PROTOCOL_VERSION,
        botId.toString(),
        channelId.toString(),
    );
}

export function updateDaveVersion(
    conn: ConnectionData,
    daveProtocolVersion: number,
) {
    reinitDave(conn, undefined, daveProtocolVersion);
}

export function sendWS(
    conn: ConnectionData,
    code: SendVoiceOpcodes,
    data: any,
) {
    if (conn.ws?.readyState === WebSocket.OPEN) {
        conn.ws.send(
            JSON.stringify({
                op: code,
                d: data,
            }),
        );
    }
}

export function sendWSBinary(
    conn: ConnectionData,
    code: SendVoiceOpcodes,
    data: any,
) {
    if (conn.ws?.readyState === WebSocket.OPEN) {
        const buffer = Buffer.allocUnsafe(1 + data.length);
        data.copy(buffer, 1);
        buffer.writeUInt8(code);
        conn.ws.send(buffer.subarray(0, 1 + data.length));
    }
}

export function updateChannel(conn: ConnectionData, channelId: bigint) {
    reinitDave(conn, channelId);
}
export function reinitDave(
    conn: ConnectionData,
    channelId?: bigint,
    daveProtocolVersion?: number,
) {
    const session = conn.dave.session;
    if (session !== undefined) {
        session.reinit(
            daveProtocolVersion ?? session.protocolVersion,
            session.userId,
            channelId?.toString() ?? session.channelId,
        );
        sendWSBinary(
            conn,
            SendVoiceOpcodes.MLS_KEY_PACKAGE,
            session?.getSerializedKeyPackage(),
        );
    }
}

function createAudioStreamer() {
    const eventsource = new EventSource<Uint8Array>();
    let n_frames = 0;
    let start = 0;
    return {
        iter: eventsource.iter,
        reset: function () {
            start = Date.now();
            n_frames = 0;
        },
        trigger: async function (chunk: Uint8Array) {
            const expected_timestamp = start + n_frames * FRAME_DURATION;
            const timestamp = Date.now();
            const time_to_wait = expected_timestamp - timestamp;
            if (Math.abs(time_to_wait / FRAME_DURATION) > 2) {
                this.reset();
            }
            await wait(Math.max(0, time_to_wait));
            eventsource.trigger(chunk);
            n_frames += 1;
        },
    };
}

async function connectAudioIterable(conn: ConnectionData) {
    for await (const chunk of conn.audio.iter()) {
        await sendAudioPacket(conn, chunk);
    }
}

export function getUserSSRC(conn: ConnectionData, user: bigint) {
    return conn.usersToSsrc.get(user);
}

export function getUserBySSRC(conn: ConnectionData, ssrc: number) {
    return conn.ssrcToUser.get(ssrc);
}

export function setUserSSRC(conn: ConnectionData, user: bigint, ssrc: number) {
    conn.usersToSsrc.set(user, ssrc);
    conn.ssrcToUser.set(ssrc, user);
}

export async function connectSocketToSource(
    botId: bigint,
    guildId: bigint,
    socket: Deno.DatagramConn,
    source: EventSource<UdpArgs>,
    localSource: EventSource<Uint8Array>,
) {
    for await (const [data, _address] of socket) {
        source.trigger({ botId, guildId, data });
        localSource.trigger(data);
    }
}
