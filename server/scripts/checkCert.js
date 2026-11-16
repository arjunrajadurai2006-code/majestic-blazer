import tls from 'tls';
import fs from 'fs';
import 'dotenv/config';

const host = process.env.DB_HOST || 'your-aiven-host.aivencloud.com';
const port = Number(process.env.DB_PORT) || 11497;

const socket = tls.connect({
  host,
  port,
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
