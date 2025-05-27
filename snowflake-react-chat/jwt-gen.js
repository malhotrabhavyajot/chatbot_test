const crypto = require('crypto')
const fs = require('fs');
var jwt = require('jsonwebtoken');

var privateKeyFile = fs.readFileSync('rsa_key.p8');    //change this as required
var mypassphrase = 'CeDzue48qiqbzIu';   //change this as required
var qualified_username = "WUQZVQT-DKC22677.MALHOTRABHAVYAJOT"; //change this as required

privateKeyObject = crypto.createPrivateKey({ key: privateKeyFile, format: 'pem', passphrase: mypassphrase });
var privateKey = privateKeyObject.export({ format: 'pem', type: 'pkcs8' });

publicKeyObject = crypto.createPublicKey({ key: privateKey, format: 'pem' });
var publicKey = publicKeyObject.export({ format: 'der', type: 'spki' });
var publicKeyFingerprint = 'SHA256:' + crypto.createHash('sha256') .update(publicKey, 'utf8') .digest('base64');

var signOptions = {
iss : qualified_username+ '.' + publicKeyFingerprint,
sub: qualified_username,
exp: Math.floor(Date.now() / 1000) + (60 * 60),
};

console.log("\n" );
console.log(signOptions);
console.log("\n" );

var token = jwt.sign(signOptions,  privateKey, {algorithm:'RS256'});
console.log("\nToken: \n\n" + token);