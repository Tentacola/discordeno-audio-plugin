import { asArray, EventSource } from "../utils/mod.ts";
import {
    createBotData,
    createDaveSession,
    getConnectionData,
} from "./connection-data.ts";
import { QueuePlayer } from "./player/mod.ts";
import { connectWebSocket } from "./websocket/mod.ts";
import {
    Bot,
    CompleteDesiredProperties,
    DesiredPropertiesBehavior,
    RecursivePartial,
    TransformersDesiredProperties,
} from "../deps.ts";
import { createOnAudio } from "./listen.ts";
import { LoadSource, loadSource } from "./audio-source/universal.ts";

export * from "./connection-data.ts";
export * from "./websocket/mod.ts";
export * from "./udp/mod.ts";
export * from "./encoding.ts";
export * from "./demux/mod.ts";
export * from "./player/mod.ts";
export * from "./audio-source/mod.ts";

export type VoiceProps = {
    voiceState: {
        guildId: true;
        sessionId: true;
        userId: true;
    };
};

export type UdpArgs = {
    botId: bigint;
    guildId: bigint;
    data: Uint8Array;
};

export type AudioBot<T> = T & {
    helpers: ReturnType<typeof createAudioHelpers>;
};

export function enableAudioPlugin<
    TProps extends RecursivePartial<TransformersDesiredProperties> & VoiceProps,
    TBehavior extends DesiredPropertiesBehavior,
>(
    bot: Bot<CompleteDesiredProperties<TProps>, TBehavior>,
    source: LoadSource = loadSource,
): AudioBot<Bot<CompleteDesiredProperties<TProps>, TBehavior>> {
    Object.assign(
        bot.helpers,
        createAudioHelpers<TProps, TBehavior>(bot, source),
    );
    return bot as AudioBot<Bot<CompleteDesiredProperties<TProps>, TBehavior>>;
}

function createAudioHelpers<
    TProps extends RecursivePartial<TransformersDesiredProperties> & VoiceProps,
    TBehavior extends DesiredPropertiesBehavior,
>(
    bot: Bot<CompleteDesiredProperties<TProps>, TBehavior>,
    source: LoadSource,
) {
    const udpSource = new EventSource<UdpArgs>();
    createBotData(bot.id, udpSource, source);
    const resetPlayer = (guildId: bigint) => {
        const conn = getConnectionData(bot.id, guildId);
        const oldPlayer = conn.player;
        const oldQueue = asArray(oldPlayer.current());
        oldQueue.push(...oldPlayer.upcoming());
        conn.player = new QueuePlayer(conn, source);
        conn.player.push(...oldQueue);
        oldPlayer.stopInterrupt();
        oldPlayer.stop();
        conn.player.loop(oldPlayer.looping);
        return conn.player;
    };
    const oldStateListener = bot.events.voiceStateUpdate;

    bot.events.voiceStateUpdate = (event) => {
        const { userId, guildId, sessionId, channelId } = event as any;
        if (
            bot.id === userId && guildId != undefined && channelId != undefined
        ) {
            const conn = getConnectionData(bot.id, guildId);
            createDaveSession(bot.id, guildId, channelId);
            conn.connectInfo.sessionId = sessionId;
            connectWebSocket(conn, bot.id, guildId);
        }
        oldStateListener?.(event);
    };
    const oldServerListener = bot.events.voiceServerUpdate;
    bot.events.voiceServerUpdate = (event) => {
        const { guildId, endpoint, token } = event;
        const conn = getConnectionData(bot.id, guildId);
        conn.connectInfo.endpoint = endpoint;
        conn.connectInfo.token = token;
        connectWebSocket(conn, bot.id, guildId);
        oldServerListener?.(event);
    };
    return {
        getPlayer: (guildId: bigint) => {
            const conn = getConnectionData(bot.id, guildId);
            return conn.player;
        },
        resetPlayer,
        fixAudio: (guildId: bigint) => {
            resetPlayer(guildId);
            const conn = getConnectionData(bot.id, guildId);
            conn.ws?.close();
        },
        /**
         * Creates an async iterable with decoded audio packets
         */
        onAudio: createOnAudio(udpSource),
    };
}
