import { describe, expect, it } from "vitest";
import { validateImageBuffer } from "@/lib/imageValidation";

function pngHeader(width: number, height: number) {
	const buffer = Buffer.alloc(24);
	Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(buffer);
	buffer.writeUInt32BE(width, 16);
	buffer.writeUInt32BE(height, 20);
	return buffer;
}

describe("image upload validation", () => {
	it("reads dimensions from image contents", () => {
		expect(validateImageBuffer(pngHeader(800, 600), "image/png")).toEqual({
			contentType: "image/png",
			width: 800,
			height: 600,
		});
	});

	it("rejects MIME spoofing and decompression bombs", () => {
		expect(() => validateImageBuffer(pngHeader(800, 600), "image/jpeg")).toThrow(/do not match/);
		expect(() => validateImageBuffer(pngHeader(10_000, 10_000), "image/png")).toThrow(/dimensions/);
	});
});
