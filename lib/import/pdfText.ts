/**
 * Server-only: plain text of a PDF via pdf2json (same library as /api/profile/extract).
 * Returns "" instead of throwing: text is a convenience for imported documents.
 */
export async function pdfToText(buffer: Buffer, timeoutMs = 10_000): Promise<string> {
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	const PDFParser = require("pdf2json");
	const parse = new Promise<string>((resolve) => {
		const parser = new PDFParser(null, true);
		parser.on("pdfParser_dataError", () => resolve(""));
		parser.on("pdfParser_dataReady", () => {
			try {
				const raw: string = parser.getRawTextContent() || "";
				resolve(
					raw
						.replace(/-+Page \(\d+\) Break-+/g, "\n")
						.replace(/\r/g, "")
						.replace(/[ \t]+\n/g, "\n")
						.replace(/\n{3,}/g, "\n\n")
						.trim()
				);
			} catch {
				resolve("");
			}
		});
		parser.parseBuffer(buffer);
	});
	const timeout = new Promise<string>((resolve) => setTimeout(() => resolve(""), timeoutMs));
	return Promise.race([parse, timeout]);
}

export const isPdf = (buf: Buffer) => buf.length > 4 && buf.subarray(0, 5).toString("latin1") === "%PDF-";
