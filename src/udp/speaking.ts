import { ConnectionData, sendWS } from "../connection-data.ts";
import { SendVoiceOpcodes } from "../websocket/opcodes.ts";

export function setSpeaking(
    conn: ConnectionData,
    speaking: boolean,
) {
    if (
        conn.context.speaking === speaking ||
        conn.ws?.readyState !== WebSocket.OPEN
    ) {
        return;
    }
    conn.context.speaking = speaking;

    sendWS(conn, SendVoiceOpcodes.Speaking, {
        speaking: speaking ? 1 : 0,
        delay: 0,
        ssrc: conn.context.ssrc,
    });
}
