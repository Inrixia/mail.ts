import Imap from "imap";
import { simpleParser } from "mailparser";

import type { Config } from "imap";
import type { ParsedMail } from "mailparser";

type ImapOptions = { 
	mailbox?: string, 
	markSeen?: boolean 
}

export interface ImapListener extends Imap {
	on(event: "error", listener: (message: Error) => void): this;
	/**
	 * Emitted when new mail has been parsed.
	 */
	on(event: "email", listener: (mail: ParsedMail) => void): this;
	/**
	 * Emitted when new mail arrives in the currently open mailbox.
	 */
	on(event: "mail", listener: (numNewMsgs: number) => void): this;
	/**
	 * Emitted when a connection to the server has been made and authentication was successful.
	 */
	on(event: "ready", listener: () => void): this;
	/**
	 * Emitted when the connection has completely closed.
	 */
	on(event: "close", listener: () => void): this;
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
			this.openBox(this.mailbox, false, err => {
				if (err) rej(err);
				else res();
			});
		});
		this.connect();
	});
	stop = () => new Promise<void>(res => {
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
			fetch.on("message", msg => {
				msg.once("body", stream => {
					simpleParser(stream, (err, mail) => {
						if (err) this.emit("error", err);
						else this.emit("email", mail);
					});
				});
			});
			fetch.on("error", err => this.emit("error", err));
		});
	};
}
