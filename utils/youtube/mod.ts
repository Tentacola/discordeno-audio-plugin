import { type } from "node:os";
import { exists } from "jsr:@std/fs/exists";
import { youtubeSearch } from "../../deps.ts";

const os = type() as keyof typeof ytdlp_binaries;
const ytdlp_binaries = {
    Windows_NT: "yt-dlp.exe",
    Linux: "yt-dlp_linux",
};

async function download_binary(binaries: any) {
    const urls = await fetch(
        "https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest",
    );
    const url_split = (await urls.json()).assets[0].browser_download_url.split(
        "/",
    );
    url_split.pop();

    const url = url_split.join("/") + "/" + binaries[os];
    const filename = `./${url.split("/").pop()}`;

    if (!(await exists(filename))) {
        const binaryResponse = await fetch(url);

        if (binaryResponse.body) {
            const file = await Deno.open(filename, {
                write: true,
                create: true,
            });

            await binaryResponse.body.pipeTo(file.writable);
        }
        if (os == "Linux") {
            const chown = new Deno.Command("chmod", {
                args: ["+x", filename],
                stdin: "null",
                stdout: "piped",
                stderr: "piped",
            });
            const output = await chown.output();
            if (output.code !== 0) {
                console.log(
                    "yt-dlp might not be executable, change that with chmod +x ./yt-dlp_linux",
                );
            }
        }
    }
    return filename;
}
const ytdlp = await download_binary(ytdlp_binaries);

export async function getVideoInfo(search: string) {
    const video_info = (await youtubeSearch(search)).videos[0];
    if (video_info === undefined) {
        return undefined;
    }

    return {
        title: video_info.title as string,
        id: video_info.videoId as string,
    };
}

const temp_dir = "./_tmp_audio";
if (!(await exists(temp_dir, { isDirectory: true }))) {
    await Deno.mkdir(temp_dir);
}

export async function getAudioStream(id: string) {
    const temp_file = `${temp_dir}/${id}.m4a`;
    console.log(
        `Run: yt-dlp_linux ${
            ["-x", "--audio-format", "m4a", "-o", temp_file, id].join(" ")
        }`,
    );
    const ytdlp_cmd = new Deno.Command(ytdlp, {
        args: ["-x", "--audio-format", "m4a", "-o", temp_file, id],
        stdin: "null",
        stdout: "null",
        stderr: "null",
    });

    const ytdlp_child = ytdlp_cmd.spawn();
    await ytdlp_child.output();

    const ffmpeg_cmd = new Deno.Command("ffmpeg", {
        args: ["-i", temp_file, "-acodec", "pcm_s16le", "-f", "s16le", "-"],
        stdin: "null",
        stdout: "piped",
        stderr: "null",
    });

    const ffmpeg_child = ffmpeg_cmd.spawn();
    ffmpeg_child.status.then(async () => {
        try {
            await Deno.remove(temp_file);
        } catch {
            console.log("Failed to remove file");
        }
    });
    return ffmpeg_child.stdout;
}

export function getVideoStream(id: string) {
    const cmd = new Deno.Command(ytdlp, {
        args: ["-o", "-", id],
        stdout: "piped",
        stderr: "null",
    });
    const child = cmd.spawn();

    return child.stdout;
}
