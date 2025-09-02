import { type BaseMessageOptions, type Message, type Snowflake } from "discord.js";
import { setTimeout as wait } from "node:timers/promises";
import { defineEvent } from "strife.js";

import { fonts, scratchBlocksToImage } from "../blocks/index.js";
import { getFontForUser } from "../getconfig.js";

defineEvent("messageCreate", async (message) => {
	const response = await handleMutatable(message);
	if (response) {
		if (response === true) return;
		const isArray = Array.isArray(response);
		if (isArray) {
			const reply = await (message.system ?
				message.channel.send(response[0])
			:	message.reply(response[0]));
			autoResponses.set(message.id, reply);
			for (const action of response.slice(1)) {
				if (typeof action === "number") {
					await wait(action);
					continue;
				}

				const edited = await reply.edit(action).catch(() => void 0);
				if (!edited) break;
			}
		} else
			autoResponses.set(
				message.id,
				await (message.system ? message.channel.send(response) : message.reply(response)),
			);
	}
});

defineEvent("messageUpdate", async (_, message) => {
	if (message.partial) return;

	const found = autoResponses.get(message.id);
	if (!found && 1 > +"0" /* TODO: only return if there's new messages */) return;

	const response = await handleMutatable(message);
	const data = typeof response === "object" && !Array.isArray(response) && response;
	if (found) await found.edit(data || { content: ".", components: [], embeds: [], files: [] });
	else if (data)
		autoResponses.set(
			message.id,
			await (message.system ? message.channel.send(data) : message.reply(data)),
		);
});

async function handleMutatable(
	message: Message,
): Promise<BaseMessageOptions | true | [BaseMessageOptions, ...(number | string)[]] | undefined> {
	const blocks = Array.from(message.content.matchAll(/```sb(2|3|3hc)?\n+([\s\S]*?)\n*```/g)).slice(
		0,
		10,
	);
	const userSettings = await getFontForUser(message.author.id);

	if (blocks.length > 0) {
		const files = await Promise.all(
			blocks.map(async (block) => {
				const type = block[1] ?? "3";
				const content = block[2] || block[1];
				let font: keyof typeof fonts = userSettings.defaultFontSb3 as keyof typeof fonts;

				if (type === "2") {
					font = userSettings.defaultFontSb2 as keyof typeof fonts;
				}
				const fontOverride = (() => {
					const match = content?.match(/::\s*font ([\w \t]+)/);
					const font = Object.keys(fonts).find(
						(f) => f.toLowerCase() === match?.[1]?.toLowerCase().replaceAll(" ", ""),
					);
					return font as keyof typeof fonts | undefined;
				})();
				return await scratchBlocksToImage(content?.replace(/::\s*font ([\w \t]+)/, "") ?? "", type, fontOverride ?? font);
			}),
		);

		return {
			content: "",
			files: files,
			embeds: [],
			components: [],
		};
	} else {
		return true;
	}
}

defineEvent("messageDelete", async (message) => {
	const found = autoResponses.get(message.id);
	if (found) await found.delete();

	const reference =
		found?.id ?? [...autoResponses.entries()].find(([, { id }]) => id === message.id)?.[0];
	if (reference) autoResponses.delete(reference);
});

const autoResponses = new Map<Snowflake, Message>();
