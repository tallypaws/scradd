import { GatewayIntentBits } from "discord.js";
import dns from "node:dns";
import { fileURLToPath } from "node:url";
import { client, login } from "strife.js";
import { connectDBS } from "./common/db/index.js";

dns.setDefaultResultOrder("ipv4first");

connectDBS({
	surreal: {
		namespace: "blocks",
		database: "blocks",
		password: "root",
		username: "root",
		url: process.env.SURREAL_URI ?? "ws://192.168.0.7:8000/rpc",
	},
});

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
			GatewayIntentBits.MessageContent,
		// GatewayIntentBits.GuildScheduledEvents
		// GatewayIntentBits.AutoModerationExecution
		presence: { status: "dnd" },
	},
	commandErrorMessage: `An error occurred.`,
});

client.user.setStatus("online");
