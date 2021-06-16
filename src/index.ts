import Imap from "imap";
import { simpleParser } from "mailparser";

import type { Config } from "imap";

type ImapOptions = { 
	mailbox?: string, 
	markSeen?: boolean 
}

export class ImapListener extends Imap {
	public mailbox: string;
	public markSeen: boolean;
	/**
	 * Listens for new emails, emits "mail" and "err" events.
	 * @param config
	 */
	constructor(config: Config, options?: ImapOptions) {
		super(config);
		this.mailbox = options?.mailbox || "INBOX";
		this.markSeen = options?.markSeen || true;
		this.on("mail", this.fetchUnseen);
	}
	start = () => new Promise<void>((res, rej) => {
		this.once("ready", () => {
			this.openBox(this.mailbox, false, (err) => {
				if (err) rej(err);
				else res();
			});
		});
		this.connect();
	});
	stop = () => new Promise(res => {
		this.on("close", res);
		this.end();
	});

	fetchUnseen = () => {
		this.search(["UNSEEN"], (err, seachResults) => {
			if (err) return this.emit("error", err);

			if (!seachResults || seachResults.length === 0) return;

			const fetch = this.fetch(seachResults, {
				markSeen: this.markSeen,
				bodies: "",
			});
			fetch.on("message", (msg) => {
				msg.once("body", (stream) => {
					simpleParser(stream, (err, mail) => {
						if (err) this.emit("error", err);
						else this.emit("email", mail);
					});
				});
			});
			fetch.once("error", (err) => this.emit("error", err));
		});
	};
}
