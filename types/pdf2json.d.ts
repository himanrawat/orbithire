declare module "pdf2json" {
	class PDFParser {
		// context?: any, needRawText?: boolean | 0 | 1
		constructor(context?: any, needRawText?: boolean | 0 | 1);
		on(event: "pdfParser_dataError", callback: (err: any) => void): void;
		on(event: "pdfParser_dataReady", callback: (data: any) => void): void;
		parseBuffer(buffer: Buffer): void;
		getRawTextContent(): string;
	}

	export default PDFParser;
}
