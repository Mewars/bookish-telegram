import { validateClosedBetaEnvironment } from './closed-beta-env.mjs';

validateClosedBetaEnvironment(process.env);
console.log('Closed beta configuration validated for Ryadom-Test (no keys printed).');
