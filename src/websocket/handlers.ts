import { reinitDave, sendWSBinary } from "../../mod.ts";
import { EventSource } from "../../utils/mod.ts";
import {
    ConnectionData,
    connectSocketToSource,
    getBotData,
    sendWS,
    setUserSSRC,
    updateDaveVersion,
} from "../connection-data.ts";
import { discoverIP } from "../udp/discover.ts";
import { setSpeaking } from "../udp/speaking.ts";
import { ReceiveVoiceOpcodes, SendVoiceOpcodes } from "./opcodes.ts";

export const socketHandlers: Record<
    ReceiveVoiceOpcodes,
    (connectionData: ConnectionData, d: any) => void
> = {
    [ReceiveVoiceOpcodes.Ready]: ready,
    [ReceiveVoiceOpcodes.SessionDescription]: sessionDescription,
    [ReceiveVoiceOpcodes.Speaking]: speaking,
    [ReceiveVoiceOpcodes.HeartbeatACK]: heartbeatACK,
    [ReceiveVoiceOpcodes.Hello]: hello,
    [ReceiveVoiceOpcodes.Resumed]: resumed,
    [ReceiveVoiceOpcodes.ClientConnect]: clientConnect,
    [ReceiveVoiceOpcodes.ClientDisconnect]: clientDisconnect,
    [ReceiveVoiceOpcodes.MLS_EXTERNAL_SENDER]: mlsExternalSenderPackage,
    [ReceiveVoiceOpcodes.MLS_PROPOSALS]: mlsProposal,
    [ReceiveVoiceOpcodes.MLS_ANNOUNCE_COMMIT_TRANSITION]:
        mlsAnnounceCommitTransition,
    [ReceiveVoiceOpcodes.MLS_WELCOME]: mlsWelcome,
    [ReceiveVoiceOpcodes.DAVE_PREPARE_TRANSITION]: davePrepareTransition,
    [ReceiveVoiceOpcodes.DAVE_EXECUTE_TRANSITION]: daveExecutePendingTransition,
    [ReceiveVoiceOpcodes.DAVE_PREPARE_EPOCH]: davePrepareEpoch,
};

function hello(conn: ConnectionData, d: { heartbeat_interval: number }) {
    if (conn.heartbeat != undefined) {
        clearInterval(conn.heartbeat);
    }
    conn.heartbeat = setInterval(() => {
        if (conn.ws?.readyState !== WebSocket.OPEN) {
            clearInterval(conn.heartbeat);
        } else {
            beat(conn);
        }
    }, d.heartbeat_interval);
    beat(conn);
}

async function beat(conn: ConnectionData) {
    sendWS(conn, SendVoiceOpcodes.Heartbeat, {
        t: Date.now(),
        seq_ack: conn.context.wsSequence,
    });
    if (conn.udpSocket && conn.remote) {
        // NAT/connection table keep-alive
        const udpMessage = Buffer.from([0x80, 0xC8, 0x0, 0x0]);
        await conn.udpSocket.send(udpMessage, {
            ...conn.remote,
            transport: "udp",
        });
    }
}

function ready(conn: ConnectionData, d: any) {
    let currentPort = 5000;
    let listening = false;
    let udpSocket: Deno.DatagramConn | undefined;
    while (!listening) {
        try {
            udpSocket = Deno.listenDatagram({
                hostname: "0.0.0.0",
                port: currentPort,
                transport: "udp",
            });
            listening = true;
        } catch (_err) {
            if (_err instanceof TypeError) {
                throw new Error(
                    "Please enable unstable by adding --unstable.",
                );
            }
            currentPort++;
        }
    }
    conn.udpSocket = udpSocket as Deno.DatagramConn;
    const udpRaw = new EventSource<Uint8Array>();
    conn.udpRaw = udpRaw;

    const botData = getBotData(conn.botId);
    connectSocketToSource(
        conn.channelId,
        conn.guildId,
        conn.udpSocket,
        botData.udpSource,
        conn.udpRaw,
    );

    const { ssrc, port, ip } = d;
    conn.context.ssrc = ssrc;
    conn.remote = { port, hostname: ip };
    discoverIP(conn, ssrc, ip, port).then((info) => {
        if (conn.ws?.readyState === WebSocket.OPEN) {
            sendWS(conn, SendVoiceOpcodes.SelectProtocol, {
                protocol: "udp",
                data: {
                    address: info.ip,
                    port: info.port,
                    mode: "aead_aes256_gcm_rtpsize",
                },
            });
        }
    });
}

function resumed(conn: ConnectionData) {
    conn.context.ready = true;
    conn.context.reconnect = 0;
    setSpeaking(conn, true);
}

function sessionDescription(conn: ConnectionData, d: any) {
    const secret = d.secret_key;
    const mode = d.mode;
    conn.secret = new Uint8Array(secret);
    conn.mode = mode;
    conn.context.ready = true;
    conn.context.reconnect = 0;

    const session = conn.dave.session;
    if (d.dave_protocol_version > 0) {
        updateDaveVersion(conn, d.dave_protocol_version);
        sendWSBinary(
            conn,
            SendVoiceOpcodes.MLS_KEY_PACKAGE,
            session?.getSerializedKeyPackage(),
        );
    } else {
        // This purges the group internally, but you still have decryptors
        session?.reset();
        if (session) {
            // Allow clients to passthrough for 10 seconds after downgrading
            session.setPassthroughMode(true, 10);
        }
    }
    setSpeaking(conn, true);
}

function speaking(conn: ConnectionData, d: any) {
    const user_id = BigInt(d.user_id);
    const ssrc = Number(d.ssrc);
    setUserSSRC(conn, user_id, ssrc);
}

function heartbeatACK(conn: ConnectionData, d: number) {
    if (conn.context.lastHeart === d) {
        conn.context.lastHeart = undefined;
    }
}

function clientConnect(conn: ConnectionData, d: any) {
    d.user_ids.forEach((id: string) => conn.clientsConnected.add(id));
}

function clientDisconnect(conn: ConnectionData, d: any) {
    conn.clientsConnected.delete(d.user_id);
}

function mlsExternalSenderPackage(conn: ConnectionData, d: Buffer) {
    conn.dave.session?.setExternalSender(d);
}

function mlsProposal(conn: ConnectionData, d: Buffer) {
    const optype = d.readUInt8(0);
    const { commit, welcome } = conn.dave.session!.processProposals(
        optype,
        d.subarray(1),
        [...conn.clientsConnected],
    );
    if (commit) {
        // This sends a binary message to the voice server, pretty much the same as `Buffer.concat([optype, buffer])` with optype being a uint8
        sendWSBinary(
            conn,
            SendVoiceOpcodes.MLS_COMMIT_WELCOME,
            welcome ? Buffer.concat([commit, welcome]) : commit,
        );
    }
}

function mlsAnnounceCommitTransition(conn: ConnectionData, d: Buffer) {
    const transitionId = d.readUInt16BE(0);
    try {
        conn.dave.session?.processCommit(d.subarray(2));
        // We note our pending transition because `DAVE_EXECUTE_TRANSITION` will follow
        // except on reinitializing transitions (transition ID 0)
        if (transitionId !== 0 && conn.dave.session != undefined) {
            conn.dave.pending.set(
                transitionId,
                conn.dave.session.protocolVersion,
            );
            sendWS(conn, SendVoiceOpcodes.DAVE_TRANSITION_READY, {
                transition_id: transitionId,
            });
        }
    } catch {
        welcomeFailed(conn, transitionId);
    }
}

function mlsWelcome(conn: ConnectionData, d: Buffer) {
    const transitionId = d.readUInt16BE(0);
    try {
        conn.dave.session?.processWelcome(d.subarray(2));
        if (transitionId !== 0 && conn.dave.session != undefined) {
            conn.dave.pending.set(
                transitionId,
                conn.dave.session.protocolVersion,
            );
            sendWS(conn, SendVoiceOpcodes.DAVE_TRANSITION_READY, {
                transition_id: transitionId,
            });
        }
    } catch {
        welcomeFailed(conn, transitionId);
    }
}

function welcomeFailed(conn: ConnectionData, transitionId: number) {
    sendWS(conn, SendVoiceOpcodes.MLS_INVALID_COMMIT_WELCOME, {
        transition_id: transitionId,
    });
    reinitDave(conn);
}

function davePrepareTransition(conn: ConnectionData, d: any) {
    conn.dave.pending.set(
        d.transition_id,
        d.protocol_version,
    );

    // When the included transition ID is 0, the transition is for (re)initialization and it can be executed immediately.
    if (d.transition_id === 0) {
        daveExecutePendingTransition(conn, d);
    } else {
        // Upon receiving this message, clients enable passthrough mode on their receive-side
        // https://daveprotocol.com/#downgrade-to-transport-only-encryption
        if (d.protocol_version === 0) {
            // Setting the passthrough expiry to two minutes, the transition *shouldn't* last this long and I don't know how long it is, so this should be fine
            // NOTE: the reason why I set passthrough mode here is to let unencrypted frames through right now, once the transition finishes this shouldn't matter
            conn.dave.session?.setPassthroughMode(true, 120);
        }
        sendWS(conn, SendVoiceOpcodes.DAVE_TRANSITION_READY, {
            transition_id: d.transition_id,
        });
    }
}

function daveExecutePendingTransition(conn: ConnectionData, d: any) {
    console.log("Idk we transition to nothin :)");
}

function davePrepareEpoch(conn: ConnectionData, d: any) {
    // When the epoch ID is equal to 1, this message indicates that a new MLS group is to be created for the given protocol version.
    if (d.epoch === 1) {
        updateDaveVersion(conn, d.protocol_version);
    }
}
