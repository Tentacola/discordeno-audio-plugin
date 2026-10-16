import { DAVE_PROTOCOL_VERSION } from "../../deps.ts";
import { ConnectionData } from "../connection-data.ts";
import { socketHandlers } from "./handlers.ts";
import {
    ReceiveVoiceOpcodes,
    SendVoiceOpcodes,
    VoiceCloseEventCodes,
} from "./opcodes.ts";

export function connectWebSocket(
    conn: ConnectionData,
    userId: bigint,
    guildId: bigint,
) {
    conn.context.ready = false;
    const { token, sessionId, endpoint } = conn.connectInfo;
    if (
        token === undefined || sessionId === undefined || endpoint === undefined
    ) {
        return;
    }
    const ws = new WebSocket(`wss://${endpoint}?v=8`);
    conn.ws = ws;
    const identifyRequest = JSON.stringify({
        op: SendVoiceOpcodes.Identify,
        d: {
            server_id: guildId.toString(),
            user_id: userId.toString(),
            max_dave_protocol_version: DAVE_PROTOCOL_VERSION,
            session_id: sessionId,
            token,
        },
    });
    const resumeRequest = JSON.stringify({
        op: SendVoiceOpcodes.Resume,
        d: {
            server_id: guildId.toString(),
            session_id: sessionId,
            token,
        },
    });
    const open = () => {
        handleOpen(conn, identifyRequest, resumeRequest);
    };
    const message = async (event: MessageEvent) => {
        await handleMessage(conn, event);
    };
    const error = () => handleError(conn);
    const close = (event: CloseEvent) => {
        ws.removeEventListener("open", open);
        ws.removeEventListener("message", message);
        ws.removeEventListener("close", close);
        ws.removeEventListener("error", error);
        handleClose(conn, event, userId, guildId);
    };
    ws.addEventListener("open", open);
    ws.addEventListener("message", message);
    ws.addEventListener("close", close);
    ws.addEventListener("error", error);
}

function handleOpen(
    conn: ConnectionData,
    identifyRequest: string,
    resumeRequest: string,
) {
    if (conn.ws?.readyState !== WebSocket.OPEN) {
        return;
    }
    conn.ws.send(conn.resume ? resumeRequest : identifyRequest);
    conn.resume = false;
}

async function handleMessage(conn: ConnectionData, ev: MessageEvent<any>) {
    let op: number;
    let d: any;
    if (ev.data instanceof ArrayBuffer || ev.data instanceof Blob) {
        let ev_bin;
        if (ev.data instanceof Blob) {
            ev_bin = Buffer.from(await ev.data.arrayBuffer());
        } else {
            ev_bin = Buffer.from(ev.data);
        }
        op = ev_bin.readUInt8(2);
        d = ev_bin.subarray(3);
    } else {
        const ev_json = JSON.parse(ev.data);
        op = ev_json.op;
        d = ev_json.d;
    }
    socketHandlers[op as ReceiveVoiceOpcodes]?.(conn, d);
}

function handleClose(
    conn: ConnectionData,
    event: CloseEvent,
    userId: bigint,
    guildId: bigint,
) {
    conn.stopHeart();
    conn.context.ready = false;
    conn.context.speaking = false;
    conn.context.lastHeart = undefined;
    conn.context.missedHeart = 0;
    if (VoiceCloseEventCodes.Disconnect === event.code) {
        return;
    }
    if (conn.context.reconnect >= 3) {
        return;
    }
    conn.context.reconnect++;
    conn.resume = true;
    connectWebSocket(conn, userId, guildId);
}

/**
 * Errors are scary just drop connection.
 * Hope it reconnects😬
 * @param event
 * @param conn
 * @param userId
 * @param guildId
 */
function handleError(conn: ConnectionData) {
    conn.ws?.close();
}
