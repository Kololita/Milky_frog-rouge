// GLTFLoader decodes embedded textures through fetch(blob:...). Both image and
// connection policies must allow these in-memory model resources.
const contentSecurityPolicy="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' blob:; worker-src 'self' blob:; object-src 'none'";
module.exports={contentSecurityPolicy};
