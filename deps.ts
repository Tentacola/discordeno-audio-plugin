export * from "npm:@discordeno/bot@20.0.0";
export * as opus from "https://unpkg.com/@evan/wasm@0.0.95/target/opus/deno.js";
export { default as youtubeSearch } from "npm:yt-search";
export {
    Codec,
    DAVE_PROTOCOL_VERSION,
    DAVESession,
    MediaType,
    ProposalsOperationType,
} from "npm:@snazzah/davey";

import _sodium from "npm:libsodium-wrappers@0.7.15";
await _sodium.ready;
export const sodium = _sodium;
