import tls from 'tls';
import fs from 'fs';

const socket = tls.connect({
  host: 'your-aiven-host.aivencloud.com',
  port: 11497,
  rejectUnauthorized: false
}, () => {
  let cert = socket.getPeerCertificate(true);
  console.log('Peer Subject:', cert.subject);
  console.log('Peer Issuer:', cert.issuer);
  let chain = [];
  while (cert && cert.raw) {
    const pem = `-----BEGIN CERTIFICATE-----\n${cert.raw.toString('base64').match(/.{1,64}/g).join('\n')}\n-----END CERTIFICATE-----\n`;
    chain.push(pem);
    if (cert.issuerCertificate && cert.issuerCertificate !== cert) {
      cert = cert.issuerCertificate;
    } else {
      break;
    }
  }
  console.log('Certificates in chain:', chain.length);
  if (chain.length > 0) {
    fs.writeFileSync('aiven-ca.pem', chain[chain.length - 1]);
    console.log('Saved CA certificate to aiven-ca.pem');
  }
  socket.end();
});

socket.on('error', (err) => {
  console.error('TLS error:', err.message);
});
