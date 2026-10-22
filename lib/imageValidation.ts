const MAX_PIXELS = 25_000_000;

type ImageInfo = { contentType: "image/jpeg" | "image/png" | "image/webp"; width: number; height: number };

function jpegSize(buffer: Buffer) {
	let offset = 2;
	while (offset + 9 < buffer.length) {
		if (buffer[offset] !== 0xff) {
			offset += 1;
			continue;
		}
		const marker = buffer[offset + 1];
		if (marker >= 0xc0 && marker <= 0xc3) {
			return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
		}
		const length = buffer.readUInt16BE(offset + 2);
		if (length < 2) break;
		offset += length + 2;
	}
	return null;
}

function detect(buffer: Buffer): ImageInfo | null {
	if (buffer.length >= 24 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
		return { contentType: "image/png", width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
	}
	if (buffer.length >= 12 && buffer[0] === 0xff && buffer[1] === 0xd8) {
		const size = jpegSize(buffer);
		return size ? { contentType: "image/jpeg", ...size } : null;
	}
	if (
		buffer.length >= 30 &&
		buffer.toString("ascii", 0, 4) === "RIFF" &&
		buffer.toString("ascii", 8, 12) === "WEBP"
	) {
		const format = buffer.toString("ascii", 12, 16);
		if (format === "VP8X") {
			return {
				contentType: "image/webp",
				width: 1 + buffer.readUIntLE(24, 3),
				height: 1 + buffer.readUIntLE(27, 3),
			};
		}
		if (format === "VP8 " && buffer.length >= 30) {
			return {
				contentType: "image/webp",
				width: buffer.readUInt16LE(26) & 0x3fff,
				height: buffer.readUInt16LE(28) & 0x3fff,
			};
		}
		if (format === "VP8L" && buffer.length >= 25) {
			const bits = buffer.readUInt32LE(21);
			return {
				contentType: "image/webp",
				width: (bits & 0x3fff) + 1,
				height: ((bits >> 14) & 0x3fff) + 1,
			};
		}
	}
	return null;
}

export function validateImageBuffer(buffer: Buffer, claimedType?: string): ImageInfo {
	const info = detect(buffer);
	if (!info || info.width < 1 || info.height < 1) {
		throw new Error("The upload is not a valid JPG, PNG, or WEBP image.");
	}
	if (claimedType && claimedType.toLowerCase() !== info.contentType) {
		throw new Error("The image contents do not match its declared file type.");
	}
	if (info.width * info.height > MAX_PIXELS) {
		throw new Error("Image dimensions are too large.");
	}
	return info;
}
