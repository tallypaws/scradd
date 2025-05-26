import { GatewayIntentBits } from "discord.js";
import dns from "node:dns";
import { fileURLToPath } from "node:url";
import { client, login } from "strife.js";

dns.setDefaultResultOrder("ipv4first");

if (process.env.CANVAS !== "false") {
	let { GlobalFonts } = await import("@napi-rs/canvas");
	GlobalFonts.registerFromPath(
		fileURLToPath(
			import.meta.resolve("@fontsource-variable/sora/files/sora-latin-wght-normal.woff2"),
		),
		"Sora",
	);
	GlobalFonts.registerFromPath(
		fileURLToPath(
			import.meta.resolve("@fontsource-variable/sora/files/sora-latin-ext-wght-normal.woff2"),
		),
		"SoraExt",
	);

	// eslint-disable-next-line @typescript-eslint/naming-convention

	/**
	 * @author Parts Of this code were taken from
	 *   [org.jgrapes.webconsole.provider.chartjs](https://github.com/mnlipp/jgrapes-webconsole/blob/9381b2c/org.jgrapes.webconsole.provider.chartjs/resources/org/jgrapes/webconsole/provider/chartjs/chart.js/adapters/chartjs-adapter-simple.js)
	 *   and [chartjs-adapter-date-std](https://github.com/gcollin/chartjs-adapter-date-std/blob/c806f2b/src/index.ts)
	 */
}
// @ts-expect-error
globalThis.window = globalThis;
await login({
	modulesDirectory: fileURLToPath(new URL("./modules", import.meta.url)),
	defaultCommandAccess: true,
	async handleError(error, event) {
		console.log(error, event);
	},
	clientOptions: {
		intents:
			GatewayIntentBits.Guilds |
			// GatewayIntentBits.GuildMembers |
			// GatewayIntentBits.GuildModeration |
			// GatewayIntentBits.GuildEmojisAndStickers |
			// GatewayIntentBits.GuildWebhooks |
			// GatewayIntentBits.GuildInvites |
			// GatewayIntentBits.GuildVoiceStates |
			// GatewayIntentBits.GuildPresences |
			GatewayIntentBits.GuildMessages |
			// GatewayIntentBits.GuildMessageReactions |
			GatewayIntentBits.DirectMessages |
			GatewayIntentBits.MessageContent
			// GatewayIntentBits.GuildScheduledEvents 
			// GatewayIntentBits.AutoModerationExecution
			,
		presence: { status: "dnd" },
	},
	commandErrorMessage: `An error occurred.`,
});

client.user.setStatus("online");
