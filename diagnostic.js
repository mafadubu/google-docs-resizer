const { google } = require('googleapis');
const docs = google.docs('v1');
// This is a hacky way to see what the library thinks are valid request keys
// Usually it's in the types, but we can't easily see types here.
// But we can check the discovery doc if we want.
console.log("Checking discovery doc...");
// Note: We can't easily fetch it from here, but we can check the local library instance if it exposes them.
// Let's just try to log the docs object structure.
console.log(Object.keys(docs.documents.batchUpdate || {}));
