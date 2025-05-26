import { z } from "zod";
import { DB } from "../common/database.js";

const configSchema = z.object({
	channels: z.object({
		list: z.array(z.string()),
		isWhitelist: z.boolean(),
	}),
});

const configDB = new DB(
	"server-config",
	{
		channels: {
			list: [],
			isWhitelist: false,
		},
	},
	configSchema,
);

export const messageSchema = z.map(z.string(), z.string());

export const messageDB = new DB("messages", new Map(), messageSchema);

export const userSettingsSchema = z.object({
	defaultFontSb3: z.string(),
	defaultFontSb2: z.string(),
	defaultStyle: z.enum(["sb3", "sb2", "sb3hc"])
})

export const userSettingsDB = new DB("usersettings", {
	defaultFontSb2: "LucidaGrande",
	defaultFontSb3: "Helvetica",
	defaultStyle: "sb3"
}, userSettingsSchema)

export async function getMessageMap(channelId: string) {
    return messageDB.getData(channelId);
}

export default async function getConfig(guildId: string) {
	return configDB.getData(guildId);
}

export async function getFontForUser(userId:string) {
return userSettingsDB.getData(userId)
}


