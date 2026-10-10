// Android 11+ hides other apps from this one unless they are declared in <queries>.
// Declaring both WhatsApp apps lets the app see which are installed and ask the
// user which one to send a bill with.
const { withAndroidManifest } = require('expo/config-plugins');

const PACKAGES = ['com.whatsapp', 'com.whatsapp.w4b'];

function addWhatsAppQueries(manifest) {
  if (!Array.isArray(manifest.queries) || manifest.queries.length === 0) {
    manifest.queries = [{}];
  }
  const queries = manifest.queries[0];
  queries.package = queries.package || [];
  for (const name of PACKAGES) {
    if (!queries.package.some((p) => p.$ && p.$['android:name'] === name)) {
      queries.package.push({ $: { 'android:name': name } });
    }
  }
  return manifest;
}

module.exports = (config) =>
  withAndroidManifest(config, (c) => {
    addWhatsAppQueries(c.modResults.manifest);
    return c;
  });
module.exports.addWhatsAppQueries = addWhatsAppQueries;
